(function() {
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()||(window.CP.isDevToolOpened&&window.CP.isDevToolOpened())){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP not verified'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e2){} throw e; }
    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
    }
    const MOBILE_BREAKPOINT = 768;
    function isMobileView() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }
    function createMobileTray() {
        if (!isMobileView()) {
            const existingTray = document.getElementById('mobile-nav-tray');
            if (existingTray) {
                existingTray.remove();
            }
            return;
        }
        if (document.getElementById('mobile-nav-tray')) return;
        const tray = document.createElement('div');
        tray.id = 'mobile-nav-tray';
        tray.className = 'mobile-nav-tray';
        tray.innerHTML = `
            <div class="mobile-tray-content">
                <div class="mobile-tray-section blog-only" id="mobile-blog-posts-section">
                    <h3 class="mobile-tray-section-title">All Posts</h3>
                    <div class="mobile-post-list" id="mobile-post-list">
                    </div>
                </div>
                <div class="mobile-tray-section">
                    <h3 class="mobile-tray-section-title">Theme</h3>
                    <div class="mobile-theme-chooser">
                        <button class="mobile-theme-btn" data-theme="auto"><i class="fa-solid fa-desktop"></i> Auto</button>
                        <button class="mobile-theme-btn" data-theme="light"><i class="fa-solid fa-sun"></i> Light</button>
                        <button class="mobile-theme-btn" data-theme="dark"><i class="fa-solid fa-moon"></i> Dark</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(tray);
        setupTrayEventListeners(tray);
        syncThemeButtons();
    }
    function setupTrayEventListeners(tray) {
        const overlay = document.getElementById('mobile-tray-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeTray();
            });
        }
        const themeBtns = tray.querySelectorAll('.mobile-theme-btn');
        themeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const theme = btn.dataset.theme;
                themeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (typeof applyTheme === 'function') {
                    applyTheme(theme);
                }
                if (typeof saveThemePreference === 'function') {
                    saveThemePreference(theme);
                }
                syncSidebarThemeButtons(theme);
            });
        });
        tray.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    function closeTray() {
        const tray = document.getElementById('mobile-nav-tray');
        const overlay = document.getElementById('mobile-tray-overlay');
        if (tray) tray.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
        document.body.classList.remove('mobile-tray-open');
    }
    function createOverlay() {
        if (!isMobileView()) {
            const existingOverlay = document.getElementById('mobile-tray-overlay');
            if (existingOverlay) existingOverlay.remove();
            return;
        }
        if (document.getElementById('mobile-tray-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'mobile-tray-overlay';
        overlay.className = 'mobile-tray-overlay';
        document.body.appendChild(overlay);
    }
    function createToggleButton() {
        if (document.getElementById('mobile-tray-toggle')) return;
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'mobile-tray-toggle';
        toggleBtn.className = 'mobile-tray-toggle';
        toggleBtn.setAttribute('aria-label', 'Toggle Menu');
        toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
        `;
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            headerRight.appendChild(toggleBtn);
        }
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const tray = document.getElementById('mobile-nav-tray');
            const overlay = document.getElementById('mobile-tray-overlay');
            if (!tray) return;
            const isOpen = tray.classList.contains('open');
            if (isOpen) {
                tray.classList.remove('open');
                if (overlay) overlay.classList.remove('open');
                document.body.classList.remove('mobile-tray-open');
            } else {
                tray.classList.add('open');
                if (overlay) overlay.classList.add('open');
                document.body.classList.add('mobile-tray-open');
                updateBlogPostsVisibility();
            }
        });
    }
    function syncThemeButtons() {
        const savedTheme = typeof getSavedTheme === 'function' ? getSavedTheme() : 'auto';
        const mobileThemeBtns = document.querySelectorAll('.mobile-theme-btn');
        mobileThemeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === savedTheme);
        });
    }
    function syncSidebarThemeButtons(theme) {
        const sidebarThemeBtns = document.querySelectorAll('.theme-btn');
        sidebarThemeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }
    function updateBlogPostsVisibility() {
        const blogSection = document.getElementById('mobile-blog-posts-section');
        if (blogSection) {
            blogSection.style.display = 'block';
            renderMobilePostList();
        }
    }
    function renderMobilePostList() {
        const container = document.getElementById('mobile-post-list');
        if (!container) return;
        const posts = typeof window.blogPostMetadata !== 'undefined' ? window.blogPostMetadata : [];
        if (posts.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">Loading posts...</p>';
            return;
        }
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        posts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'mobile-post-item' + (post.pinned ? ' pinned' : '');
            item.innerHTML = `
                <div class="mobile-post-title">${escapeHtml(post.title)}</div>
                <div class="mobile-post-meta">${escapeHtml(post.icon)} ${escapeHtml(post.date)} • ${escapeHtml(post.category)}</div>
                ${post.pinned ? '<div class="mobile-post-pin" title="Pinned post" aria-hidden="true">📌</div>' : ''}
            `;
            item.addEventListener('touchstart', () => {
                if (typeof window.preloadBlogPostContent === 'function') {
                    window.preloadBlogPostContent(post.id);
                }
            }, {passive: true});
            item.addEventListener('mouseenter', () => {
                if (typeof window.preloadBlogPostContent === 'function') {
                    window.preloadBlogPostContent(post.id);
                }
            });
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.openBlogPostLazy === 'function') {
                    window.openBlogPostLazy(post.id);
                }
                closeTray();
            });
            fragment.appendChild(item);
        });
        container.appendChild(fragment);
    }
    let resizeTimeout;
    function handleResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (isMobileView()) {
                createMobileTray();
                createOverlay();
                syncThemeButtons();
            } else {
                const tray = document.getElementById('mobile-nav-tray');
                const overlay = document.getElementById('mobile-tray-overlay');
                if (tray) tray.remove();
                if (overlay) overlay.remove();
                closeTray();
            }
        }, 100);
    }
    function init() {
        // The toggle stays in the DOM on every viewport so its width/opacity
        // can transition smoothly across the breakpoint (sliding the nav
        // items along with it); the CSS hides it on desktop.
        createToggleButton();
        if (isMobileView()) {
            createMobileTray();
            createOverlay();
        }
        window.addEventListener('resize', handleResize);
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                setTimeout(updateBlogPostsVisibility, 100);
            });
        });
        document.addEventListener('blog:metadata-loaded', () => {
            updateBlogPostsVisibility();
        });
        if (typeof window.blogPostMetadata !== 'undefined' && window.blogPostMetadata.length > 0) {
            updateBlogPostsVisibility();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
