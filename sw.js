// sw.js - Service Worker for Image Caching and Prefetching
// Caches all images in the media folder for offline use and faster loading
// Also handles prefetching of background images when cursor is near theme selector

const CACHE_NAME = 'kamikami-cache-v1';
const IMAGE_CACHE = 'kamikami-images-v1';

// Assets to cache on install
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/liquid-glass.css',
    '/js/app.js',
    '/js/blog.js',
    '/js/devotional.js',
    '/js/home.js',
    '/js/lazyload.js',
    '/js/markdown.js',
    '/js/mobile-tray.js',
    '/js/state.js',
    '/js/ui.js',
    '/media/favicon-circle.webp',
    '/media/logo.webp',
    '/media/apple.webp',
    '/media/background.webp',
    '/media/bg-dark.webp',
    '/media/bg-light.webp',
    '/media/dns.webp',
    '/media/signing.webp',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=VT323&display=swap'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching core assets');
            return cache.addAll(ASSETS_TO_CACHE);
        }).catch((error) => {
            console.error('[SW] Failed to cache assets:', error);
        })
    );
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Claim all clients immediately
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin requests or known CDNs
    if (url.origin !== location.origin && 
        !url.origin.includes('cdnjs.cloudflare.com') && 
        !url.origin.includes('fonts.googleapis.com') &&
        !url.origin.includes('fonts.gstatic.com')) {
        return;
    }

    // Cache-first strategy for images
    if (request.destination === 'image' || 
        url.pathname.startsWith('/media/') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.gif') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.ico')) {
        
        event.respondWith(
            caches.open(IMAGE_CACHE).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached image immediately
                        return cachedResponse;
                    }
                    
                    // Not in cache, fetch from network
                    return fetch(request).then((networkResponse) => {
                        // Clone the response for caching
                        const responseToCache = networkResponse.clone();
                        
                        // Cache the image for future use
                        if (networkResponse.ok) {
                            cache.put(request, responseToCache);
                        }
                        
                        return networkResponse;
                    }).catch((error) => {
                        console.error('[SW] Failed to fetch image:', request.url, error);
                        // Return a placeholder or empty response for failed images
                        return new Response('', { status: 404 });
                    });
                });
            })
        );
        return;
    }

    // Network-first strategy for HTML and JS (with cache fallback)
    if (request.destination === 'document' || 
        request.destination === 'script' ||
        request.destination === 'style') {
        
        event.respondWith(
            fetch(request).then((networkResponse) => {
                // Clone the response for caching
                const responseToCache = networkResponse.clone();
                
                // Cache successful responses
                if (networkResponse.ok) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                
                return networkResponse;
            }).catch(() => {
                // Fetch failed, try cache
                return caches.match(request);
            })
        );
        return;
    }

    // Default: network-first with cache fallback
    event.respondWith(
        fetch(request).then((networkResponse) => {
            return networkResponse;
        }).catch(() => {
            return caches.match(request);
        })
    );
});

// Message event - handle prefetch requests from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PREFETCH_IMAGES') {
        const urls = event.data.urls;
        console.log('[SW] Prefetching images:', urls);
        
        event.waitUntil(
            caches.open(IMAGE_CACHE).then((cache) => {
                return Promise.all(
                    urls.map((url) => {
                        // Check if already cached
                        return cache.match(url).then((cachedResponse) => {
                            if (!cachedResponse) {
                                // Not cached, fetch and store
                                return fetch(url).then((response) => {
                                    if (response.ok) {
                                        return cache.put(url, response.clone());
                                    }
                                }).catch((error) => {
                                    console.error('[SW] Failed to prefetch:', url, error);
                                });
                            }
                        });
                    })
                );
            })
        );
    }
    
    if (event.data && event.data.type === 'CACHE_BLOG_IMAGES') {
        const urls = event.data.urls;
        console.log('[SW] Caching blog images:', urls);
        
        event.waitUntil(
            caches.open(IMAGE_CACHE).then((cache) => {
                return Promise.all(
                    urls.map((url) => {
                        return cache.match(url).then((cachedResponse) => {
                            if (!cachedResponse) {
                                return fetch(url).then((response) => {
                                    if (response.ok) {
                                        return cache.put(url, response.clone());
                                    }
                                }).catch((error) => {
                                    console.error('[SW] Failed to cache blog image:', url, error);
                                });
                            }
                        });
                    })
                );
            })
        );
    }
});
