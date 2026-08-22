(function() {
    'use strict';
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()||(window.CP.isDevToolOpened&&window.CP.isDevToolOpened())){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP not verified'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e2){} throw e; }
    const CONFIG = {
        STATE_STORAGE_KEY: 'blogPlatformState',
        STATE_SAVE_DELAY: 500,
        SELECTORS: {
            ACTIVE_SECTION: '.page-section.active',
            POST_SELECTOR_ITEM: '.post-selector-item',
            THEME_BTN: '.theme-btn',
            NAV_ITEM: '.nav-item',
            SIDEBAR: '#sidebar',
            SIDEBAR_TOGGLE: '#sidebar-toggle',
            BLOG_POST_VIEW: '#blog-post-view',
            BACK_BUTTON: '.back-to-intro-btn'
        }
    };
    if (typeof window !== 'undefined') {
        window.CONFIG = CONFIG;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CONFIG;
    }
})();
