// state.js - Application State Persistence
// Handles saving and restoring application state to localStorage

(function() {
    'use strict';

    // Constants
    const STATE_STORAGE_KEY = 'blogPlatformState';
    const STATE_SAVE_DELAY = 100;
    const STATE_AUTO_SAVE_INTERVAL = 30000;
    const BLOG_POST_RESTORE_DELAY = 300;

    // Selectors
    const SELECTORS = {
        ACTIVE_SECTION: '.page-section.active',
        POST_SELECTOR_ITEM: '.post-selector-item',
        THEME_BTN: '.theme-btn',
        NAV_ITEM: '.nav-item',
        SIDEBAR: '#sidebar',
        SIDEBAR_TOGGLE: '#sidebar-toggle',
        BLOG_POST_VIEW: '#blog-post-view',
        BACK_BUTTON: '.back-to-intro-btn'
    };

    /**
     * Get current active page
     * @returns {string} Current page ID or 'home'
     */
    function getCurrentPage() {
        const activeSection = document.querySelector(SELECTORS.ACTIVE_SECTION);
        return activeSection ? activeSection.id : 'home';
    }

    /**
     * Get currently active blog post ID (if viewing a post)
     * @returns {string|null} Post ID or null
     */
    function getActiveBlogPostId() {
        const postView = document.getElementById(SELECTORS.BLOG_POST_VIEW.substring(1));
        if (postView && postView.style.display !== 'none') {
            const activeItem = document.querySelector(SELECTORS.POST_SELECTOR_ITEM + '.active');
            if (activeItem) {
                return activeItem.getAttribute('data-post-id');
            }
        }
        return null;
    }

    /**
     * Check if sidebar is collapsed
     * @returns {boolean} True if sidebar is collapsed
     */
    function isSidebarCollapsed() {
        const sidebar = document.getElementById(SELECTORS.SIDEBAR.substring(1));
        return sidebar ? sidebar.classList.contains('collapsed') : false;
    }

    /**
     * Get current theme
     * @returns {string} Current theme name or 'auto'
     */
    function getCurrentTheme() {
        const activeThemeBtn = document.querySelector(SELECTORS.THEME_BTN + '.active');
        return activeThemeBtn ? activeThemeBtn.dataset.theme : 'auto';
    }

    /**
     * Save current application state to localStorage
     */
    function saveAppState() {
        const currentState = {
            currentPage: getCurrentPage(),
            activeBlogPost: getActiveBlogPostId(),
            sidebarCollapsed: isSidebarCollapsed(),
            theme: getCurrentTheme(),
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(currentState));
            console.log('App state saved:', currentState);
        } catch (err) {
            console.warn('Failed to save app state:', err);
        }
    }

    /**
     * Load application state from localStorage
     * @returns {Object|null} Saved state or null
     */
    function loadAppState() {
        try {
            const savedState = localStorage.getItem(STATE_STORAGE_KEY);
            if (savedState) {
                const state = JSON.parse(savedState);
                console.log('Loaded app state:', state);
                return state;
            }
        } catch (err) {
            console.warn('Failed to load app state:', err);
        }
        return null;
    }

    /**
     * Clear saved state (useful for logout or reset)
     */
    function clearAppState() {
        try {
            localStorage.removeItem(STATE_STORAGE_KEY);
            console.log('App state cleared');
        } catch (err) {
            console.warn('Failed to clear app state:', err);
        }
    }

    /**
     * Apply saved state to the application
     * @param {Object} state - State object to apply
     */
    function applySavedState(state) {
        console.log('Applying saved state:', state);

        // Restore theme first (before other UI updates)
        if (state.theme) {
            const themeBtn = document.querySelector(`${SELECTORS.THEME_BTN}[data-theme="${state.theme}"]`);
            if (themeBtn && !themeBtn.classList.contains('active')) {
                themeBtn.click();
            }
        }

        // Restore sidebar state
        if (state.sidebarCollapsed) {
            const sidebar = document.getElementById(SELECTORS.SIDEBAR.substring(1));
            if (sidebar && !sidebar.classList.contains('collapsed')) {
                const toggleBtn = document.getElementById(SELECTORS.SIDEBAR_TOGGLE.substring(1));
                if (toggleBtn) {
                    toggleBtn.click();
                }
            }
        }

        // Restore page navigation
        if (state.currentPage && state.currentPage !== 'home') {
            const navItem = document.querySelector(`${SELECTORS.NAV_ITEM}[data-page="${state.currentPage}"]`);
            if (navItem) {
                navItem.click();
            }
        }

        // Restore blog post view (must be done after navigating to blogs page)
        if (state.activeBlogPost && state.currentPage === 'blogs') {
            setTimeout(() => {
                if (typeof window.openBlogPostLazy === 'function') {
                    window.openBlogPostLazy(state.activeBlogPost);
                }
            }, BLOG_POST_RESTORE_DELAY);
        }
    }

    /**
     * Restore application state after page load
     */
    function restoreAppState() {
        const savedState = loadAppState();
        if (!savedState) {
            console.log('No saved state to restore');
            return;
        }

        // Wait for DOM to be ready and blog posts to be loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => applySavedState(savedState));
        } else {
            applySavedState(savedState);
        }
    }

    /**
     * Handle state persistence on user interactions
     * @param {Event} e - Click event
     */
    function handleInteraction(e) {
        const interactiveSelectors = [
            SELECTORS.NAV_ITEM,
            SELECTORS.POST_SELECTOR_ITEM,
            SELECTORS.BACK_BUTTON,
            SELECTORS.THEME_BTN,
            SELECTORS.SIDEBAR_TOGGLE
        ];

        const isInteractive = interactiveSelectors.some(selector => 
            e.target.closest(selector)
        );

        if (isInteractive) {
            setTimeout(saveAppState, STATE_SAVE_DELAY);
        }
    }

    /**
     * Auto-save state on various user actions
     */
    function setupStatePersistence() {
        // Save state when navigating between pages
        document.addEventListener('click', handleInteraction);

        // Also save before page unload
        window.addEventListener('beforeunload', saveAppState);

        // Save state periodically (every 30 seconds) as backup
        setInterval(saveAppState, STATE_AUTO_SAVE_INTERVAL);
    }

    // Expose functions globally
    window.saveAppState = saveAppState;
    window.loadAppState = loadAppState;
    window.clearAppState = clearAppState;
    window.restoreAppState = restoreAppState;
    window.applySavedState = applySavedState;
    window.setupStatePersistence = setupStatePersistence;
    window.getCurrentPage = getCurrentPage;
    window.getActiveBlogPostId = getActiveBlogPostId;
    window.isSidebarCollapsed = isSidebarCollapsed;
    window.getCurrentTheme = getCurrentTheme;
})();
