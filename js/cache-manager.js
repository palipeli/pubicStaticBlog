// cache-manager.js - Service Worker Registration and Image Caching Management
// Handles service worker registration, image caching, and background prefetch on hover

(function() {
    'use strict';
    
    const CACHE_NAME = 'michelle-dns-cache-v1';
    const IMAGE_CACHE = 'michelle-images-v1';
    
    // All media assets in the project
    const ALL_MEDIA_ASSETS = [
        '/media/favicon-circle.webp',
        '/media/logo.webp',
        '/media/apple.webp',
        '/media/background.webp',
        '/media/dns.webp',
        '/media/signing.webp',
        '/media/bg-dark.webp',
        '/media/bg-light.webp'
    ];
    
    let swRegistered = false;
    let bgPrefetchTriggered = false;
    
    // Detect system color scheme
    function getSystemColorScheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // Register service worker
    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('Service Worker not supported');
            return false;
        }
        
        if (swRegistered) {
            return true;
        }
        
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            
            console.log('Service Worker registered:', registration.scope);
            
            // Wait for service worker to be ready
            if (registration.active) {
                swRegistered = true;
                return true;
            }
            
            return new Promise((resolve) => {
                registration.addEventListener('updatefound', () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.addEventListener('statechange', () => {
                            if (installingWorker.state === 'activated') {
                                swRegistered = true;
                                resolve(true);
                            }
                        });
                    }
                });
                
                // Timeout after 5 seconds
                setTimeout(() => resolve(true), 5000);
            });
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return false;
        }
    }
    
    // Preload images using Image objects (browser cache)
    function preloadImages(imageUrls) {
        imageUrls.forEach(url => {
            const img = new Image();
            img.src = url;
            // Images will be cached by the browser
        });
    }
    
    // Prefetch BOTH background images for instant theme switching
    function prefetchBothBackgrounds() {
        if (bgPrefetchTriggered) return;
        
        const bgImages = ['/media/bg-dark.webp', '/media/bg-light.webp'];
        
        // Method 1: Use link rel="prefetch" for both backgrounds
        bgImages.forEach(bgImage => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'image';
            link.href = bgImage;
            document.head.appendChild(link);
            
            // Method 2: Also preload with Image object
            const img = new Image();
            img.src = bgImage;
        });
        
        // Method 3: Send message to service worker to cache both
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.active.postMessage({
                    type: 'CACHE_IMAGES',
                    images: bgImages
                });
            });
        } else if ('serviceWorker' in navigator) {
            // If SW not yet controlling, wait for it
            navigator.serviceWorker.ready.then(registration => {
                registration.active.postMessage({
                    type: 'CACHE_IMAGES',
                    images: bgImages
                });
            });
        }
        
        bgPrefetchTriggered = true;
        console.log('Prefetching both background images for instant theme switching');
    }
    
    // Setup hover detection near theme selector
    function setupThemeHoverPrefetch() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        
        // Function to handle hover near theme selector
        const handleHoverNearTheme = () => {
            prefetchBothBackgrounds();
        };
        
        // Add event listener for mouseenter on sidebar (larger hover zone)
        sidebar.addEventListener('mouseenter', handleHoverNearTheme, { once: true });
        
        // Also add listeners to individual theme buttons for more precise detection
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach(btn => {
            btn.addEventListener('mouseenter', handleHoverNearTheme, { once: true });
        });
        
        // Add a broader hover zone around the theme section
        const themeSection = sidebar.querySelector('.sidebar-section');
        if (themeSection) {
            themeSection.addEventListener('mouseenter', handleHoverNearTheme, { once: true });
        }
    }
    
    // Cache all blog post images from posts.json
    async function cacheBlogImages() {
        try {
            const response = await fetch('/blog/posts.json');
            if (!response.ok) throw new Error('Failed to fetch posts.json');
            
            const posts = await response.json();
            const imageUrls = [];
            
            // Extract image URLs from posts
            posts.forEach(post => {
                if (post.image) {
                    // Handle both absolute and relative paths
                    const imageUrl = post.image.startsWith('/') || post.image.startsWith('http') 
                        ? post.image 
                        : '/blog/' + post.image;
                    imageUrls.push(imageUrl);
                }
            });
            
            // Preload blog images
            if (imageUrls.length > 0) {
                preloadImages(imageUrls);
                
                // Also send to service worker for persistent caching
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'CACHE_IMAGES',
                        images: imageUrls
                    });
                }
                
                console.log('Caching blog images:', imageUrls);
            }
        } catch (error) {
            console.log('Could not cache blog images:', error);
        }
    }
    
    // Initialize caching system
    async function init() {
        // Register service worker
        await registerServiceWorker();
        
        // Preload critical images immediately
        preloadImages([
            '/media/favicon-circle.webp',
            '/media/logo.webp'
        ]);
        
        // Cache blog images
        await cacheBlogImages();
        
        // Setup theme hover prefetch
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupThemeHoverPrefetch);
        } else {
            setupThemeHoverPrefetch();
        }
        
        // Listen for theme changes to ensure both backgrounds are cached
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Ensure both backgrounds are cached when user interacts with theme
                prefetchBothBackgrounds();
            });
        });
        
        console.log('Cache Manager initialized');
    }
    
    // Expose public API
    window.CacheManager = {
        registerServiceWorker,
        preloadImages,
        prefetchBothBackgrounds,
        getSystemColorScheme
    };
    
    // Auto-initialize
    init();
})();
