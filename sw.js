// sw.js - Service Worker for Comprehensive Caching & Background Prefetch
// Caches images, CSS, and JS with stale-while-revalidate strategy and supports
// on-demand background image prefetching via postMessage from main thread.

'use strict';

const CACHE_NAME = 'site-cache-v2';

// Image file extensions to intercept and cache
const IMAGE_EXTENSIONS = /\.(webp|png|jpg|jpeg|gif|svg|ico)(\?.*)?$/i;

// CSS and JS file extensions to cache for faster subsequent loads
const STATIC_ASSET_EXTENSIONS = /\.(css|js)(\?.*)?$/i;

// -------------------------------------------------------------------
// Install: Pre-cache critical assets for instant first load on return visits
// -------------------------------------------------------------------
self.addEventListener('install', (event) => {
    // Pre-cache critical static assets
    const criticalAssets = [
        '/style.css',
        '/liquid-glass.css',
        '/js/app.js',
        '/js/state.js',
        '/js/ui.js'
    ];

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(criticalAssets).catch(err => {
                // Ignore errors - assets will be cached on first request
                console.log('SW pre-caching skipped:', err);
            });
        }).then(() => {
            // Activate immediately without waiting for existing clients
            return self.skipWaiting();
        })
    );
});

// -------------------------------------------------------------------
// Activate: claim all clients and purge old cache versions.
// -------------------------------------------------------------------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('img-cache-') || name.startsWith('site-cache-'))
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => {
            // Take control of all open clients immediately
            return self.clients.claim();
        })
    );
});

// -------------------------------------------------------------------
// Fetch: cache-first for images and static assets (CSS, JS).
// If the resource is already cached, return it immediately with no
// network request. Only fetch from the network on a cache miss,
// then store the response for future use.
// Non-matching requests pass through to the network untouched.
// -------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only intercept same-origin requests
    if (url.origin !== self.location.origin) return;

    // Check if this is an image or static asset
    const isImage = IMAGE_EXTENSIONS.test(url.pathname);
    const isStaticAsset = STATIC_ASSET_EXTENSIONS.test(url.pathname);

    if (!isImage && !isStaticAsset) return;

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
