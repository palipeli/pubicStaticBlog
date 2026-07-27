// state.js - Application State Persistence
// Handles saving and restoring application state to localStorage

(function() {
    // State Persistence Key
    const STATE_STORAGE_KEY = 'blogPlatformState';

    // Get current active page
    function getCurrentPage() {
        const activeSection = document.querySelector('.page-section.active');
        return activeSection ? activeSection.id : 'home';
    }

    // Get currently active blog post ID (if viewing a post)
    function getActiveBlogPostId() {
        const postView = document.getElementById('blog-post-view');
        if (postView && postView.style.display !== 'none') {
            const activeItem = document.querySelector('.post-selector-item.active');
            if (activeItem) {
                // Extract post ID from the onclick handler or data attribute
                const postId = activeItem.getAttribute('data-post-id');
                if (postId) return postId;
            }
        }
        return null;
    }

    // Check if sidebar is collapsed
    function isSidebarCollapsed() {
        const sidebar = document.getElementById('sidebar');
        return sidebar ? sidebar.classList.contains('collapsed') : false;
    }

    // Get current theme
    function getCurrentTheme() {
        const activeThemeBtn = document.querySelector('.theme-btn.active');
        return activeThemeBtn ? activeThemeBtn.dataset.theme : 'auto';
    }

    // Save current application state to localStorage
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

    // Load application state from localStorage
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

    // Clear saved state (useful for logout or reset)
    function clearAppState() {
        try {
            localStorage.removeItem(STATE_STORAGE_KEY);
            console.log('App state cleared');
        } catch (err) {
            console.warn('Failed to clear app state:', err);
        }
    }

    // Restore application state after page load
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

    // Apply saved state to the application
    function applySavedState(state) {
        console.log('Applying saved state:', state);

        // Restore theme first (before other UI updates)
        if (state.theme) {
            const themeBtn = document.querySelector(`.theme-btn[data-theme="${state.theme}"]`);
            if (themeBtn && !themeBtn.classList.contains('active')) {
                themeBtn.click();
            }
        }

        // Restore sidebar state
        if (state.sidebarCollapsed) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.classList.contains('collapsed')) {
                const toggleBtn = document.getElementById('sidebar-toggle');
                if (toggleBtn) {
                    toggleBtn.click();
                }
            }
        }

        // Restore page navigation
        if (state.currentPage && state.currentPage !== 'home') {
            const navItem = document.querySelector(`.nav-item[data-page="${state.currentPage}"]`);
            if (navItem) {
                navItem.click();
            }
        }

        // Restore blog post view (must be done after navigating to blogs page)
        if (state.activeBlogPost && state.currentPage === 'blogs') {
            // Wait a bit for the page transition and blog posts to load
            setTimeout(() => {
                if (typeof window.openBlogPostLazy === 'function') {
                    window.openBlogPostLazy(state.activeBlogPost);
                }
            }, 300);
        }
    }

    // Auto-save state on various user actions
    function setupStatePersistence() {
        // Save state when navigating between pages
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            const postItem = e.target.closest('.post-selector-item');
            const backBtn = e.target.closest('.back-to-intro-btn');
            const themeBtn = e.target.closest('.theme-btn');
            const sidebarToggle = e.target.closest('.sidebar-toggle');

            if (navItem || postItem || backBtn || themeBtn || sidebarToggle) {
                // Delay save slightly to allow UI updates
                setTimeout(saveAppState, 100);
            }
        });

        // Also save before page unload
        window.addEventListener('beforeunload', saveAppState);

        // Save state periodically (every 30 seconds) as backup
        setInterval(saveAppState, 30000);
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
