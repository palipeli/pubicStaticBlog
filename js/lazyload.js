// lazyload.js - Image Lazy Loading
// Handles lazy loading of images with multiple triggers: hover, touch, intersection, and native loading

(function() {
    // Track IntersectionObserver instances for cleanup
    const activeObservers = new Set();

    // Initialize lazy loading for all images with data-src attribute
    function initializeLazyLoading() {
        const lazyImages = document.querySelectorAll('img.lazy-image[data-src]');

        lazyImages.forEach(img => {
            // Skip if already initialized
            if (img.dataset.lazyInitialized === 'true') return;

            img.dataset.lazyInitialized = 'true';

            // Add native lazy loading attribute as fallback
            img.loading = 'lazy';

            // Load image on hover (mouseenter) - desktop
            img.addEventListener('mouseenter', () => {
                loadImage(img);
            }, { passive: true });

            // Load image on touchstart - mobile
            img.addEventListener('touchstart', () => {
                loadImage(img);
            }, { passive: true });

            // Also load on intersection (when scrolled into view) as a fallback
            if ('IntersectionObserver' in window) {
                const imgObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            loadImage(entry.target);
                            observer.unobserve(entry.target);
                        }
                    });
                }, { rootMargin: '10px 0px' });

                imgObserver.observe(img);
                activeObservers.add(imgObserver);
            }
        });
    }

    // Load image source when triggered
    function loadImage(img) {
        const dataSrc = img.getAttribute('data-src');
        if (!dataSrc) return;

        // Check if already loaded or loading
        if (img.classList.contains('loaded') || img.classList.contains('loading')) return;

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

    // Cleanup all observers (call on page navigation/unload)
    function cleanupLazyLoading() {
        activeObservers.forEach(observer => {
            observer.disconnect();
        });
        activeObservers.clear();
    }

    // Expose functions globally
    window.initializeLazyLoading = initializeLazyLoading;
    window.loadImageOnHover = loadImage; // Alias for backward compatibility
    window.loadImage = loadImage;
    window.cleanupLazyLoading = cleanupLazyLoading;

    // Global initialization on DOMContentLoaded
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            // Initial setup for any static lazy images
            initializeLazyLoading();
        });
    }
})();
