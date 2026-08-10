const API_BASE = 'https://api.github.com';
const ALLOWED_IMAGE_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_POST = 20;
const MAX_REQUEST_BYTES = 45 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 30 * 1024 * 1024;
const UPLOAD_PLACEHOLDER = '/__upload__/';

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

function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function base64ToUtf8(base64) {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, function(ch) { return ch.charCodeAt(0); });
    return new TextDecoder().decode(bytes);
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
    return base || 'post';
}

function escapeFrontmatterValue(value) {
    return String(value)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

function buildFrontmatter(fields) {
    return '---\n' +
        'title: "' + escapeFrontmatterValue(fields.title) + '"\n' +
        'date: "' + escapeFrontmatterValue(fields.date) + '"\n' +
        'category: "' + escapeFrontmatterValue(fields.category) + '"\n' +
        'icon: "' + escapeFrontmatterValue(fields.icon) + '"\n' +
        '---\n\n';
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

async function githubApi(env, method, path, body) {
    const owner = env.GITHUB_OWNER || 'palipeli';
    const repo = env.GITHUB_REPO || 'pubicStaticBlog';
    const response = await fetch(API_BASE + '/repos/' + owner + '/' + repo + '/' + path, {
        method: method,
        headers: githubHeaders(env.GITHUB_TOKEN),
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
        let detail = '';
        try {
            detail = (await response.json()).message || '';
        } catch (err) {
            // ignore parse failure
        }
        console.error('GitHub ' + method + ' ' + path + ' failed: ' + response.status + (detail ? ' - ' + detail : ''));
        return {
            error: 'GitHub request failed',
            status: 502
        };
    }
    return response.json();
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

function parseImage(raw, index) {
    if (!raw || typeof raw !== 'object') {
        return {error: 'images[' + index + '] must be an object'};
    }
    const name = String(raw.name || '').trim();
    const dataUrl = String(raw.data || '');
    const token = /^[A-Za-z0-9_-]{1,64}$/.test(String(raw.token || '')) ? String(raw.token) : '';
    const match = dataUrl.match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!name || !match) {
        return {error: 'images[' + index + ']: name and a base64 data URL are required'};
    }
    const mime = match[1].toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(mime)) {
        return {error: 'images[' + index + ']: unsupported image type ' + mime};
    }
    const base64Data = match[2].replace(/\s+/g, '');
    let bytes;
    try {
        const binary = atob(base64Data);
        bytes = Uint8Array.from(binary, function(ch) { return ch.charCodeAt(0); });
    } catch (err) {
        return {error: 'images[' + index + ']: invalid base64 data'};
    }
    if (bytes.length === 0) {
        return {error: 'images[' + index + ']: empty file'};
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
        return {error: 'images[' + index + ']: image too large (max 5MB)'};
    }
    if (!sniffImage(bytes, mime)) {
        return {error: 'images[' + index + ']: file contents do not match ' + mime};
    }
    if (!checkImageDimensions(bytes, mime)) {
        return {error: 'images[' + index + ']: image dimensions are too large (max 8192x8192, 30MP)'};
    }
    return {ok: true, token: token, name: name, mime: mime, base64Data: base64Data};
}

async function resolveMediaNames(env, images) {
    if (!images.length) {
        return {ok: true, names: []};
    }
    const listing = await githubGet(env, 'media');
    if (listing.error) {
        return listing;
    }
    const existing = new Set();
    if (!listing.notFound && Array.isArray(listing)) {
        listing.forEach(function(entry) {
            if (entry && entry.name) existing.add(entry.name);
        });
    }
    const names = [];
    images.forEach(function(image) {
        const extension = image.mime === 'image/jpeg' ? 'jpg' : image.mime.split('/')[1];
        const base = slugify(image.name.replace(/\.[^.]+$/, ''));
        let name = base + '.' + extension;
        let counter = 2;
        while (existing.has(name)) {
            name = base + '-' + counter + '.' + extension;
            counter++;
        }
        existing.add(name);
        names.push(name);
    });
    return {ok: true, names: names};
}

async function githubCreateBlob(env, base64Content) {
    const blob = await githubApi(env, 'POST', 'git/blobs', {
        content: base64Content,
        encoding: 'base64'
    });
    if (blob.error) return blob;
    if (!blob.sha) {
        return {error: 'GitHub POST git/blobs returned no sha', status: 502};
    }
    return {ok: true, sha: blob.sha};
}

async function commitAll(env, message, entries) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const branch = env.GITHUB_BRANCH || 'main';
        const ref = await githubApi(env, 'GET', 'git/ref/heads/' + branch);
        if (ref.error) return ref;
        const current = await githubApi(env, 'GET', 'git/commits/' + ref.object.sha);
        if (current.error) return current;
        const tree = await githubApi(env, 'POST', 'git/trees', {
            base_tree: current.tree.sha,
            tree: entries
        });
        if (tree.error) return tree;
        const commit = await githubApi(env, 'POST', 'git/commits', {
            message: message,
            tree: tree.sha,
            parents: [current.sha]
        });
        if (commit.error) return commit;
        const update = await githubApi(env, 'PATCH', 'git/refs/heads/' + branch, {
            sha: commit.sha,
            force: false
        });
        if (update.error) {
            if (attempt === 0 && (update.status === 409 || update.status === 422)) {
                continue;
            }
            return update;
        }
        return {ok: true, sha: commit.sha};
    }
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
    if (await checkDailyQuota(env, 'publish', 60)) {
        return json({error: 'Daily publish quota reached, try again tomorrow'}, 429);
    }

    let payload;
    try {
        payload = await request.json();
    } catch (err) {
        return json({error: 'Invalid JSON body'}, 400);
    }

    const title = String(payload.title || '').trim().slice(0, 200);
    const content = String(payload.content || '').trim();
    if (!title) {
        return json({error: 'Title is required'}, 400);
    }
    if (!content) {
        return json({error: 'Post body is required'}, 400);
    }
    if (content.length > 1000000) {
        return json({error: 'Post body is too large (max 1MB)'}, 413);
    }
    const category = String(payload.category || 'Blog').trim().replace(/\s+/g, ' ').slice(0, 60) || 'Blog';
    const icon = String(payload.icon || '📄').trim().slice(0, 8) || '📄';
    const date = String(payload.date || '').trim().slice(0, 50) || new Date().toISOString().slice(0, 10);
    const editId = /^[a-z0-9-]{1,80}$/.test(String(payload.id || '')) ? String(payload.id) : null;

    const rawImages = Array.isArray(payload.images) ? payload.images : [];
    if (rawImages.length > MAX_IMAGES_PER_POST) {
        return json({error: 'Too many images in one post (max ' + MAX_IMAGES_PER_POST + ')'}, 413);
    }
    const images = [];
    let totalImageBytes = 0;
    for (let i = 0; i < rawImages.length; i++) {
        const parsed = parseImage(rawImages[i], i);
        if (parsed.error) {
            return json({error: parsed.error}, 400);
        }
        totalImageBytes += parsed.base64Data.length;
        images.push(parsed);
    }
    if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) {
        return json({error: 'Total image payload too large (max 30MB)'}, 413);
    }

    const manifestGet = await githubGet(env, 'blog/posts.json');
    if (manifestGet.error) {
        return json(manifestGet, manifestGet.status);
    }
    let posts = [];
    if (!manifestGet.notFound) {
        try {
            posts = JSON.parse(base64ToUtf8(manifestGet.content));
        } catch (err) {
            return json({error: 'Could not parse existing blog/posts.json'}, 502);
        }
        if (!Array.isArray(posts)) {
            posts = [];
        }
    }

    let markdown = buildFrontmatter({title: title, date: date, category: category, icon: icon}) + content + '\n';

    let postId = null;
    let slug = null;
    let updated = false;

    if (editId) {
        const existing = posts.find(function(p) { return p && p.id === editId; });
        if (!existing) {
            return json({error: 'Post "' + editId + '" is not in the manifest'}, 404);
        }
        const fileGet = await githubGet(env, 'blog/' + editId + '.md');
        if (fileGet.notFound) {
            return json({error: 'blog/' + editId + '.md is not on GitHub'}, 404);
        }
        if (fileGet.error) {
            return json(fileGet, fileGet.status);
        }
        postId = editId;
        slug = existing.slug || '/blog/' + editId + '.md';
        updated = true;
    } else {
        const baseId = slugify(title);
        const existingIds = new Set(posts.map(function(p) { return p && p.id; }));
        postId = baseId;
        let suffix = 2;
        while (existingIds.has(postId)) {
            postId = baseId + '-' + suffix;
            suffix++;
        }
        slug = '/blog/' + postId + '.md';
    }

    const media = await resolveMediaNames(env, images);
    if (media.error) {
        return json(media, media.status);
    }

    images.forEach(function(image, index) {
        if (image.token) {
            markdown = markdown.split(UPLOAD_PLACEHOLDER + image.token).join('/media/' + media.names[index]);
        }
    });

    if (updated) {
        const entry = posts.find(function(p) { return p.id === postId; });
        if (entry) {
            entry.title = title;
            entry.date = date;
            entry.category = category;
            entry.icon = icon;
        }
    } else {
        posts.push({id: postId, slug: slug, title: title, date: date, category: category, icon: icon});
    }
    const manifestJson = JSON.stringify(posts, null, 2) + '\n';

    const entries = [];
    for (let i = 0; i < images.length; i++) {
        const blob = await githubCreateBlob(env, images[i].base64Data);
        if (blob.error) {
            return json(blob, blob.status);
        }
        entries.push({
            path: 'media/' + media.names[i],
            mode: '100644',
            type: 'blob',
            sha: blob.sha
        });
    }
    entries.push({path: 'blog/' + postId + '.md', mode: '100644', type: 'blob', content: markdown});
    entries.push({path: 'blog/posts.json', mode: '100644', type: 'blob', content: manifestJson});

    const mediaLabel = images.length ? ' with ' + images.length + ' media file' + (images.length === 1 ? '' : 's') : '';
    const message = (updated ? 'chore(blog): update post ' : 'chore(blog): add post ') + postId + mediaLabel;
    const commit = await commitAll(env, message, entries);
    if (commit.error) {
        return json(commit, commit.status);
    }

    const imageResults = images.map(function(image, index) {
        return {token: image.token, name: media.names[index], url: '/media/' + media.names[index]};
    });

    await recordDailyQuota(env, 'publish');
    return json({
        ok: true,
        id: postId,
        slug: slug,
        title: title,
        date: date,
        updated: updated,
        images: imageResults,
        commit: commit.sha
    });
}
