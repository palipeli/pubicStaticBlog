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
        return {
            error: 'GitHub DELETE ' + path + ' failed: ' + response.status + (detail ? ' - ' + detail : ''),
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

export async function onRequestGet(context) {
    const {env} = context;
    if (!env.GITHUB_TOKEN) {
        return json({error: 'Server is missing the GITHUB_TOKEN secret'}, 500);
    }
    const [manifest, tree] = await Promise.all([loadManifest(env), githubTree(env)]);
    if (manifest.error) {
        return json({error: manifest.error}, manifest.status);
    }
    if (tree.error) {
        return json(tree, tree.status);
    }
    const mdPaths = new Set((tree.paths || []).filter(function(p) {
        return p && p.startsWith('blog/') && p.endsWith('.md');
    }));
    const posts = manifest.posts.map(function(p) {
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
    const manifestIds = new Set(manifest.posts.map(function(p) { return p.id; }));
    const orphans = Array.from(mdPaths).map(function(path) { return path.slice(5, -3); }).filter(function(id) {
        return !manifestIds.has(id);
    });
    return json({posts: posts, orphans: orphans});
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
    const action = String(payload.action || '');
    const id = String(payload.id || '');
    if (!/^[a-z0-9-]{1,80}$/.test(id)) {
        return json({error: 'Invalid post id'}, 400);
    }

    if (action === 'delete') {
        const fileGet = await githubGet(env, 'blog/' + id + '.md');
        if (fileGet.notFound) {
            // nothing to delete on disk; continue to the manifest cleanup
        } else if (fileGet.error) {
            return json(fileGet, fileGet.status);
        } else {
            const del = await githubDelete(env, 'blog/' + id + '.md', fileGet.sha, 'chore(blog): delete post ' + id);
            if (del.error) {
                return json(del, del.status);
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
        return json({ok: true, id: id});
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
