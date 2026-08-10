const API_BASE = 'https://api.github.com';
const ALLOWED_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;

function json(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: {'Content-Type': 'application/json; charset=utf-8'}
    });
}

function secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

function isAuthorized(request, env) {
    const expected = 'Bearer ' + (env.ADMIN_TOKEN || '');
    if (expected.length <= 7) {
        return false;
    }
    return secureCompare(request.headers.get('Authorization') || '', expected);
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
        return {error: 'GitHub GET ' + path + ' failed: ' + response.status, status: 502};
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
        return {
            error: 'GitHub PUT ' + path + ' failed: ' + response.status + (detail ? ' - ' + detail : ''),
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

export async function onRequestPost(context) {
    const {request, env} = context;

    if (!isAuthorized(request, env)) {
        return json({error: 'Unauthorized'}, 401);
    }
    if (!env.GITHUB_TOKEN) {
        return json({error: 'Server is missing the GITHUB_TOKEN secret'}, 500);
    }

    let payload;
    try {
        payload = await request.json();
    } catch (err) {
        return json({error: 'Invalid JSON body'}, 400);
    }

    const fileName = String(payload.name || '').trim();
    const dataUrl = String(payload.data || '');
    const dataUrlMatch = dataUrl.match(/^data:([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
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

    return json({ok: true, url: '/media/' + name, name: name});
}
