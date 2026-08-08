(function() {
    'use strict';

    const STORAGE_KEY = 'blogPlatformScrollPositions';
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
            const raw = localStorage.getItem(STORAGE_KEY);
            scrollPositions = raw ? JSON.parse(raw) : {};
        } catch (err) {
            console.warn('Failed to load scroll positions:', err);
            scrollPositions = {};
        }
        return scrollPositions;
    }

    function persistScrollPositions() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(scrollPositions));
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
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(scrollPositions));
                    console.log('Dropped oldest scroll positions to free storage quota');
                    return;
                } catch (e) {
                    // Keep dropping the oldest entries until the write fits.
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
            // The post view can linger display:block inside the hidden #blogs
            // section after navigating to home/about; the key must follow the
            // section that is actually visible.
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

    function restoreScrollPosition() {
        const pageKey = getCurrentPageKey();
        if (!pageKey) return;
        const saved = loadScrollPositions()[pageKey];
        const x = saved && typeof saved.x === 'number' ? saved.x : 0;
        const y = saved && typeof saved.y === 'number' ? saved.y : 0;
        const windowY = saved && typeof saved.windowY === 'number' ? saved.windowY : 0;
        const apply = () => applyScrollPosition(pageKey, x, y, windowY);
        window.requestAnimationFrame(apply);
        // Fallback for throttled/background contexts where rAF callbacks are
        // suppressed; applying twice to the same target is harmless.
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
            setScrollPosition(saved.x, saved.y, saved.windowY);
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

    function restoreInitialPagePosition() {
        const hash = window.location.hash.substring(1);
        if (hash && hash !== 'home') {
            // Hash routing will navigate to the hashed page and restore it itself.
            return;
        }
        const pageKey = getCurrentPageKey();
        const saved = loadScrollPositions()[pageKey];
        if (!saved) return;
        const apply = () => applyScrollPosition(pageKey, saved.x, saved.y, saved.windowY);
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

    window.setupScrollPositionTracking = setupScrollPositionTracking;
    window.saveScrollPosition = saveScrollPosition;
    window.restoreScrollPosition = restoreScrollPosition;
})();
