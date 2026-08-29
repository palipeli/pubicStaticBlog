const ALLOWED_PATHS = [
    /^Users$/,
    /^Users\/[A-Za-z0-9_-]+$/,
    /^Users\/[A-Za-z0-9_-]+\/Views$/,
    /^Users\/[A-Za-z0-9_-]+\/Items$/,
    /^Items$/,
    /^Artists$/,
    /^Albums$/,
    /^MusicGenres$/,
    /^Genres$/,
    /^Items\/[A-Za-z0-9_-]+\/Images\/(Primary|Backdrop|Logo|Thumb|Disc)(\/\d+)?$/,
    /^Audio\/[A-Za-z0-9_-]+\/(stream|universal)$/
];
const GUID_RE = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
const STRIP_PARAMS = ['api_key', 'apikey', 'userid', 'fields', 'includeitemtypes', 'static', 'enablehiddenelements', 'enableinterruptions', 'enablestreaminginfo'];
const MAX_LIMIT = 200;
let resolvedUserCache = null;
function json(data, status, cacheControl) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': cacheControl || 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Robots-Tag': 'noindex, nofollow'
        }
    });
}
async function requestRateLimited(env, request, scope, limit, windowSeconds) {
    if (!env.RATE_LIMIT_KV) {
        return false;
    }
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = 'rl:' + scope + ':' + ip + ':' + bucket;
    const count = parseInt((await env.RATE_LIMIT_KV.get(key)) || '0', 10);
    if (count >= limit) {
        return true;
    }
    await env.RATE_LIMIT_KV.put(key, String(count + 1), {expirationTtl: windowSeconds + 1});
    return false;
}
function upstreamBase(env) {
    return String(env.JELLYFIN_URL).replace(/\/+$/, '');
}
async function upstreamFetch(env, path, searchParams, request) {
    const target = new URL(upstreamBase(env) + '/' + path);
    for (const [key, value] of searchParams.entries()) {
        target.searchParams.set(key, value);
    }
    const headers = new Headers();
    const range = request.headers.get('Range');
    if (range) {
        headers.set('Range', range);
    }
    headers.set('X-Emby-Token', env.JELLYFIN_TOKEN);
    headers.set('Accept', request.headers.get('Accept') || '*/*');
    return fetch(target.toString(), {method: request.method === 'HEAD' ? 'HEAD' : 'GET', headers: headers, redirect: 'manual'});
}
async function resolveUserId(env, request) {
    const configured = String(env.JELLYFIN_USER || '').trim();
    if (configured && GUID_RE.test(configured)) {
        return configured;
    }
    if (resolvedUserCache && (!configured || resolvedUserCache.name === configured)) {
        return resolvedUserCache.id;
    }
    let response;
    try {
        response = await upstreamFetch(env, 'Users', new URLSearchParams(), request);
    } catch (err) {
        return '';
    }
    if (!response.ok) {
        return '';
    }
    let users;
    try {
        users = await response.json();
    } catch (err) {
        return '';
    }
    const list = Array.isArray(users) ? users : [];
    const match = configured
        ? list.find(function(u) { return String(u.Name || '').toLowerCase() === configured.toLowerCase(); })
        : list[0];
    if (match && match.Id) {
        resolvedUserCache = {name: configured || String(match.Name || ''), id: match.Id};
        return match.Id;
    }
    return '';
}
function sanitizeParams(path, search, configuredUser) {
    const params = new URLSearchParams(search);
    for (const key of Array.from(params.keys())) {
        const lower = key.toLowerCase();
        if (STRIP_PARAMS.indexOf(lower) !== -1 || lower.indexOf('transcoding') === 0 || lower.indexOf('maxstreaming') === 0) {
            params.delete(key);
        }
    }
    params.set('UserId', configuredUser);
    if (/^(Items|Users\/[^/]+\/Items)$/.test(path)) {
        params.set('IncludeItemTypes', 'Audio');
        params.set('Recursive', 'true');
    }
    if (path.indexOf('Audio/') === 0) {
        params.set('static', 'true');
    }
    let limit = parseInt(params.get('Limit') || '50', 10);
    if (!isFinite(limit) || limit < 1) {
        limit = 50;
    }
    params.set('Limit', String(Math.min(limit, MAX_LIMIT)));
    return params;
}
function crossSiteBlocked(request) {
    const site = request.headers.get('Sec-Fetch-Site');
    return site !== null && site !== 'same-origin' && site !== 'none';
}
export async function onRequest(context) {
    const {request, env} = context;
    const url = new URL(request.url);
    const ROUTE_PREFIX = '/api/jellyfin';
    if (url.pathname !== ROUTE_PREFIX && !url.pathname.startsWith(ROUTE_PREFIX + '/')) {
        return json({error: 'Not found'}, 404);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return json({error: 'Method not allowed'}, 405);
    }
    if (!env.JELLYFIN_URL || !env.JELLYFIN_TOKEN) {
        return json({error: 'Jellyfin proxy is not configured'}, 503);
    }
    if (crossSiteBlocked(request)) {
        return json({error: 'Cross-site requests not allowed'}, 403);
    }
    let path = '';
    try {
        path = decodeURIComponent(url.pathname.slice(ROUTE_PREFIX.length)).replace(/^\/+|\/+$/g, '');
    } catch (err) {
        return json({error: 'Malformed path'}, 400);
    }
    if (!path) {
        return json({proxy: 'jellyfin', ok: true});
    }
    if (path.indexOf('..') !== -1 || !ALLOWED_PATHS.some(function(re) { return re.test(path); })) {
        return json({error: 'Path not allowed'}, 403);
    }
    const isStream = path.indexOf('Audio/') === 0;
    const isImage = path.indexOf('/Images/') !== -1;
    const scope = isStream ? 'jf-stream' : 'jf-meta';
    const limit = isStream ? 60 : 120;
    if (await requestRateLimited(env, request, scope, limit, 60)) {
        return json({error: 'Too many requests, try again later'}, 429);
    }
    const configuredUser = await resolveUserId(env, request);
    if (!configuredUser) {
        return json({error: 'Jellyfin user unavailable'}, 503);
    }
    const userSegment = path.match(/^Users\/([^/]+)/);
    if (userSegment && userSegment[1] !== configuredUser) {
        path = 'Users/' + configuredUser + path.slice(userSegment[0].length);
    }
    if (path === 'Users' || /^Users\/[A-Za-z0-9_-]+$/.test(path)) {
        const response = await upstreamFetch(env, 'Users', new URLSearchParams(), request).catch(function() { return null; });
        if (!response || !response.ok) {
            return json({error: 'Upstream request failed'}, 502);
        }
        let users;
        try {
            users = await response.json();
        } catch (err) {
            return json({error: 'Upstream request failed'}, 502);
        }
        const safe = (Array.isArray(users) ? users : [])
            .filter(function(u) { return u.Id === configuredUser; })
            .map(function(u) { return {Id: u.Id, Name: u.Name}; });
        if (path === 'Users') {
            return json(safe, 200, 'private, max-age=60');
        }
        return safe.length ? json(safe[0], 200, 'private, max-age=60') : json({error: 'Not found'}, 404);
    }
    const params = sanitizeParams(path, url.search, configuredUser);
    let response;
    try {
        response = await upstreamFetch(env, path, params, request);
    } catch (err) {
        return json({error: 'Upstream unreachable'}, 502);
    }
    if (response.status >= 300 && response.status < 400) {
        return json({error: 'Redirects not allowed'}, 502);
    }
    const headers = new Headers();
    const contentType = response.headers.get('Content-Type');
    if (contentType) {
        headers.set('Content-Type', contentType);
    }
    for (const h of ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
        const value = response.headers.get(h);
        if (value) {
            headers.set(h, value);
        }
    }
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (isStream) {
        headers.set('Cache-Control', 'no-store');
    } else if (isImage) {
        headers.set('Cache-Control', 'public, max-age=86400');
    } else {
        headers.set('Cache-Control', 'private, max-age=60');
    }
    return new Response(response.body, {status: response.status, headers: headers});
}
