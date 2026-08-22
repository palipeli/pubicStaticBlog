(function() {
    'use strict';
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()||(window.CP.isDevToolOpened&&window.CP.isDevToolOpened())){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP not verified'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e2){} throw e; }

    var cloudEl = null;
    var moveHandler = null;
    var disappearTimer = null;
    var fadeTimer = null;
    var styleEl = null;
    var lastX = -1;
    var lastY = -1;

    var BUBBLE_LEFT = '/media/speechbuba_left.png';
    var BUBBLE_RIGHT = '/media/speechbuba_right.png';
    var DENIED_LEFT = '/media/denied_left.png';
    var DENIED_RIGHT = '/media/denied_right.png';
    var DISPLAY_MS = 3000;
    var FADE_MS = 350;
    var deniedMode = false;

    function injectStyles() {
        if (styleEl) return;
        styleEl = document.createElement('style');
        styleEl.id = 'pixel-chat-cloud-css';
        styleEl.textContent =
            '#pixel-chat-cloud {' +
            '  position:fixed; z-index:2147483647; pointer-events:none;' +
            '  opacity:0; transition:opacity 350ms steps(5);' +
            '}' +
            '#pixel-chat-cloud.visible { opacity:1; }' +
            '#pixel-chat-cloud.hiding  { opacity:0; }' +
            '.cloud-bubble-img {' +
            '  display:block; max-width:480px; width:auto; height:auto;' +
            '  image-rendering:pixelated; image-rendering:crisp-edges;' +
            '}' +
            '@keyframes cloudBounceIn {' +
            '  0%   { transform:scale(0); }' +
            '  35%  { transform:scale(1.1); }' +
            '  65%  { transform:scale(0.93); }' +
            '  100% { transform:scale(1); }' +
            '}' +
            '@keyframes cloudFloat {' +
            '  0%,100% { transform:translateY(0); }' +
            '  50% { transform:translateY(-8px); }' +
            '}' +
            '#pixel-chat-cloud.entering {' +
            '  animation:cloudBounceIn 0.35s steps(6) forwards;' +
            '}' +
            '#pixel-chat-cloud.visible {' +
            '  animation:cloudFloat 2.2s steps(6) infinite;' +
            '}' +
            '.cloud-pixel-pop {' +
            '  position:fixed; pointer-events:none; z-index:2147483647;' +
            '  width:4px; height:4px; image-rendering:pixelated;' +
            '}' +
            '@keyframes pixelPop {' +
            '  0%   { transform:translate(0,0) scale(1); opacity:1; }' +
            '  100% { transform:translate(var(--px),var(--py)) scale(0); opacity:0; }' +
            '}';
        document.head.appendChild(styleEl);
    }

    function burst(cx, cy) {
        for (var i = 0; i < 8; i++) {
            var el = document.createElement('div');
            el.className = 'cloud-pixel-pop';
            var a = Math.PI * 2 * i / 8;
            var d = 84 + Math.random() * 144;
            el.style.left = cx + 'px';
            el.style.top = cy + 'px';
            el.style.setProperty('--px', Math.cos(a) * d + 'px');
            el.style.setProperty('--py', Math.sin(a) * d + 'px');
            el.style.background = i % 2 ? '#fff' : '#ff45fc';
            el.style.animation = 'pixelPop 0.6s steps(12) forwards';
            document.body.appendChild(el);
            (function(e) {
                setTimeout(function() {
                    if (e.parentNode) e.parentNode.removeChild(e);
                }, 500);
            })(el);
        }
    }

    function createCloud() {
        removeCloud();
        injectStyles();

        var isLeft = lastX < window.innerWidth / 2;
        var img = document.createElement('img');
        img.className = 'cloud-bubble-img';
        img.src = isLeft
            ? (deniedMode ? DENIED_LEFT : BUBBLE_LEFT)
            : (deniedMode ? DENIED_RIGHT : BUBBLE_RIGHT);

        cloudEl = document.createElement('div');
        cloudEl.id = 'pixel-chat-cloud';
        cloudEl.appendChild(img);
        document.body.appendChild(cloudEl);

        var curSide = isLeft;
        var cw = cloudEl.offsetWidth || 480;
        var ch = cloudEl.offsetHeight || 65;
        var sx = lastX >= 0 ? lastX : window.innerWidth / 2;
        var sy = lastY >= 0 ? lastY : window.innerHeight / 2;
        var px = isLeft ? sx - cw / 3 : sx - cw * 2 / 3;
        var py = sy - ch;
        if (px + cw > window.innerWidth - 10) px = window.innerWidth - cw - 10;
        if (px < 10) px = 10;
        if (py < 10) py = 10;
        if (py + ch > window.innerHeight - 10) py = window.innerHeight - ch - 10;
        cloudEl.style.left = px + 'px';
        cloudEl.style.top = py + 'px';

        moveHandler = function(e) {
            if (!cloudEl) return;
            var w = cloudEl.offsetWidth || 480;
            var h = cloudEl.offsetHeight || 65;
            var side = e.clientX < window.innerWidth / 2;
            if (side !== curSide) {
                curSide = side;
                img.src = side
                    ? (deniedMode ? DENIED_LEFT : BUBBLE_LEFT)
                    : (deniedMode ? DENIED_RIGHT : BUBBLE_RIGHT);
            }
            var mx = side ? e.clientX - w / 3 : e.clientX - w * 2 / 3;
            var my = e.clientY - h;
            if (mx + w > window.innerWidth - 10) mx = window.innerWidth - w - 10;
            if (mx < 10) mx = 10;
            if (my < 10) my = 10;
            if (my + h > window.innerHeight - 10) my = window.innerHeight - h - 10;
            cloudEl.style.left = mx + 'px';
            cloudEl.style.top = my + 'px';
        };
        document.addEventListener('mousemove', moveHandler);

        requestAnimationFrame(function() {
            if (!cloudEl) return;
            cloudEl.classList.add('entering');
            setTimeout(function() {
                if (!cloudEl) return;
                cloudEl.classList.remove('entering');
                cloudEl.classList.add('visible');
            }, 350);
        });

        burst(lastX, lastY);

        disappearTimer = setTimeout(function() {
            if (!cloudEl) return;
            cloudEl.classList.remove('visible');
            cloudEl.classList.add('hiding');
            fadeTimer = setTimeout(removeCloud, FADE_MS);
        }, DISPLAY_MS);
    }

    function removeCloud() {
        if (disappearTimer) { clearTimeout(disappearTimer); disappearTimer = null; }
        if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
        if (moveHandler) {
            document.removeEventListener('mousemove', moveHandler);
            moveHandler = null;
        }
        if (cloudEl && cloudEl.parentNode) cloudEl.parentNode.removeChild(cloudEl);
        cloudEl = null;
    }

    window.addEventListener('mousedown', function(e) {
        lastX = e.clientX;
        lastY = e.clientY;
    });
    window.addEventListener('touchstart', function(e) {
        if (e.touches.length > 0) {
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        }
    }, { passive: true });
    window.addEventListener('warning:flash', function() {
        deniedMode = false;
        createCloud();
    });
    window.addEventListener('denied:flash', function() {
        deniedMode = true;
        createCloud();
    });
})();