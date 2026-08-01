// sw.js - Service Worker for Image Caching & Background Prefetch
// Caches images with cache-first strategy and supports
// on-demand background image prefetching via postMessage from main thread.
// Optimized for minimal resource usage and fast load times.

'use strict';

const CACHE_NAME = 'img-cache-v2';

// Image file extensions to intercept and cache
const IMAGE_EXTENSIONS = /\.(webp|png|jpg|jpeg|gif|svg|ico)(\?.*)?$/i;

// Maximum cache size limit (in number of entries) to prevent unbounded growth
const MAX_CACHE_SIZE = 50;

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
// Also enforce maximum cache size limit.
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
        }).then(() => {
            // Enforce cache size limit
            return enforceCacheSizeLimit();
        })
    );
});

// Enforce maximum cache size by removing oldest entries
async function enforceCacheSizeLimit() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        
        if (keys.length > MAX_CACHE_SIZE) {
            // Delete oldest entries (first in list)
            const deleteCount = keys.length - MAX_CACHE_SIZE;
            for (let i = 0; i < deleteCount; i++) {
                await cache.delete(keys[i]);
            }
            console.log(`[SW] Cache trimmed: removed ${deleteCount} old entries`);
        }
    } catch (err) {
        console.warn('[SW] Cache size enforcement failed:', err);
    }
}

// -------------------------------------------------------------------
// Fetch: cache-first for image requests.
// If the image is already cached, return it immediately, no
// network request. Only fetch from the network on a cache miss,
// then store the response for future use.
// Non-image requests pass through to the network untouched.
// -------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only intercept same-origin image requests
    if (url.origin !== self.location.origin) return;
    if (!IMAGE_EXTENSIONS.test(url.pathname)) return;
    
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

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
                        // Clone the response before caching (streams can only be consumed once)
                        const responseClone = networkResponse.clone();
                        cache.put(event.request, responseClone);
                        
                        // Asynchronously enforce cache size limit after successful cache write
                        enforceCacheSizeLimit().catch(err => {
                            console.warn('[SW] Post-fetch cache trim failed:', err);
                        });
                    }
                    return networkResponse;
                }).catch((fetchError) => {
                    // Network failed and no cache - return offline fallback or error
                    console.warn('[SW] Fetch failed for:', url.pathname, fetchError);
                    throw fetchError;
                });
            });
        }).catch((cacheError) => {
            // Cache operation failed - fallback to network
            console.warn('[SW] Cache operation failed:', cacheError);
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
                        return cache.add(data.url).then(() => {
                            console.log('[SW] Pre-cached background:', data.url);
                        });
                    }
                });
            }).catch((err) => {
                console.warn('[SW] Pre-cache failed:', err);
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
                                return cache.add(url).then(() => {
                                    console.log('[SW] Prefetched background:', url);
                                });
                            }
                        });
                    })
                );
            }).catch((err) => {
                console.warn('[SW] Prefetch failed:', err);
            })
        );
    }
});
