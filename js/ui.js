(function() {
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()){ try{ if(window.__CP_RECOVER) window.__CP_RECOVER(); else if(window.__CP_FAIL) window.__CP_FAIL(); }catch(e){} throw new Error('CP not verified'); } if(window.CP.isDevToolOpened&&window.CP.isDevToolOpened()){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP devtool'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{ if(e.message==='CP not verified'&&window.__CP_RECOVER) window.__CP_RECOVER(); else if(window.__CP_FAIL) window.__CP_FAIL(); }catch(e2){} throw e; }
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
        if (typeof window.updateHash === 'function') {
            window.updateHash('blogs', null, true);
        }
    }
    function setActiveNavigationItem(navItems, activeItem) {
        navItems.forEach(nav => nav.classList.toggle('active', nav === activeItem));
    }
    function showPageSection(sections, page) {
        sections.forEach(section => {
            section.classList.toggle('active', section.id === page);
        });
        if (page === 'about') {
            const aboutHero = document.querySelector('.about-hero');
            if (aboutHero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                aboutHero.classList.remove('about-animate');
                void aboutHero.offsetWidth;
                aboutHero.classList.add('about-animate');
            }
        } else if (page === 'home') {
            const homeHero = document.querySelector('.home-hero');
            if (homeHero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                homeHero.classList.remove('home-animate');
                void homeHero.offsetWidth;
                homeHero.classList.add('home-animate');
            }
        }
    }
    function updateBlogSidebarVisibility(blogSidebarSection, page) {
        if (!blogSidebarSection) return;
        blogSidebarSection.style.display = ['blogs', 'home', 'about'].includes(page)
            ? 'block'
            : 'none';
    }
    function clearActivePostSelector() {
        document.querySelectorAll('.post-selector-item.active').forEach(item => {
            item.classList.remove('active');
        });
    }
    function showBlogIntroView() {
        const introView = document.getElementById('blog-intro-view');
        const postView = document.getElementById('blog-post-view');
        if (postView) postView.style.display = 'none';
        if (introView) introView.style.display = 'block';
        clearActivePostSelector();
        if (typeof window.renderBlogPostSelectorGrid === 'function' && window.blogPostMetadata) {
            window.renderBlogPostSelectorGrid(window.blogPostMetadata);
        }
    }
    function saveStateAfterNavigation() {
        setTimeout(window.saveAppState, 100);
    }
    function generateBlogPostHash(postId) {
        return 'blog-' + postId;
    }
    function getBlogPostIdFromHash(hash) {
        if (hash && hash.startsWith('blog-')) {
            return hash.substring(5);
        }
        return null;
    }
    function updateHash(newHash, postId, addToHistory = true) {
        let hash = newHash;
        if (postId) {
            hash = generateBlogPostHash(postId);
        }
        if (window.location.hash !== '#' + hash) {
            if (addToHistory) {
                history.pushState({hash: hash}, '', '#' + hash);
            } else {
                history.replaceState({hash: hash}, '', '#' + hash);
            }
        }
    }
    function handleHashChange() {
        const hash = window.location.hash.substring(1);
        if (!hash || hash === 'home') {
            const homeNavItem = document.querySelector('.nav-item[data-page="home"]');
            if (homeNavItem) homeNavItem.click();
        } else if (hash === 'blogs') {
            if (window.pendingBlogPostRestore ||
                (typeof window.isBlogPostLoading === 'function' && window.isBlogPostLoading())) {
                return;
            }
            const blogsNavItem = document.querySelector('.nav-item[data-page="blogs"]');
            if (blogsNavItem) {
                blogsNavItem.click();
                const introView = document.getElementById('blog-intro-view');
                const postView = document.getElementById('blog-post-view');
                if (introView && postView) {
                    postView.style.display = 'none';
                    introView.style.display = 'block';
                }
            }
        } else if (hash === 'about') {
            const aboutNavItem = document.querySelector('.nav-item[data-page="about"]');
            if (aboutNavItem) aboutNavItem.click();
        } else if (hash && hash.startsWith('blog-')) {
            const postId = getBlogPostIdFromHash(hash);
            if (postId && typeof window.openBlogPostLazy === 'function') {
                window.openBlogPostLazy(postId);
            }
        }
    }
    function setupHashRouting() {
        window.addEventListener('hashchange', handleHashChange);
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.hash) {
                const hash = event.state.hash;
                if (window.location.hash !== '#' + hash) {
                    history.replaceState({hash: hash}, '', '#' + hash);
                }
                handleHashChange();
            } else if (window.location.hash) {
                handleHashChange();
            }
        });
        if (window.location.hash) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(handleHashChange, 100);
                });
            } else {
                setTimeout(handleHashChange, 100);
            }
        }
    }
    function createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
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
                            window.updateHash('blogs', null, true);
                            if (savedState.activeBlogPost) {
                                window.pendingBlogPostRestore = savedState.activeBlogPost;
                                if (typeof window.processPendingBlogPostRestore === 'function') {
                                    window.processPendingBlogPostRestore();
                                }
                            }
                            window.scrollTo(0, 0);
                            setTimeout(window.saveAppState, 100);
                            return;
                        } else {
                            hasRestoredBlogSession = false;
                            navigateToBlogsPageWithoutPrefetch();
                            window.updateHash('blogs', null, true);
                            showBlogIntroView();
                            window.scrollTo(0, 0);
                            if (typeof window.restoreScrollPosition === 'function') {
                                window.restoreScrollPosition();
                            }
                            saveStateAfterNavigation();
                            return;
                        }
                    }
                    if (isReadingPost) {
                        navigateToBlogsPageWithoutPrefetch();
                        window.updateHash('blogs', null, true);
                        showBlogIntroView();
                        window.scrollTo(0, 0);
                        if (typeof window.restoreScrollPosition === 'function') {
                            window.restoreScrollPosition();
                        }
                        saveStateAfterNavigation();
                        return;
                    }
                } else {
                    if (isReadingPost) {
                        wasReadingBlogPost = true;
                    }
                    if (item.dataset.page === 'home' || item.dataset.page === 'about') {
                        hasRestoredBlogSession = false;
                    }
                    const page = item.dataset.page;
                    setActiveNavigationItem(navItems, item);
                    showPageSection(sections, page);
                    updateBlogSidebarVisibility(blogSidebarSection, page);
                    if (page === 'home') {
                        window.updateHash('home', null, true);
                    } else if (page === 'about') {
                        window.updateHash('about', null, true);
                    } else if (page === 'blogs') {
                        window.updateHash('blogs', null, true);
                    }
                    window.scrollTo(0, 0);
                    if (typeof window.restoreScrollPosition === 'function') {
                        window.restoreScrollPosition();
                    }
                    saveStateAfterNavigation();
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
    function syncThemeColor(){
        var m=document.getElementById('theme-color-meta');
        if(!m) m=document.querySelector('meta[name="theme-color"]');
        if(!m) return;
        var t=document.documentElement.getAttribute('data-theme');
        var dark='#121212', light='#f6f5f4';
        if(t==='dark') m.content=dark;
        else if(t==='light') m.content=light;
        else m.content=window.matchMedia('(prefers-color-scheme: dark)').matches?dark:light;
    }
    function applyTheme(themeName) {
        const root = document.documentElement;
        root.setAttribute('data-theme', themeName);
        if (themeName === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
            return;
        }
        syncThemeColor();
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
        const SIDEBAR_COLLAPSE_BREAKPOINT = 1024;
        let hiddenForSpace = false;
        function isMobileView() {
            return window.innerWidth <= SIDEBAR_COLLAPSE_BREAKPOINT;
        }
        function syncBodyCollapsedClass() {
            document.body.classList.toggle('sidebar-collapsed', sidebar.classList.contains('collapsed'));
        }
        function initSidebarState() {
            sidebar.classList.add('no-anim');
            mainContainer.classList.add('no-anim');
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
            syncBodyCollapsedClass();
            void sidebar.offsetWidth;
            void mainContainer.offsetWidth;
            requestAnimationFrame(function(){
                requestAnimationFrame(function(){
                    sidebar.classList.remove('no-anim');
                    mainContainer.classList.remove('no-anim');
                });
            });
        }
        function setAnimating(on){
            if(on){
                sidebar.classList.add('is-animating');
                mainContainer.classList.add('is-animating');
                try{ document.dispatchEvent(new CustomEvent('sidebar:toggle')); }catch(e){}
            } else {
                sidebar.classList.remove('is-animating');
                mainContainer.classList.remove('is-animating');
            }
        }
        function clearAnimating(e){
            if(e.propertyName==='transform' && e.target===sidebar) setAnimating(false);
            if(e.propertyName==='margin-right' && e.target===mainContainer) setAnimating(false);
        }
        sidebar.addEventListener('transitionend', clearAnimating);
        mainContainer.addEventListener('transitionend', clearAnimating);
        initSidebarState();
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            hiddenForSpace = false;
            setAnimating(true);
            sidebar.classList.toggle('collapsed');
            sidebar.classList.toggle('expanded');
            mainContainer.classList.toggle('sidebar-collapsed');
            const isCollapsed = sidebar.classList.contains('collapsed');
            sidebarToggle.setAttribute('aria-label', isCollapsed ? 'Open Sidebar' : 'Collapse Sidebar');
            sidebarToggle.setAttribute('title', isCollapsed ? 'Open Sidebar' : 'Collapse Sidebar');
            syncBodyCollapsedClass();
            setTimeout(function(){ setAnimating(false); }, 400);
            setTimeout(window.saveAppState, 100);
        });
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (isMobileView()) {
                    if (!sidebar.classList.contains('collapsed')) {
                        hiddenForSpace = true;
                        setAnimating(true);
                        sidebar.classList.add('collapsed');
                        sidebar.classList.remove('expanded');
                        mainContainer.classList.add('sidebar-collapsed');
                        sidebarToggle.setAttribute('aria-label', 'Open Sidebar');
                        sidebarToggle.setAttribute('title', 'Open Sidebar');
                        syncBodyCollapsedClass();
                        setTimeout(function(){ setAnimating(false); }, 400);
                    }
                } else if (hiddenForSpace) {
                    hiddenForSpace = false;
                    setAnimating(true);
                    sidebar.classList.remove('collapsed');
                    sidebar.classList.add('expanded');
                    mainContainer.classList.remove('sidebar-collapsed');
                    sidebarToggle.setAttribute('aria-label', 'Collapse Sidebar');
                    sidebarToggle.setAttribute('title', 'Collapse Sidebar');
                    syncBodyCollapsedClass();
                    setTimeout(function(){ setAnimating(false); }, 400);
                } else {
                    if (!sidebar.classList.contains('collapsed') && !sidebar.classList.contains('expanded')) {
                        sidebar.classList.add('expanded');
                        mainContainer.classList.remove('sidebar-collapsed');
                        sidebarToggle.setAttribute('aria-label', 'Collapse Sidebar');
                        sidebarToggle.setAttribute('title', 'Collapse Sidebar');
                        syncBodyCollapsedClass();
                    } else {
                        syncBodyCollapsedClass();
                    }
                }
            }, 80);
        });
    }
    function setupThemePrefetch() {
        let bgPrefetched = false;
        let lastMouseMoveCheck = 0;
        function triggerPrefetch() {
            if (bgPrefetched) return;
            if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            var cookieMatch = document.cookie.match(/theme_preference=([^;]+)/);
            var savedTheme = cookieMatch ? cookieMatch[1] : null;
            var alternateBg;
            if (savedTheme === 'dark') {
                alternateBg = '/media/bg-light.webp';
            } else if (savedTheme === 'light') {
                alternateBg = '/media/bg-dark.webp';
            } else {
                alternateBg = prefersDark ? '/media/bg-light.webp' : '/media/bg-dark.webp';
            }
            bgPrefetched = true;
            navigator.serviceWorker.controller.postMessage({
                type: 'prefetch-bg',
                urls: [alternateBg]
            });
        }
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.addEventListener('mousemove', function(e) {
                const now = Date.now();
                if (now - lastMouseMoveCheck < 100) return;
                lastMouseMoveCheck = now;
                if (bgPrefetched) return;
                const chooser = sidebar.querySelector('.theme-chooser');
                if (!chooser) return;
                const rect = chooser.getBoundingClientRect();
                const proximity = 100;
                const isNear = (
                    e.clientX >= rect.left - proximity &&
                    e.clientX <= rect.right + proximity &&
                    e.clientY >= rect.top - proximity &&
                    e.clientY <= rect.bottom + proximity
                );
                if (isNear) {
                    triggerPrefetch();
                }
            });
        }
        const mobileTray = document.querySelector('.mobile-tray');
        if (mobileTray) {
            mobileTray.addEventListener('touchstart', function() {
                triggerPrefetch();
            }, {once: true, passive: true});
        }
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1 && node.classList && node.classList.contains('mobile-tray')) {
                        node.addEventListener('touchstart', function() {
                            triggerPrefetch();
                        }, {once: true, passive: true});
                        observer.disconnect();
                    }
                });
            });
        });
        observer.observe(document.body, {childList: true, subtree: true});
        setTimeout(function() {
            observer.disconnect();
        }, 30000);
    }
    window.navigateToBlogsPageWithoutPrefetch = navigateToBlogsPageWithoutPrefetch;
    window.createParticles = createParticles;
    window.setupNavigation = setupNavigation;
    window.wrapHomeContentInRectangle = wrapHomeContentInRectangle;
    window.getSavedTheme = getSavedTheme;
    window.saveThemePreference = saveThemePreference;
    window.applyTheme = applyTheme;
    window.setupTemplates = setupTemplates;
    window.setupSystemThemeListener = setupSystemThemeListener;
    window.handleClickMe = handleClickMe;
    window.setupSidebarToggle = setupSidebarToggle;
    window.setupHashRouting = setupHashRouting;
    window.updateHash = updateHash;
    window.setupThemePrefetch = setupThemePrefetch;
})();
