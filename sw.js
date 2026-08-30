'use strict';
const CACHE_NAME = 'pubic-static-blog-v11';
const STATIC_CACHE_NAME = 'static-assets-v44';
const IMAGE_CACHE_NAME = 'images-v17';
const CONTENT_CACHE_NAME = 'blog-content-v12';
const pendingFetches = new Map();
const STATIC_EXTENSIONS = /\.(html|css|js|json|webmanifest|ico|txt|xml)$/i;
const IMAGE_EXTENSIONS = /\.(webp|png|jpg|jpeg|gif|svg|ico)(\?.*)?$/i;
const MARKDOWN_EXTENSIONS = /\.(md|markdown)(\?.*)?$/i;
const FONT_EXTENSIONS = /\.(woff|woff2|ttf|eot|otf)(\?.*)?$/i;
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/js/config.js',
    '/js/markdown.js',
    '/js/lazyload.js',
    '/js/state.js',
    '/js/devotional.js',
    '/js/ui.js',
    '/js/blog.js',
    '/js/home.js',
    '/js/chart-loader.js',
    '/js/github-graph.js',
    '/js/dns-graph.js',
    '/js/warning.js',
    '/js/chat-cloud.js',
    '/js/mobile-tray.js',
    '/js/scrollbar.js',
    '/js/jellyfin.js',
    '/js/app.js',
    '/blog/posts.json',
    '/media/favicon-circle.webp',
    '/media/logo.webp',
    '/media/vt323.woff2',
    '/media/vt323.ttf',
];
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE_NAME),
            caches.open(IMAGE_CACHE_NAME)
        ]).then(([staticCache, imageCache]) => {
            const cachePromises = PRECACHE_ASSETS.map((url) => {
                const targetCache = IMAGE_EXTENSIONS.test(url) ? imageCache : staticCache;
                const cacheName = IMAGE_EXTENSIONS.test(url) ? IMAGE_CACHE_NAME : STATIC_CACHE_NAME;
                return fetch(url)
                    .then((response) => {
                        if (response.ok && responseMatchesCache(response, url, cacheName)) {
                            return targetCache.put(url, response);
                        }
                        console.warn(`Failed to precache ${url}: ${response.status}`);
                    })
                    .catch((err) => {
                        console.warn(`Failed to fetch ${url} for precaching:`, err);
                    });
            });
            return Promise.all(cachePromises);
        }).then(() => {
            return self.skipWaiting();
        })
    );
});
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) =>
                        (name.startsWith('img-cache-') ||
                         name.startsWith('images-') ||
                         name.startsWith('static-') ||
                         name.startsWith('blog-content-') ||
                         name.startsWith('pubic-static-blog-')) &&
                        name !== STATIC_CACHE_NAME &&
                        name !== IMAGE_CACHE_NAME &&
                        name !== CONTENT_CACHE_NAME &&
                        name !== CACHE_NAME
                    )
                    .map((name) => caches.delete(name))
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});
function getCacheStrategy(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (url.origin !== self.location.origin) {
        return 'network-only';
    }
    if (pathname === '/js/cp.js') {
        return 'network-first';
    }
    if (pathname === '/' || pathname === '/index.html' || pathname.endsWith('.html')) {
        return 'network-first';
    }
    if (pathname === '/blog/posts.json') {
        return 'network-first';
    }
    if (pathname.startsWith('/api/') || pathname.startsWith('/cdn-cgi/')) {
        return 'network-only';
    }
    if (STATIC_EXTENSIONS.test(pathname)) {
        return 'cache-first';
    }
    if (IMAGE_EXTENSIONS.test(pathname)) {
        return 'cache-first';
    }
    if (FONT_EXTENSIONS.test(pathname)) {
        return 'cache-first';
    }
    if (MARKDOWN_EXTENSIONS.test(pathname) || pathname.startsWith('/blog/')) {
        return 'cache-first';
    }
    return 'network-first';
}
function getCacheForRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (IMAGE_EXTENSIONS.test(pathname)) {
        return IMAGE_CACHE_NAME;
    }
    if (MARKDOWN_EXTENSIONS.test(pathname) || pathname.startsWith('/blog/')) {
        return CONTENT_CACHE_NAME;
    }
    return STATIC_CACHE_NAME;
}
function responseMatchesCache(response, request, cacheName) {
    const url = new URL(request instanceof Request ? request.url : request, self.location.origin);
    const pathname = url.pathname;
    const type = (response.headers.get('content-type') || '').toLowerCase();
    if (!type) return true;
    const isHtmlAsset = pathname === '/' || pathname === '/index.html' || pathname.endsWith('.html');
    if (cacheName === IMAGE_CACHE_NAME) {
        return type.startsWith('image/');
    }
    if (cacheName === CONTENT_CACHE_NAME) {
        return (type.startsWith('text/') && !type.startsWith('text/html')) || type.startsWith('application/json');
    }
    if (isHtmlAsset) {
        return type.startsWith('text/html');
    }
    return (type.startsWith('text/') && !type.startsWith('text/html')) ||
        type.startsWith('application/javascript') || type.startsWith('application/json') ||
        type.startsWith('image/') || type.startsWith('font/');
}
function isCacheableMessageUrl(value) {
    try {
        const url = new URL(value, self.location.origin);
        if (url.pathname === '/js/cp.js') return false;
        return url.origin === self.location.origin &&
            (url.pathname === '/' || url.pathname === '/index.html' ||
             url.pathname === '/style.css' || url.pathname === '/js/warning.js' ||
             url.pathname.startsWith('/js/') || url.pathname.startsWith('/media/') ||
             url.pathname.startsWith('/blog/'));
    } catch (error) {
        return false;
    }
}
async function prefetchUrl(value, cache, cacheName) {
    if (!isCacheableMessageUrl(value)) return;
    const request = new Request(new URL(value, self.location.origin).href);
    if (await cache.match(request)) return;
    try {
        await fetchAndCache(request, cache, cacheName);
    } catch (error) {
        console.warn('Prefetch failed:', request.url, error);
    }
}
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET') {
        return;
    }
    if (url.origin !== self.location.origin) {
        return;
    }
    if (/\.(webm|mp4|mp3|ogg|wav|m4a|flac|aac)(\?.*)?$/i.test(url.pathname)) {
        return;
    }
    const strategy = getCacheStrategy(request);
    const cacheName = getCacheForRequest(request);
    event.respondWith(handleRequest(request, strategy, cacheName));
});
async function handleRequest(request, strategy, cacheName) {
    const cache = await caches.open(cacheName);
    switch (strategy) {
        case 'cache-first':
            return cacheFirst(request, cache, cacheName);
        case 'network-first':
            return networkFirst(request, cache, cacheName);
        case 'stale-while-revalidate':
            return staleWhileRevalidate(request, cache, cacheName);
        case 'network-only':
        default:
            try { return await fetch(request); } catch (e) {
                const cached = await cache.match(request);
                if (cached) return cached;
                return new Response(null, { status: 404, statusText: 'Not Found' });
            }
    }
}
async function cacheFirst(request, cache, cacheName) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    return fetchAndCache(request, cache, cacheName);
}
async function networkFirst(request, cache, cacheName) {
    try {
        const isCp = new URL(request.url).pathname === '/js/cp.js';
        const fetchReq = isCp ? new Request(request.url, {cache: 'no-cache', credentials: 'same-origin'}) : request;
        const networkResponse = await fetch(fetchReq);
        if (networkResponse && networkResponse.ok && responseMatchesCache(networkResponse, request, cacheName)) {
            await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        if (request.headers.get('accept')?.includes('text/html')) {
            return getOfflineShell(cache);
        }
        return new Response(null, { status: 404, statusText: 'Not Found' });
    }
}
async function staleWhileRevalidate(request, cache, cacheName) {
    const cachedResponse = await cache.match(request);
    const fetchPromise = fetchAndCache(request, cache, cacheName);
    if (cachedResponse) {
        return cachedResponse;
    }
    try {
        return await fetchPromise;
    } catch (error) {
        if (request.headers.get('accept')?.includes('text/html')) {
            return getOfflineShell(cache);
        }
        return new Response(null, { status: 404, statusText: 'Not Found' });
    }
}
async function fetchAndCache(request, cache, cacheName) {
    const url = request.url;
    if (pendingFetches.has(url)) {
        return pendingFetches.get(url);
    }
    const fetchPromise = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(request, {signal: controller.signal});
            if (response && response.ok && responseMatchesCache(response, request, cacheName)) {
                await cache.put(request, response.clone());
            }
            return response;
        } finally {
            clearTimeout(timer);
        }
    })();
    pendingFetches.set(url, fetchPromise);
    try {
        return await fetchPromise;
    } finally {
        pendingFetches.delete(url);
    }
}
function updateCacheInBackground(request, cache, cacheName) {
    const url = request.url;
    if (pendingFetches.has(url)) {
        return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const updatePromise = fetch(request, {signal: controller.signal})
        .then((response) => {
            if (response && response.ok && responseMatchesCache(response, request, cacheName)) {
                return cache.put(request, response.clone());
            }
        })
        .catch(() => {
        })
        .finally(() => {
            clearTimeout(timer);
            pendingFetches.delete(url);
        });
    pendingFetches.set(url, updatePromise);
}
async function getOfflineShell(cache) {
    const shell = await cache.match('/index.html') || await cache.match('/');
    return shell || createOfflineFallback();
}
function createOfflineFallback() {
    const offlineHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Offline - Michelle's DNS and Blog</title>
            <style>
                * {box-sizing: border-box; margin: 0; padding: 0;}
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    background: #1a1a1a;
                    color: #fff;
                    text-align: center;
                    padding: 20px;
                }
                .container {max-width: 400px;}
                h1 {font-size: 2rem; margin-bottom: 1rem; color: #ff45fc;}
                p {font-size: 1.1rem; margin-bottom: 1.5rem; color: #ccc;}
                button {
                    background: #ff45fc;
                    border: none;
                    color: #fff;
                    padding: 12px 24px;
                    font-size: 1rem;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                button:hover {background: #e031e0;}
                .icon {font-size: 4rem; margin-bottom: 1rem;}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">📡</div>
                <h1>You're Offline</h1>
                <p>It looks like you've lost your internet connection. Don't worry, you can still browse previously visited pages.</p>
                <button onclick="window.location.reload()">Try Again</button>
            </div>
        </body>
        </html>
    `;
    return new Response(offlineHtml, {
        status: 200,
        statusText: 'OK',
        headers: {'Content-Type': 'text/html; charset=utf-8'}
    });
}
self.addEventListener('message', (event) => {
    const data = event.data;
    if (data === 'clear-cache') {
        event.waitUntil(
            caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
                .then(() => event.ports[0]?.postMessage({success: true}))
        );
        return;
    }
    if (!data || !data.type) return;
    if (data.type === 'precache-bg' && data.url) {
        event.waitUntil(caches.open(IMAGE_CACHE_NAME).then((cache) => prefetchUrl(data.url, cache, IMAGE_CACHE_NAME)));
    }
    if (data.type === 'prefetch-bg' && Array.isArray(data.urls)) {
        event.waitUntil(caches.open(IMAGE_CACHE_NAME).then((cache) =>
            Promise.all(data.urls.map((url) => prefetchUrl(url, cache, IMAGE_CACHE_NAME)))
        ));
    }
    if (data.type === 'prefetch-posts' && Array.isArray(data.urls)) {
        event.waitUntil(caches.open(CONTENT_CACHE_NAME).then((cache) =>
            Promise.all(data.urls.map((url) => prefetchUrl(url, cache, CONTENT_CACHE_NAME)))
        ));
    }
    if (data.type === 'precache-all') {
        event.waitUntil(precacheAllAssets());
    }
    if (data.type === 'skip-waiting') {
        self.skipWaiting();
    }
});
async function precacheAllAssets() {
    const staticCache = await caches.open(STATIC_CACHE_NAME);
    const imageCache = await caches.open(IMAGE_CACHE_NAME);
    const contentCache = await caches.open(CONTENT_CACHE_NAME);
    const mediaFiles = [
        '/media/bg-dark.webp',
        '/media/bg-light.webp',
        '/media/big-kitty.webp',
        '/media/car-dumdum.webp',
        '/media/denied_left.png',
        '/media/denied_right.png',
        '/media/dns.webp',
        '/media/favicon-circle.webp',
        '/media/il-feel.webp',
        '/media/kittler.webp',
        '/media/logo.webp',
        '/media/post-editor.webp',
        '/media/signing.webp',
        '/media/speechbuba_left.png',
        '/media/speechbuba_right.png',
        '/media/vt323.woff2',
        '/media/vt323.ttf',
    ];
    let blogPosts = [];
    try {
        const response = await fetch('/blog/posts.json');
        if (response.ok) {
            const posts = await response.json();
            blogPosts = posts.map(p => p.slug);
        }
    } catch (e) {
        console.warn('Could not fetch posts.json for precaching');
    }
    const allAssets = [...new Set([
        ...PRECACHE_ASSETS,
        ...mediaFiles,
        ...blogPosts,
        '/js/config.js',
        '/js/util.js',
        '/js/markdown.js',
        '/js/lazyload.js',
        '/js/state.js',
        '/js/devotional.js',
        '/js/ui.js',
        '/js/blog.js',
        '/js/home.js',
        '/js/chart-loader.js',
        '/js/github-graph.js',
        '/js/dns-graph.js',
        '/js/warning.js',
        '/js/chat-cloud.js',
        '/js/mobile-tray.js',
        '/js/scrollbar.js',
        '/js/jellyfin.js',
        '/js/app.js',
        '/blog/nt_verses_compact.json',
    ])];
    const cachePromises = allAssets.map((url) => {
        const isPost = url.startsWith('/blog/') && url.endsWith('.md');
        const cache = isPost ? contentCache : IMAGE_EXTENSIONS.test(url) ? imageCache : staticCache;
        const cacheName = isPost ? CONTENT_CACHE_NAME : IMAGE_EXTENSIONS.test(url) ? IMAGE_CACHE_NAME : STATIC_CACHE_NAME;
        return prefetchUrl(url, cache, cacheName);
    });
    await Promise.all(cachePromises);
    console.log('All assets precached');
}
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'precache-assets') {
        event.waitUntil(precacheAllAssets());
    }
});
