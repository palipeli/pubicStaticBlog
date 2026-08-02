// sw.js - Service Worker for Static Asset Caching & Offline Support
// Caches all static assets (HTML, CSS, JS, images, JSON, Markdown) with appropriate strategies
// Provides offline fallback and background prefetching for improved load times and UI responsiveness

'use strict';

const CACHE_NAME = 'pubic-static-blog-v1';
const STATIC_CACHE_NAME = 'static-assets-v1';
const IMAGE_CACHE_NAME = 'images-v1';
const CONTENT_CACHE_NAME = 'blog-content-v1';

// Track pending fetches to prevent duplicate network requests
const pendingFetches = new Set();

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
        caches.open(STATIC_CACHE_NAME).then((cache) => {
            // Precache critical assets with error handling for each
            const cachePromises = PRECACHE_ASSETS.map((url) => {
                return fetch(url)
                    .then((response) => {
                        if (response.ok) {
                            return cache.put(url, response);
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

    // Markdown blog posts - stale-while-revalidate
    if (MARKDOWN_EXTENSIONS.test(pathname) || pathname.startsWith('/blog/')) {
        return 'stale-while-revalidate';
    }

    // API/manifest - network-first
    if (pathname === '/blog/posts.json') {
        return 'network-first';
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
        // Return cached response immediately
        // Optionally update cache in background (stale-while-revalidate behavior)
        updateCacheInBackground(request, cache);
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
            cache.put(request, networkResponse.clone());
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
            return createOfflineFallback();
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
            return createOfflineFallback();
        }
        throw error;
    }
}

// -------------------------------------------------------------------
// Fetch from network and cache the response
// -------------------------------------------------------------------
async function fetchAndCache(request, cache) {
    const url = request.url;
    
    // Prevent duplicate fetches
    if (pendingFetches.has(url)) {
        // Wait for the existing fetch to complete
        return new Promise((resolve, reject) => {
            const checkPending = setInterval(() => {
                if (!pendingFetches.has(url)) {
                    clearInterval(checkPending);
                    cache.match(request).then(resolve).catch(reject);
                }
            }, 50);
        });
    }

    pendingFetches.add(url);
    
    try {
        const response = await fetch(request);
        
        if (response && response.ok) {
            // Clone response before caching (response body can only be read once)
            cache.put(request, response.clone());
        }
        
        return response;
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
    
    pendingFetches.add(url);
    
    fetch(request)
        .then((response) => {
            if (response && response.ok) {
                cache.put(request, response);
            }
        })
        .catch(() => {
            // Ignore background update failures
        })
        .finally(() => {
            pendingFetches.delete(url);
        });
}

// -------------------------------------------------------------------
// Create offline fallback response
// -------------------------------------------------------------------
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
    if (!data || !data.type) return;

    // Precache a single background image (sent on SW registration)
    if (data.type === 'precache-bg' && data.url) {
        event.waitUntil(
            caches.open(IMAGE_CACHE_NAME).then((cache) => {
                if (pendingFetches.has(data.url)) {
                    return;
                }
                return cache.match(data.url).then((existing) => {
                    if (existing) return;
                    pendingFetches.add(data.url);
                    return fetch(data.url)
                        .then((response) => {
                            if (response && response.ok) {
                                return cache.put(data.url, response);
                            }
                        })
                        .finally(() => {
                            pendingFetches.delete(data.url);
                        });
                });
            })
        );
    }

    // Prefetch background images (sent on cursor proximity)
    if (data.type === 'prefetch-bg' && Array.isArray(data.urls)) {
        event.waitUntil(
            caches.open(IMAGE_CACHE_NAME).then((cache) => {
                return Promise.all(
                    data.urls.map((url) => {
                        if (pendingFetches.has(url)) {
                            return Promise.resolve();
                        }
                        return cache.match(url).then((existing) => {
                            if (existing) return;
                            pendingFetches.add(url);
                            return fetch(url)
                                .then((response) => {
                                    if (response && response.ok) {
                                        return cache.put(url, response);
                                    }
                                })
                                .finally(() => {
                                    pendingFetches.delete(url);
                                });
                        });
                    })
                );
            })
        );
    }

    // Prefetch blog post content (markdown files)
    if (data.type === 'prefetch-posts' && Array.isArray(data.urls)) {
        event.waitUntil(
            caches.open(CONTENT_CACHE_NAME).then((cache) => {
                return Promise.all(
                    data.urls.map((url) => {
                        if (pendingFetches.has(url)) {
                            return Promise.resolve();
                        }
                        return cache.match(url).then((existing) => {
                            if (existing) return;
                            pendingFetches.add(url);
                            return fetch(url)
                                .then((response) => {
                                    if (response && response.ok) {
                                        return cache.put(url, response);
                                    }
                                })
                                .finally(() => {
                                    pendingFetches.delete(url);
                                });
                        });
                    })
                );
            })
        );
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
        
        if (pendingFetches.has(url)) return Promise.resolve();
        
        return cache.match(url).then((existing) => {
            if (existing) return Promise.resolve();
            pendingFetches.add(url);
            return fetch(url)
                .then((response) => {
                    if (response && response.ok) {
                        return cache.put(url, response);
                    }
                })
                .catch(() => {})
                .finally(() => {
                    pendingFetches.delete(url);
                });
        });
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

// -------------------------------------------------------------------
// Handle client messages for cache management
// -------------------------------------------------------------------
self.addEventListener('message', (event) => {
    if (event.data === 'clear-cache') {
        event.waitUntil(
            caches.keys().then((names) => 
                Promise.all(names.map((name) => caches.delete(name)))
            ).then(() => {
                event.ports[0]?.postMessage({ success: true });
            })
        );
    }
});