// sw.js - Service Worker for Image Caching & Background Prefetch
// Caches images with cache-first strategy and supports
// on-demand background image prefetching via postMessage from main thread.
// Optimized to prevent duplicate fetches by tracking pending requests.

'use strict';

const CACHE_NAME = 'img-cache-v1';

// Track pending fetches to prevent duplicate network requests
const pendingFetches = new Set();

// Image file extensions to intercept and cache
const IMAGE_EXTENSIONS = /\.(webp|png|jpg|jpeg|gif|svg|ico)(\?.*)?$/i;

// -------------------------------------------------------------------
// Install: no pre-caching here. The active background image is
// sent via postMessage once the main thread knows the user's theme,
// and all other images are cached on first natural fetch (cache-first).
// -------------------------------------------------------------------
self.addEventListener('install', (event) => {
    // Activate immediately without waiting for existing clients
    event.waitUntil(self.skipWaiting());
});

// -------------------------------------------------------------------
// Activate: claim all clients and purge old cache versions.
// -------------------------------------------------------------------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('img-cache-') && name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => {
            // Take control of all open clients immediately
            return self.clients.claim();
        })
    );
});

// -------------------------------------------------------------------
// Fetch: cache-first for image requests.
// If the image is already cached, return it immediately with no
// network request. Only fetch from the network on a cache miss,
// then store the response for future use.
// Non-image requests pass through to the network untouched.
// -------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only intercept same-origin image requests
    if (url.origin !== self.location.origin) return;
    if (!IMAGE_EXTENSIONS.test(url.pathname)) return;

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
//       Skips if already cached or currently being fetched.
//
//   { type: 'prefetch-bg', urls: ['/media/bg-dark.webp'] }
//       Prefetch background images (sent on cursor proximity).
//       Only fetches URLs not already in cache or pending.
// -------------------------------------------------------------------
self.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'precache-bg' && data.url) {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                // Skip if already cached or currently being fetched
                if (pendingFetches.has(data.url)) {
                    return;
                }
                return cache.match(data.url).then((existing) => {
                    if (existing) {
                        return; // Already cached, skip
                    }
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

    if (data.type === 'prefetch-bg' && Array.isArray(data.urls)) {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                return Promise.all(
                    data.urls.map((url) => {
                        // Skip if already cached or currently being fetched
                        if (pendingFetches.has(url)) {
                            return Promise.resolve();
                        }
                        return cache.match(url).then((existing) => {
                            if (existing) {
                                return; // Already cached, skip
                            }
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
});
