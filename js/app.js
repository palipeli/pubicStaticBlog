// app.js - Main Application Entry Point
// Initializes the blog platform using dynamic imports for code splitting and lazy loading

// Critical UI modules are preloaded via preload in HTML
// Non-critical modules are dynamically imported to reduce initial bundle size

(function() {
    // Track loaded modules to prevent duplicate imports
    const loadedModules = new Set();
    
    // Dynamic import helper with deduplication
    async function importModule(moduleName, modulePath) {
        if (loadedModules.has(moduleName)) {
            return window[moduleName];
        }
        
        try {
            const module = await import(modulePath);
            loadedModules.add(moduleName);
            return module;
        } catch (err) {
            console.error(`Failed to load module ${moduleName}:`, err);
            return null;
        }
    }
    
    // Lazy load devotional module only when needed (after warning clearance)
    async function loadDevotionalModule() {
        if (loadedModules.has('devotional')) return;
        
        // Use requestIdleCallback to avoid blocking main thread
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                importModule('devotional', './js/devotional.js');
            });
        } else {
            setTimeout(() => importModule('devotional', './js/devotional.js'), 0);
        }
    }
    
    // Lazy load blog module only when blogs page is accessed
    async function loadBlogModule() {
        if (loadedModules.has('blog')) return window.blog;
        
        const module = await import('./js/blog.js');
        loadedModules.add('blog');
        return module;
    }
    
    // Lazy load home module only when home page specific features are needed
    async function loadHomeModule() {
        if (loadedModules.has('home')) return window.home;
        
        const module = await import('./js/home.js');
        loadedModules.add('home');
        return module;
    }
    
    // Lazy load markdown parser when first needed
    async function loadMarkdownModule() {
        if (loadedModules.has('markdown')) return;
        
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                importModule('markdown', './js/markdown.js');
            });
        } else {
            setTimeout(() => importModule('markdown', './js/markdown.js'), 0);
        }
    }

    // Initialize application when DOM is ready
    document.addEventListener('DOMContentLoaded', async function() {
        // Create floating particles
        if (typeof window.createParticles === 'function') {
            window.createParticles();
        }

        // Setup navigation
        if (typeof window.setupNavigation === 'function') {
            window.setupNavigation();
        }

        // Setup template selection (theme switching)
        if (typeof window.setupTemplates === 'function') {
            window.setupTemplates();
        }

        // Setup system theme change listener for auto mode
        if (typeof window.setupSystemThemeListener === 'function') {
            window.setupSystemThemeListener();
        }

        // Setup sidebar toggle
        if (typeof window.setupSidebarToggle === 'function') {
            window.setupSidebarToggle();
        }

        // Setup state persistence (auto-save on user actions)
        if (typeof window.setupStatePersistence === 'function') {
            window.setupStatePersistence();
        }
        
        // Lazy load non-critical modules using requestIdleCallback
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                loadMarkdownModule();
                loadDevotionalModule();
            }, { timeout: 2000 });
        } else {
            setTimeout(() => {
                loadMarkdownModule();
                loadDevotionalModule();
            }, 0);
        }

        // Monitor for blogs page access - lazy load blog module on demand
        setupRouteObserver();
        
        // Start devotional monitoring - Bible verses will be loaded only when animation starts
        if (typeof window.monitorWarningAndStartDevotional === 'function') {
            window.monitorWarningAndStartDevotional();
        }

        // Restore saved state after page refresh
        if (typeof window.restoreAppState === 'function') {
            window.restoreAppState();
        }

        // Lazy load blog metadata fetch - only when blog functionality is needed
        // Uses IntersectionObserver to detect when blog section becomes visible
        setupBlogLazyLoading();

        console.log('Blog platform initialized successfully');
    });
    
    // Setup route observer for lazy loading route-specific modules
    function setupRouteObserver() {
        // Observe navigation clicks to lazy load appropriate modules
        document.addEventListener('click', async (e) => {
            const navItem = e.target.closest('.nav-item[data-page]');
            if (!navItem) return;
            
            const page = navItem.dataset.page;
            
            // Lazy load blog module when navigating to blogs page
            if (page === 'blogs' && !loadedModules.has('blog')) {
                await loadBlogModule();
            }
            
            // Lazy load home module when navigating to home page
            if (page === 'home' && !loadedModules.has('home')) {
                await loadHomeModule();
            }
        });
    }
    
    // Setup blog lazy loading with IntersectionObserver
    function setupBlogLazyLoading() {
        const blogsSection = document.getElementById('blogs');
        if (!blogsSection || !('IntersectionObserver' in window)) {
            // Fallback: load blog data after a delay if no IntersectionObserver
            setTimeout(fetchBlogMetadataIfVisible, 1000);
            return;
        }
        
        const blogObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    fetchBlogMetadataIfVisible();
                    blogObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: '200px 0px' });
        
        blogObserver.observe(blogsSection);
    }
    
    // Fetch blog metadata when blog section is visible
    async function fetchBlogMetadataIfVisible() {
        if (typeof window.fetchBlogPostMetadata === 'function') {
            const posts = await window.fetchBlogPostMetadata();
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

                // Show post selector sidebar on Home page by default
                const blogSidebarSection = document.getElementById('blog-sidebar-section');
                if (blogSidebarSection) {
                    blogSidebarSection.style.display = 'block';
                }
            }
        }
    }
})();
