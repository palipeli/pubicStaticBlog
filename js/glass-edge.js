/**
 * glass-edge.js — WebGL2 refractive glass edge effect
 *
 * Renders a full-screen overlay that simulates thick bevelled glass at the
 * viewport periphery.  The effect is purely procedural (no texture input) and
 * composites via CSS mix-blend-mode so it never blocks interaction.
 *
 * Exports: window.createGlassEdgeEffect(canvas) → { destroy, setTheme }
 *
 * Runtime contract (see AGENTS.md):
 *   - IIFE pattern, no module syntax
 *   - 4-space indent, camelCase functions, UPPER_SNAKE_CASE constants
 *   - No dependencies, no framework state
 *   - Respects prefers-reduced-motion
 */

(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /*  Vertex shader — simple full-screen quad                           */
    /* ------------------------------------------------------------------ */
    var VERTEX_SRC = [
        '#version 100',
        'attribute vec2 aPos;',
        'varying vec2 vUv;',
        'void main() {',
        '    vUv = aPos * 0.5 + 0.5;',
        '    gl_Position = vec4(aPos, 0.0, 1.0);',
        '}',
    ].join('\n');

    /* ------------------------------------------------------------------ */
    /*  Fragment shader — refractive glass edge                           */
    /* ------------------------------------------------------------------ */
    var FRAGMENT_SRC = [
        '#version 100',
        'precision highp float;',

        'varying vec2 vUv;',

        'uniform vec2  uResolution;',
        'uniform float uTime;',
        'uniform float uIntensity;',   // 0.0 – 1.0  (theme-aware)
        'uniform float uEdgeSize;',    // 0.0 – 0.5  (how far from edge)

        /* ---- pseudo-random / noise helpers ---- */
        'float hash(vec2 p) {',
        '    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
        '}',

        'float noise(vec2 p) {',
        '    vec2 i = floor(p);',
        '    vec2 f = fract(p);',
        '    f = f * f * (3.0 - 2.0 * f);',
        '    float a = hash(i);',
        '    float b = hash(i + vec2(1.0, 0.0));',
        '    float c = hash(i + vec2(0.0, 1.0));',
        '    float d = hash(i + vec2(1.0, 1.0));',
        '    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
        '}',

        'float fbm(vec2 p) {',
        '    float v = 0.0;',
        '    float a = 0.5;',
        '    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));',
        '    for (int i = 0; i < 4; i++) {',
        '        v += a * noise(p);',
        '        p = rot * p * 2.0;',
        '        a *= 0.5;',
        '    }',
        '    return v;',
        '}',

        'void main() {',
        /* ---- edge distance ---- */
        '    vec2 uv = vUv;',
        '    vec2 center = vec2(0.5);',
        '    vec2 edgeDist = 1.0 - abs(uv - center) * 2.0;',  // 0 at edge, 1 at center
        '    float edge = min(edgeDist.x, edgeDist.y);',
        '    float edgeFactor = 1.0 - smoothstep(0.0, uEdgeSize, edge);',

        /* ---- refractive distortion ---- */
        '    float time = uTime * 0.15;',
        '    vec2 noiseUv = uv * 3.0 + time;',
        '    float n1 = fbm(noiseUv);',
        '    float n2 = fbm(noiseUv + vec2(10.0, 20.0));',
        '    vec2 refractOffset = vec2(n1 - 0.5, n2 - 0.5) * edgeFactor * 0.04;',

        /* ---- chromatic aberration ---- */
        '    float chromaStrength = edgeFactor * 0.015;',
        '    vec2 rUv = uv + refractOffset + vec2(chromaStrength, 0.0);',
        '    vec2 gUv = uv + refractOffset;',
        '    vec2 bUv = uv + refractOffset - vec2(chromaStrength, 0.0);',

        /* ---- sample background (simulated via procedural colour) ---- */
        /*  We don't have the actual background, so we create a procedural
            refraction pattern that blends with the page via mix-blend-mode. */
        '    float rPat = fbm(rUv * 2.0 + time * 0.5);',
        '    float gPat = fbm(gUv * 2.0 + time * 0.5 + 5.0);',
        '    float bPat = fbm(bUv * 2.0 + time * 0.5 + 10.0);',

        /* ---- glass edge highlight ---- */
        '    float rim = 1.0 - edge;',
        '    float highlight = smoothstep(0.85, 1.0, rim) * 0.6;',
        '    highlight += smoothstep(0.6, 0.9, rim) * 0.2;',

        /* ---- caustic patterns ---- */
        '    float caustic = fbm(uv * 5.0 - time * 0.3);',
        '    caustic = smoothstep(0.3, 0.7, caustic) * edgeFactor * 0.15;',

        /* ---- colour composition ---- */
        '    vec3 col;',
        '    col.r = rPat * 0.6 + 0.4 + highlight * 0.5 + caustic * 0.3;',
        '    col.g = gPat * 0.6 + 0.4 + highlight * 0.4 + caustic * 0.2;',
        '    col.b = bPat * 0.6 + 0.4 + highlight * 0.3 + caustic * 0.1;',

        /* ---- tint towards glass colour ---- */
        '    vec3 glassTint = vec3(0.85, 0.90, 1.0);',
        '    col = mix(col, glassTint, edgeFactor * 0.15);',

        /* ---- intensity / theme modulation ---- */
        '    col *= uIntensity;',

        /* ---- alpha: transparent in centre, visible at edges ---- */
        '    float alpha = edgeFactor * uIntensity;',
        '    alpha = clamp(alpha, 0.0, 0.55);',

        '    gl_FragColor = vec4(col, alpha);',
        '}',
    ].join('\n');

    /* ------------------------------------------------------------------ */
    /*  WebGL renderer                                                    */
    /* ------------------------------------------------------------------ */

    function GlassEdgeRenderer(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.animId = null;
        this.startTime = performance.now();
        this.intensity = 0.6;
        this.edgeSize = 0.18;
        this.destroyed = false;

        this._initGL();
        if (this.gl) {
            this._initProgram();
            this._initGeometry();
            this._startLoop();
        }
    }

    GlassEdgeRenderer.prototype._initGL = function () {
        var glOpts = {
            alpha: true,
            premultipliedAlpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
        };
        var gl = this.canvas.getContext('webgl', glOpts) ||
                 this.canvas.getContext('experimental-webgl', glOpts);
        if (!gl) {
            console.warn('glass-edge: WebGL not available');
            return;
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this.gl = gl;
    };

    GlassEdgeRenderer.prototype._initProgram = function () {
        var gl = this.gl;
        var vs = this._compileShader(gl.VERTEX_SHADER, VERTEX_SRC);
        var fs = this._compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
        if (!vs || !fs) return;

        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);

        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.warn('glass-edge: program link error:', gl.getProgramInfoLog(prog));
            return;
        }

        this.program = prog;
        this.uResolution = gl.getUniformLocation(prog, 'uResolution');
        this.uTime = gl.getUniformLocation(prog, 'uTime');
        this.uIntensity = gl.getUniformLocation(prog, 'uIntensity');
        this.uEdgeSize = gl.getUniformLocation(prog, 'uEdgeSize');
        this.aPos = gl.getAttribLocation(prog, 'aPos');

        gl.useProgram(prog);
    };

    GlassEdgeRenderer.prototype._compileShader = function (type, src) {
        var gl = this.gl;
        var shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.warn('glass-edge: shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    GlassEdgeRenderer.prototype._initGeometry = function () {
        var gl = this.gl;
        /* Full-screen quad (two triangles) */
        var verts = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1,
        ]);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

        var stride = 2 * Float32Array.BYTES_PER_ELEMENT;
        gl.enableVertexAttribArray(this.aPos);
        gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, stride, 0);
    };

    GlassEdgeRenderer.prototype._startLoop = function () {
        var self = this;

        function loop(now) {
            if (self.destroyed) return;
            self._render(now);
            self.animId = requestAnimationFrame(loop);
        }

        /* Pause when tab hidden */
        document.addEventListener('visibilitychange', function onVis() {
            if (document.hidden && self.animId !== null) {
                cancelAnimationFrame(self.animId);
                self.animId = null;
            } else if (!document.hidden && self.animId === null && !self.destroyed) {
                self.animId = requestAnimationFrame(loop);
            }
        });

        this.animId = requestAnimationFrame(loop);
    };

    GlassEdgeRenderer.prototype._render = function (now) {
        var gl = this.gl;
        if (!gl || !this.program) return;

        var w = this.canvas.width;
        var h = this.canvas.height;
        gl.viewport(0, 0, w, h);

        gl.uniform2f(this.uResolution, w, h);
        gl.uniform1f(this.uTime, (now - this.startTime) / 1000);
        gl.uniform1f(this.uIntensity, this.intensity);
        gl.uniform1f(this.uEdgeSize, this.edgeSize);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    GlassEdgeRenderer.prototype.resize = function (w, h) {
        var dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
    };

    GlassEdgeRenderer.prototype.setIntensity = function (val) {
        this.intensity = Math.max(0, Math.min(1, val));
    };

    GlassEdgeRenderer.prototype.setEdgeSize = function (val) {
        this.edgeSize = Math.max(0.05, Math.min(0.5, val));
    };

    GlassEdgeRenderer.prototype.destroy = function () {
        this.destroyed = true;
        if (this.animId !== null) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        if (this.gl && this.program) {
            this.gl.deleteProgram(this.program);
        }
        this.gl = null;
        this.program = null;
    };

    /* ------------------------------------------------------------------ */
    /*  Public API                                                         */
    /* ------------------------------------------------------------------ */

    /**
     * Create the glass edge effect on a given <canvas> element.
     *
     * @param {HTMLCanvasElement} canvas
     * @param {Object} [opts]
     * @param {number} [opts.intensity=0.6]
     * @param {number} [opts.edgeSize=0.18]
     * @returns {{ destroy, setTheme, resize }}
     */
    window.createGlassEdgeEffect = function (canvas, opts) {
        opts = opts || {};

        var renderer = new GlassEdgeRenderer(canvas);
        if (opts.intensity != null) renderer.setIntensity(opts.intensity);
        if (opts.edgeSize != null) renderer.setEdgeSize(opts.edgeSize);

        /* ---- initial resize ---- */
        function doResize() {
            renderer.resize(window.innerWidth, window.innerHeight);
        }
        doResize();

        var ro = new ResizeObserver(doResize);
        ro.observe(canvas.parentElement || canvas);

        /* ---- reduced motion ---- */
        var motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
        var motionHandler = function () {
            if (motionMq.matches) {
                renderer.setIntensity(0);
            } else {
                /* restore */
                renderer.setIntensity(opts.intensity != null ? opts.intensity : 0.6);
            }
        };
        motionMq.addListener(motionHandler);
        motionHandler();

        return {
            destroy: function () {
                ro.disconnect();
                motionMq.removeListener(motionHandler);
                renderer.destroy();
            },
            setTheme: function (theme) {
                /* Dark mode → slightly more subtle, light mode → more visible */
                if (theme === 'dark') {
                    renderer.setIntensity(0.45);
                } else {
                    renderer.setIntensity(opts.intensity != null ? opts.intensity : 0.6);
                }
            },
            resize: doResize,
        };
    };
})();