// mobile-sidebar.js - Mobile Floating Sidebar Tray Functionality
// Only activates on screens with width <= 480px

(function() {
    const MOBILE_BREAKPOINT = 480;
    
    let isMobileTrayActive = false;
    let sidebar = null;
    let triggerButton = null;
    let overlay = null;
    let trayHeader = null;

    // Check if we're in mobile view
    function isMobileView() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    // Initialize the mobile tray components
    function initMobileTray() {
        if (!isMobileView()) {
            cleanupMobileTray();
            return;
        }

        sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // Add mobile tray class to sidebar
        sidebar.classList.add('mobile-tray');

        // Create trigger button if it doesn't exist
        if (!document.querySelector('.mobile-sidebar-trigger')) {
            createTriggerButton();
        }

        // Create overlay if it doesn't exist
        if (!document.querySelector('.mobile-tray-overlay')) {
            createOverlay();
        }

        // Create tray header if it doesn't exist
        if (!document.querySelector('.mobile-tray-header')) {
            createTrayHeader();
        }

        triggerButton = document.querySelector('.mobile-sidebar-trigger');
        overlay = document.querySelector('.mobile-tray-overlay');
        trayHeader = document.querySelector('.mobile-tray-header');

        // Setup event listeners
        setupEventListeners();
    }

    // Create the floating trigger button
    function createTriggerButton() {
        const button = document.createElement('button');
        button.className = 'mobile-sidebar-trigger';
        button.setAttribute('aria-label', 'Open Menu');
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
        `;
        document.body.appendChild(button);
        triggerButton = button;
    }

    // Create the overlay
    function createOverlay() {
        const overlayDiv = document.createElement('div');
        overlayDiv.className = 'mobile-tray-overlay';
        document.body.appendChild(overlayDiv);
        overlay = overlayDiv;
    }

    // Create the tray header with handle and close button
    function createTrayHeader() {
        const header = document.createElement('div');
        header.className = 'mobile-tray-header';
        header.innerHTML = `
            <div class="mobile-tray-handle"></div>
            <button class="mobile-tray-close" aria-label="Close Menu">&times;</button>
        `;
        
        // Insert at the beginning of sidebar content wrapper
        const contentWrapper = sidebar.querySelector('.sidebar-content-wrapper');
        if (contentWrapper) {
            contentWrapper.insertBefore(header, contentWrapper.firstChild);
        }
        trayHeader = header;
    }

    // Setup all event listeners
    function setupEventListeners() {
        // Trigger button click
        if (triggerButton) {
            triggerButton.addEventListener('click', openTray);
        }

        // Overlay click to close
        if (overlay) {
            overlay.addEventListener('click', closeTray);
        }

        // Close button click
        const closeBtn = document.querySelector('.mobile-tray-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeTray);
        }

        // Handle drag on tray header
        const handle = document.querySelector('.mobile-tray-handle');
        if (handle) {
            setupDragToClose(handle);
        }
    }

    // Open the tray
    function openTray() {
        if (!sidebar || !overlay) return;
        
        sidebar.classList.add('active');
        overlay.classList.add('active');
        isMobileTrayActive = true;
        
        // Prevent body scroll when tray is open
        document.body.style.overflow = 'hidden';
    }

    // Close the tray
    function closeTray() {
        if (!sidebar || !overlay) return;
        
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        isMobileTrayActive = false;
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    // Setup drag-to-close functionality
    function setupDragToClose(handle) {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        handle.addEventListener('touchstart', (e) => {
            isDragging = true;
            startY = e.touches[0].clientY;
            handle.style.transition = 'none';
        }, { passive: true });

        handle.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            if (deltaY > 0) {
                const translateValue = Math.min(deltaY, 100);
                sidebar.style.transform = `translateY(${translateValue / sidebar.offsetHeight * 100}%)`;
            }
        }, { passive: true });

        handle.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            
            const deltaY = currentY - startY;
            sidebar.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            
            if (deltaY > 50) {
                closeTray();
            } else {
                sidebar.style.transform = 'translateY(0)';
            }
            
            startY = 0;
            currentY = 0;
        });
    }

    // Cleanup mobile tray when switching to desktop
    function cleanupMobileTray() {
        if (!sidebar) return;
        
        sidebar.classList.remove('mobile-tray', 'active');
        
        const trigger = document.querySelector('.mobile-sidebar-trigger');
        if (trigger) trigger.remove();
        
        const overlayEl = document.querySelector('.mobile-tray-overlay');
        if (overlayEl) overlayEl.remove();
        
        const header = document.querySelector('.mobile-tray-header');
        if (header) header.remove();
        
        document.body.style.overflow = '';
        
        sidebar = null;
        triggerButton = null;
        overlay = null;
        trayHeader = null;
        isMobileTrayActive = false;
    }

    // Handle resize events
    let resizeTimeout;
    function handleResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (isMobileView()) {
                initMobileTray();
            } else {
                cleanupMobileTray();
            }
        }, 200);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initMobileTray();
            window.addEventListener('resize', handleResize);
        });
    } else {
        initMobileTray();
        window.addEventListener('resize', handleResize);
    }

})();
