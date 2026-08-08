(function() {
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
        if (!isMobileView()) {
            const existingToggle = document.getElementById('mobile-tray-toggle');
            if (existingToggle) existingToggle.remove();
            return;
        }
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
        posts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'mobile-post-item';
            item.innerHTML = `
                <div class="mobile-post-title">${post.icon} ${post.title}</div>
                <div class="mobile-post-meta">${post.date}</div>
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
            container.appendChild(item);
        });
    }
    let resizeTimeout;
    function handleResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (isMobileView()) {
                createMobileTray();
                createOverlay();
                createToggleButton();
                syncThemeButtons();
            } else {
                const tray = document.getElementById('mobile-nav-tray');
                const overlay = document.getElementById('mobile-tray-overlay');
                const toggleBtn = document.getElementById('mobile-tray-toggle');
                if (tray) tray.remove();
                if (overlay) overlay.remove();
                if (toggleBtn) toggleBtn.remove();
                closeTray();
            }
        }, 100);
    }
    function init() {
        if (isMobileView()) {
            createToggleButton();
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
