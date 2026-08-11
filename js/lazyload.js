(function() {
    const observedImages = new Set();
    let imgObserver = null;
    function initializeLazyLoading() {
        if (!('IntersectionObserver' in window)) {
            const lazyImages = document.querySelectorAll('img.lazy-image[data-src]');
            lazyImages.forEach(img => {
                if (img.dataset.lazyInitialized === 'true') return;
                img.dataset.lazyInitialized = 'true';
                img.loading = 'lazy';
            });
            return;
        }
        if (!imgObserver) {
            imgObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        loadImage(entry.target);
                        imgObserver.unobserve(entry.target);
                        observedImages.delete(entry.target);
                    }
                });
            }, {rootMargin: '10px 0px'});
        }
        const lazyImages = document.querySelectorAll('img.lazy-image[data-src]');
        lazyImages.forEach(img => {
            if (img.dataset.lazyInitialized === 'true') return;
            img.dataset.lazyInitialized = 'true';
            img.loading = 'lazy';
            observedImages.add(img);
            imgObserver.observe(img);
        });
    }
    function loadImage(img) {
        const dataSrc = img.getAttribute('data-src');
        if (!dataSrc) return;
        if (img.classList.contains('loaded') || img.classList.contains('loading')) return;
        img.classList.add('loading');
        const handleLoad = () => {
            img.classList.remove('loading');
            img.classList.add('loaded');
        };
        img.addEventListener('load', handleLoad, {once: true});
        img.addEventListener('error', () => {
            img.classList.remove('loading');
            img.classList.add('error');
        }, {once: true});
        img.src = dataSrc;
    }
    window.initializeLazyLoading = initializeLazyLoading;
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeLazyLoading();
        });
    }
})();
