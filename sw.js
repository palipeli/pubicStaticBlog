// sw.js - Service Worker for Image Caching & Background Prefetch
// Caches images with cache-first strategy and supports
// on-demand background image prefetching via postMessage from main thread.
// 
// IMPROVEMENTS:
// - Versioned cache name for easy invalidation
// - Cache size limits to prevent unbounded growth
// - Pre-caching of critical CSS/JS assets

'use strict';

const CACHE_VERSION = 'v1';
const CACHE_NAME = `img-cache-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `static-cache-${CACHE_VERSION}`;

// Image file extensions to intercept and cache
const IMAGE_EXTENSIONS = /\.(webp|png|jpg|jpeg|gif|svg|ico)(\?.*)?$/i;

// Static assets to pre-cache (critical CSS, JS for faster subsequent loads)
const STATIC_ASSETS = [
    '/style.css',
    '/liquid-glass.css',
    '/js/state.js',
    '/js/ui.js',
    '/js/app.js'
];

// Maximum cache size in bytes (50 MB limit for image cache)
const MAX_CACHE_SIZE = 50 * 1024 * 1024;

// -------------------------------------------------------------------
// Install: Pre-cache static assets for faster subsequent loads.
// The active background image is sent via postMessage once the main 
// thread knows the user's theme, and all other images are cached on 
// first natural fetch (cache-first).
// -------------------------------------------------------------------
self.addEventListener('install', (event) => {
    // Pre-cache static assets
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => {
            // Activate immediately without waiting for existing clients
            return self.skipWaiting();
        })
    );
});

// -------------------------------------------------------------------
// Activate: claim all clients, purge old cache versions, and enforce
// cache size limits to prevent unbounded growth.
// -------------------------------------------------------------------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => {
                        // Delete old image-cache-* and static-cache-* versions
                        const isOldImgCache = name.startsWith('img-cache-') && name !== CACHE_NAME;
                        const isOldStaticCache = name.startsWith('static-cache-') && name !== STATIC_CACHE_NAME;
                        return isOldImgCache || isOldStaticCache;
                    })
                    .map((name) => caches.delete(name))
            );
        }).then(() => {
            // Enforce cache size limit on image cache
            return trimCacheToSize(CACHE_NAME, MAX_CACHE_SIZE);
        }).then(() => {
            // Take control of all open clients immediately
            return self.clients.claim();
        })
    );
});

// -------------------------------------------------------------------
// Helper: Trim cache to maximum size by removing oldest entries
// -------------------------------------------------------------------
async function trimCacheToSize(cacheName, maxSize) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        let currentSize = 0;
        const responses = await Promise.all(keys.map(key => cache.match(key)));
        
        // Calculate current cache size
        for (const response of responses) {
            if (response) {
                const blob = await response.blob();
                currentSize += blob.size;
            }
        }
        
        // If over limit, remove oldest entries until under limit
        if (currentSize > maxSize) {
            for (let i = 0; i < keys.length && currentSize > maxSize; i++) {
                const blob = await responses[i].blob();
                currentSize -= blob.size;
                await cache.delete(keys[i]);
            }
        }
    } catch (err) {
        console.warn('Failed to trim cache:', err);
    }
}

// -------------------------------------------------------------------
// Fetch: cache-first for image requests, cache-first for static assets.
// If the resource is already cached, return it immediately with no
// network request. Only fetch from the network on a cache miss,
// then store the response for future use.
// Non-image/non-static requests pass through to the network untouched.
// -------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only intercept same-origin requests
    if (url.origin !== self.location.origin) return;

    // Check if it's an image request
    if (IMAGE_EXTENSIONS.test(url.pathname)) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    // Cache hit — return immediately, no network request
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // Cache miss — fetch from network, cache, and return
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // Check if it's a static asset request (CSS, JS)
    const STATIC_PATHS = new Set(STATIC_ASSETS);
    if (STATIC_PATHS.has(url.pathname)) {
        event.respondWith(
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    // Cache hit — return immediately
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // Cache miss — fetch from network, cache, and return
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // All other requests pass through to network
});

// -------------------------------------------------------------------
// Message handler: pre-cache or prefetch background images on demand.
//
// Accepted message types:
//   { type: 'precache-bg', url: '/media/bg-dark.webp' }
//       Pre-cache a single background image (sent on SW registration).
//
//   { type: 'prefetch-bg', urls: ['/media/bg-dark.webp', '/media/bg-light.webp'] }
//       Prefetch multiple background images (sent on cursor proximity).
// -------------------------------------------------------------------
self.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'precache-bg' && data.url) {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(data.url).then((existing) => {
                    if (!existing) {
                        return cache.add(data.url);
                    }
                });
            })
        );
    }

    if (data.type === 'prefetch-bg' && Array.isArray(data.urls)) {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                return Promise.all(
                    data.urls.map((url) => {
                        return cache.match(url).then((existing) => {
                            if (!existing) {
                                return cache.add(url);
                            }
                        });
                    })
                );
            })
        );
    }
});
