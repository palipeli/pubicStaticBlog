// lazyload.js - Image Lazy Loading on Hover
// Handles lazy loading of images when hovered or scrolled into view
// Optimized for performance with native lazy loading fallback

(function() {
    // Initialize lazy loading for all images with data-src attribute
    function initializeLazyLoading() {
        const lazyImages = document.querySelectorAll('img.lazy-image[data-src]');

        lazyImages.forEach(img => {
            // Skip if already initialized
            if (img.dataset.lazyInitialized === 'true') return;

            img.dataset.lazyInitialized = 'true';

            // Use native lazy loading as primary method (better performance)
            img.loading = 'lazy';
            
            // Add fetchpriority for above-fold images
            if (img.getBoundingClientRect().top < window.innerHeight) {
                img.fetchpriority = 'high';
            }

            // Load image on hover (mouseenter) for instant feedback
            img.addEventListener('mouseenter', () => {
                loadImageOnHover(img);
            }, { passive: true });

            // Also load on intersection (when scrolled into view) as a fallback
            if ('IntersectionObserver' in window) {
                const imgObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            loadImageOnHover(entry.target);
                            observer.unobserve(entry.target);
                        }
                    });
                }, { rootMargin: '100px 0px' }); // Increased root margin for better UX

                imgObserver.observe(img);
            }
        });
    }

    // Load image source when triggered (hover or intersection)
    function loadImageOnHover(img) {
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
            // Remove console.log for production performance
        };

        preloadImg.onerror = () => {
            img.classList.remove('loading');
            img.classList.add('error');
            // Fallback: try loading directly
            img.src = dataSrc;
        };
    }

    // Expose functions globally
    window.initializeLazyLoading = initializeLazyLoading;
    window.loadImageOnHover = loadImageOnHover;

    // Global initialization on DOMContentLoaded
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            // Initial setup for any static lazy images
            initializeLazyLoading();
        });
    }
})();
