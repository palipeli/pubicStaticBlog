// sw-register.js - Service Worker Registration and Theme Prefetch Handler
// Registers the service worker for image caching
// Implements cursor-based prefetching for bg-dark.webp and bg-light.webp when near theme selector

(function() {
    // Register Service Worker
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                        console.log('[SW] Service Worker registered:', registration.scope);
                        
                        // Check for updates periodically
                        setInterval(() => {
                            registration.update();
                        }, 60 * 60 * 1000); // Check every hour
                    })
                    .catch((error) => {
                        console.error('[SW] Service Worker registration failed:', error);
                    });
            });
        } else {
            console.log('[SW] Service Workers not supported');
        }
    }

    // Setup cursor-based prefetching for theme background images
    function setupThemePrefetch() {
        const themeChooser = document.querySelector('.theme-chooser');
        if (!themeChooser) return;

        // Define the detection zone around the theme chooser
        const PREFETCH_DISTANCE = 150; // pixels from theme chooser

        let prefetchTriggered = false;
        let prefetchTimeout = null;

        // Function to check if cursor is near theme chooser
        function isCursorNearThemeChooser(mouseX, mouseY) {
            const rect = themeChooser.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const distanceX = Math.abs(mouseX - centerX);
            const distanceY = Math.abs(mouseY - centerY);

            // Check if cursor is within the detection zone (rectangular area)
            return distanceX <= (rect.width / 2 + PREFETCH_DISTANCE) &&
                   distanceY <= (rect.height / 2 + PREFETCH_DISTANCE);
        }

        // Handle mousemove event
        function handleMouseMove(e) {
            if (prefetchTriggered) return; // Only prefetch once per session

            if (isCursorNearThemeChooser(e.clientX, e.clientY)) {
                // Clear any existing timeout
                if (prefetchTimeout) {
                    clearTimeout(prefetchTimeout);
                }

                // Small delay to avoid accidental triggers
                prefetchTimeout = setTimeout(() => {
                    prefetchBackgroundImages();
                    prefetchTriggered = true;
                }, 100);
            }
        }

        // Prefetch background images
        function prefetchBackgroundImages() {
            const bgDarkUrl = 'media/bg-dark.webp';
            const bgLightUrl = 'media/bg-light.webp';

            console.log('[Prefetch] Prefetching background images...');

            // Method 1: Send message to Service Worker to cache images
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then((registration) => {
                    registration.active.postMessage({
                        type: 'PREFETCH_IMAGES',
                        urls: [bgDarkUrl, bgLightUrl]
                    });
                }).catch((error) => {
                    console.error('[Prefetch] Failed to send message to SW:', error);
                    // Fallback to direct fetch
                    prefetchWithFetch(bgDarkUrl, bgLightUrl);
                });
            } else {
                // Fallback: Direct fetch and cache using Cache API
                prefetchWithFetch(bgDarkUrl, bgLightUrl);
            }
        }

        // Fallback prefetch method using Cache API directly
        function prefetchWithFetch(bgDarkUrl, bgLightUrl) {
            if ('caches' in window) {
                caches.open('kamikami-images-v1').then((cache) => {
                    const urls = [bgDarkUrl, bgLightUrl];
                    
                    urls.forEach((url) => {
                        // Check if already cached
                        cache.match(url).then((cachedResponse) => {
                            if (!cachedResponse) {
                                // Not cached, fetch and store
                                fetch(url).then((response) => {
                                    if (response.ok) {
                                        cache.put(url, response.clone());
                                        console.log('[Prefetch] Cached:', url);
                                    }
                                }).catch((error) => {
                                    console.error('[Prefetch] Failed to cache:', url, error);
                                });
                            } else {
                                console.log('[Prefetch] Already cached:', url);
                            }
                        });
                    });
                });
            } else {
                // Ultimate fallback: Just trigger browser's native preload
                const linkDark = document.createElement('link');
                linkDark.rel = 'preload';
                linkDark.as = 'image';
                linkDark.href = bgDarkUrl;
                document.head.appendChild(linkDark);

                const linkLight = document.createElement('link');
                linkLight.rel = 'preload';
                linkLight.as = 'image';
                linkLight.href = bgLightUrl;
                document.head.appendChild(linkLight);
            }
        }

        // Add event listener for mouse movement
        document.addEventListener('mousemove', handleMouseMove);

        // Also prefetch on touchstart for mobile devices (when user touches near theme selector)
        themeChooser.addEventListener('touchstart', () => {
            if (!prefetchTriggered) {
                prefetchBackgroundImages();
                prefetchTriggered = true;
            }
        }, { passive: true });
    }

    // Setup blog post image caching when posts are loaded
    function setupBlogImageCaching() {
        // Known images from blog posts that should be cached
        const knownBlogImages = [
            'media/signing.webp',
            'media/dns.webp'
        ];

        // Wait for blog metadata to be loaded
        function cacheBlogImages() {
            const imageUrls = [...knownBlogImages];
            
            // If we have images to cache, send message to Service Worker
            if (imageUrls.length > 0 && navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then((registration) => {
                    registration.active.postMessage({
                        type: 'CACHE_BLOG_IMAGES',
                        urls: imageUrls
                    });
                });
            }
        }

        // Cache on DOMContentLoaded
        cacheBlogImages();
    }

    // Initialize everything when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        registerServiceWorker();
        
        // Small delay to ensure theme chooser is rendered
        setTimeout(setupThemePrefetch, 100);
        
        // Setup blog image caching
        setupBlogImageCaching();
    });
})();
