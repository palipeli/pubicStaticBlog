// app.js - Main Application Entry Point
// Initializes the blog platform by loading required modules and setting up the application

(function() {
    // Initialize application when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Create floating particles
        if (typeof window.createParticles === 'function') {
            window.createParticles();
        }

        // Setup navigation
        if (typeof window.setupNavigation === 'function') {
            window.setupNavigation();
        }

        // Setup hash-based routing for URL tags
        if (typeof window.setupHashRouting === 'function') {
            window.setupHashRouting();
        }

        // Setup template selection (theme switching)
        if (typeof window.setupTemplates === 'function') {
            window.setupTemplates();
        }

        // Setup system theme change listener for auto mode
        if (typeof window.setupSystemThemeListener === 'function') {
            window.setupSystemThemeListener();
        }

        // Setup background image prefetch on cursor proximity to theme chooser
        if (typeof window.setupThemePrefetch === 'function') {
            window.setupThemePrefetch();
        }

        // Setup sidebar toggle
        if (typeof window.setupSidebarToggle === 'function') {
            window.setupSidebarToggle();
        }

        // Setup state persistence (auto-save on user actions)
        if (typeof window.setupStatePersistence === 'function') {
            window.setupStatePersistence();
        }

        // Start devotional monitoring - Bible verses will be loaded only when animation starts
        if (typeof window.monitorWarningAndStartDevotional === 'function') {
            window.monitorWarningAndStartDevotional();
        }

        // Restore saved state after page refresh
        if (typeof window.restoreAppState === 'function') {
            window.restoreAppState();
        }

        // Fetch only blog post metadata (lazy load content on demand)
        if (typeof window.fetchBlogPostMetadata === 'function') {
            window.fetchBlogPostMetadata().then(posts => {
                if (posts.length > 0) {
                    // Render the sidebar components with lazy loading support
                    if (typeof window.renderPostSelector === 'function') {
                        window.renderPostSelector(posts);
                    }

                    // Render blog buttons on home page (kamikami.eu style) with lazy loading
                    if (typeof window.renderBlogButtonsLazy === 'function') {
                        window.renderBlogButtonsLazy(posts);
                    }

                    // Render the blog post selector grid in the main content area
                    if (typeof window.renderBlogPostSelectorGrid === 'function') {
                        window.renderBlogPostSelectorGrid(posts);
                    }

                    // Show post selector sidebar on Home page by default (since it's the active page on load)
                    const blogSidebarSection = document.getElementById('blog-sidebar-section');
                    if (blogSidebarSection) {
                        blogSidebarSection.style.display = 'block';
                    }
                    
                    // Process any pending blog post restoration after metadata is loaded
                    if (typeof window.processPendingBlogPostRestore === 'function') {
                        window.processPendingBlogPostRestore();
                    }
                }
            });
        }

        console.log('Blog platform initialized successfully');
    });
})();
