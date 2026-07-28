// custom-cursor.js - Cute Pink Circle Cursor with Star Trail
(function() {
    let cursor = null;
    let lastX = 0;
    let lastY = 0;
    let moveTimeout = null;

    // Create custom cursor element
    function createCursor() {
        cursor = document.createElement('div');
        cursor.className = 'custom-cursor';
        document.body.appendChild(cursor);

        // Position cursor initially at center
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        cursor.style.left = centerX + 'px';
        cursor.style.top = centerY + 'px';
        lastX = centerX;
        lastY = centerY;
    }

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
        if (!cursor) return;

        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';

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

    // Handle mouse down
    function handleMouseDown() {
        if (cursor) {
            cursor.classList.add('clicked');
        }
    }

    // Handle mouse up
    function handleMouseUp() {
        if (cursor) {
            cursor.classList.remove('clicked');
        }
    }

    // Initialize cursor when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        createCursor();

        // Add event listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);

        console.log('Custom cursor initialized');
    });
})();
