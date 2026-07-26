// mobile-tray.js - Mobile Tray for constrained spaces
// Only activates on mobile devices (width <= 768px)

(function() {
    'use strict';
    
    // Mobile breakpoint
    const MOBILE_BREAKPOINT = 768;
    
    // State
    let isTrayOpen = false;
    let isMobile = false;
    let blogPosts = [];
    
    // DOM Elements
    let trayElement = null;
    let toggleButton = null;
    let overlayElement = null;
    let trayContent = null;
    
    // Check if we're on mobile
    function checkMobile() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }
    
    // Initialize mobile tray
    function initMobileTray() {
        // Don't initialize if already done
        if (trayElement) return;
        
        // Create tray HTML structure
        createTrayElements();
        
        // Setup event listeners
        setupEventListeners();
        
        // Populate tray content
        populateTrayContent();
    }
    
    // Create tray DOM elements
    function createTrayElements() {
        // Create overlay
        overlayElement = document.createElement('div');
        overlayElement.className = 'mobile-tray-overlay';
        overlayElement.id = 'mobile-tray-overlay';
        document.body.appendChild(overlayElement);
        
        // Create tray
        trayElement = document.createElement('div');
        trayElement.className = 'mobile-tray';
        trayElement.id = 'mobile-tray';
        trayElement.innerHTML = `
            <div class="mobile-tray-header" id="mobile-tray-header">
                <div class="mobile-tray-handle">
                    <div class="mobile-tray-handle-icon"></div>
                    <span>Menu</span>
                </div>
                <button class="mobile-tray-close" id="mobile-tray-close" aria-label="Close menu">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
            <div class="mobile-tray-content" id="mobile-tray-content">
                <!-- Content will be populated -->
            </div>
        `;
        document.body.appendChild(trayElement);
        
        // Create toggle button
        toggleButton = document.createElement('button');
        toggleButton.className = 'mobile-tray-toggle';
        toggleButton.id = 'mobile-tray-toggle';
        toggleButton.setAttribute('aria-label', 'Open menu');
        toggleButton.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
        `;
        document.body.appendChild(toggleButton);
        
        // Get content reference
        trayContent = document.getElementById('mobile-tray-content');
    }
    
    // Populate tray content from sidebar
    function populateTrayContent() {
        if (!trayContent) return;
        
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        
        // Build content HTML
        let contentHTML = '';
        
        // Theme section
        const themeSection = sidebar.querySelector('.sidebar-section:first-child');
        if (themeSection) {
            contentHTML += `
                <div class="mobile-tray-section">
                    <div class="mobile-tray-title">Theme</div>
                    <div class="mobile-theme-chooser">
                        <button class="mobile-theme-btn ${getActiveTheme() === 'auto' ? 'active' : ''}" data-theme="auto">Auto</button>
                        <button class="mobile-theme-btn ${getActiveTheme() === 'adwaita-light' ? 'active' : ''}" data-theme="adwaita-light">Adwaita Light</button>
                        <button class="mobile-theme-btn ${getActiveTheme() === 'adwaita-dark' ? 'active' : ''}" data-theme="adwaita-dark">Adwaita Dark</button>
                    </div>
                </div>
            `;
        }
        
        // Profile section
        const profileSection = sidebar.querySelector('.sidebar-section:nth-child(2)');
        if (profileSection) {
            const photoPlaceholder = profileSection.querySelector('.photo-placeholder');
            const aboutShort = profileSection.querySelector('.about-short');
            
            contentHTML += `
                <div class="mobile-tray-section">
                    <div class="mobile-profile-section">
                        <div class="mobile-photo-placeholder">
                            ${photoPlaceholder ? photoPlaceholder.innerHTML : '<svg viewBox="0 0 100 100"><circle cx="50" cy="35" r="20" fill="currentColor" opacity="0.3"/><ellipse cx="50" cy="85" rx="30" ry="15" fill="currentColor" opacity="0.3"/></svg>'}
                        </div>
                        ${aboutShort ? `<div class="mobile-about-short">${aboutShort.innerHTML}</div>` : ''}
                    </div>
                </div>
            `;
        }
        
        // Blog posts section (only visible on blog page)
        const blogSection = sidebar.querySelector('.sidebar-section.blog-only');
        if (blogSection && blogSection.style.display !== 'none') {
            const postList = sidebar.querySelector('#post-selector-list');
            if (postList && postList.children.length > 0) {
                contentHTML += `
                    <div class="mobile-tray-section">
                        <div class="mobile-tray-title">All Posts</div>
                        <div class="mobile-post-list">
                `;
                
                Array.from(postList.children).forEach((item, index) => {
                    const titleEl = item.querySelector('.post-selector-title');
                    const metaEl = item.querySelector('.post-selector-meta');
                    const isActive = item.classList.contains('active');
                    
                    contentHTML += `
                        <div class="mobile-post-item ${isActive ? 'active' : ''}" data-post-index="${index}">
                            <div class="mobile-post-title">${titleEl ? titleEl.innerHTML : ''}</div>
                            <div class="mobile-post-meta">${metaEl ? metaEl.innerHTML : ''}</div>
                        </div>
                    `;
                });
                
                contentHTML += `
                        </div>
                    </div>
                `;
            }
        }
        
        trayContent.innerHTML = contentHTML;
        
        // Setup theme button listeners in tray
        trayContent.querySelectorAll('.mobile-theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = btn.dataset.theme;
                
                // Update active state
                trayContent.querySelectorAll('.mobile-theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Apply theme using existing app.js function
                if (typeof applyTheme === 'function') {
                    applyTheme(theme);
                }
                if (typeof saveThemePreference === 'function') {
                    saveThemePreference(theme);
                }
                
                // Close tray after selection
                closeTray();
            });
        });
        
        // Setup post item listeners in tray
        trayContent.querySelectorAll('.mobile-post-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const postIndex = parseInt(item.dataset.postIndex, 10);
                
                if (blogPosts[postIndex]) {
                    // Use existing app.js function
                    if (typeof openBlogPost === 'function') {
                        openBlogPost(blogPosts[postIndex].id);
                    }
                    
                    // Update active state in tray
                    trayContent.querySelectorAll('.mobile-post-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    
                    // Close tray after selection
                    closeTray();
                }
            });
        });
    }
    
    // Get currently active theme
    function getActiveTheme() {
        const savedTheme = typeof getCookie === 'function' ? getCookie('theme_preference') : null;
        return savedTheme || 'auto';
    }
    
    // Setup event listeners
    function setupEventListeners() {
        // Toggle button click
        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTray();
        });
        
        // Header click (to toggle)
        const header = document.getElementById('mobile-tray-header');
        if (header) {
            header.addEventListener('click', (e) => {
                // Don't close if clicking the close button
                if (!e.target.closest('.mobile-tray-close')) {
                    toggleTray();
                }
            });
        }
        
        // Close button click
        const closeBtn = document.getElementById('mobile-tray-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTray();
            });
        }
        
        // Overlay click to close
        overlayElement.addEventListener('click', (e) => {
            e.stopPropagation();
            closeTray();
        });
        
        // Prevent warning.js flash when clicking tray elements
        trayElement.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Handle resize events
        window.addEventListener('resize', () => {
            const wasMobile = isMobile;
            isMobile = checkMobile();
            
            if (wasMobile && !isMobile) {
                // Switched from mobile to desktop - close tray
                closeTray();
            } else if (!wasMobile && isMobile) {
                // Switched to mobile - ensure initialized
                initMobileTray();
            }
        });
        
        // Listen for navigation changes to update content
        document.addEventListener('DOMContentLoaded', () => {
            // Initial check
            isMobile = checkMobile();
            if (isMobile) {
                initMobileTray();
            }
        });
        
        // Also check immediately if DOM is already loaded
        if (document.readyState !== 'loading') {
            isMobile = checkMobile();
            if (isMobile) {
                initMobileTray();
            }
        }
    }
    
    // Toggle tray open/closed
    function toggleTray() {
        if (isTrayOpen) {
            closeTray();
        } else {
            openTray();
        }
    }
    
    // Open tray
    function openTray() {
        if (!trayElement || !toggleButton || !overlayElement) return;
        
        // Refresh content before opening
        populateTrayContent();
        
        isTrayOpen = true;
        trayElement.classList.add('open');
        toggleButton.classList.add('open');
        overlayElement.classList.add('open');
        
        // Prevent body scroll when tray is open
        document.body.style.overflow = 'hidden';
    }
    
    // Close tray
    function closeTray() {
        if (!trayElement || !toggleButton || !overlayElement) return;
        
        isTrayOpen = false;
        trayElement.classList.remove('open');
        toggleButton.classList.remove('open');
        overlayElement.classList.remove('open');
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
    
    // Expose functions for external use if needed
    window.MobileTray = {
        open: openTray,
        close: closeTray,
        toggle: toggleTray,
        isOpen: () => isTrayOpen
    };
    
    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            isMobile = checkMobile();
            if (isMobile) {
                initMobileTray();
            }
        });
    } else {
        isMobile = checkMobile();
        if (isMobile) {
            initMobileTray();
        }
    }
    
})();
