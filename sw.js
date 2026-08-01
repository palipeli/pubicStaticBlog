// Service Worker for Image Caching
// Caches all static images to avoid re-fetching on navigation

const CACHE_NAME = 'image-cache-v1';
const IMAGE_CACHE = 'images-v1';

// Images to cache on install
const IMAGES_TO_CACHE = [
    '/media/favicon-circle.webp',
    '/media/logo.webp',
    '/media/bg-dark.webp',
    '/media/bg-light.webp',
    '/media/apple.webp',
    '/media/background.webp',
    '/media/dns.webp',
    '/media/signing.webp'
];

// Install event - cache all images
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(IMAGE_CACHE).then((cache) => {
            console.log('[Service Worker] Caching images on install');
            return cache.addAll(IMAGES_TO_CACHE);
        }).catch((error) => {
            console.log('[Service Worker] Failed to cache images:', error);
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
                    // Don't delete our current image cache
                    if (cacheName !== IMAGE_CACHE) {
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
    const url = event.request.url;
    
    // Only handle image requests
    if (isImageRequest(event.request)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached image
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network
                return fetch(event.request).then((networkResponse) => {
                    // Clone the response because it's a stream
                    const responseToCache = networkResponse.clone();
                    
                    // Cache the new image for future use
                    caches.open(IMAGE_CACHE).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    
                    return networkResponse;
                });
            }).catch(() => {
                // If both cache and network fail, return a placeholder or empty response
                console.log('[Service Worker] Failed to fetch image:', url);
            })
        );
    }
    // For non-image requests, let the browser handle normally
});

// Helper function to check if request is for an image
function isImageRequest(request) {
    const url = request.url;
    const destination = request.destination;
    
    // Check by destination type
    if (destination === 'image') {
        return true;
    }
    
    // Check by file extension
    const imageExtensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
}

// Listen for messages from main thread (e.g., to prefetch specific images)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PREFETCH_IMAGES') {
        const urls = event.data.urls;
        if (urls && Array.isArray(urls)) {
            event.waitUntil(
                caches.open(IMAGE_CACHE).then((cache) => {
                    console.log('[Service Worker] Prefetching images:', urls);
                    return cache.addAll(urls);
                })
            );
        }
    }
});
