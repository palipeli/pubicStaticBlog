const API_BASE = 'https://api.github.com';
const ALLOWED_IMAGE_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_POST = 20;
const UPLOAD_PLACEHOLDER = '/__upload__/';

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

function buildFrontmatter(fields) {
    return '---\n' +
        'title: "' + fields.title + '"\n' +
        'date: "' + fields.date + '"\n' +
        'category: "' + fields.category + '"\n' +
        'icon: "' + fields.icon + '"\n' +
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
        return {error: 'GitHub GET ' + path + ' failed: ' + response.status, status: 502};
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
        return {
            error: 'GitHub ' + method + ' ' + path + ' failed: ' + response.status + (detail ? ' - ' + detail : ''),
            status: 502
        };
    }
    return response.json();
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

async function commitAll(env, message, entries) {
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
    if (update.error) return update;
    return {ok: true, sha: commit.sha};
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
    for (let i = 0; i < rawImages.length; i++) {
        const parsed = parseImage(rawImages[i], i);
        if (parsed.error) {
            return json({error: parsed.error}, 400);
        }
        images.push(parsed);
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
    images.forEach(function(image, index) {
        entries.push({
            path: 'media/' + media.names[index],
            mode: '100644',
            type: 'blob',
            content: image.base64Data,
            encoding: 'base64'
        });
    });
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
