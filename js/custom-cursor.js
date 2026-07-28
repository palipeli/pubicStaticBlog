// custom-cursor.js - Star Trail Cursor Effect
(function() {
    let lastX = 0;
    let lastY = 0;
    let moveTimeout = null;

    // Create star trail element
    function createStar(x, y) {
        const star = document.createElement('div');
        star.className = 'cursor-star';
        star.innerHTML = '★';
        star.style.left = x + 'px';
        star.style.top = y + 'px';
        document.body.appendChild(star);

        // Remove star after animation completes
        setTimeout(() => {
            star.remove();
        }, 800);
    }

    // Handle mouse move
    function handleMouseMove(e) {
        // Create star trail on movement (throttled)
        const distance = Math.sqrt(Math.pow(e.clientX - lastX, 2) + Math.pow(e.clientY - lastY, 2));
        
        if (distance > 15) { // Only create stars when moved enough
            createStar(e.clientX, e.clientY);
            lastX = e.clientX;
            lastY = e.clientY;
        }

        // Clear existing timeout
        if (moveTimeout) {
            clearTimeout(moveTimeout);
        }

        // Continue creating stars while moving
        moveTimeout = setTimeout(() => {
            moveTimeout = null;
        }, 50);
    }

    // Initialize cursor when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Add event listeners
        document.addEventListener('mousemove', handleMouseMove);

        // Hide default cursor on interactive elements
        const interactiveSelector = 'a, button, .nav-item, .blue-button, .theme-btn, .template-card, .all-post-btn, .back-to-list-btn, .back-to-intro-btn, input, textarea, [role="button"], [onclick]';
        
        document.addEventListener('mouseover', function(e) {
            if (e.target.closest(interactiveSelector)) {
                document.body.style.cursor = 'none';
            }
        });

        document.addEventListener('mouseout', function(e) {
            if (e.target.closest(interactiveSelector)) {
                document.body.style.cursor = '';
            }
        });

        console.log('Star trail cursor initialized');
    });
})();
