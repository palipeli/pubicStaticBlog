// mobile-sidebar.js - Mobile-specific floating sidebar functionality
// This script only activates on mobile devices (width <= 768px)

(function() {
    const MOBILE_BREAKPOINT = 768;
    
    // Check if we're on mobile
    function isMobileView() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }
    
    // Initialize mobile floating sidebar
    function initMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
        
        if (!sidebar) return;
        
        // Only activate on mobile
        if (!isMobileView()) {
            // Remove mobile classes if we're now on desktop
            sidebar.classList.remove('mobile-floating', 'mobile-open');
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) overlay.remove();
            return;
        }
        
        // Add mobile floating class to sidebar
        sidebar.classList.add('mobile-floating');
        
        // Create overlay backdrop
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
            
            // Close sidebar when clicking overlay
            overlay.addEventListener('click', function() {
                closeMobileSidebar();
            });
        }
        
        // Use the new mobile toggle button for mobile
        if (mobileSidebarToggle) {
            mobileSidebarToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                
                if (sidebar.classList.contains('mobile-open')) {
                    closeMobileSidebar();
                } else {
                    openMobileSidebar();
                }
            });
        }
        
        // Handle swipe gestures for better mobile UX
        setupSwipeGestures(sidebar);
    }
    
    // Open mobile sidebar
    function openMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (!sidebar) return;
        
        sidebar.classList.add('mobile-open');
        if (overlay) overlay.classList.add('active');
        
        // Prevent body scroll when sidebar is open
        document.body.style.overflow = 'hidden';
    }
    
    // Close mobile sidebar
    function closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (!sidebar) return;
        
        sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
    
    // Setup swipe gestures for mobile
    function setupSwipeGestures(sidebar) {
        let touchStartX = 0;
        let touchEndX = 0;
        let isSwipingFromEdge = false;
        
        // Detect swipe from right edge to open sidebar
        document.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
            // Check if touch starts from right edge of screen
            const screenWidth = window.innerWidth;
            if (touchStartX > screenWidth - 30) {
                isSwipingFromEdge = true;
            }
        }, { passive: true });
        
        document.addEventListener('touchend', function(e) {
            if (!isSwipingFromEdge) return;
            
            touchEndX = e.changedTouches[0].screenX;
            isSwipingFromEdge = false;
            
            // Swipe left from right edge opens sidebar
            if (touchStartX - touchEndX > 50) {
                openMobileSidebar();
            }
        }, { passive: true });
        
        // Detect swipe on sidebar to close it
        let sidebarTouchStartX = 0;
        
        sidebar.addEventListener('touchstart', function(e) {
            sidebarTouchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        sidebar.addEventListener('touchend', function(e) {
            const sidebarTouchEndX = e.changedTouches[0].screenX;
            
            // Swipe right on sidebar closes it
            if (sidebarTouchEndX - sidebarTouchStartX > 50) {
                closeMobileSidebar();
            }
        }, { passive: true });
    }
    
    // Handle resize events
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            // Re-initialize on resize
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('mobile-floating')) {
                // If resizing to desktop, clean up mobile classes
                if (!isMobileView()) {
                    sidebar.classList.remove('mobile-floating', 'mobile-open');
                    const overlay = document.querySelector('.sidebar-overlay');
                    if (overlay) overlay.remove();
                    document.body.style.overflow = '';
                } else {
                    // Re-add mobile floating class
                    sidebar.classList.add('mobile-floating');
                }
            } else if (isMobileView()) {
                // Initialize if we're on mobile and not yet initialized
                initMobileSidebar();
            }
        }, 200);
    });
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileSidebar);
    } else {
        initMobileSidebar();
    }
})();
