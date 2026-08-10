const API_BASE = 'https://api.github.com';
const ALLOWED_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;

function json(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: {'Content-Type': 'application/json; charset=utf-8'}
    });
}

function secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    let diff = a.length ^ b.length;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        diff |= (i < a.length ? a.charCodeAt(i) : 0) ^ (i < b.length ? b.charCodeAt(i) : 0);
    }
    return diff === 0;
}

function isAuthorized(request, env) {
    const provided = request.headers.get('Authorization') || '';
    const tokens = String(env.ADMIN_TOKEN || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean);
    return tokens.some(function(t) {
        return secureCompare(provided, 'Bearer ' + t);
    });
}

function authMisconfigured(env) {
    const tokens = String(env.ADMIN_TOKEN || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean);
    return !tokens.length || tokens.some(function(t) { return t.length < 32; });
}

async function authFailureRateLimited(env, request) {
    if (!env.RATE_LIMIT_KV) {
        return false;
    }
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const bucket = Math.floor(Date.now() / 1000 / 900);
    const key = 'authfail:' + ip + ':' + bucket;
    const count = parseInt((await env.RATE_LIMIT_KV.get(key)) || '0', 10);
    if (count >= 10) {
        return true;
    }
    await env.RATE_LIMIT_KV.put(key, String(count + 1), {expirationTtl: 901});
    return false;
}

async function checkDailyQuota(env, scope, limit) {
    if (!env.QUOTA_KV) {
        return false;
    }
    const day = new Date().toISOString().slice(0, 10);
    const count = parseInt((await env.QUOTA_KV.get('quota:' + scope + ':' + day)) || '0', 10);
    return count >= limit;
}

async function recordDailyQuota(env, scope) {
    if (!env.QUOTA_KV) {
        return;
    }
    const day = new Date().toISOString().slice(0, 10);
    const key = 'quota:' + scope + ':' + day;
    const count = parseInt((await env.QUOTA_KV.get(key)) || '0', 10);
    await env.QUOTA_KV.put(key, String(count + 1), {expirationTtl: 90000});
}

function githubHeaders(token) {
    return {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'pubic-static-blog-admin'
    };
}

function slugify(str) {
    const base = String(str)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')
        .slice(0, 80);
    return base || 'image';
}

async function githubGet(env, path) {
    const owner = env.GITHUB_OWNER || 'palipeli';
    const repo = env.GITHUB_REPO || 'pubicStaticBlog';
    const response = await fetch(API_BASE + '/repos/' + owner + '/' + repo + '/contents/' + path, {
        headers: githubHeaders(env.GITHUB_TOKEN)
    });
    if (response.status === 404) {
        return {notFound: true};
    }
    if (!response.ok) {
        console.error('GitHub GET ' + path + ' failed: ' + response.status);
        return {error: 'GitHub request failed', status: 502};
    }
    return response.json();
}

async function githubPut(env, path, content, sha, message) {
    const owner = env.GITHUB_OWNER || 'palipeli';
    const repo = env.GITHUB_REPO || 'pubicStaticBlog';
    const body = {message: message, content: content};
    if (sha) {
        body.sha = sha;
    }
    const response = await fetch(API_BASE + '/repos/' + owner + '/' + repo + '/contents/' + path, {
        method: 'PUT',
        headers: githubHeaders(env.GITHUB_TOKEN),
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        let detail = '';
        try {
            detail = (await response.json()).message || '';
        } catch (err) {
            // ignore parse failure
        }
        console.error('GitHub PUT ' + path + ' failed: ' + response.status + (detail ? ' - ' + detail : ''));
        return {
            error: 'GitHub request failed',
            status: 502
        };
    }
    return response.json();
}

function sniffImage(bytes, mime) {
    if (bytes.length < 12) {
        return false;
    }
    if (mime === 'image/png') {
        return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    }
    if (mime === 'image/jpeg') {
        return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (mime === 'image/gif') {
        return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
    }
    if (mime === 'image/webp') {
        return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    }
    return false;
}

function checkImageDimensions(bytes, mime) {
    const MAX_DIMENSION = 8192;
    const MAX_PIXELS = 30000000;
    let width = 0;
    let height = 0;
    if (mime === 'image/png') {
        if (bytes.length < 24) return true;
        width = bytes[16] * 16777216 + bytes[17] * 65536 + bytes[18] * 256 + bytes[19];
        height = bytes[20] * 16777216 + bytes[21] * 65536 + bytes[22] * 256 + bytes[23];
    } else if (mime === 'image/gif') {
        if (bytes.length < 10) return true;
        width = bytes[6] | (bytes[7] << 8);
        height = bytes[8] | (bytes[9] << 8);
    } else if (mime === 'image/jpeg') {
        let i = 2;
        while (i + 9 < bytes.length) {
            if (bytes[i] !== 0xFF) {
                i++;
                continue;
            }
            const marker = bytes[i + 1];
            if (marker === 0x00 || marker === 0xFF) {
                i += 2;
                continue;
            }
            if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
                i += 2;
                continue;
            }
            if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                height = (bytes[i + 5] << 8) | bytes[i + 6];
                width = (bytes[i + 7] << 8) | bytes[i + 8];
                break;
            }
            const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
            if (segLen < 2) break;
            i += 2 + segLen;
        }
    } else if (mime === 'image/webp') {
        if (bytes.length < 30) return true;
        const fourcc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
        if (fourcc === 'VP8X') {
            width = 1 + (bytes[24] * 65536 + bytes[25] * 256 + bytes[26]);
            height = 1 + (bytes[28] * 65536 + bytes[29] * 256 + bytes[30]);
        } else if (fourcc === 'VP8L') {
            const v = bytes[21] + bytes[22] * 256 + bytes[23] * 65536 + bytes[24] * 16777216;
            width = 1 + (v % 16384);
            height = 1 + (Math.floor(v / 16384) % 16384);
        } else if (fourcc === 'VP8 ') {
            width = bytes[23] | ((bytes[24] & 0x3F) << 8);
            height = bytes[25] | ((bytes[26] & 0x3F) << 8);
        } else {
            return true;
        }
    } else {
        return true;
    }
    if (!width || !height) {
        return true;
    }
    return width <= MAX_DIMENSION && height <= MAX_DIMENSION && width * height <= MAX_PIXELS;
}

export async function onRequestPost(context) {
    const {request, env} = context;

    if (authMisconfigured(env)) {
        return json({error: 'Server auth is misconfigured: set ADMIN_TOKEN (min 32 chars) and restart'}, 503);
    }
    if (!isAuthorized(request, env)) {
        if (await authFailureRateLimited(env, request)) {
            return json({error: 'Too many failed attempts, try again later'}, 429);
        }
        return json({error: 'Unauthorized'}, 401);
    }
    if (!env.GITHUB_TOKEN) {
        return json({error: 'Server is missing the GITHUB_TOKEN secret'}, 500);
    }
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
        return json({error: 'Content-Type must be application/json'}, 415);
    }
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
        return json({error: 'Request body too large'}, 413);
    }
    if (await checkDailyQuota(env, 'upload', 200)) {
        return json({error: 'Daily upload quota reached, try again tomorrow'}, 429);
    }

    let payload;
    try {
        payload = await request.json();
    } catch (err) {
        return json({error: 'Invalid JSON body'}, 400);
    }

    const fileName = String(payload.name || '').trim();
    const dataUrl = String(payload.data || '');
    const dataUrlMatch = dataUrl.match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!fileName || !dataUrlMatch) {
        return json({error: 'name and a base64 data URL are required'}, 400);
    }

    const mime = dataUrlMatch[1].toLowerCase();
    if (!ALLOWED_TYPES.has(mime)) {
        return json({error: 'Unsupported image type: ' + mime}, 415);
    }

    const base64Data = dataUrlMatch[2].replace(/\s+/g, '');
    let bytes;
    try {
        const binary = atob(base64Data);
        bytes = Uint8Array.from(binary, function(ch) { return ch.charCodeAt(0); });
    } catch (err) {
        return json({error: 'Invalid base64 data'}, 400);
    }
    if (bytes.length === 0) {
        return json({error: 'Empty file'}, 400);
    }
    if (bytes.length > MAX_BYTES) {
        return json({error: 'Image too large (max 5MB)'}, 413);
    }
    if (!sniffImage(bytes, mime)) {
        return json({error: 'File contents do not match ' + mime}, 415);
    }
    if (!checkImageDimensions(bytes, mime)) {
        return json({error: 'Image dimensions are too large (max 8192x8192, 30MP)'}, 415);
    }

    const extension = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
    const base = slugify(fileName.replace(/\.[^.]+$/, ''));
    let name = base + '.' + extension;

    const listing = await githubGet(env, 'media');
    if (listing.error) {
        return json(listing, listing.status);
    }
    if (!listing.notFound && Array.isArray(listing)) {
        const existing = new Set(listing.map(function(entry) { return entry.name; }));
        let counter = 2;
        while (existing.has(name)) {
            name = base + '-' + counter + '.' + extension;
            counter++;
        }
    }

    const put = await githubPut(env, 'media/' + name, base64Data, null, 'chore(media): add ' + name);
    if (put.error) {
        return json(put, put.status);
    }
    await recordDailyQuota(env, 'upload');

    return json({ok: true, url: '/media/' + name, name: name});
}
