(function() {
    'use strict';
    const CONFIG = window.CONFIG || {};
    const STATE_STORAGE_KEY = CONFIG.STATE_STORAGE_KEY || 'blogPlatformState';
    const STATE_SAVE_DELAY = CONFIG.STATE_SAVE_DELAY || 500;
    const SELECTORS = CONFIG.SELECTORS || {
        ACTIVE_SECTION: '.page-section.active',
        POST_SELECTOR_ITEM: '.post-selector-item',
        THEME_BTN: '.theme-btn',
        NAV_ITEM: '.nav-item',
        SIDEBAR: '#sidebar',
        SIDEBAR_TOGGLE: '#sidebar-toggle',
        BLOG_POST_VIEW: '#blog-post-view',
        BACK_BUTTON: '.back-to-intro-btn'
    };
    function getCurrentPage() {
        const activeSection = document.querySelector(SELECTORS.ACTIVE_SECTION);
        return activeSection ? activeSection.id : 'home';
    }
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
    function isSidebarCollapsed() {
        const sidebar = document.getElementById(SELECTORS.SIDEBAR.substring(1));
        return sidebar ? sidebar.classList.contains('collapsed') : false;
    }
    function getCurrentTheme() {
        const activeThemeBtn = document.querySelector(SELECTORS.THEME_BTN + '.active');
        return activeThemeBtn ? activeThemeBtn.dataset.theme : 'auto';
    }
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
            if (err.name === 'QuotaExceededError') {
                localStorage.removeItem(STATE_STORAGE_KEY);
                try {
                    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(currentState));
                    console.log('App state saved after clearing quota:', currentState);
                } catch (e) {
                    console.warn('State save failed: storage full');
                }
            } else {
                console.warn('Failed to save app state:', err);
            }
        }
    }
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
    function applySavedState(state) {
        console.log('Applying saved state:', state);
        if (state.theme) {
            const themeBtn = document.querySelector(`${SELECTORS.THEME_BTN}[data-theme="${state.theme}"]`);
            if (themeBtn && !themeBtn.classList.contains('active')) {
                themeBtn.click();
            }
        }
        if (state.sidebarCollapsed) {
            const sidebar = document.getElementById(SELECTORS.SIDEBAR.substring(1));
            if (sidebar && !sidebar.classList.contains('collapsed')) {
                const toggleBtn = document.getElementById(SELECTORS.SIDEBAR_TOGGLE.substring(1));
                if (toggleBtn) {
                    toggleBtn.click();
                }
            }
        }
        if (state.currentPage && state.currentPage !== 'home') {
            const navItem = document.querySelector(`${SELECTORS.NAV_ITEM}[data-page="${state.currentPage}"]`);
            if (navItem) {
                navItem.click();
            }
        }
        if (state.currentPage === 'blogs' && state.activeBlogPost) {
            window.pendingBlogPostRestore = state.activeBlogPost;
        } else if (state.currentPage === 'blogs') {
            window.pendingBlogScrollToTop = true;
        }
    }
    function processPendingBlogPostRestore() {
        if (window.pendingBlogPostRestore) {
            const postId = window.pendingBlogPostRestore;
            window.pendingBlogPostRestore = null;
            if (typeof window.openBlogPostLazy === 'function') {
                window.openBlogPostLazy(postId);
            }
        } else if (window.pendingBlogScrollToTop) {
            window.pendingBlogScrollToTop = false;
            if (typeof window.showBlogIntro === 'function') {
                window.showBlogIntro();
            }
            setTimeout(() => {
                window.scrollTo(0, 0);
            }, 50);
        }
    }
    function restoreAppState() {
        const savedState = loadAppState();
        if (!savedState) {
            console.log('No saved state to restore');
            return;
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => applySavedState(savedState));
        } else {
            applySavedState(savedState);
        }
    }
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
    function setupStatePersistence() {
        document.addEventListener('click', handleInteraction);
        window.addEventListener('beforeunload', saveAppState);
    }
    window.saveAppState = saveAppState;
    window.loadAppState = loadAppState;
    window.restoreAppState = restoreAppState;
    window.setupStatePersistence = setupStatePersistence;
    window.getCurrentPage = getCurrentPage;
    window.processPendingBlogPostRestore = processPendingBlogPostRestore;
})();
