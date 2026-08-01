// sw.js - Service Worker for Image Caching & Background Prefetch
// Caches images with stale-while-revalidate strategy and supports
// on-demand background image prefetching via postMessage from main thread.
// 
// Version: 2 - Added cache busting support and improved error handling

'use strict';

const CACHE_NAME = 'img-cache-v2';
const CACHE_VERSION = 'v2'; // Update this when cache strategy changes

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
// Fetch: cache-first for image requests with error handling.
// If the image is already cached, return it immediately with no
// network request. Only fetch from the network on a cache miss,
// then store the response for future use.
// Non-image requests pass through to the network untouched.
// Includes fallback to network if cache API fails.
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
                }).catch((err) => {
                    // Network failed - try to return any cached version even if stale
                    console.warn('Network fetch failed, attempting cache fallback:', err);
                    return cache.match(event.request).then((fallbackResponse) => {
                        if (fallbackResponse) {
                            return fallbackResponse;
                        }
                        // No cache available - rethrow the error
                        throw err;
                    });
                });
            });
        }).catch((err) => {
            // Cache API failed - fall back to network
            console.warn('Cache API failed, falling back to network:', err);
            return fetch(event.request);
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
