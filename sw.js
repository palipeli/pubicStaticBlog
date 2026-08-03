// sw.js - Service Worker for Static Asset Caching & Offline Support
// Caches all static assets (HTML, CSS, JS, images, JSON, Markdown) with appropriate strategies
// Provides offline fallback and background prefetching for improved load times and UI responsiveness

'use strict';

const CACHE_NAME = 'pubic-static-blog-v2';
const STATIC_CACHE_NAME = 'static-assets-v2';
const IMAGE_CACHE_NAME = 'images-v2';
const CONTENT_CACHE_NAME = 'blog-content-v2';

// Track pending fetches to prevent duplicate network requests
// Share in-flight requests instead of polling Cache Storage. A failed request
// must reject all waiters rather than leaving them waiting forever.
const pendingFetches = new Map();

// File extensions to cache with different strategies
const STATIC_EXTENSIONS = /\.(html|css|js|json|webmanifest|ico|txt|xml)$/i;
const IMAGE_EXTENSIONS = /\.(webp|png|jpg|jpeg|gif|svg|ico)(\?.*)?$/i;
const MARKDOWN_EXTENSIONS = /\.(md|markdown)(\?.*)?$/i;
const FONT_EXTENSIONS = /\.(woff|woff2|ttf|eot|otf)(\?.*)?$/i;

// Critical assets to precache on install
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
    '/js/mobile-tray.js',
    '/js/app.js',
    '/warning.js',
    '/blog/posts.json',
    '/media/favicon-circle.webp',
    '/media/logo.webp',
    '/media/bg-light.webp',
    '/media/bg-dark.webp',
];

// -------------------------------------------------------------------
// Install: Precache critical static assets
// -------------------------------------------------------------------
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE_NAME),
            caches.open(IMAGE_CACHE_NAME)
        ]).then(([staticCache, imageCache]) => {
            // Precache critical assets with error handling for each
            const cachePromises = PRECACHE_ASSETS.map((url) => {
                // Determine which cache to use based on file type
                const targetCache = IMAGE_EXTENSIONS.test(url) ? imageCache : staticCache;
                return fetch(url)
                    .then((response) => {
                        if (response.ok) {
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
            // Activate immediately without waiting for existing clients
            return self.skipWaiting();
        })
    );
});

// -------------------------------------------------------------------
// Activate: Claim all clients and purge old cache versions
// -------------------------------------------------------------------
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
            // Take control of all open clients immediately
            return self.clients.claim();
        })
    );
});

// -------------------------------------------------------------------
// Helper: Determine cache strategy based on request
// -------------------------------------------------------------------
function getCacheStrategy(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Same-origin only
    if (url.origin !== self.location.origin) {
        return 'network-only';
    }

    // HTML pages - network-first with offline fallback
    if (pathname === '/' || pathname === '/index.html' || pathname.endsWith('.html')) {
        return 'network-first';
    }

    // The manifest changes independently from the rest of the static assets.
    // Keep this check before the generic JSON/static rule.
    if (pathname === '/blog/posts.json') {
        return 'network-first';
    }

    // Static assets (CSS, JS, JSON) - cache-first with network fallback
    if (STATIC_EXTENSIONS.test(pathname)) {
        return 'cache-first';
    }

    // Images - cache-first
    if (IMAGE_EXTENSIONS.test(pathname)) {
        return 'cache-first';
    }

    // Fonts - cache-first (long-term caching)
    if (FONT_EXTENSIONS.test(pathname)) {
        return 'cache-first';
    }

    // Blog content is static in this deployment. Cache-first avoids a network
    // refresh every time a user revisits a post; publish updates by bumping
    // the cache version or explicitly running the precache command.
    if (MARKDOWN_EXTENSIONS.test(pathname) || pathname.startsWith('/blog/')) {
        return 'cache-first';
    }

    // Default: network-first
    return 'network-first';
}

// -------------------------------------------------------------------
// Helper: Get appropriate cache for request
// -------------------------------------------------------------------
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

function isCacheableMessageUrl(value) {
    try {
        const url = new URL(value, self.location.origin);
        return url.origin === self.location.origin &&
            (url.pathname === '/' || url.pathname === '/index.html' ||
             url.pathname === '/style.css' || url.pathname === '/warning.js' ||
             url.pathname.startsWith('/js/') || url.pathname.startsWith('/media/') ||
             url.pathname.startsWith('/blog/'));
    } catch (error) {
        return false;
    }
}

async function prefetchUrl(value, cache) {
    if (!isCacheableMessageUrl(value)) return;
    const request = new Request(new URL(value, self.location.origin).href);
    if (await cache.match(request)) return;
    try {
        await fetchAndCache(request, cache);
    } catch (error) {
        console.warn('Prefetch failed:', request.url, error);
    }
}

// -------------------------------------------------------------------
// Fetch: Apply appropriate caching strategy
// -------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Only handle GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests (except for fonts from Google Fonts)
    if (url.origin !== self.location.origin) {
        // Allow Google Fonts to pass through (they have their own caching)
        if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
            return;
        }
        // Allow FontAwesome CDN
        if (url.hostname === 'cdnjs.cloudflare.com') {
            return;
        }
        return;
    }

    const strategy = getCacheStrategy(request);
    const cacheName = getCacheForRequest(request);

    event.respondWith(handleRequest(request, strategy, cacheName));
});

// -------------------------------------------------------------------
// Request handler with different strategies
// -------------------------------------------------------------------
async function handleRequest(request, strategy, cacheName) {
    const cache = await caches.open(cacheName);

    switch (strategy) {
        case 'cache-first':
            return cacheFirst(request, cache);
        case 'network-first':
            return networkFirst(request, cache);
        case 'stale-while-revalidate':
            return staleWhileRevalidate(request, cache);
        case 'network-only':
        default:
            return fetch(request);
    }
}

// -------------------------------------------------------------------
// Cache-First Strategy: Return cached response immediately, fetch in background
// Best for: Static assets (CSS, JS, images, fonts) that rarely change
// -------------------------------------------------------------------
async function cacheFirst(request, cache) {
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        // Static assets are versioned through the cache name. Avoid a second
        // network request on every script/style/image read.
        return cachedResponse;
    }

    // Cache miss - fetch from network
    return fetchAndCache(request, cache);
}

// -------------------------------------------------------------------
// Network-First Strategy: Try network first, fallback to cache
// Best for: HTML pages, API endpoints, manifest files
// -------------------------------------------------------------------
async function networkFirst(request, cache) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.ok) {
            // Cache successful response
            await cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed - try cache
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }

        // No cache - return offline fallback for HTML pages
        if (request.headers.get('accept')?.includes('text/html')) {
            return getOfflineShell(cache);
        }

        throw error;
    }
}

// -------------------------------------------------------------------
// Stale-While-Revalidate: Return cached immediately, update in background
// Best for: Blog content (markdown posts) that may update occasionally
// -------------------------------------------------------------------
async function staleWhileRevalidate(request, cache) {
    const cachedResponse = await cache.match(request);
    
    // Always fetch in background to update cache
    const fetchPromise = fetchAndCache(request, cache);
    
    if (cachedResponse) {
        // Return cached immediately, update happens in background
        return cachedResponse;
    }

    // No cache - wait for network
    try {
        return await fetchPromise;
    } catch (error) {
        // If network fails and no cache, return offline fallback for HTML
        if (request.headers.get('accept')?.includes('text/html')) {
            return getOfflineShell(cache);
        }
        throw error;
    }
}

// -------------------------------------------------------------------
// Fetch from network and cache the response
// -------------------------------------------------------------------
async function fetchAndCache(request, cache) {
    const url = request.url;
    
    // Prevent duplicate fetches and propagate the original result/error.
    if (pendingFetches.has(url)) {
        return pendingFetches.get(url);
    }

    const fetchPromise = (async () => {
        const response = await fetch(request);

        if (response && response.ok) {
            await cache.put(request, response.clone());
        }

        return response;
    })();

    pendingFetches.set(url, fetchPromise);
    try {
        return await fetchPromise;
    } finally {
        pendingFetches.delete(url);
    }
}

// -------------------------------------------------------------------
// Update cache in background (for cache-first strategy)
// -------------------------------------------------------------------
function updateCacheInBackground(request, cache) {
    const url = request.url;
    
    if (pendingFetches.has(url)) {
        return; // Already fetching
    }
    const updatePromise = fetch(request)
        .then((response) => {
            if (response && response.ok) {
                return cache.put(request, response.clone());
            }
        })
        .catch(() => {
            // Ignore background update failures
        })
        .finally(() => {
            pendingFetches.delete(url);
        });

    pendingFetches.set(url, updatePromise);
}

// -------------------------------------------------------------------
// Create offline fallback response
// -------------------------------------------------------------------
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
                * { box-sizing: border-box; margin: 0; padding: 0; }
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
                .container { max-width: 400px; }
                h1 { font-size: 2rem; margin-bottom: 1rem; color: #ff45fc; }
                p { font-size: 1.1rem; margin-bottom: 1.5rem; color: #ccc; }
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
                button:hover { background: #e031e0; }
                .icon { font-size: 4rem; margin-bottom: 1rem; }
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
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

// -------------------------------------------------------------------
// Message handler: Precache/prefetch assets on demand
// -------------------------------------------------------------------
self.addEventListener('message', (event) => {
    const data = event.data;

    if (data === 'clear-cache') {
        event.waitUntil(
            caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
                .then(() => event.ports[0]?.postMessage({ success: true }))
        );
        return;
    }

    if (!data || !data.type) return;

    // Precache/prefetch requests share one validated implementation.
    if (data.type === 'precache-bg' && data.url) {
        event.waitUntil(caches.open(IMAGE_CACHE_NAME).then((cache) => prefetchUrl(data.url, cache)));
    }

    if (data.type === 'prefetch-bg' && Array.isArray(data.urls)) {
        event.waitUntil(caches.open(IMAGE_CACHE_NAME).then((cache) =>
            Promise.all(data.urls.map((url) => prefetchUrl(url, cache)))
        ));
    }

    if (data.type === 'prefetch-posts' && Array.isArray(data.urls)) {
        event.waitUntil(caches.open(CONTENT_CACHE_NAME).then((cache) =>
            Promise.all(data.urls.map((url) => prefetchUrl(url, cache)))
        ));
    }

    // Precahce all static assets (can be called manually)
    if (data.type === 'precache-all') {
        event.waitUntil(precacheAllAssets());
    }

    // Skip waiting and activate new SW immediately
    if (data.type === 'skip-waiting') {
        self.skipWaiting();
    }
});

// -------------------------------------------------------------------
// Precaches all known static assets
// -------------------------------------------------------------------
async function precacheAllAssets() {
    const staticCache = await caches.open(STATIC_CACHE_NAME);
    const imageCache = await caches.open(IMAGE_CACHE_NAME);
    const contentCache = await caches.open(CONTENT_CACHE_NAME);

    // Get all media files
    const mediaFiles = [
        '/media/apple.webp',
        '/media/background.webp',
        '/media/bg-dark.webp',
        '/media/bg-light.webp',
        '/media/dns.webp',
        '/media/favicon-circle.webp',
        '/media/logo.webp',
        '/media/signing.webp',
    ];

    // Get all blog markdown files from posts.json
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

    // Precahce all assets
    const allAssets = [
        ...PRECACHE_ASSETS,
        ...mediaFiles,
        ...blogPosts,
        '/js/app.js',
        '/js/blog.js',
        '/js/devotional.js',
        '/js/home.js',
        '/js/lazyload.js',
        '/js/markdown.js',
        '/js/mobile-tray.js',
        '/js/state.js',
        '/js/ui.js',
        '/blog/nt_verses_compact.json',
    ];

    const cachePromises = allAssets.map((url) => {
        const cache = url.startsWith('/blog/') && url.endsWith('.md') ? contentCache :
                      IMAGE_EXTENSIONS.test(url) ? imageCache : staticCache;
        return prefetchUrl(url, cache);
    });

    await Promise.all(cachePromises);
    console.log('All assets precached');
}

// -------------------------------------------------------------------
// Periodic background sync (if supported)
// -------------------------------------------------------------------
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'precache-assets') {
        event.waitUntil(precacheAllAssets());
    }
});
