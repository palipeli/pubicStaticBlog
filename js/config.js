(function() {
    'use strict';
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
