const API_BASE = 'https://api.github.com';

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

function buildFrontmatter(fields) {
    return '---\n' +
        'title: "' + fields.title + '"\n' +
        'date: "' + fields.date + '"\n' +
        'category: "' + fields.category + '"\n' +
        'icon: "' + fields.icon + '"\n' +
        '---\n';
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

    const title = String(payload.title || '').trim().replace(/\s+/g, ' ').slice(0, 200);
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

    const manifestGet = await githubGet(env, 'blog/posts.json');
    if (manifestGet.error) {
        return json(manifestGet, manifestGet.status);
    }
    let posts = [];
    let manifestSha = null;
    if (!manifestGet.notFound) {
        try {
            posts = JSON.parse(base64ToUtf8(manifestGet.content));
        } catch (err) {
            return json({error: 'Could not parse existing blog/posts.json'}, 502);
        }
        if (!Array.isArray(posts)) {
            posts = [];
        }
        manifestSha = manifestGet.sha;
    }

    const markdown = buildFrontmatter({title: title, date: date, category: category, icon: icon}) + content + '\n';

    let postId = null;
    let slug = null;
    let updated = false;
    let mdSha = null;

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
        mdSha = fileGet.sha;
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

    const mdWrite = await githubPut(env, 'blog/' + postId + '.md', utf8ToBase64(markdown), mdSha, updated ? 'chore(blog): update post ' + postId : 'chore(blog): add post ' + postId);
    if (mdWrite.error) {
        return json(mdWrite, mdWrite.status);
    }

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
    const manifestWrite = await githubPut(env, 'blog/posts.json', utf8ToBase64(manifestJson), manifestSha, updated ? 'chore(blog): update manifest for ' + postId : 'chore(blog): register post ' + postId);
    if (manifestWrite.error) {
        return json(manifestWrite, manifestWrite.status);
    }

    return json({ok: true, id: postId, slug: slug, title: title, date: date, updated: updated});
}
