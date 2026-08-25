(function() {
    'use strict';
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()||(window.CP.isDevToolOpened&&window.CP.isDevToolOpened())){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP not verified'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e2){} throw e; }
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
                if (typeof window.restoreScrollPosition === 'function') {
                    window.restoreScrollPosition();
                } else {
                    window.scrollTo(0, 0);
                }
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
    const SCROLL_STORAGE_KEY = 'blogPlatformScrollPositions';
    const SCROLL_SAVE_DELAY = 250;
    const SCROLL_CONTAINER_SELECTOR = '.content-area';
    const NAVIGATION_SELECTORS = [
        '.nav-item',
        '.post-selector-item',
        '.back-to-intro-btn',
        '.blog-card',
        '.blog-btn',
        '.blue-button',
        '.mobile-post-item',
        '.mobile-nav-item'
    ];
    let scrollPositions = null;
    let scrollSaveTimer = null;
    let lastRestoredPageKey = null;
    let lastRestoredX = null;
    let lastRestoredY = null;
    let lastRestoredWindowY = null;
    function loadScrollPositions() {
        if (scrollPositions) return scrollPositions;
        try {
            const raw = localStorage.getItem(SCROLL_STORAGE_KEY);
            scrollPositions = raw ? JSON.parse(raw) : {};
        } catch (err) {
            console.warn('Failed to load scroll positions:', err);
            scrollPositions = {};
        }
        return scrollPositions;
    }
    function persistScrollPositions() {
        try {
            localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(scrollPositions));
        } catch (err) {
            if (err.name !== 'QuotaExceededError') {
                console.warn('Failed to save scroll positions:', err);
                return;
            }
            const entries = Object.keys(scrollPositions)
                .map((key) => ({key: key, timestamp: scrollPositions[key].timestamp || 0}))
                .sort((a, b) => a.timestamp - b.timestamp);
            for (const entry of entries) {
                delete scrollPositions[entry.key];
                try {
                    localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(scrollPositions));
                    console.log('Dropped oldest scroll positions to free storage quota');
                    return;
                } catch (e) {
                }
            }
            console.warn('Failed to save scroll positions: storage full');
        }
    }
    function getScrollContainer() {
        const container = document.querySelector(SCROLL_CONTAINER_SELECTOR);
        if (container) return container;
        return document.scrollingElement || document.documentElement;
    }
    function isWindowContainer(container) {
        return container === document.scrollingElement || container === document.documentElement;
    }
    function getScrollPosition() {
        const container = getScrollContainer();
        if (isWindowContainer(container)) {
            return {
                x: window.scrollX || 0,
                y: window.scrollY || 0,
                windowY: window.scrollY || 0
            };
        }
        return {
            x: container.scrollLeft || 0,
            y: container.scrollTop || 0,
            windowY: window.scrollY || 0
        };
    }
    function setScrollPosition(x, y, windowY) {
        const container = getScrollContainer();
        if (isWindowContainer(container)) {
            window.scrollTo(x, y);
        } else {
            container.scrollTop = y;
            container.scrollLeft = x;
        }
        window.scrollTo(0, typeof windowY === 'number' ? windowY : 0);
    }
    function getCurrentPageKey() {
        const activeSection = document.querySelector('.page-section.active');
        const activeId = activeSection ? activeSection.id : 'home';
        if (activeId !== 'blogs') {
            return activeId;
        }
        const postView = document.getElementById('blog-post-view');
        if (postView && postView.style.display !== 'none' && postView.style.display !== '') {
            const activeItem = document.querySelector('.post-selector-item.active');
            const postId = activeItem && activeItem.getAttribute('data-post-id');
            if (postId) {
                return 'blog-' + postId;
            }
            const hash = window.location.hash.substring(1);
            if (hash && hash.startsWith('blog-')) {
                return hash;
            }
        }
        return 'blogs';
    }
    function saveScrollPosition() {
        const pageKey = getCurrentPageKey();
        if (!pageKey) return;
        const pos = getScrollPosition();
        const positions = loadScrollPositions();
        positions[pageKey] = {
            x: Math.max(0, pos.x),
            y: Math.max(0, pos.y),
            windowY: Math.max(0, pos.windowY),
            timestamp: Date.now()
        };
        persistScrollPositions();
    }
    function applyScrollPosition(pageKey, x, y, windowY) {
        if (getCurrentPageKey() !== pageKey) return;
        lastRestoredPageKey = pageKey;
        lastRestoredX = x;
        lastRestoredY = y;
        lastRestoredWindowY = typeof windowY === 'number' ? windowY : 0;
        setScrollPosition(x, y, lastRestoredWindowY);
    }
    function clampScrollY(y){
        var c=getScrollContainer();
        if(isWindowContainer(c)) return y;
        var max=c.scrollHeight - c.clientHeight;
        if(max<=0) return 0;
        return Math.max(0, Math.min(y, max));
    }
    function restoreScrollPosition() {
        const pageKey = getCurrentPageKey();
        if (!pageKey) return;
        const saved = loadScrollPositions()[pageKey];
        const x = saved && typeof saved.x === 'number' ? saved.x : 0;
        const y = saved && typeof saved.y === 'number' ? clampScrollY(saved.y) : 0;
        const windowY = saved && typeof saved.windowY === 'number' ? saved.windowY : 0;
        const apply = () => applyScrollPosition(pageKey, x, clampScrollY(y), windowY);
        apply();
        window.requestAnimationFrame(apply);
        setTimeout(apply, 60);
    }
    function hasMovedSinceRestore() {
        const pos = getScrollPosition();
        return Math.abs(pos.x - lastRestoredX) > 2 || Math.abs(pos.y - lastRestoredY) > 2;
    }
    function reapplySavedPositionWhenContentSettles() {
        window.addEventListener('load', () => {
            if (lastRestoredPageKey === null) return;
            const saved = loadScrollPositions()[lastRestoredPageKey];
            if (!saved) return;
            if (getCurrentPageKey() !== lastRestoredPageKey) return;
            if (hasMovedSinceRestore()) return;
            setScrollPosition(lastRestoredX, lastRestoredY, lastRestoredWindowY);
        });
        document.addEventListener('blog:metadata-loaded', () => {
            if (lastRestoredPageKey !== 'blogs') return;
            const saved = loadScrollPositions()['blogs'];
            if (!saved) return;
            if (getCurrentPageKey() !== 'blogs') return;
            if (hasMovedSinceRestore()) return;
            setScrollPosition(saved.x, saved.y, saved.windowY);
        });
    }
    const COLD_LOAD_TOP_SNAP_PX = 60;
    function restoreInitialPagePosition() {
        const hash = window.location.hash.substring(1);
        if (hash && hash !== 'home') {
            return;
        }
        const pageKey = getCurrentPageKey();
        const saved = loadScrollPositions()[pageKey];
        let x = 0;
        let y = 0;
        let windowY = 0;
        if (saved) {
            x = typeof saved.x === 'number' ? Math.max(0, saved.x) : 0;
            y = typeof saved.y === 'number' ? Math.max(0, clampScrollY(saved.y)) : 0;
            windowY = typeof saved.windowY === 'number' ? Math.max(0, saved.windowY) : 0;
            if (y <= COLD_LOAD_TOP_SNAP_PX) {
                y = 0;
                windowY = 0;
            }
        }
        const apply = () => applyScrollPosition(pageKey, x, clampScrollY(y), windowY);
        window.requestAnimationFrame(apply);
        setTimeout(apply, 100);
        setTimeout(apply, 300);
    }
    function setupScrollPositionTracking() {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.addEventListener('scroll', () => {
            clearTimeout(scrollSaveTimer);
            scrollSaveTimer = setTimeout(saveScrollPosition, SCROLL_SAVE_DELAY);
        }, {passive: true, capture: true});
        window.addEventListener('beforeunload', saveScrollPosition);
        window.addEventListener('pagehide', saveScrollPosition);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                saveScrollPosition();
            }
        });
        document.addEventListener('click', (e) => {
            const isNavigation = NAVIGATION_SELECTORS.some((selector) =>
                e.target.closest?.(selector)
            );
            if (isNavigation) {
                saveScrollPosition();
            }
        }, true);
        window.addEventListener('popstate', saveScrollPosition);
        reapplySavedPositionWhenContentSettles();
        restoreInitialPagePosition();
    }
    window.saveAppState = saveAppState;
    window.loadAppState = loadAppState;
    window.restoreAppState = restoreAppState;
    window.setupStatePersistence = setupStatePersistence;
    window.getCurrentPage = getCurrentPage;
    window.processPendingBlogPostRestore = processPendingBlogPostRestore;
    window.setupScrollPositionTracking = setupScrollPositionTracking;
    window.saveScrollPosition = saveScrollPosition;
    window.restoreScrollPosition = restoreScrollPosition;
})();
