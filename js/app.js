(function() {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof window.createParticles === 'function') {
            window.createParticles();
        }
        if (typeof window.setupNavigation === 'function') {
            window.setupNavigation();
        }
        if (!window.location.hash && (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html'))) {
            history.replaceState({hash: 'home'}, '', window.location.pathname + '#home');
        }
        if (typeof window.setupScrollPositionTracking === 'function') {
            window.setupScrollPositionTracking();
        }
        if (typeof window.setupHashRouting === 'function') {
            window.setupHashRouting();
        }
        if (typeof window.setupTemplates === 'function') {
            window.setupTemplates();
        }
        if (typeof window.setupSystemThemeListener === 'function') {
            window.setupSystemThemeListener();
        }
        if (typeof window.setupThemePrefetch === 'function') {
            window.setupThemePrefetch();
        }
        if (typeof window.setupSidebarToggle === 'function') {
            window.setupSidebarToggle();
        }
        if (typeof window.setupCustomScrollbars === 'function') {
            window.setupCustomScrollbars();
        }
        if (typeof window.setupStatePersistence === 'function') {
            window.setupStatePersistence();
        }
        if (typeof window.monitorWarningAndStartDevotional === 'function') {
            window.monitorWarningAndStartDevotional();
        }
        if (typeof window.restoreAppState === 'function') {
            window.restoreAppState();
        }
        if (typeof window.fetchBlogPostMetadata === 'function') {
            window.fetchBlogPostMetadata().then(posts => {
                if (posts.length > 0) {
                    if (typeof window.renderPostSelector === 'function') {
                        window.renderPostSelector(posts);
                    }
                    if (typeof window.renderBlogButtonsLazy === 'function') {
                        window.renderBlogButtonsLazy(posts);
                    }
                    if (typeof window.renderBlogPostSelectorGrid === 'function') {
                        window.renderBlogPostSelectorGrid(posts);
                    }
                    const blogSidebarSection = document.getElementById('blog-sidebar-section');
                    if (blogSidebarSection) {
                        blogSidebarSection.style.display = 'block';
                    }
                    if (typeof window.processPendingBlogPostRestore === 'function') {
                        window.processPendingBlogPostRestore();
                    }
                }
            });
        }
        console.log('Blog platform initialized successfully');
    });
})();
