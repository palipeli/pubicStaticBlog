const API_BASE = 'https://api.github.com';

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

async function githubDelete(env, path, sha, message) {
    const owner = env.GITHUB_OWNER || 'palipeli';
    const repo = env.GITHUB_REPO || 'pubicStaticBlog';
    const body = {message: message};
    if (sha) {
        body.sha = sha;
    }
    const response = await fetch(API_BASE + '/repos/' + owner + '/' + repo + '/contents/' + path, {
        method: 'DELETE',
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
        console.error('GitHub DELETE ' + path + ' failed: ' + response.status + (detail ? ' - ' + detail : ''));
        return {
            error: 'GitHub request failed',
            status: 502
        };
    }
    return {ok: true};
}

async function githubTree(env) {
    const owner = env.GITHUB_OWNER || 'palipeli';
    const repo = env.GITHUB_REPO || 'pubicStaticBlog';
    const branch = env.GITHUB_BRANCH || 'main';
    const response = await fetch(API_BASE + '/repos/' + owner + '/' + repo + '/git/trees/' + branch + '?recursive=1', {
        headers: githubHeaders(env.GITHUB_TOKEN)
    });
    if (!response.ok) {
        return {error: 'GitHub tree fetch failed: ' + response.status, status: 502};
    }
    const data = await response.json();
    const paths = (data.tree || []).map(function(entry) { return entry.path; });
    return {paths: paths};
}

async function loadManifest(env) {
    const manifestGet = await githubGet(env, 'blog/posts.json');
    if (manifestGet.error) {
        return {error: manifestGet.error, status: manifestGet.status || 502};
    }
    if (manifestGet.notFound) {
        return {posts: [], sha: null};
    }
    let posts = [];
    try {
        posts = JSON.parse(base64ToUtf8(manifestGet.content));
    } catch (err) {
        return {error: 'Could not parse blog/posts.json', status: 502};
    }
    if (!Array.isArray(posts)) {
        posts = [];
    }
    return {posts: posts, sha: manifestGet.sha};
}

const PROTECTED_MEDIA = new Set(['favicon-circle.webp', 'logo.webp', 'bg-light.webp', 'bg-dark.webp', 'vt323.ttf']);

async function deletePostMedia(env, deletedId, deletedMdBase64) {
    const mediaRegex = /(["'(=:\s])\/media\/([A-Za-z0-9._-]+)/g;
    const referenced = new Set();
    const deletedText = base64ToUtf8(deletedMdBase64 || '');
    let m;
    while ((m = mediaRegex.exec(deletedText))) {
        referenced.add(m[2]);
    }
    if (!referenced.size) {
        return {removed: [], skipped: []};
    }
    const manifest = await loadManifest(env);
    if (manifest.error) {
        return {error: manifest.error, status: manifest.status};
    }
    const remaining = manifest.posts.filter(function(p) {
        return p && p.id !== deletedId && /^[a-z0-9-]{1,80}$/.test(String(p.id));
    });
    const inUse = new Set();
    if (remaining.length > 25) {
        return {removed: [], skipped: Array.from(referenced)};
    }
    for (let i = 0; i < remaining.length; i++) {
        const get = await githubGet(env, 'blog/' + remaining[i].id + '.md');
        if (get.notFound || get.error) {
            continue;
        }
        const text = base64ToUtf8(get.content || '');
        while ((m = mediaRegex.exec(text))) {
            inUse.add(m[2]);
        }
    }
    const removed = [];
    const skipped = [];
    for (const name of referenced) {
        if (PROTECTED_MEDIA.has(name) || inUse.has(name)) {
            skipped.push(name);
            continue;
        }
        const get = await githubGet(env, 'media/' + name);
        if (get.notFound || get.error || !get.sha) {
            skipped.push(name);
            continue;
        }
        const del = await githubDelete(env, 'media/' + name, get.sha, 'chore(blog): remove media ' + name + ' with post ' + deletedId);
        if (del.error) {
            skipped.push(name);
            continue;
        }
        removed.push(name);
    }
    return {removed: removed, skipped: skipped};
}

export async function onRequestGet(context) {
    const {request, env} = context;
    if (!env.GITHUB_TOKEN) {
        return json({error: 'Server is missing the GITHUB_TOKEN secret'}, 500);
    }
    if (authMisconfigured(env)) {
        return json({error: 'Server auth is misconfigured: set ADMIN_TOKEN (min 32 chars) and restart'}, 503);
    }
    if (!isAuthorized(request, env)) {
        if (await authFailureRateLimited(env, request)) {
            return json({error: 'Too many failed attempts, try again later'}, 429);
        }
        return json({error: 'Unauthorized'}, 401);
    }
    if (await requestRateLimited(env, request, 'posts-get', 60, 60)) {
        return json({error: 'Too many requests, try again later'}, 429);
    }
    const [manifest, tree] = await Promise.all([loadManifest(env), githubTree(env)]);
    if (manifest.error) {
        return json({error: manifest.error}, manifest.status);
    }
    if (tree.error) {
        return json(tree, tree.status);
    }
    const validId = /^[a-z0-9-]{1,80}$/;
    const mdPaths = new Set((tree.paths || []).filter(function(p) {
        return p && p.startsWith('blog/') && p.endsWith('.md');
    }));
    const posts = manifest.posts.filter(function(p) {
        return p && p.id && validId.test(String(p.id));
    }).map(function(p) {
        const slugPath = String(p.slug || '').replace(/^\//, '');
        return {
            id: p.id,
            slug: p.slug,
            title: p.title || 'Untitled',
            date: p.date || '',
            category: p.category || '',
            icon: p.icon || '',
            pinned: !!p.pinned,
            onGithub: mdPaths.has(slugPath) || mdPaths.has('blog/' + p.id + '.md')
        };
    });
    const manifestIds = new Set(posts.map(function(p) { return p.id; }));
    const orphans = Array.from(mdPaths).map(function(path) { return path.slice(5, -3); }).filter(function(id) {
        return validId.test(id) && !manifestIds.has(id);
    });
    return json({posts: posts, orphans: orphans});
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
    if (contentLength > 200000) {
        return json({error: 'Request body too large'}, 413);
    }
    let payload;
    try {
        payload = await request.json();
    } catch (err) {
        return json({error: 'Invalid JSON body'}, 400);
    }
    const action = String(payload.action || '');
    const id = String(payload.id || '');
    if (!/^[a-z0-9-]{1,80}$/.test(id)) {
        return json({error: 'Invalid post id'}, 400);
    }

    if (action === 'delete') {
        const fileGet = await githubGet(env, 'blog/' + id + '.md');
        const mediaNotes = [];
        if (fileGet.notFound) {
            // nothing to delete on disk; continue to the manifest cleanup
        } else if (fileGet.error) {
            return json(fileGet, fileGet.status);
        } else {
            const del = await githubDelete(env, 'blog/' + id + '.md', fileGet.sha, 'chore(blog): delete post ' + id);
            if (del.error) {
                return json(del, del.status);
            }
            const cleanup = await deletePostMedia(env, id, fileGet.content);
            if (cleanup.error) {
                return json(cleanup, cleanup.status);
            }
            if (cleanup.removed && cleanup.removed.length) {
                mediaNotes.push('removed media: ' + cleanup.removed.join(', '));
            }
            if (cleanup.skipped && cleanup.skipped.length) {
                mediaNotes.push('kept media still referenced elsewhere: ' + cleanup.skipped.join(', '));
            }
        }
        const manifest = await loadManifest(env);
        if (manifest.error) {
            return json({error: manifest.error}, manifest.status);
        }
        const before = manifest.posts.length;
        manifest.posts = manifest.posts.filter(function(p) { return p.id !== id; });
        if (manifest.posts.length === before) {
            return json({ok: true, id: id, note: 'Post was not listed in the manifest'});
        }
        const manifestJson = JSON.stringify(manifest.posts, null, 2) + '\n';
        const manifestWrite = await githubPut(env, 'blog/posts.json', utf8ToBase64(manifestJson), manifest.sha, 'chore(blog): unregister post ' + id);
        if (manifestWrite.error) {
            return json(manifestWrite, manifestWrite.status);
        }
        return json({ok: true, id: id, note: mediaNotes.length ? mediaNotes.join('; ') : undefined});
    }

    if (action === 'pin') {
        const pinned = !!payload.pinned;
        const manifest = await loadManifest(env);
        if (manifest.error) {
            return json({error: manifest.error}, manifest.status);
        }
        const post = manifest.posts.find(function(p) { return p.id === id; });
        if (!post) {
            return json({error: 'Post not found in manifest'}, 404);
        }
        if (pinned) {
            post.pinned = true;
        } else {
            delete post.pinned;
        }
        const manifestJson = JSON.stringify(manifest.posts, null, 2) + '\n';
        const manifestWrite = await githubPut(env, 'blog/posts.json', utf8ToBase64(manifestJson), manifest.sha, 'chore(blog): ' + (pinned ? 'pin' : 'unpin') + ' post ' + id);
        if (manifestWrite.error) {
            return json(manifestWrite, manifestWrite.status);
        }
        return json({ok: true, id: id, pinned: pinned});
    }

    return json({error: 'Unknown action'}, 400);
}
