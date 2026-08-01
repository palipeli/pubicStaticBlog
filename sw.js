// sw.js - Service Worker for Image Caching and Prefetching
// Caches all images for offline use and faster subsequent loads
// Prefetches background images when requested from the main thread

const CACHE_NAME = 'michelle-dns-cache-v1';
const IMAGE_CACHE = 'michelle-images-v1';

// Install event - cache will be populated dynamically
self.addEventListener('install', (event) => {
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== IMAGE_CACHE)
                    .map((name) => caches.delete(name))
            );
        })()
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    
    // Only handle GET requests for same-origin resources
    if (event.request.method !== 'GET') return;
    
    // Handle image requests
    if (isImageRequest(url)) {
        event.respondWith(handleImageRequest(event.request));
        return;
    }
    
    // Handle page requests
    if (event.request.mode === 'navigate') {
        event.respondWith(handlePageRequest(event.request));
        return;
    }
    
    // Handle other static assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Cache successful responses
                if (networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            });
        }).catch(() => {
            // Offline fallback could go here
        })
    );
});

// Check if request is for an image
function isImageRequest(url) {
    return /\.(webp|png|jpg|jpeg|gif|svg|ico)$/i.test(url) || 
           url.includes('/media/');
}

// Handle image requests with cache-first strategy
async function handleImageRequest(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            const imageCache = await caches.open(IMAGE_CACHE);
            imageCache.put(request, responseClone);
        }
        return networkResponse;
    } catch (error) {
        // Return a placeholder or empty response for offline
        console.log('Image fetch failed:', error);
    }
}

// Handle page requests
async function handlePageRequest(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            const staticCache = await caches.open(CACHE_NAME);
            staticCache.put(request, responseClone);
        }
        return networkResponse;
    } catch (error) {
        // Offline fallback could go here
    }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PREFETCH_BACKGROUND') {
        const bgImage = event.data.image;
        event.waitUntil(
            (async () => {
                const imageCache = await caches.open(IMAGE_CACHE);
                try {
                    const response = await fetch(bgImage);
                    if (response.ok) {
                        await imageCache.put(bgImage, response);
                        console.log('Prefetched and cached:', bgImage);
                    }
                } catch (error) {
                    console.log('Prefetch failed:', error);
                }
            })()
        );
    }
    
    if (event.data && event.data.type === 'CACHE_IMAGES') {
        const images = event.data.images;
        event.waitUntil(
            (async () => {
                const imageCache = await caches.open(IMAGE_CACHE);
                for (const imgUrl of images) {
                    try {
                        const response = await fetch(imgUrl);
                        if (response.ok) {
                            await imageCache.put(imgUrl, response);
                        }
                    } catch (error) {
                        console.log('Failed to cache image:', imgUrl, error);
                    }
                }
            })()
        );
    }
});
