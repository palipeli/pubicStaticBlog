// mobile-tray.js - Mobile Navigation Tray for Constrained Spaces
// Only activates on mobile screens (max-width: 768px)

(function() {
    const MOBILE_BREAKPOINT = 768;
    let isTrayOpen = false;
    
    // Check if we're in mobile view
    function isMobileView() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }
    
    // Create the mobile tray element
    function createMobileTray() {
        // Don't create tray on desktop
        if (!isMobileView()) {
            const existingTray = document.getElementById('mobile-nav-tray');
            if (existingTray) {
                existingTray.remove();
            }
            return;
        }
        
        // Don't create if already exists
        if (document.getElementById('mobile-nav-tray')) return;
        
        const tray = document.createElement('div');
        tray.id = 'mobile-nav-tray';
        tray.className = 'mobile-nav-tray';
        tray.innerHTML = `
            <div class="mobile-tray-content">
                <!-- Navigation Links Section -->
                <div class="mobile-tray-section">
                    <h3 class="mobile-tray-section-title">Navigation</h3>
                    <div class="mobile-nav-list">
                        <button class="mobile-nav-item mc-btn" data-page="home">Home</button>
                        <button class="mobile-nav-item mc-btn" data-page="blogs">Blogs</button>
                        <button class="mobile-nav-item mc-btn" data-page="about">About</button>
                    </div>
                </div>
                
                <!-- Blog Posts Section (visible only on blogs page) -->
                <div class="mobile-tray-section" id="mobile-blog-posts-section">
                    <h3 class="mobile-tray-section-title">All Posts</h3>
                    <div class="mobile-post-list" id="mobile-post-list">
                        <!-- Posts will be rendered here -->
                    </div>
                </div>
                
                <!-- Theme Section -->
                <div class="mobile-tray-section">
                    <h3 class="mobile-tray-section-title">THEMES</h3>
                    <div class="mobile-theme-chooser">
                        <button class="mobile-theme-btn" data-theme="auto">Auto</button>
                        <button class="mobile-theme-btn" data-theme="light">Light</button>
                        <button class="mobile-theme-btn" data-theme="dark">Dark</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(tray);
        
        // Setup event listeners
        setupTrayEventListeners(tray);
        syncThemeButtons();
    }
    
    // Setup event listeners for the tray
    function setupTrayEventListeners(tray) {
        const overlay = document.getElementById('mobile-tray-overlay');
        
        // Overlay click - close tray without triggering warning
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeTray();
            });
        }
        
        // Theme buttons
        const themeBtns = tray.querySelectorAll('.mobile-theme-btn');
        themeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const theme = btn.dataset.theme;
                
                // Update active state
                themeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Apply theme using global function if available
                if (typeof applyTheme === 'function') {
                    applyTheme(theme);
                }
                
                // Save preference
                if (typeof saveThemePreference === 'function') {
                    saveThemePreference(theme);
                }
                
                // Sync with sidebar theme buttons
                syncSidebarThemeButtons(theme);
            });
        });
        
        // Navigation links
        const navItems = tray.querySelectorAll('.mobile-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const page = item.dataset.page;
                
                // Trigger navigation using existing system
                const desktopNavItem = document.querySelector(`.nav-item[data-page="${page}"]`);
                if (desktopNavItem) {
                    desktopNavItem.click();
                }
                
                closeTray();
            });
        });
        
        // Prevent clicks inside tray from propagating
        tray.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // Close the tray
    function closeTray() {
        const tray = document.getElementById('mobile-nav-tray');
        const overlay = document.getElementById('mobile-tray-overlay');
        
        if (tray) tray.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
        
        isTrayOpen = false;
        document.body.classList.remove('mobile-tray-open');
    }
    
    // Open the tray (used for auto-expand on blogs page)
    function openTray() {
        if (!isMobileView()) return;
        
        const tray = document.getElementById('mobile-nav-tray');
        const overlay = document.getElementById('mobile-tray-overlay');
        
        if (!tray) return;
        
        // Only open if not already open
        if (tray.classList.contains('open')) return;
        
        // Open tray
        tray.classList.add('open');
        if (overlay) overlay.classList.add('open');
        isTrayOpen = true;
        document.body.classList.add('mobile-tray-open');
        
        // Update blog posts section visibility
        updateBlogPostsVisibility();
    }
    
    // Create the overlay
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
    
    // Create the toggle button in header
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
        
        // Insert into header-right, after all nav items (rightmost position)
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            headerRight.appendChild(toggleBtn);
        }
        
        // Add click event listener directly when creating button
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const tray = document.getElementById('mobile-nav-tray');
            const overlay = document.getElementById('mobile-tray-overlay');
            
            if (!tray) return;
            
            const isOpen = tray.classList.contains('open');
            
            if (isOpen) {
                // Close tray
                tray.classList.remove('open');
                if (overlay) overlay.classList.remove('open');
                isTrayOpen = false;
                document.body.classList.remove('mobile-tray-open');
            } else {
                // Open tray
                tray.classList.add('open');
                if (overlay) overlay.classList.add('open');
                isTrayOpen = true;
                document.body.classList.add('mobile-tray-open');
                
                // Update blog posts section visibility
                updateBlogPostsVisibility();
            }
        });
    }
    
    // Sync theme buttons between mobile tray and sidebar
    function syncThemeButtons() {
        const savedTheme = typeof getSavedTheme === 'function' ? getSavedTheme() : 'auto';
        
        // Update mobile tray buttons
        const mobileThemeBtns = document.querySelectorAll('.mobile-theme-btn');
        mobileThemeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === savedTheme);
        });
    }
    
    // Sync sidebar theme buttons when mobile tray changes
    function syncSidebarThemeButtons(theme) {
        const sidebarThemeBtns = document.querySelectorAll('.theme-btn');
        sidebarThemeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }
    
    // Update blog posts visibility based on current page
    function updateBlogPostsVisibility() {
        const blogSection = document.getElementById('mobile-blog-posts-section');
        const activePage = document.querySelector('.page-section.active');
        
        if (blogSection && activePage) {
            if (activePage.id === 'blogs') {
                blogSection.classList.add('blog-visible');
                renderMobilePostList();
            } else {
                blogSection.classList.remove('blog-visible');
            }
        }
    }
    
    // Render post list in mobile tray
    function renderMobilePostList() {
        const container = document.getElementById('mobile-post-list');
        if (!container) return;
        
        // Get posts from global window.blogPostMetadata array (lazy loading - metadata only)
        const posts = typeof window.blogPostMetadata !== 'undefined' ? window.blogPostMetadata : [];
        
        if (posts.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">Loading posts...</p>';
            return;
        }
        
        container.innerHTML = '';
        posts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'mobile-post-item';
            
            // Check if this post is currently active
            const isActive = window.currentlyActiveBlogPost === post.id;
            if (isActive) {
                item.classList.add('active');
            }
            
            item.innerHTML = `
                <div class="mobile-post-title">${post.icon} ${post.title}</div>
                <div class="mobile-post-meta">${post.date}</div>
            `;
            
            // Preload content on touch start for faster response
            item.addEventListener('touchstart', () => {
                if (typeof window.preloadBlogPostContent === 'function') {
                    window.preloadBlogPostContent(post.id);
                }
            }, { passive: true });
            
            // Also preload on mouseenter/hover for devices that support it
            item.addEventListener('mouseenter', () => {
                if (typeof window.preloadBlogPostContent === 'function') {
                    window.preloadBlogPostContent(post.id);
                }
            });
            
            // Preload on mouseover as backup
            item.addEventListener('mouseover', () => {
                if (typeof window.preloadBlogPostContent === 'function') {
                    window.preloadBlogPostContent(post.id);
                }
            });
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Use global openBlogPostLazy function for lazy loading
                if (typeof window.openBlogPostLazy === 'function') {
                    window.openBlogPostLazy(post.id);
                } else if (typeof openBlogPost === 'function') {
                    openBlogPost(post.id);
                }
                
                closeTray();
            });
            
            container.appendChild(item);
        });
        
        // Update active states after rendering
        updateMobilePostListActiveState();
    }
    
    // Update active state in mobile post list
    function updateMobilePostListActiveState() {
        const container = document.getElementById('mobile-post-list');
        if (!container) return;
        
        const items = container.querySelectorAll('.mobile-post-item');
        const activeId = window.currentlyActiveBlogPost;
        
        items.forEach(item => {
            const title = item.querySelector('.mobile-post-title');
            if (title && title.textContent.includes(activeId)) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    // Handle resize events
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
                // Remove mobile elements on desktop
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
    
    // Initialize
    function init() {
        if (isMobileView()) {
            createToggleButton();
            createMobileTray();
            createOverlay();
        }
        
        window.addEventListener('resize', handleResize);
        
        // Listen for page changes to update blog posts visibility
        document.addEventListener('DOMContentLoaded', () => {
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.addEventListener('click', () => {
                    setTimeout(updateBlogPostsVisibility, 100);
                });
            });
            
            // Also listen for when blog metadata is loaded to render mobile post list
            // This ensures the mobile tray can access window.blogPostMetadata once it's available
            const checkAndRenderPosts = setInterval(() => {
                if (typeof window.blogPostMetadata !== 'undefined' && window.blogPostMetadata.length > 0) {
                    updateBlogPostsVisibility();
                    clearInterval(checkAndRenderPosts);
                }
            }, 100);
            
            // Clear interval after 5 seconds to avoid infinite checking
            setTimeout(() => clearInterval(checkAndRenderPosts), 5000);
        });
        
        // Expose updateBlogPostsVisibility globally for app.js to call
        window.updateBlogPostsVisibility = updateBlogPostsVisibility;
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
