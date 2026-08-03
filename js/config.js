// config.js - Shared Configuration Constants
// Centralized constants to avoid magic numbers and strings scattered across modules

(function() {
    'use strict';

    const CONFIG = {
        // State persistence
        STATE_STORAGE_KEY: 'blogPlatformState',
        STATE_SAVE_DELAY: 500,        // Debounce saves with 500ms minimum interval
        
        // Selectors (for state.js)
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

    // Expose globally
    if (typeof window !== 'undefined') {
        window.CONFIG = CONFIG;
    }
    
    // Export for Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CONFIG;
    }
})();