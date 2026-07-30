


(function() {
    
    document.addEventListener('DOMContentLoaded', function() {
        
        if (typeof window.createParticles === 'function') {
            window.createParticles();
        }

        
        if (typeof window.setupNavigation === 'function') {
            window.setupNavigation();
        }

        
        if (typeof window.setupTemplates === 'function') {
            window.setupTemplates();
        }

        
        if (typeof window.setupSystemThemeListener === 'function') {
            window.setupSystemThemeListener();
        }

        
        if (typeof window.setupSidebarToggle === 'function') {
            window.setupSidebarToggle();
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
                }
            });
        }

        console.log('Blog platform initialized successfully');
    });
})();
