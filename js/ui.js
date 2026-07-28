// ui.js - UI Components, Navigation, and Event Handlers
// Handles navigation, sidebar toggle, theme switching, particles, and UI interactions

(function() {
    // Navigate to blogs page without triggering blog introduction prefetch
    function navigateToBlogsPageWithoutPrefetch(fromPage) {
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

        // Save the page we're coming from for back button functionality
        if (fromPage) {
            try {
                const STATE_STORAGE_KEY = 'blogPlatformState';
                const savedState = localStorage.getItem(STATE_STORAGE_KEY);
                let state = savedState ? JSON.parse(savedState) : {};
                state.previousPage = fromPage;
                localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
            } catch (err) {
                console.warn('Failed to save previous page:', err);
            }
        }

        // Scroll to top
        window.scrollTo(0, 0);
    }

    // Initialize particles
    function createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
            container.appendChild(particle);
        }
    }

    // Navigation
    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.page-section');
        const blogSidebarSection = document.getElementById('blog-sidebar-section');

        // Wrap home content in rectangle on initialization
        wrapHomeContentInRectangle();

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                // Get the current page before navigation for state tracking
                const currentPage = window.getCurrentPage ? window.getCurrentPage() : null;

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

                // Scroll to top when changing pages
                window.scrollTo(0, 0);

                // Save state after navigation
                setTimeout(window.saveAppState, 100);
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
            // Adwaita Light Theme (GNOME default)
            root.style.setProperty('--bg-dark', '#f6f5f4');
            root.style.setProperty('--bg-panel', 'rgba(255, 255, 255, 0.95)');
            root.style.setProperty('--bg-header', 'rgba(246, 245, 244, 0.95)');
            root.style.setProperty('--accent-pink', '#ff45fc');
            root.style.setProperty('--accent-pink-hover', '#e031e0');
            root.style.setProperty('--text-primary', '#2e3436');
            root.style.setProperty('--text-secondary', '#5e5e5e');
            root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
            root.style.setProperty('--blur-overlay-brightness', '1.0');
            root.style.setProperty('--dark-overlay-color', 'rgba(0, 0, 0, 0.0)');
            document.body.style.background = 'linear-gradient(135deg, #f6f5f4 0%, #ffffff 100%)';
        } else if (themeName === 'dark') {
            // Adwaita Dark Theme (GNOME) - Darker version
            root.style.setProperty('--bg-dark', '#121212');
            root.style.setProperty('--bg-panel', 'rgba(18, 18, 18, 0.9)');
            root.style.setProperty('--bg-header', 'rgba(12, 12, 12, 0.95)');
            root.style.setProperty('--accent-pink', '#ff45fc');
            root.style.setProperty('--accent-pink-hover', '#e031e0');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#9a9a9a');
            root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
            root.style.setProperty('--blur-overlay-brightness', '0.6');
            root.style.setProperty('--dark-overlay-color', 'rgba(0, 0, 0, 0.4)');
            document.body.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)';
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
})();
