// ui.js - UI Components, Navigation, and Event Handlers
// Handles navigation, sidebar toggle, theme switching, particles, and UI interactions

(function() {
    // Navigate to blogs page without triggering blog introduction prefetch
    function navigateToBlogsPageWithoutPrefetch() {
        const blogsNavItem = document.querySelector('.nav-item[data-page="blogs"]');
        if (!blogsNavItem) return;

        const sections = document.querySelectorAll('.page-section');
        const navItems = document.querySelectorAll('.nav-item');
        const blogSidebarSection = document.getElementById('blog-sidebar-section');

        // Update active nav item
        navItems.forEach(nav => nav.classList.remove('active'));
        blogsNavItem.classList.add('active');

        // Show blogs section
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === 'blogs') {
                section.classList.add('active');
            }
        });

        // Show/hide "All Posts" in sidebar
        if (blogSidebarSection) {
            blogSidebarSection.style.display = 'block';
        }

        // Scroll to top
        window.scrollTo(0, 0);
    }

    // Generate URL-safe hash for a blog post
    function generateBlogPostHash(postId) {
        return 'blog-' + postId;
    }

    // Extract blog post ID from hash
    function getBlogPostIdFromHash(hash) {
        if (hash && hash.startsWith('blog-')) {
            return hash.substring(5); // Remove 'blog-' prefix
        }
        return null;
    }

    // Update URL hash without triggering scroll
    function updateHash(newHash, postId, addToHistory = true) {
        let hash = newHash;
        if (postId) {
            hash = generateBlogPostHash(postId);
        }
        if (window.location.hash !== '#' + hash) {
            if (addToHistory) {
                history.pushState(null, '', '#' + hash);
            } else {
                history.replaceState(null, '', '#' + hash);
            }
        }
    }

    // Handle hash change events
    function handleHashChange() {
        const hash = window.location.hash.substring(1); // Remove '#'
        
        if (!hash || hash === 'home') {
            // Navigate to home
            const homeNavItem = document.querySelector('.nav-item[data-page="home"]');
            if (homeNavItem) homeNavItem.click();
        } else if (hash === 'blogs') {
            // Navigate to blogs intro
            const blogsNavItem = document.querySelector('.nav-item[data-page="blogs"]');
            if (blogsNavItem) {
                blogsNavItem.click();
                // Show intro view
                const introView = document.getElementById('blog-intro-view');
                const postView = document.getElementById('blog-post-view');
                if (introView && postView) {
                    postView.style.display = 'none';
                    introView.style.display = 'block';
                }
            }
        } else if (hash === 'about') {
            // Navigate to about
            const aboutNavItem = document.querySelector('.nav-item[data-page="about"]');
            if (aboutNavItem) aboutNavItem.click();
        } else if (hash && hash.startsWith('blog-')) {
            // Open specific blog post
            const postId = getBlogPostIdFromHash(hash);
            if (postId && typeof window.openBlogPostLazy === 'function') {
                // Wait for metadata if needed
                if (!window.blogPostMetadata || window.blogPostMetadata.length === 0) {
                    window.waitForBlogMetadata().then(() => {
                        window.openBlogPostLazy(postId);
                    });
                } else {
                    window.openBlogPostLazy(postId);
                }
            }
        }
    }

    // Setup hash-based routing
    function setupHashRouting() {
        // Listen for hash changes
        window.addEventListener('hashchange', handleHashChange);
        
        // Handle initial hash on page load
        if (window.location.hash) {
            // Wait for DOM and blog metadata to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(handleHashChange, 100);
                });
            } else {
                setTimeout(handleHashChange, 100);
            }
        }
    }

    // Initialize particles (respecting reduced motion preferences)
    function createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;

        // Skip particle creation if user prefers reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
            fragment.appendChild(particle);
        }
        container.appendChild(fragment);
    }

    // Navigation
    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.page-section');
        const blogSidebarSection = document.getElementById('blog-sidebar-section');
        
        // Track if user has already restored their blog session
        let hasRestoredBlogSession = false;
        // Track if user was previously reading a blog post before navigating away
        let wasReadingBlogPost = false;

        // Wrap home content in rectangle on initialization
        wrapHomeContentInRectangle();

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                // Track if user was reading a blog post before clicking nav
                const postView = document.getElementById('blog-post-view');
                const isReadingPost = postView && postView.style.display !== 'none' && postView.style.display !== '';
                
                // Handle Blog button behavior
                if (item.dataset.page === 'blogs') {
                    const currentPage = window.getCurrentPage ? window.getCurrentPage() : 'home';
                    
                    // If clicking Blog from Home or About page
                    if (currentPage === 'home' || currentPage === 'about') {
                        // Check if there's a saved blog post to restore
                        const savedState = window.loadAppState ? window.loadAppState() : null;
                        const hasSavedPost = savedState && savedState.activeBlogPost;
                        
                        // First click: Restore the blog post if user was reading one before navigating away
                        // OR if they haven't restored yet and there's a saved post
                        if ((wasReadingBlogPost || !hasRestoredBlogSession) && hasSavedPost) {
                            hasRestoredBlogSession = true;
                            wasReadingBlogPost = false; // Reset after restoration
                            
                            // Navigate to blogs page
                            navigateToBlogsPageWithoutPrefetch();
                            
                            // Open the saved blog post
                            if (typeof window.openBlogPostLazy === 'function' && savedState.activeBlogPost) {
                                window.openBlogPostLazy(savedState.activeBlogPost);
                            }
                            
                            // Scroll to top
                            window.scrollTo(0, 0);
                            
                            // Save state after navigation
                            setTimeout(window.saveAppState, 100);
                            return;
                        } else {
                            // Second click (or no saved post): Show blog intro grid
                            hasRestoredBlogSession = false; // Reset for next time
                            
                            // Navigate to blogs page and show intro grid
                            navigateToBlogsPageWithoutPrefetch();
                            
                            // Show blog intro view (grid of all posts)
                            const introView = document.getElementById('blog-intro-view');
                            
                            if (postView && introView) {
                                postView.style.display = 'none';
                                introView.style.display = 'block';
                            }
                            
                            // Clear active state in sidebar
                            document.querySelectorAll('.post-selector-item').forEach(item => {
                                item.classList.remove('active');
                            });
                            
                            // Render the blog post selector grid
                            if (typeof window.renderBlogPostSelectorGrid === 'function' && window.blogPostMetadata) {
                                window.renderBlogPostSelectorGrid(window.blogPostMetadata);
                            }
                            
                            // Update back button visibility
                            if (typeof window.updateBlogIntroBackButton === 'function') {
                                window.updateBlogIntroBackButton();
                            }
                            
                            // Scroll to top
                            window.scrollTo(0, 0);
                            
                            // Save state after navigation
                            setTimeout(window.saveAppState, 100);
                            return;
                        }
                    }
                    // If already reading a blog post on blogs page, show the blog intro grid
                    if (isReadingPost) {
                        // Navigate to blogs page and show intro grid
                        navigateToBlogsPageWithoutPrefetch();
                        
                        // Show blog intro view (grid of all posts)
                        const introView = document.getElementById('blog-intro-view');
                        
                        if (introView) {
                            postView.style.display = 'none';
                            introView.style.display = 'block';
                        }
                        
                        // Clear active state in sidebar
                        document.querySelectorAll('.post-selector-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        
                        // Render the blog post selector grid
                        if (typeof window.renderBlogPostSelectorGrid === 'function' && window.blogPostMetadata) {
                            window.renderBlogPostSelectorGrid(window.blogPostMetadata);
                        }
                        
                        // Update back button visibility
                        if (typeof window.updateBlogIntroBackButton === 'function') {
                            window.updateBlogIntroBackButton();
                        }
                        
                        // Scroll to top
                        window.scrollTo(0, 0);
                        
                        // Save state after navigation
                        setTimeout(window.saveAppState, 100);
                        return;
                    }
                    // If clicking Blog from elsewhere, just navigate normally
                } else {
                    // For other nav items, track if user was reading a blog post
                    if (isReadingPost) {
                        wasReadingBlogPost = true;
                    }
                    
                    // Reset the blog session flag when going to Home or About
                    if (item.dataset.page === 'home' || item.dataset.page === 'about') {
                        hasRestoredBlogSession = false;
                    }
                    
                    // Update active nav item
                    navItems.forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');

                    // Show corresponding section
                    const page = item.dataset.page;
                    sections.forEach(section => {
                        section.classList.remove('active');
                        if (section.id === page) {
                            section.classList.add('active');
                        }
                    });

                    // Show/hide "All Posts" in sidebar on Home, About, and Blogs pages
                    if (blogSidebarSection) {
                        if (page === 'blogs' || page === 'home' || page === 'about') {
                            blogSidebarSection.style.display = 'block';
                        } else {
                            blogSidebarSection.style.display = 'none';
                        }
                    }

                    // Update URL hash based on page
                    if (page === 'home') {
                        window.updateHash('home', null, true);
                    } else if (page === 'about') {
                        window.updateHash('about', null, true);
                    } else if (page === 'blogs') {
                        window.updateHash('blogs', null, true);
                    }

                    // Scroll to top when changing pages
                    window.scrollTo(0, 0);

                    // Save state after navigation
                    setTimeout(window.saveAppState, 100);
                    return;
                }

                // Navigation already handled in the Blog button logic above
                return;
            });
        });
    }

    // Wrap home page content in a rectangle container (like blog and about pages)
    function wrapHomeContentInRectangle() {
        const homeHero = document.getElementById('home-hero-content');
        if (!homeHero) return;

        // Check if already wrapped
        if (homeHero.parentElement.classList.contains('home-layout-container')) {
            return;
        }

        // Create wrapper container
        const wrapper = document.createElement('div');
        wrapper.className = 'home-layout-container';

        // Insert wrapper before homeHero
        homeHero.parentNode.insertBefore(wrapper, homeHero);

        // Move homeHero into wrapper
        wrapper.appendChild(homeHero);
    }

    // Cookie helpers for theme persistence
    function setCookie(name, value, days) {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/';
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    // Check if first visit (no cookie set)
    function isFirstVisit() {
        return getCookie('theme_preference') === null;
    }

    // Get saved theme or default to auto
    function getSavedTheme() {
        if (isFirstVisit()) {
            return 'auto';
        }
        return getCookie('theme_preference') || 'auto';
    }

    // Save theme preference
    function saveThemePreference(theme) {
        setCookie('theme_preference', theme, 365);
    }

    // Apply different themes
    function applyTheme(themeName) {
        const root = document.documentElement;

        // Set data-theme attribute for CSS selectors
        root.setAttribute('data-theme', themeName);

        if (themeName === 'auto') {
            // Auto theme - detect system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
            return;
        } else if (themeName === 'light') {
            // Adwaita Light Theme (GNOME default) - Subtle Glass
            root.style.setProperty('--bg-dark', '#f6f5f4');
            root.style.setProperty('--bg-panel', 'rgba(255, 255, 255, 0.72)');
            root.style.setProperty('--bg-header', 'rgba(246, 245, 244, 0.85)');
            root.style.setProperty('--accent-pink', '#ff45fc');
            root.style.setProperty('--accent-pink-hover', '#e031e0');
            root.style.setProperty('--text-primary', '#2e3436');
            root.style.setProperty('--text-secondary', '#5e5e5e');
            root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
            root.style.setProperty('--blur-overlay-brightness', '1.0');
            root.style.setProperty('--dark-overlay-color', 'rgba(0, 0, 0, 0.0)');
            document.body.style.background = 'linear-gradient(135deg, rgba(246, 245, 244, 0.6) 0%, rgba(255, 255, 255, 0.6) 100%), url("/media/bg-light.webp")';
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
        } else if (themeName === 'dark') {
            // Adwaita Dark Theme (GNOME) - Subtle Dark Glass
            root.style.setProperty('--bg-dark', '#121212');
            root.style.setProperty('--bg-panel', 'rgba(26, 26, 26, 0.75)');
            root.style.setProperty('--bg-header', 'rgba(18, 18, 18, 0.85)');
            root.style.setProperty('--accent-pink', '#ff45fc');
            root.style.setProperty('--accent-pink-hover', '#e031e0');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#9a9a9a');
            root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.12)');
            root.style.setProperty('--blur-overlay-brightness', '0.6');
            root.style.setProperty('--dark-overlay-color', 'rgba(0, 0, 0, 0.4)');
            document.body.style.background = 'linear-gradient(135deg, rgba(26, 26, 26, 0.6) 0%, rgba(13, 13, 13, 0.6) 100%), url("/media/bg-dark.webp")';
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
        }
    }

    // Template selection - now handles theme switching with cookie persistence
    function setupTemplates() {
        const themeBtns = document.querySelectorAll('.theme-btn');

        themeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                themeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const theme = btn.dataset.theme;
                applyTheme(theme);
                saveThemePreference(theme);

                // Save state after theme change
                setTimeout(window.saveAppState, 100);
            });
        });

        // Load saved theme on initialization
        const savedTheme = getSavedTheme();
        const savedBtn = document.querySelector(`.theme-btn[data-theme="${savedTheme}"]`);
        if (savedBtn) {
            themeBtns.forEach(b => b.classList.remove('active'));
            savedBtn.classList.add('active');
            applyTheme(savedTheme);
        } else {
            // Default to auto if no button matches
            applyTheme('auto');
        }
    }

    // Setup system theme change listener for auto mode
    function setupSystemThemeListener() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // Listen for changes in system color scheme preference
        mediaQuery.addEventListener('change', (e) => {
            // Only react if auto theme is currently selected
            const activeThemeBtn = document.querySelector('.theme-btn.active');
            if (activeThemeBtn && activeThemeBtn.dataset.theme === 'auto') {
                applyTheme('auto');
            }
        });
    }

    // Click me button handler
    function handleClickMe() {
        const button = document.querySelector('.blue-button');
        if (!button) return;

        button.style.animation = 'pulse 0.3s ease';

        setTimeout(() => {
            button.style.animation = '';
        }, 300);

        // Create ripple effect
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 10px;
            height: 10px;
            background: rgba(71, 114, 179, 0.6);
            border-radius: 50%;
            animation: rippleEffect 0.6s ease-out forwards;
            pointer-events: none;
            z-index: 9999;
        `;

        document.body.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);

        // Navigate to home page
        const homeNavItem = document.querySelector('.nav-item[data-page="home"]');
        if (homeNavItem) {
            homeNavItem.click();
        }
    }

    // Sidebar toggle functionality
    function setupSidebarToggle() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        const mainContainer = document.querySelector('.main-container');

        if (!sidebarToggle || !sidebar || !mainContainer) return;

        // Check if we're on mobile/small screen
        function isMobileView() {
            return window.innerWidth <= 768;
        }

        // Initialize sidebar state based on screen size
        function initSidebarState() {
            if (isMobileView()) {
                sidebar.classList.add('collapsed');
                sidebar.classList.remove('expanded');
                mainContainer.classList.add('sidebar-collapsed');
                sidebarToggle.setAttribute('aria-label', 'Open Sidebar');
                sidebarToggle.setAttribute('title', 'Open Sidebar');
            } else {
                sidebar.classList.remove('collapsed');
                sidebar.classList.add('expanded');
                mainContainer.classList.remove('sidebar-collapsed');
                sidebarToggle.setAttribute('aria-label', 'Collapse Sidebar');
                sidebarToggle.setAttribute('title', 'Collapse Sidebar');
            }
        }

        // Call on load
        initSidebarState();

        // Toggle sidebar on button click
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('collapsed');
            sidebar.classList.toggle('expanded');
            mainContainer.classList.toggle('sidebar-collapsed');

            // Update toggle button aria-label and icon direction
            const isCollapsed = sidebar.classList.contains('collapsed');
            sidebarToggle.setAttribute('aria-label', isCollapsed ? 'Open Sidebar' : 'Collapse Sidebar');
            sidebarToggle.setAttribute('title', isCollapsed ? 'Open Sidebar' : 'Collapse Sidebar');

            // Save state after sidebar toggle
            setTimeout(window.saveAppState, 100);
        });

        // Handle window resize - sidebar always accessible via button
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // On mobile, auto-collapse for space but button remains visible
                // On desktop, preserve user's choice
                if (isMobileView()) {
                    if (!sidebar.classList.contains('collapsed')) {
                        sidebar.classList.add('collapsed');
                        sidebar.classList.remove('expanded');
                        mainContainer.classList.add('sidebar-collapsed');
                        sidebarToggle.setAttribute('aria-label', 'Open Sidebar');
                        sidebarToggle.setAttribute('title', 'Open Sidebar');
                    }
                } else {
                    // Desktop: only auto-expand if user hasn't manually collapsed it
                    if (!sidebar.classList.contains('collapsed') && !sidebar.classList.contains('expanded')) {
                        sidebar.classList.add('expanded');
                        mainContainer.classList.remove('sidebar-collapsed');
                        sidebarToggle.setAttribute('aria-label', 'Collapse Sidebar');
                        sidebarToggle.setAttribute('title', 'Collapse Sidebar');
                    }
                }
            }, 200);
        });
    }

    // Expose functions globally
    window.navigateToBlogsPageWithoutPrefetch = navigateToBlogsPageWithoutPrefetch;
    window.createParticles = createParticles;
    window.setupNavigation = setupNavigation;
    window.wrapHomeContentInRectangle = wrapHomeContentInRectangle;
    window.setCookie = setCookie;
    window.getCookie = getCookie;
    window.isFirstVisit = isFirstVisit;
    window.getSavedTheme = getSavedTheme;
    window.saveThemePreference = saveThemePreference;
    window.applyTheme = applyTheme;
    window.setupTemplates = setupTemplates;
    window.setupSystemThemeListener = setupSystemThemeListener;
    window.handleClickMe = handleClickMe;
    window.setupSidebarToggle = setupSidebarToggle;
    window.setupHashRouting = setupHashRouting;
    window.updateHash = updateHash;
})();
