(function() {
    'use strict';

    var TARGET_SELECTORS = '.home-hero, .about-hero, .blog-article';
    var canvases = [];
    var animationId = null;
    var time = 0;
    var reducedMotion = false;

    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function createCanvasForElement(el) {
        var canvas = document.createElement('canvas');
        canvas.className = 'liquid-glass-canvas';
        canvas.setAttribute('aria-hidden', 'true');

        var rect = el.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        canvas.style.cssText = [
            'position: absolute',
            'top: 0',
            'left: 0',
            'width: 100%',
            'height: 100%',
            'pointer-events: none',
            'z-index: 1',
            'border-radius: inherit',
            'opacity: 0.6',
            'will-change: opacity'
        ].join(';') + ';';

        el.style.position = 'relative';
        el.appendChild(canvas);

        return {
            canvas: canvas,
            ctx: canvas.getContext('2d'),
            element: el,
            width: canvas.width,
            height: canvas.height
        };
    }

    function resizeCanvas(canvasData) {
        var rect = canvasData.element.getBoundingClientRect();
        var w = rect.width;
        var h = rect.height;
        if (w !== canvasData.width || h !== canvasData.height) {
            canvasData.canvas.width = w;
            canvasData.canvas.height = h;
            canvasData.width = w;
            canvasData.height = h;
        }
    }

    function drawRefraction(canvasData, t) {
        var ctx = canvasData.ctx;
        var w = canvasData.width;
        var h = canvasData.height;
        if (w === 0 || h === 0) return;

        ctx.clearRect(0, 0, w, h);

        var edgeWidth = Math.min(40, Math.min(w, h) * 0.08);

        // Animated edge refraction — flowing light along borders
        var speed = 0.4;
        var phase = t * speed;

        // Top edge glow
        var topGrad = ctx.createLinearGradient(0, 0, w * 0.5, edgeWidth * 2);
        var topAlpha = 0.15 + 0.08 * Math.sin(phase * 1.3 + 0.5);
        topGrad.addColorStop(0, 'rgba(255, 255, 255, ' + topAlpha + ')');
        topGrad.addColorStop(0.3, 'rgba(255, 255, 255, ' + (topAlpha * 0.6) + ')');
        topGrad.addColorStop(0.6, 'rgba(255, 255, 255, ' + (topAlpha * 0.3) + ')');
        topGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, w, edgeWidth * 2);

        // Bottom edge glow
        var bottomGrad = ctx.createLinearGradient(0, h - edgeWidth * 2, w * 0.5, h);
        var bottomAlpha = 0.12 + 0.06 * Math.sin(phase * 1.1 + 1.2);
        bottomGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        bottomGrad.addColorStop(0.4, 'rgba(255, 255, 255, ' + (bottomAlpha * 0.3) + ')');
        bottomGrad.addColorStop(0.7, 'rgba(255, 255, 255, ' + (bottomAlpha * 0.6) + ')');
        bottomGrad.addColorStop(1, 'rgba(255, 255, 255, ' + bottomAlpha + ')');
        ctx.fillStyle = bottomGrad;
        ctx.fillRect(0, h - edgeWidth * 2, w, edgeWidth * 2);

        // Left edge glow
        var leftGrad = ctx.createLinearGradient(0, 0, edgeWidth * 2, h * 0.5);
        var leftAlpha = 0.1 + 0.07 * Math.sin(phase * 0.9 + 2.0);
        leftGrad.addColorStop(0, 'rgba(255, 255, 255, ' + leftAlpha + ')');
        leftGrad.addColorStop(0.3, 'rgba(255, 255, 255, ' + (leftAlpha * 0.5) + ')');
        leftGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, edgeWidth * 2, h);

        // Right edge glow
        var rightGrad = ctx.createLinearGradient(w - edgeWidth * 2, 0, w, h * 0.5);
        var rightAlpha = 0.1 + 0.07 * Math.sin(phase * 1.2 + 3.1);
        rightGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        rightGrad.addColorStop(0.7, 'rgba(255, 255, 255, ' + (rightAlpha * 0.5) + ')');
        rightGrad.addColorStop(1, 'rgba(255, 255, 255, ' + rightAlpha + ')');
        ctx.fillStyle = rightGrad;
        ctx.fillRect(w - edgeWidth * 2, 0, edgeWidth * 2, h);

        // Chromatic edge dispersion — subtle RGB separation at corners
        var dispStrength = 2 + Math.sin(phase * 0.7) * 1;
        var cornerSize = Math.min(30, Math.min(w, h) * 0.06);

        // Top-left corner — red shift
        ctx.globalAlpha = 0.08 + 0.04 * Math.sin(phase * 0.5);
        ctx.fillStyle = '#ff4466';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(cornerSize + dispStrength, 0);
        ctx.lineTo(0, cornerSize + dispStrength);
        ctx.closePath();
        ctx.fill();

        // Top-right corner — blue shift
        ctx.globalAlpha = 0.08 + 0.04 * Math.sin(phase * 0.5 + 1.0);
        ctx.fillStyle = '#4488ff';
        ctx.beginPath();
        ctx.moveTo(w, 0);
        ctx.lineTo(w - cornerSize - dispStrength, 0);
        ctx.lineTo(w, cornerSize + dispStrength);
        ctx.closePath();
        ctx.fill();

        // Bottom-left corner — green shift
        ctx.globalAlpha = 0.06 + 0.03 * Math.sin(phase * 0.5 + 2.0);
        ctx.fillStyle = '#44ff88';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(cornerSize + dispStrength, h);
        ctx.lineTo(0, h - cornerSize - dispStrength);
        ctx.closePath();
        ctx.fill();

        // Bottom-right corner — purple shift
        ctx.globalAlpha = 0.06 + 0.03 * Math.sin(phase * 0.5 + 3.0);
        ctx.fillStyle = '#aa44ff';
        ctx.beginPath();
        ctx.moveTo(w, h);
        ctx.lineTo(w - cornerSize - dispStrength, h);
        ctx.lineTo(w, h - cornerSize - dispStrength);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 1.0;

        // Flowing edge wave — subtle sine distortion along borders
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        var waveCount = 3;
        var waveAmp = 3;
        var waveLen = w / waveCount;

        for (var i = 0; i < waveCount; i++) {
            var offset = i * waveLen;
            ctx.beginPath();
            for (var x = 0; x <= waveLen; x += 2) {
                var y = edgeWidth + Math.sin((x + offset + phase * 20) * 0.05) * waveAmp * Math.sin(phase * 0.3 + i);
                if (x === 0) ctx.moveTo(offset + x, y);
                else ctx.lineTo(offset + x, y);
            }
            ctx.stroke();
        }
    }

    function animate() {
        if (reducedMotion) return;
        time += 0.016; // ~60fps step

        for (var i = 0; i < canvases.length; i++) {
            resizeCanvas(canvases[i]);
            drawRefraction(canvases[i], time);
        }

        animationId = requestAnimationFrame(animate);
    }

    function init() {
        // Clean up any existing instances
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        for (var i = 0; i < canvases.length; i++) {
            if (canvases[i].canvas.parentNode) {
                canvases[i].canvas.parentNode.removeChild(canvases[i].canvas);
            }
        }
        canvases = [];
        time = 0;

        reducedMotion = prefersReducedMotion();
        if (reducedMotion) return;

        var elements = document.querySelectorAll(TARGET_SELECTORS);
        if (elements.length === 0) return;

        for (var j = 0; j < elements.length; j++) {
            var data = createCanvasForElement(elements[j]);
            canvases.push(data);
        }

        if (canvases.length > 0) {
            animate();
        }
    }

    // Re-init on theme changes (which may affect element dimensions)
    var themeObserver = new MutationObserver(function() {
        // Debounce: wait for layout to settle
        if (window._liquidGlassResizeTimer) {
            clearTimeout(window._liquidGlassResizeTimer);
        }
        window._liquidGlassResizeTimer = setTimeout(function() {
            for (var i = 0; i < canvases.length; i++) {
                resizeCanvas(canvases[i]);
            }
        }, 100);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Re-init on page navigation (blog post view changes)
    var navObserver = new MutationObserver(function() {
        if (window._liquidGlassNavTimer) {
            clearTimeout(window._liquidGlassNavTimer);
        }
        window._liquidGlassNavTimer = setTimeout(init, 200);
    });
    navObserver.observe(document.getElementById('blog-post-view') || document.body, {
        childList: true,
        subtree: true
    });

    // Listen for reduced-motion changes
    var motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionMedia.addEventListener('change', function(e) {
        reducedMotion = e.matches;
        if (reducedMotion) {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            for (var i = 0; i < canvases.length; i++) {
                var ctx = canvases[i].ctx;
                ctx.clearRect(0, 0, canvases[i].width, canvases[i].height);
            }
        } else {
            if (canvases.length > 0 && !animationId) {
                animate();
            }
        }
    });

    // Expose public API
    window.initializeLiquidGlassEffect = init;
    window.refreshLiquidGlassEffect = init;

    // Auto-init on DOMContentLoaded if not already
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();