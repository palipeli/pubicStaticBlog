(function() {

    function initializeLazyLoading() {
        const lazyImages = document.querySelectorAll('img.lazy-image[data-src]');

        lazyImages.forEach(img => {

            if (img.dataset.lazyInitialized === 'true') return;

            img.dataset.lazyInitialized = 'true';

            img.loading = 'lazy';

            img.addEventListener('mouseenter', () => {
                loadImage(img);
            }, {passive: true});

            img.addEventListener('touchstart', () => {
                loadImage(img);
            }, {passive: true});

            if ('IntersectionObserver' in window) {
                const imgObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            loadImage(entry.target);
                            observer.unobserve(entry.target);
                        }
                    });
                }, {rootMargin: '10px 0px'});

                imgObserver.observe(img);
            }
        });
    }

    function loadImage(img) {
        const dataSrc = img.getAttribute('data-src');
        if (!dataSrc) return;

        if (img.classList.contains('loaded') || img.classList.contains('loading')) return;

        img.classList.add('loading');

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

            img.src = dataSrc;
        };
    }

    window.initializeLazyLoading = initializeLazyLoading;

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {

            initializeLazyLoading();
        });
    }
})();
