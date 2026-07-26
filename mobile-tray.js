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
            <div class="mobile-tray-header">
                <span class="mobile-tray-title">Menu</span>
                <button class="mobile-tray-close" id="mobile-tray-close" aria-label="Close Menu">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
            <div class="mobile-tray-content">
                <!-- Theme Section -->
                <div class="mobile-tray-section">
                    <h3 class="mobile-tray-section-title">Theme</h3>
                    <div class="mobile-theme-chooser">
                        <button class="mobile-theme-btn" data-theme="auto">Auto</button>
                        <button class="mobile-theme-btn" data-theme="adwaita-light">Adwaita Light</button>
                        <button class="mobile-theme-btn" data-theme="adwaita-dark">Adwaita Dark</button>
                    </div>
                </div>
                
                <!-- About Section -->
                <div class="mobile-tray-section">
                    <div class="mobile-photo-placeholder">
                        <svg viewBox="0 0 100 100" width="80" height="80">
                            <circle cx="50" cy="35" r="20" fill="currentColor" opacity="0.3"/>
                            <ellipse cx="50" cy="85" rx="30" ry="15" fill="currentColor" opacity="0.3"/>
                        </svg>
                    </div>
                    <div class="mobile-about-text">
                        <p>A Blender-inspired blogging platform built with pure HTML, CSS, and JavaScript. Minimalist, fast, and transparent.</p>
                    </div>
                </div>
                
                <!-- Blog Posts Section (only visible on blog page) -->
                <div class="mobile-tray-section blog-only" id="mobile-blog-posts-section" style="display: none;">
                    <h3 class="mobile-tray-section-title">All Posts</h3>
                    <div class="mobile-post-list" id="mobile-post-list">
                        <!-- Posts will be rendered here -->
                    </div>
                </div>
                
                <!-- Navigation Links -->
                <div class="mobile-tray-section">
                    <h3 class="mobile-tray-section-title">Navigation</h3>
                    <div class="mobile-nav-links">
                        <a href="#" class="mobile-nav-item" data-page="home">Home</a>
                        <a href="#" class="mobile-nav-item" data-page="blogs">Blogs</a>
                        <a href="#" class="mobile-nav-item" data-page="about">About</a>
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
        const toggleBtn = document.getElementById('mobile-tray-toggle');
        const closeBtn = document.getElementById('mobile-tray-close');
        const overlay = document.getElementById('mobile-tray-overlay');
        
        // Toggle button click - prevent warning flash
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openTray();
            });
        }
        
        // Close button click
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeTray();
            });
        }
        
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
    
    // Open the tray
    function openTray() {
        if (!isMobileView()) return;
        
        const tray = document.getElementById('mobile-nav-tray');
        const overlay = document.getElementById('mobile-tray-overlay');
        
        if (!tray) return;
        
        tray.classList.add('open');
        if (overlay) overlay.classList.add('open');
        
        isTrayOpen = true;
        document.body.classList.add('mobile-tray-open');
        
        // Update blog posts section visibility
        updateBlogPostsVisibility();
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
        toggleBtn.setAttribute('aria-label', 'Open Menu');
        toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
        `;
        
        // Insert into header-right, before nav items
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            headerRight.insertBefore(toggleBtn, headerRight.firstChild);
        }
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
                blogSection.style.display = 'block';
                renderMobilePostList();
            } else {
                blogSection.style.display = 'none';
            }
        }
    }
    
    // Render post list in mobile tray
    function renderMobilePostList() {
        const container = document.getElementById('mobile-post-list');
        if (!container) return;
        
        // Get posts from global blogPosts array if available
        const posts = typeof blogPosts !== 'undefined' ? blogPosts : [];
        
        if (posts.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">No posts available.</p>';
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
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Use global openBlogPost function if available
                if (typeof openBlogPost === 'function') {
                    openBlogPost(post.id);
                }
                
                closeTray();
            });
            
            container.appendChild(item);
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
            createMobileTray();
            createOverlay();
            createToggleButton();
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
        });
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
