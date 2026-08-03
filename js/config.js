// config.js - Shared Configuration Constants
// Centralized constants to avoid magic numbers and strings scattered across modules

(function() {
    'use strict';

    const CONFIG = {
        // Breakpoints
        MOBILE_BREAKPOINT: 768,
        
        // State persistence
        STATE_STORAGE_KEY: 'blogPlatformState',
        STATE_SAVE_DELAY: 500,        // Debounce saves with 500ms minimum interval
        STATE_AUTO_SAVE_INTERVAL: 30000, // 30 seconds
        
        // Lazy loading
        PRELOAD_DEBOUNCE_MS: 150,
        
        // Theme
        THEME_TRANSITION_DURATION: 400,
        
        // Blog
        BLOG_POST_RESTORE_DELAY: 300,
        
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
        },
        
        // Theme colors (reference only - actual values in CSS)
        THEMES: {
            LIGHT: {
                BG_DARK: '#f6f5f4',
                BG_PANEL: 'rgba(255, 255, 255, 0.72)',
                BG_HEADER: 'rgba(246, 245, 244, 0.85)',
                ACCENT_PINK: '#ff45fc',
                ACCENT_PINK_HOVER: '#e031e0',
                TEXT_PRIMARY: '#2e3436',
                TEXT_SECONDARY: '#5e5e5e',
                BORDER_COLOR: 'rgba(0, 0, 0, 0.08)',
                BLUR_OVERLAY_BRIGHTNESS: 1.0,
                DARK_OVERLAY_COLOR: 'rgba(255, 255, 255, 0.92)',
                BTN_BG: 'rgba(255, 255, 255, 0.6)',
                BTN_TEXT: '#2e3436',
                BTN_BORDER: 'rgba(0, 0, 0, 0.2)',
                BTN_HOVER_BG: 'rgba(240, 240, 240, 0.7)'
            },
            DARK: {
                BG_DARK: '#121212',
                BG_PANEL: 'rgba(26, 26, 26, 0.75)',
                BG_HEADER: 'rgba(18, 18, 18, 0.85)',
                ACCENT_PINK: '#ff45fc',
                ACCENT_PINK_HOVER: '#e031e0',
                TEXT_PRIMARY: '#ffffff',
                TEXT_SECONDARY: '#9a9a9a',
                BORDER_COLOR: 'rgba(255, 255, 255, 0.12)',
                BLUR_OVERLAY_BRIGHTNESS: 0.3,
                DARK_OVERLAY_COLOR: 'rgba(0, 0, 0, 0.92)',
                BTN_BG: 'rgba(26, 26, 26, 0.6)',
                BTN_TEXT: '#ffffff',
                BTN_BORDER: 'rgba(255, 255, 255, 0.2)',
                BTN_HOVER_BG: 'rgba(10, 10, 10, 0.7)'
            }
        },
        
        // File paths
        PATHS: {
            BLOG_POSTS_MANIFEST: '/blog/posts.json',
            BIBLE_VERSES: '/blog/nt_verses_compact.json',
            BACKGROUND_DARK: '/media/bg-dark.webp',
            BACKGROUND_LIGHT: '/media/bg-light.webp',
            FAVICON: '/media/favicon-circle.webp',
            LOGO: '/media/logo.webp'
        },
        
        // Cache names
        CACHE_NAMES: {
            STATIC: 'static-assets-v2',
            IMAGE: 'images-v2',
            CONTENT: 'blog-content-v2',
            MAIN: 'pubic-static-blog-v2'
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