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
    /^Audio\/[A-Za-z0-9_-]+\/stream$/
];
const GUID_RE = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
const STRIP_PARAMS = ['api_key', 'apikey', 'userid', 'fields', 'includeitemtypes', 'static', 'enablehiddenelements', 'enableinterruptions', 'enablestreaminginfo'];
const MAX_LIMIT = 200;
const MAX_IMAGE_WIDTH = 800;
const MAX_IMAGE_QUALITY = 90;
const FORCED_TRANSCODE = {container: 'mp4', audioCodec: 'aac', audioBitRate: 256000};
const FORCED_TRANSCODE_SAFARI = {container: 'mp3', audioCodec: 'mp3', audioBitRate: 256000};
const START_TICKS_RE = /^\d{1,15}$/;
function isSafariRequest(request) {
    const ua = request.headers.get('User-Agent') || '';
    return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Android/.test(ua);
}
function forcedTranscodeFor(request) {
    return isSafariRequest(request) ? FORCED_TRANSCODE_SAFARI : FORCED_TRANSCODE;
}
let resolvedUserCache = null;
let usersListCacheMem = null;
let usersListCacheMemTs = 0;
function json(data, status, cacheControl) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': cacheControl || 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Robots-Tag': 'noindex, nofollow',
            'Vary': 'Sec-Fetch-Site, Origin',
            'Cross-Origin-Resource-Policy': 'same-origin',
            'Referrer-Policy': 'no-referrer'
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
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch) headers.set('If-None-Match', ifNoneMatch);
    const ifModSince = request.headers.get('If-Modified-Since');
    if (ifModSince) headers.set('If-Modified-Since', ifModSince);
    const ifRange = request.headers.get('If-Range');
    if (ifRange) headers.set('If-Range', ifRange);
    headers.set('X-Emby-Token', env.JELLYFIN_TOKEN);
    headers.set('Accept', request.headers.get('Accept') || '*/*');
    return fetch(target.toString(), {method: request.method === 'HEAD' ? 'HEAD' : 'GET', headers: headers, redirect: 'manual'});
}
async function resolveUserId(env, request, prefetched) {
    const configured = String(env.JELLYFIN_USER || '').trim();
    if (configured && GUID_RE.test(configured)) {
        return configured;
    }
    if (resolvedUserCache && (!configured || resolvedUserCache.name === configured)) {
        return resolvedUserCache.id;
    }
    let users = prefetched;
    if (!users) {
        if (usersListCacheMem && Date.now() - usersListCacheMemTs < 60000) {
            users = usersListCacheMem;
        } else {
            let response;
            try {
                response = await upstreamFetch(env, 'Users', new URLSearchParams(), request);
            } catch (err) {
                return '';
            }
            if (!response.ok) {
                return '';
            }
            try {
                users = await response.json();
            } catch (err) {
                return '';
            }
            if (Array.isArray(users)) {
                usersListCacheMem = users;
                usersListCacheMemTs = Date.now();
            }
        }
    } else if (Array.isArray(users) && !usersListCacheMem) {
        usersListCacheMem = users;
        usersListCacheMemTs = Date.now();
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
function getCI(params, nameLower) {
    for (const k of Array.from(params.keys())) {
        if (k.toLowerCase() === nameLower) return params.get(k);
    }
    return null;
}
function deleteCI(params, nameLower) {
    for (const k of Array.from(params.keys())) {
        if (k.toLowerCase() === nameLower) params.delete(k);
    }
}
function sanitizeParams(path, search, configuredUser, request) {
    const params = new URLSearchParams(search);
    for (const key of Array.from(params.keys())) {
        const lower = key.toLowerCase();
        if (STRIP_PARAMS.indexOf(lower) !== -1 || lower.indexOf('transcoding') === 0 || lower.indexOf('maxstreaming') === 0) {
            params.delete(key);
        }
    }
    deleteCI(params, 'recursive');
    deleteCI(params, 'includeitemtypes');
    params.set('UserId', configuredUser);
    if (/^(Items|Users\/[^\/]+\/Items)$/.test(path)) {
        params.set('IncludeItemTypes', 'Audio');
        params.set('Recursive', 'true');
    }
    if (path.indexOf('Audio/') === 0) {
        const ft = forcedTranscodeFor(request);
        if (ft) {
            params.set('static', 'false');
            params.set('container', ft.container);
            params.set('audioCodec', ft.audioCodec);
            params.set('audioBitRate', String(ft.audioBitRate));
            const rawTicks = getCI(params, 'starttimeticks');
            deleteCI(params, 'starttimeticks');
            params.delete('StartTimeTicks');
            params.delete('startTimeTicks');
            const st = (rawTicks || '').trim();
            if (START_TICKS_RE.test(st)) {
                params.set('startTimeTicks', st);
            }
        } else {
            params.set('static', 'true');
        }
    }
    if (path.indexOf('/Images/') !== -1) {
        const rawW = getCI(params, 'maxwidth');
        const rawH = getCI(params, 'maxheight');
        const rawQ = getCI(params, 'quality');
        deleteCI(params, 'maxwidth');
        deleteCI(params, 'maxheight');
        deleteCI(params, 'quality');
        let w = parseInt(rawW || '', 10);
        if (isFinite(w) && w > 0) {
            w = Math.min(w, MAX_IMAGE_WIDTH);
            params.set('maxWidth', String(w));
        } else if (rawW !== null) {
            params.set('maxWidth', '400');
        }
        let h = parseInt(rawH || '', 10);
        if (isFinite(h) && h > 0) {
            h = Math.min(h, MAX_IMAGE_WIDTH);
            params.set('maxHeight', String(h));
        }
        let q = parseInt(rawQ || '', 10);
        if (isFinite(q) && q >= 1 && q <= 100) {
            q = Math.min(q, MAX_IMAGE_QUALITY);
            params.set('quality', String(q));
        } else if (rawQ !== null) {
            params.set('quality', '80');
        }
        const st = getCI(params, 'searchterm');
        if (st !== null && String(st).length > 200) {
            deleteCI(params, 'searchterm');
            params.set('SearchTerm', String(st).slice(0, 200));
        }
    }
    const rawLimit = getCI(params, 'limit');
    deleteCI(params, 'limit');
    let limit = parseInt(rawLimit || '50', 10);
    if (!isFinite(limit) || limit < 1) {
        limit = 50;
    }
    params.set('Limit', String(Math.min(limit, MAX_LIMIT)));
    const rawSearchTerm = getCI(params, 'searchterm');
    if (rawSearchTerm !== null && String(rawSearchTerm).length > 200) {
        deleteCI(params, 'searchterm');
        params.set('SearchTerm', String(rawSearchTerm).slice(0, 200));
    }
    return params;
}
function crossSiteBlocked(request) {
    const site = request.headers.get('Sec-Fetch-Site');
    if (site !== null && site !== 'same-origin' && site !== 'none') return true;
    const origin = request.headers.get('Origin');
    if (origin) {
        try {
            const o = new URL(origin);
            const host = request.headers.get('Host') || new URL(request.url).host;
            if (o.host !== host) return true;
        } catch (e) {}
    } else {
        const referer = request.headers.get('Referer');
        if (referer) {
            try {
                const r = new URL(referer);
                const host = request.headers.get('Host') || new URL(request.url).host;
                if (r.host !== host) return true;
            } catch (e) {}
        }
    }
    return false;
}
function hasEncodedTraversal(rawPathname) {
    const lower = rawPathname.toLowerCase();
    if (lower.indexOf('%2e') !== -1 || lower.indexOf('%2f') !== -1 || lower.indexOf('%5c') !== -1) {
        try {
            const decoded = decodeURIComponent(rawPathname);
            const segs = decoded.split('/');
            for (let i = 0; i < segs.length; i++) {
                if (segs[i] === '..' || segs[i] === '.') return true;
            }
            if (decoded.indexOf('\u0000') !== -1) return true;
        } catch (e) {
            return true;
        }
        const afterDecode = lower.replace(/%2e/g, '.').replace(/%2f/g, '/').replace(/%5c/g, '/');
        if (afterDecode.indexOf('..') !== -1) return true;
    }
    return false;
}
export async function onRequest(context) {
    const {request, env} = context;
    const url = new URL(request.url);
    const ROUTE_PREFIX = '/api/jellyfin';
    const rawUrl = request.url;
    const qIdx = rawUrl.indexOf('?');
    const hIdx = rawUrl.indexOf('#');
    let rawEnd = rawUrl.length;
    if (qIdx !== -1) rawEnd = qIdx;
    else if (hIdx !== -1) rawEnd = hIdx;
    const originLen = url.origin.length;
    const rawPathname = rawUrl.slice(originLen, rawEnd);
    if (hasEncodedTraversal(rawPathname)) {
        return json({error: 'Malformed path'}, 400);
    }
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
    if (path.indexOf('Audio/') === 0 && path.endsWith('/universal')) {
        path = path.slice(0, -'universal'.length) + 'stream';
    }
    const segs = path.split('/');
    for (let i = 0; i < segs.length; i++) {
        if (segs[i] === '..' || segs[i] === '.') {
            return json({error: 'Path not allowed'}, 403);
        }
        if (segs[i].indexOf('\u0000') !== -1) return json({error: 'Path not allowed'}, 403);
    }
    if (!ALLOWED_PATHS.some(function(re) { return re.test(path); })) {
        return json({error: 'Path not allowed'}, 403);
    }
    const isStream = path.indexOf('Audio/') === 0;
    const isImage = path.indexOf('/Images/') !== -1;
    const scope = isStream ? 'jf-stream' : 'jf-meta';
    const limit = isStream ? 60 : 120;
    if (await requestRateLimited(env, request, scope, limit, 60)) {
        return json({error: 'Too many requests, try again later'}, 429);
    }
    let prefetchedUsers = null;
    let didPrefetchBranch = false;
    if (path === 'Users' || /^Users\/[A-Za-z0-9_-]+$/.test(path)) {
        if (usersListCacheMem && Date.now() - usersListCacheMemTs < 60000) {
            prefetchedUsers = usersListCacheMem;
        } else {
            try {
                const pr = await upstreamFetch(env, 'Users', new URLSearchParams(), request);
                if (pr.ok) {
                    try { prefetchedUsers = await pr.json(); } catch (e) { prefetchedUsers = null; }
                    if (Array.isArray(prefetchedUsers)) {
                        usersListCacheMem = prefetchedUsers;
                        usersListCacheMemTs = Date.now();
                    }
                }
            } catch (e) {}
        }
        didPrefetchBranch = true;
    }
    const configuredUser = await resolveUserId(env, request, prefetchedUsers);
    if (!configuredUser) {
        return json({error: 'Jellyfin user unavailable'}, 503);
    }
    const userSegment = path.match(/^Users\/([^/]+)/);
    if (userSegment && userSegment[1] !== configuredUser) {
        path = 'Users/' + configuredUser + path.slice(userSegment[0].length);
    }
    if (path === 'Users' || /^Users\/[A-Za-z0-9_-]+$/.test(path)) {
        let users = prefetchedUsers;
        if (!users) {
            const response = await upstreamFetch(env, 'Users', new URLSearchParams(), request).catch(function() { return null; });
            if (!response || !response.ok) {
                return json({error: 'Upstream request failed'}, 502);
            }
            try {
                users = await response.json();
            } catch (err) {
                return json({error: 'Upstream request failed'}, 502);
            }
            if (Array.isArray(users)) {
                usersListCacheMem = users;
                usersListCacheMemTs = Date.now();
            }
        }
        const safe = (Array.isArray(users) ? users : [])
            .filter(function(u) { return u.Id === configuredUser; })
            .map(function(u) { return {Id: u.Id, Name: u.Name}; });
        if (path === 'Users') {
            return json(safe, 200, 'private, max-age=60');
        }
        return safe.length ? json(safe[0], 200, 'private, max-age=60') : json({error: 'Not found'}, 404);
    }
    const params = sanitizeParams(path, url.search, configuredUser, request);
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
    let contentType = response.headers.get('Content-Type');
    if (isStream && isSafariRequest(request)) {
        contentType = 'audio/mpeg';
        headers.set('Content-Type', contentType);
    } else if (contentType) {
        headers.set('Content-Type', contentType);
    }
    for (const h of ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
        const value = response.headers.get(h);
        if (value) {
            headers.set(h, value);
        }
    }
    if (isStream && isSafariRequest(request)) {
        headers.set('Accept-Ranges', 'bytes');
    }
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (isStream && isSafariRequest(request)) {
        headers.set('Vary', 'Sec-Fetch-Site, Origin, Accept, Range, User-Agent');
    } else {
        headers.set('Vary', 'Sec-Fetch-Site, Origin, Accept, Range');
    }
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    headers.set('Referrer-Policy', 'no-referrer');
    if (isStream) {
        headers.set('Cache-Control', 'no-store');
    } else if (isImage) {
        const inm = request.headers.get('If-None-Match');
        const ims = request.headers.get('If-Modified-Since');
        if ((inm && response.status === 304) || (ims && response.status === 304)) {
            headers.set('Cache-Control', 'public, max-age=86400');
            return new Response(null, {status: 304, headers: headers});
        }
        headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=86400');
    } else {
        headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
    }
    return new Response(response.body, {status: response.status, headers: headers});
}
