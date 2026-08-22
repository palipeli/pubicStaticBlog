(function() {
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()||(window.CP.isDevToolOpened&&window.CP.isDevToolOpened())){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP not verified'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e2){} throw e; }
    let delegatedEventsInstalled = false;
    function initializeLazyLoading() {
        if (!delegatedEventsInstalled) {
            delegatedEventsInstalled = true;
            document.addEventListener('mouseenter', (e) => {
                if (e.target && e.target.matches('img.lazy-image[data-src]')) {
                    window.loadImage(e.target);
                }
            }, { passive: true });
            document.addEventListener('touchstart', (e) => {
                if (e.target && e.target.matches('img.lazy-image[data-src]')) {
                    window.loadImage(e.target);
                }
            }, { passive: true });
        }
        const lazyImages = document.querySelectorAll('img.lazy-image[data-src]');
        lazyImages.forEach(img => {
            if (img.dataset.lazyInitialized === 'true') return;
            img.dataset.lazyInitialized = 'true';
            img.loading = 'lazy';
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
    window.loadImage = loadImage;
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeLazyLoading();
        });
    }
})();
