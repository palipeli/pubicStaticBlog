


(function() {
    
    function navigateToBlogsPageWithoutPrefetch() {
        const blogsNavItem = document.querySelector('.nav-item[data-page="blogs"]');
        if (!blogsNavItem) return;

        const sections = document.querySelectorAll('.page-section');
        const navItems = document.querySelectorAll('.nav-item');
        const blogSidebarSection = document.getElementById('blog-sidebar-section');

        
        navItems.forEach(nav => nav.classList.remove('active'));
        blogsNavItem.classList.add('active');

        
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === 'blogs') {
                section.classList.add('active');
            }
        });

        
        if (blogSidebarSection) {
            blogSidebarSection.style.display = 'block';
        }

        
        window.scrollTo(0, 0);
    }

    
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

    
    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.page-section');
        const blogSidebarSection = document.getElementById('blog-sidebar-section');
        
        
        let hasRestoredBlogSession = false;
        
        let wasReadingBlogPost = false;

        
        wrapHomeContentInRectangle();

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                
                const postView = document.getElementById('blog-post-view');
                const isReadingPost = postView && postView.style.display !== 'none' && postView.style.display !== '';
                
                
                if (item.dataset.page === 'blogs') {
                    const currentPage = window.getCurrentPage ? window.getCurrentPage() : 'home';
                    
                    
                    if (currentPage === 'home' || currentPage === 'about') {
                        
                        const savedState = window.loadAppState ? window.loadAppState() : null;
                        const hasSavedPost = savedState && savedState.activeBlogPost;
                        
                        
                        
                        if ((wasReadingBlogPost || !hasRestoredBlogSession) && hasSavedPost) {
                            hasRestoredBlogSession = true;
                            wasReadingBlogPost = false; 
                            
                            
                            navigateToBlogsPageWithoutPrefetch();
                            
                            
                            setTimeout(() => {
                                if (typeof window.openBlogPostLazy === 'function' && savedState.activeBlogPost) {
                                    window.openBlogPostLazy(savedState.activeBlogPost);
                                }
                            }, 100);
                            
                            
                            window.scrollTo(0, 0);
                            
                            
                            setTimeout(window.saveAppState, 100);
                            return;
                        } else {
                            
                            hasRestoredBlogSession = false; 
                            
                            
                            navigateToBlogsPageWithoutPrefetch();
                            
                            
                            const introView = document.getElementById('blog-intro-view');
                            
                            if (postView && introView) {
                                postView.style.display = 'none';
                                introView.style.display = 'block';
                            }
                            
                            
                            document.querySelectorAll('.post-selector-item').forEach(item => {
                                item.classList.remove('active');
                            });
                            
                            
                            if (typeof window.renderBlogPostSelectorGrid === 'function' && window.blogPostMetadata) {
                                window.renderBlogPostSelectorGrid(window.blogPostMetadata);
                            }
                            
                            
                            if (typeof window.updateBlogIntroBackButton === 'function') {
                                window.updateBlogIntroBackButton();
                            }
                            
                            
                            window.scrollTo(0, 0);
                            
                            
                            setTimeout(window.saveAppState, 100);
                            return;
                        }
                    }
                    
                    if (isReadingPost) {
                        
                        navigateToBlogsPageWithoutPrefetch();
                        
                        
                        const introView = document.getElementById('blog-intro-view');
                        
                        if (introView) {
                            postView.style.display = 'none';
                            introView.style.display = 'block';
                        }
                        
                        
                        document.querySelectorAll('.post-selector-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        
                        
                        if (typeof window.renderBlogPostSelectorGrid === 'function' && window.blogPostMetadata) {
                            window.renderBlogPostSelectorGrid(window.blogPostMetadata);
                        }
                        
                        
                        if (typeof window.updateBlogIntroBackButton === 'function') {
                            window.updateBlogIntroBackButton();
                        }
                        
                        
                        window.scrollTo(0, 0);
                        
                        
                        setTimeout(window.saveAppState, 100);
                        return;
                    }
                    
                } else {
                    
                    if (isReadingPost) {
                        wasReadingBlogPost = true;
                    }
                    
                    
                    if (item.dataset.page === 'home' || item.dataset.page === 'about') {
                        hasRestoredBlogSession = false;
                    }
                    
                    
                    navItems.forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');

                    
                    const page = item.dataset.page;
                    sections.forEach(section => {
                        section.classList.remove('active');
                        if (section.id === page) {
                            section.classList.add('active');
                        }
                    });

                    
                    if (blogSidebarSection) {
                        if (page === 'blogs' || page === 'home' || page === 'about') {
                            blogSidebarSection.style.display = 'block';
                        } else {
                            blogSidebarSection.style.display = 'none';
                        }
                    }

                    
                    window.scrollTo(0, 0);

                    
                    setTimeout(window.saveAppState, 100);
                    return;
                }

                
                return;
            });
        });
    }

    
    function wrapHomeContentInRectangle() {
        const homeHero = document.getElementById('home-hero-content');
        if (!homeHero) return;

        
        if (homeHero.parentElement.classList.contains('home-layout-container')) {
            return;
        }

        
        const wrapper = document.createElement('div');
        wrapper.className = 'home-layout-container';

        
        homeHero.parentNode.insertBefore(wrapper, homeHero);

        
        wrapper.appendChild(homeHero);
    }

    
    function setCookie(name, value, days) {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/';
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    
    function isFirstVisit() {
        return getCookie('theme_preference') === null;
    }

    
    function getSavedTheme() {
        if (isFirstVisit()) {
            return 'auto';
        }
        return getCookie('theme_preference') || 'auto';
    }

    
    function saveThemePreference(theme) {
        setCookie('theme_preference', theme, 365);
    }

    
    function applyTheme(themeName) {
        const root = document.documentElement;

        
        root.setAttribute('data-theme', themeName);

        if (themeName === 'auto') {
            
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
            return;
        } else if (themeName === 'light') {
            
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

    
    function setupTemplates() {
        const themeBtns = document.querySelectorAll('.theme-btn');

        themeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                themeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const theme = btn.dataset.theme;
                applyTheme(theme);
                saveThemePreference(theme);

                
                setTimeout(window.saveAppState, 100);
            });
        });

        
        const savedTheme = getSavedTheme();
        const savedBtn = document.querySelector(`.theme-btn[data-theme="${savedTheme}"]`);
        if (savedBtn) {
            themeBtns.forEach(b => b.classList.remove('active'));
            savedBtn.classList.add('active');
            applyTheme(savedTheme);
        } else {
            
            applyTheme('auto');
        }
    }

    
    function setupSystemThemeListener() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        
        mediaQuery.addEventListener('change', (e) => {
            
            const activeThemeBtn = document.querySelector('.theme-btn.active');
            if (activeThemeBtn && activeThemeBtn.dataset.theme === 'auto') {
                applyTheme('auto');
            }
        });
    }

    
    function handleClickMe() {
        const button = document.querySelector('.blue-button');
        if (!button) return;

        button.style.animation = 'pulse 0.3s ease';

        setTimeout(() => {
            button.style.animation = '';
        }, 300);

        
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

        
        const homeNavItem = document.querySelector('.nav-item[data-page="home"]');
        if (homeNavItem) {
            homeNavItem.click();
        }
    }

    
    function setupSidebarToggle() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        const mainContainer = document.querySelector('.main-container');

        if (!sidebarToggle || !sidebar || !mainContainer) return;

        
        function isMobileView() {
            return window.innerWidth <= 768;
        }

        
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

        
        initSidebarState();

        
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('collapsed');
            sidebar.classList.toggle('expanded');
            mainContainer.classList.toggle('sidebar-collapsed');

            
            const isCollapsed = sidebar.classList.contains('collapsed');
            sidebarToggle.setAttribute('aria-label', isCollapsed ? 'Open Sidebar' : 'Collapse Sidebar');
            sidebarToggle.setAttribute('title', isCollapsed ? 'Open Sidebar' : 'Collapse Sidebar');

            
            setTimeout(window.saveAppState, 100);
        });

        
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                
                
                if (isMobileView()) {
                    if (!sidebar.classList.contains('collapsed')) {
                        sidebar.classList.add('collapsed');
                        sidebar.classList.remove('expanded');
                        mainContainer.classList.add('sidebar-collapsed');
                        sidebarToggle.setAttribute('aria-label', 'Open Sidebar');
                        sidebarToggle.setAttribute('title', 'Open Sidebar');
                    }
                } else {
                    
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
