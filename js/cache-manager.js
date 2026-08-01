// cache-manager.js - Service Worker Registration and Image Prefetching
// Handles image caching and smart prefetching based on user interactions

(function() {
    let serviceWorkerRegistered = false;
    let serviceWorkerReady = false;

    // All known static images in the project
    const STATIC_IMAGES = [
        '/media/favicon-circle.webp',
        '/media/logo.webp',
        '/media/bg-dark.webp',
        '/media/bg-light.webp',
        '/media/apple.webp',
        '/media/background.webp',
        '/media/dns.webp',
        '/media/signing.webp'
    ];

    // Register service worker for image caching
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('[Cache Manager] Service Worker registered:', registration.scope);
                    serviceWorkerRegistered = true;
                    
                    // Wait for service worker to be ready
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                serviceWorkerReady = true;
                                console.log('[Cache Manager] Service Worker is ready');
                            }
                        });
                    });
                    
                    // Check if already active
                    if (registration.active) {
                        serviceWorkerReady = true;
                        console.log('[Cache Manager] Service Worker already active');
                    }
                })
                .catch((error) => {
                    console.error('[Cache Manager] Service Worker registration failed:', error);
                });
        } else {
            console.log('[Cache Manager] Service Workers not supported, using browser cache only');
        }
    }

    // Send message to service worker to prefetch images
    function prefetchImages(urls) {
        if (!serviceWorkerRegistered) {
            console.log('[Cache Manager] Service Worker not registered, skipping prefetch');
            return;
        }

        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.active.postMessage({
                    type: 'PREFETCH_IMAGES',
                    urls: urls
                });
                console.log('[Cache Manager] Prefetch request sent for:', urls);
            }).catch((error) => {
                console.error('[Cache Manager] Failed to send prefetch message:', error);
            });
        } else {
            // If no controller yet, pre-load using Image objects
            urls.forEach(url => {
                const img = new Image();
                img.src = url;
                console.log('[Cache Manager] Preloading image (fallback):', url);
            });
        }
    }

    // Setup hover detection near theme selector for background prefetch
    function setupThemeBackgroundPrefetch() {
        const themeChooser = document.querySelector('.theme-chooser');
        if (!themeChooser) return;

        // Define the area around theme selector (including sidebar area)
        const sidebar = document.getElementById('sidebar');
        
        // Create a larger hover zone around the theme selector
        const hoverZone = document.createElement('div');
        hoverZone.id = 'theme-hover-zone';
        hoverZone.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
        `;
        
        // Add hover zone to sidebar
        if (sidebar) {
            sidebar.style.position = 'relative';
            sidebar.appendChild(hoverZone);
        }

        let prefetched = false;
        let hoverTimeout = null;

        // Function to handle hover near theme selector
        function handleHoverNearTheme() {
            if (prefetched) return;

            // Clear any existing timeout
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }

            // Set a small delay to avoid accidental triggers
            hoverTimeout = setTimeout(() => {
                console.log('[Cache Manager] Hover detected near theme selector, prefetching backgrounds');
                
                // Prefetch both background images
                prefetchImages([
                    '/media/bg-dark.webp',
                    '/media/bg-light.webp'
                ]);
                
                prefetched = true;
                
                // Remove hover listener after prefetch
                if (hoverZone) {
                    hoverZone.removeEventListener('mouseenter', handleHoverNearTheme);
                }
                if (themeChooser) {
                    themeChooser.removeEventListener('mouseenter', handleHoverNearTheme);
                }
            }, 50); // 50ms delay
        }

        // Listen for hover on the hover zone (covers entire sidebar)
        if (hoverZone) {
            hoverZone.addEventListener('mouseenter', handleHoverNearTheme);
        }
        
        // Also listen directly on theme chooser
        if (themeChooser) {
            themeChooser.addEventListener('mouseenter', handleHoverNearTheme);
        }
    }

    // Setup image lazy loading with cache awareness
    function setupSmartImageLoading() {
        // Preload critical images immediately using link preload
        const imagesToPreload = [
            '/media/favicon-circle.webp',
            '/media/logo.webp',
            '/media/apple.webp',
            '/media/dns.webp',
            '/media/signing.webp'
        ];

        // Preload critical images immediately
        imagesToPreload.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = url;
            document.head.appendChild(link);
        });

        console.log('[Cache Manager] Critical images preloaded');
    }

    // Extract image URLs from markdown content and cache them
    function extractAndCacheBlogImages(markdownContent) {
        if (!markdownContent) return [];
        
        // Match markdown image syntax: ![alt](url) or ![alt](url "title")
        const markdownImageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
        // Match HTML image tags: <img src="url">
        const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        
        const images = new Set();
        let match;
        
        // Extract from markdown syntax
        while ((match = markdownImageRegex.exec(markdownContent)) !== null) {
            const imageUrl = match[2];
            // Only add relative URLs (internal images)
            if (imageUrl.startsWith('/') || !imageUrl.includes('://')) {
                images.add(imageUrl);
            }
        }
        
        // Extract from HTML img tags
        while ((match = htmlImageRegex.exec(markdownContent)) !== null) {
            const imageUrl = match[1];
            // Only add relative URLs (internal images)
            if (imageUrl.startsWith('/') || !imageUrl.includes('://')) {
                images.add(imageUrl);
            }
        }
        
        return Array.from(images);
    }

    // Cache images from a blog post when it's loaded
    function cacheBlogPostImages(postId, markdownContent) {
        const images = extractAndCacheBlogImages(markdownContent);
        if (images.length > 0) {
            console.log('[Cache Manager] Caching images for blog post:', postId, images);
            prefetchImages(images);
        }
    }

    // Monitor blog post loading and cache images
    function setupBlogImageCaching() {
        // Wrap the loadBlogPostContent function to cache images
        const originalLoadBlogPostContent = window.loadBlogPostContent;
        if (originalLoadBlogPostContent) {
            window.loadBlogPostContent = async function(postId) {
                const post = await originalLoadBlogPostContent(postId);
                if (post && post.content) {
                    cacheBlogPostImages(postId, post.content);
                }
                return post;
            };
        }
    }

    // Initialize cache manager
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                registerServiceWorker();
                setupSmartImageLoading();
                setupThemeBackgroundPrefetch();
                setupBlogImageCaching();
            });
        } else {
            registerServiceWorker();
            setupSmartImageLoading();
            setupThemeBackgroundPrefetch();
            setupBlogImageCaching();
        }
    }

    // Expose functions globally
    window.prefetchImages = prefetchImages;
    window.registerServiceWorker = registerServiceWorker;
    window.cacheBlogPostImages = cacheBlogPostImages;
    window.extractAndCacheBlogImages = extractAndCacheBlogImages;

    // Start initialization
    init();
})();
