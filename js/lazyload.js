// lazyload.js - Image Lazy Loading with Intersection Observer
// Handles lazy loading of images when scrolled into view using IntersectionObserver

(function() {
    // Check for IntersectionObserver support
    const hasIntersectionObserver = 'IntersectionObserver' in window;
    
    // Initialize lazy loading for all images with data-src attribute
    function initializeLazyLoading() {
        const lazyImages = document.querySelectorAll('img.lazy-image[data-src]');

        if (!hasIntersectionObserver) {
            // Fallback: load all images immediately if no IntersectionObserver
            lazyImages.forEach(img => loadImage(img));
            return;
        }

        // Create a single IntersectionObserver for all lazy images
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    
                    // Skip if already initialized or loading
                    if (img.dataset.lazyInitialized === 'true') {
                        observer.unobserve(img);
                        return;
                    }
                    
                    img.dataset.lazyInitialized = 'true';
                    loadImage(img);
                    observer.unobserve(img);
                }
            });
        }, { 
            rootMargin: '50px 0px',  // Start loading 50px before image enters viewport
            threshold: 0.01          // Trigger when at least 1% of image is visible
        });

        lazyImages.forEach(img => {
            // Skip if already initialized
            if (img.dataset.lazyInitialized === 'true') return;
            
            imageObserver.observe(img);
        });
    }

    // Load image source when triggered by IntersectionObserver
    function loadImage(img) {
        const dataSrc = img.getAttribute('data-src');
        if (!dataSrc) return;

        // Check if already loaded or loading
        if (img.src === dataSrc || img.classList.contains('loading')) return;

        // Add loading class for visual feedback
        img.classList.add('loading');

        // Create a new image to preload
        const preloadImg = new Image();
        preloadImg.src = dataSrc;

        preloadImg.onload = () => {
            img.src = dataSrc;
            img.classList.remove('loading');
            img.classList.add('loaded');
            console.log(`Lazy-loaded image: ${dataSrc}`);
        };

        preloadImg.onerror = () => {
            console.error(`Failed to load lazy image: ${dataSrc}`);
            img.classList.remove('loading');
            img.classList.add('error');
            // Fallback: try loading directly
            img.src = dataSrc;
        };
    }

    // Expose functions globally
    window.initializeLazyLoading = initializeLazyLoading;
    window.loadImage = loadImage;

    // Global initialization on DOMContentLoaded
    if (typeof document !== 'undefined') {
        // Use requestIdleCallback for non-critical initialization
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                initializeLazyLoading();
            }, { timeout: 2000 });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                initializeLazyLoading();
            });
        }
    }
})();
