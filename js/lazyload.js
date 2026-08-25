(function() {
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()||(window.CP.isDevToolOpened&&window.CP.isDevToolOpened())){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP not verified'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e2){} throw e; }
    let delegatedEventsInstalled = false;
    let sharedObserver = null;
    function getSharedObserver(){
        if(sharedObserver) return sharedObserver;
        if(!('IntersectionObserver' in window)) return null;
        sharedObserver=new IntersectionObserver(function(entries){
            entries.forEach(function(entry){
                if(entry.isIntersecting){
                    loadImage(entry.target);
                    sharedObserver.unobserve(entry.target);
                }
            });
        },{rootMargin:'300px 0px'});
        return sharedObserver;
    }
    function initializeLazyLoading() {
        if (!delegatedEventsInstalled) {
            delegatedEventsInstalled = true;
            document.addEventListener('mouseenter', function(e){
                if(e.target&&e.target.matches&&e.target.matches('img.lazy-image[data-src]')) window.loadImage(e.target);
           },{passive:true});
            document.addEventListener('touchstart', function(e){
                if(e.target&&e.target.matches&&e.target.matches('img.lazy-image[data-src]')) window.loadImage(e.target);
           },{passive:true});
        }
        var lazyImages=document.querySelectorAll('img.lazy-image[data-src]');
        var observer=getSharedObserver();
        lazyImages.forEach(function(img){
            if(img.dataset.lazyInitialized==='true') return;
            img.dataset.lazyInitialized='true';
            img.loading='lazy';
            img.decoding='async';
            if(observer) observer.observe(img);
            else window.loadImage(img);
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
