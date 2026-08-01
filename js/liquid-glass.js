/**
 * Liquid Glass Effect - Local Implementation
 * Based on https://github.com/ybouane/liquidglass
 * Optimized for Chromium and Safari browsers
 */

(function() {
    'use strict';

    // GLSL Shaders
    const VS_QUAD = `
        attribute vec2 a_pos;
        varying vec2 v_uv;
        void main() {
            v_uv = a_pos * 0.5 + 0.5;
            gl_Position = vec4(a_pos, 0.0, 1.0);
        }
    `;

    const FS_BLIT = `
        precision mediump float;
        uniform sampler2D u_tex;
        uniform vec2 u_scale;
        uniform vec2 u_offset;
        varying vec2 v_uv;
        void main() {
            gl_FragColor = texture2D(u_tex, v_uv * u_scale + u_offset);
        }
    `;

    const FS_BLUR = `
        precision mediump float;
        uniform sampler2D u_tex;
        uniform vec2 u_dir;
        varying vec2 v_uv;
        void main() {
            vec4 s  = texture2D(u_tex, v_uv) * 0.227027;
            s += texture2D(u_tex, v_uv + u_dir * 1.0) * 0.194594;
            s += texture2D(u_tex, v_uv - u_dir * 1.0) * 0.194594;
            s += texture2D(u_tex, v_uv + u_dir * 2.0) * 0.121622;
            s += texture2D(u_tex, v_uv - u_dir * 2.0) * 0.121622;
            s += texture2D(u_tex, v_uv + u_dir * 3.0) * 0.054054;
            s += texture2D(u_tex, v_uv - u_dir * 3.0) * 0.054054;
            s += texture2D(u_tex, v_uv + u_dir * 4.0) * 0.016216;
            s += texture2D(u_tex, v_uv - u_dir * 4.0) * 0.016216;
            gl_FragColor = s;
        }
    `;

    const VS_GLASS = `
        attribute vec2 a_pos;
        uniform vec2 u_center;
        uniform vec2 u_size;
        uniform vec2 u_res;
        uniform float u_pad;
        varying vec2 v_localPx;
        varying vec2 v_screenUV;

        void main() {
            vec2 total = u_size + vec2(u_pad * 2.0);
            v_localPx = a_pos * total;
            vec2 px = u_center + a_pos * total;
            v_screenUV = vec2(px.x / u_res.x, 1.0 - px.y / u_res.y);
            vec2 ndc = (px / u_res) * 2.0 - 1.0;
            ndc.y = -ndc.y;
            gl_Position = vec4(ndc, 0.0, 1.0);
        }
    `;

    const FS_GLASS = `
        precision highp float;

        uniform sampler2D u_bgTex;
        uniform sampler2D u_blurTex;
        uniform vec2 u_size;
        uniform float u_radius;
        uniform vec2 u_res;
        uniform float u_refract;
        uniform float u_chroma;
        uniform float u_edgeHL;
        uniform float u_spec;
        uniform float u_fresnel;
        uniform float u_distort;
        uniform float u_alpha;
        uniform float u_sat;
        uniform float u_tint;
        uniform float u_zRadius;
        uniform float u_brightness;
        uniform float u_shadowAlpha;
        uniform float u_shadowSpread;
        uniform float u_shadowOffY;
        uniform float u_bevelMode;

        varying vec2 v_localPx;
        varying vec2 v_screenUV;

        float rrSDF(vec2 p, vec2 b, float r) {
            vec2 q = abs(p) - b + vec2(r);
            return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;
        }

        float bevelHeight(float d, float zR) {
            if (d <= 0.0) return 0.0;
            if (d >= zR) return zR;
            return sqrt(d * (2.0 * zR - d));
        }

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
            vec2 half_ = u_size * 0.5;
            float r = min(u_radius, min(half_.x, half_.y));
            float sdf = rrSDF(v_localPx, half_, r);
            float mask = 1.0 - smoothstep(-1.0, 1.0, sdf);

            if (sdf > 0.0 && u_shadowAlpha > 0.0) {
                float shadowSDF = rrSDF(v_localPx - vec2(0.0, u_shadowOffY), half_, r);
                float shadowMask = 1.0 - smoothstep(0.0, u_shadowSpread, shadowSDF);
                float shadowAlpha = shadowMask * u_shadowAlpha * mask;
                gl_FragColor = vec4(0.0, 0.0, 0.0, shadowAlpha);
                return;
            }

            float depth = bevelHeight(-sdf, u_zRadius);
            float hC = max(depth, 0.001);
            float zR = max(u_zRadius, 0.001);
            float hGrad = depth / hC;
            vec3 N = normalize(vec3(hGrad, hGrad, 1.0));
            float edge = 1.0 - mask;

            vec2 pxToUV = vec2(1.0, -1.0) / u_res;
            float ior = 1.5;
            float refrPow = 1.0 - 1.0 / ior;
            float thickness = hC * 2.0;
            float thickNorm = thickness / max(zR * 2.0, 1.0);
            vec2 refrPx;

            if (u_bevelMode < 0.5) {
                vec2 exitRefr = hGrad * refrPow;
                vec2 entryRefr = hGrad * refrPow;
                vec2 throughRefr = entryRefr * thickNorm * 0.5;
                refrPx = (exitRefr + entryRefr + throughRefr) * u_refract * 30.0;
                vec2 centerDir = -v_localPx / max(half_, vec2(1.0));
                refrPx += centerDir * u_refract * 4.0 * depth;
            } else {
                refrPx = -v_localPx * u_refract * depth * 0.35;
            }

            vec2 refr = refrPx * pxToUV;
            vec2 ns = v_localPx * 0.08;
            vec2 absPxToUV = vec2(1.0) / u_res;
            vec2 micro = (vec2(hash(ns), hash(ns + vec2(37.0))) - 0.5) * u_distort * 4.0 * absPxToUV;

            float caS = u_chroma * 18.0 * (edge * 0.7 + 0.3) * 2.0;
            vec2 caD = N.xy * caS * pxToUV;
            vec2 base = v_screenUV + refr + micro;

            vec3 sharp = vec3(
                texture2D(u_bgTex,  base + caD).r,
                texture2D(u_bgTex,  base).g,
                texture2D(u_bgTex,  base - caD).b
            );
            vec3 blur = vec3(
                texture2D(u_blurTex, base + caD).r,
                texture2D(u_blurTex, base).g,
                texture2D(u_blurTex, base - caD).b
            );

            float edgeMix = (1.0 - edge * 0.15);
            vec3 col = mix(sharp, blur, edgeMix);

            col *= 1.0 + u_brightness;

            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(lum), col, 1.0 + u_sat);

            col = mix(col, col * vec3(0.92, 0.95, 1.05), u_tint);
            col *= 1.0 + 0.06 * depth;

            float fres = pow(1.0 - abs(N.z), 4.0) * u_fresnel;

            vec3 V = vec3(0.0, 0.0, 1.0);
            vec3 L1 = normalize(vec3(0.4, 0.7, 1.0));
            vec3 H1 = normalize(L1 + V);
            float sp1 = pow(max(dot(N, H1), 0.0), 90.0);
            vec3 L2 = normalize(vec3(-0.3, -0.5, 1.0));
            vec3 H2 = normalize(L2 + V);
            float sp2 = pow(max(dot(N, H2), 0.0), 50.0) * 0.3;
            vec3 L3 = normalize(vec3(0.1, 0.3, 1.0));
            float spB = pow(max(dot(N, L3), 0.0), 6.0) * 0.1;
            vec3 L4 = normalize(vec3(0.0, 0.9, 0.4));
            vec3 H4 = normalize(L4 + V);
            float sp4 = pow(max(dot(N, H4), 0.0), 120.0) * 0.6;
            float totalSpec = (sp1 + sp2 + spB + sp4) * u_spec;

            float borderWidth = 1.5;
            float innerStroke = smoothstep(-borderWidth - 1.0, -borderWidth, sdf)
                              * (1.0 - smoothstep(-1.0, 0.0, sdf));
            float topBias = 0.5 + 0.5 * (-v_localPx.y / half_.y);
            innerStroke *= (0.4 + 0.6 * topBias);

            float rim = edge * u_edgeHL * 0.22;
            float innerGlow = smoothstep(5.0, 0.0, -sdf) * u_edgeHL * 0.15;
            float envRefl = (N.y * 0.5 + 0.5) * fres * 0.08;

            vec3 fin = col;
            fin += vec3(totalSpec);
            fin += vec3(rim + innerGlow);
            fin += vec3(innerStroke * u_edgeHL * 0.55);
            fin += vec3(envRefl);
            fin = mix(fin, vec3(1.0), fres * 0.2);

            gl_FragColor = vec4(fin, mask * u_alpha);
        }
    `;

    // Default configuration
    const DEFAULTS = {
        blurAmount: 0.65,
        refraction: 0.69,
        chromAberration: 0.05,
        edgeHighlight: 0.15,
        specular: 0.35,
        fresnel: 0.8,
        distortion: 0.02,
        cornerRadius: 16,
        zRadius: 30,
        opacity: 0.85,
        saturation: 0.05,
        tintStrength: 0.08,
        brightness: 0.02,
        shadowOpacity: 0.25,
        shadowSpread: 15,
        shadowOffsetY: 8,
        bevelMode: 0
    };

    const BLUR_ITERATIONS = 4;
    const SHADOW_PAD = 20;

    // Theme-aware defaults
    const LIGHT_MODE_ADJUSTMENTS = {
        brightness: 0.08,
        tintStrength: 0.05,
        opacity: 0.75,
        edgeHighlight: 0.2
    };

    const DARK_MODE_ADJUSTMENTS = {
        brightness: -0.05,
        tintStrength: 0.1,
        opacity: 0.85,
        edgeHighlight: 0.12
    };

    class GlassRenderer {
        constructor() {
            this.canvas = document.createElement('canvas');
            this.canvas.style.display = 'none';
            this.canvas.style.position = 'fixed';
            this.canvas.style.bottom = '0';
            this.canvas.style.right = '0';
            this.canvas.style.width = '1px';
            this.canvas.style.height = '1px';
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.zIndex = '-9999';
            document.body.appendChild(this.canvas);

            this.cropCanvas = document.createElement('canvas');
            this.cropCtx = this.cropCanvas.getContext('2d', { willReadFrequently: true });

            const gl = this.canvas.getContext('webgl', {
                alpha: true,
                premultipliedAlpha: false,
                antialias: false,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance'
            });

            if (!gl) {
                console.warn('LiquidGlass: WebGL not supported, falling back to CSS');
                this.gl = null;
                return;
            }

            this.gl = gl;
            this._initPrograms();
            this._initBuffers();
            this.fboCache = new Map();
            this.activeFBOs = null;
            this.bgTex = null;
            this.width = 0;
            this.height = 0;
            this.contextLost = false;

            this.canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                this.contextLost = true;
            });

            this.canvas.addEventListener('webglcontextrestored', () => {
                this.contextLost = false;
                this._initPrograms();
                this._initBuffers();
                this.fboCache.forEach((fboSet) => this._freeFBOSet(fboSet));
                this.fboCache.clear();
                this.activeFBOs = null;
                this.bgTex = null;
            });
        }

        _createShader(type, source) {
            const gl = this.gl;
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        _link(vsSource, fsSource) {
            const gl = this.gl;
            const vs = this._createShader(gl.VERTEX_SHADER, vsSource);
            const fs = this._createShader(gl.FRAGMENT_SHADER, fsSource);
            const program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error('Program link error:', gl.getProgramInfoLog(program));
                return null;
            }
            return program;
        }

        _uloc(program, names) {
            const gl = this.gl;
            const locs = {};
            names.forEach(name => {
                locs[name] = gl.getUniformLocation(program, name);
            });
            return locs;
        }

        _initPrograms() {
            this.blitP = this._link(VS_QUAD, FS_BLIT);
            this.blitU = this._uloc(this.blitP, ['u_tex', 'u_scale', 'u_offset']);

            this.blurP = this._link(VS_QUAD, FS_BLUR);
            this.blurU = this._uloc(this.blurP, ['u_tex', 'u_dir']);

            this.glassP = this._link(VS_GLASS, FS_GLASS);
            this.glassU = this._uloc(this.glassP, [
                'u_bgTex', 'u_blurTex', 'u_center', 'u_size', 'u_radius',
                'u_res', 'u_pad', 'u_refract', 'u_chroma',
                'u_edgeHL', 'u_spec', 'u_fresnel', 'u_distort', 'u_alpha',
                'u_sat', 'u_tint', 'u_zRadius', 'u_brightness',
                'u_shadowAlpha', 'u_shadowSpread', 'u_shadowOffY',
                'u_bevelMode'
            ]);
        }

        _initBuffers() {
            const gl = this.gl;
            this.quadBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

            this.panelBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.panelBuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, -.5, .5, -.5, -.5, .5, .5, .5]), gl.STATIC_DRAW);
        }

        _createFBO(w, h) {
            const gl = this.gl;
            const fbo = gl.createFramebuffer();
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            return { fbo, tex, w, h };
        }

        _freeFBOSet(fboSet) {
            const gl = this.gl;
            [fboSet.bg, fboSet.blurA, fboSet.blurB].forEach(fbo => {
                gl.deleteTexture(fbo.tex);
                gl.deleteFramebuffer(fbo.fbo);
            });
        }

        _getFBOSet(w, h) {
            const key = `${w}x${h}`;
            if (!this.fboCache.has(key)) {
                this.fboCache.set(key, {
                    bg: this._createFBO(w, h),
                    blurA: this._createFBO(w, h),
                    blurB: this._createFBO(w, h)
                });
            }
            return this.fboCache.get(key);
        }

        _setActiveSize(w, h) {
            if (this.canvas.width !== w || this.canvas.height !== h) {
                this.canvas.width = w;
                this.canvas.height = h;
            }
            this.width = w;
            this.height = h;
            this.activeFBOs = this._getFBOSet(w, h);
            return true;
        }

        _drawQuad(program, buf) {
            const gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            const loc = gl.getAttribLocation(program, 'a_pos');
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.disableVertexAttribArray(loc);
        }

        uploadAndBlur(sourceCanvas, sourceX, sourceY, width, height, blurAmount) {
            if (this.contextLost || !this.gl) return;
            const gl = this.gl;
            if (!this._setActiveSize(width, height)) return;
            const W = this.width;
            const H = this.height;
            const fboSet = this.activeFBOs;

            this.cropCanvas.width = W;
            this.cropCanvas.height = H;
            this.cropCtx.clearRect(0, 0, W, H);
            this.cropCtx.drawImage(sourceCanvas, -sourceX, -sourceY);

            if (!this.bgTex) {
                this.bgTex = gl.createTexture();
            }
            gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.cropCanvas);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

            gl.bindFramebuffer(gl.FRAMEBUFFER, fboSet.bg.fbo);
            gl.viewport(0, 0, W, H);
            gl.useProgram(this.blitP);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
            gl.uniform1i(this.blitU.u_tex, 0);
            gl.uniform2f(this.blitU.u_scale, 1, 1);
            gl.uniform2f(this.blitU.u_offset, 0, 0);
            this._drawQuad(this.blitP, this.quadBuf);

            gl.bindFramebuffer(gl.FRAMEBUFFER, fboSet.blurA.fbo);
            gl.useProgram(this.blurP);
            gl.bindTexture(gl.TEXTURE_2D, fboSet.bg.tex);
            gl.uniform1i(this.blurU.u_tex, 0);
            gl.uniform2f(this.blurU.u_dir, 0, 1.0 / H);
            this._drawQuad(this.blurP, this.quadBuf);

            for (let i = 0; i < BLUR_ITERATIONS * blurAmount; i++) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, fboSet.blurB.fbo);
                gl.bindTexture(gl.TEXTURE_2D, fboSet.blurA.tex);
                gl.uniform2f(this.blurU.u_dir, 1.0 / W, 0);
                this._drawQuad(this.blurP, this.quadBuf);

                gl.bindFramebuffer(gl.FRAMEBUFFER, fboSet.blurA.fbo);
                gl.bindTexture(gl.TEXTURE_2D, fboSet.blurB.tex);
                gl.uniform2f(this.blurU.u_dir, 0, 1.0 / H);
                this._drawQuad(this.blurP, this.quadBuf);
            }
        }

        renderGlass(canvas, config, isDarkMode) {
            if (this.contextLost || !this.gl) return null;
            const gl = this.gl;
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const w = Math.ceil(rect.width * dpr);
            const h = Math.ceil(rect.height * dpr);
            const x = Math.floor(rect.left * dpr);
            const y = Math.floor(rect.top * dpr);

            if (w <= 0 || h <= 0) return null;

            const paddedW = w + SHADOW_PAD * 2;
            const paddedH = h + SHADOW_PAD * 2;
            const centerX = x + w / 2;
            const centerY = y + h / 2;

            this.uploadAndBlur(canvas, x - SHADOW_PAD, y - SHADOW_PAD, paddedW, paddedH, config.blurAmount);

            const outCanvas = document.createElement('canvas');
            outCanvas.width = w;
            outCanvas.height = h;
            outCanvas.style.position = 'absolute';
            outCanvas.style.left = '0';
            outCanvas.style.top = '0';
            outCanvas.style.pointerEvents = 'none';
            outCanvas.style.borderRadius = config.cornerRadius + 'px';

            const outCtx = outCanvas.getContext('2d');
            if (!outCtx) return null;

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, w, h);
            gl.useProgram(this.glassP);

            gl.uniform2f(this.glassU.u_center, centerX, centerY);
            gl.uniform2f(this.glassU.u_size, w, h);
            gl.uniform2f(this.glassU.u_res, this.width, this.height);
            gl.uniform1f(this.glassU.u_radius, config.cornerRadius * dpr);
            gl.uniform1f(this.glassU.u_pad, SHADOW_PAD * dpr);
            gl.uniform1f(this.glassU.u_refract, config.refraction);
            gl.uniform1f(this.glassU.u_chroma, config.chromAberration);
            gl.uniform1f(this.glassU.u_edgeHL, config.edgeHighlight);
            gl.uniform1f(this.glassU.u_spec, config.specular);
            gl.uniform1f(this.glassU.u_fresnel, config.fresnel);
            gl.uniform1f(this.glassU.u_distort, config.distortion);
            gl.uniform1f(this.glassU.u_alpha, config.opacity);
            gl.uniform1f(this.glassU.u_sat, config.saturation);
            gl.uniform1f(this.glassU.u_tint, config.tintStrength);
            gl.uniform1f(this.glassU.u_zRadius, config.zRadius * dpr);
            gl.uniform1f(this.glassU.u_brightness, config.brightness);
            gl.uniform1f(this.glassU.u_shadowAlpha, config.shadowOpacity);
            gl.uniform1f(this.glassU.u_shadowSpread, config.shadowSpread * dpr);
            gl.uniform1f(this.glassU.u_shadowOffY, config.shadowOffsetY * dpr);
            gl.uniform1f(this.glassU.u_bevelMode, config.bevelMode);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
            gl.uniform1i(this.glassU.u_bgTex, 0);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.activeFBOs.blurA.tex);
            gl.uniform1i(this.glassU.u_blurTex, 1);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.panelBuf);
            this._drawQuad(this.glassP, this.panelBuf);

            outCtx.drawImage(this.canvas, 0, 0, w, h, 0, 0, w, h);

            return outCanvas;
        }

        destroy() {
            if (this.gl) {
                this.fboCache.forEach((fboSet) => this._freeFBOSet(fboSet));
                this.fboCache.clear();
                if (this.bgTex) this.gl.deleteTexture(this.bgTex);
            }
            if (this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
            }
        }
    }

    class LiquidGlass {
        constructor(options = {}) {
            this.root = options.root || document.body;
            this.selector = options.selector || '.liquid-glass';
            this.config = { ...DEFAULTS, ...options.config };
            this.renderer = null;
            this.elements = [];
            this.canvases = new Map();
            this.renderCanvases = new Map();
            this.observer = null;
            this.resizeObserver = null;
            this.isDarkMode = false;
            this.initialized = false;
        }

        detectTheme() {
            const html = document.documentElement;
            const theme = html.getAttribute('data-theme');
            
            if (theme === 'dark') {
                return true;
            } else if (theme === 'light') {
                return false;
            } else {
                // Auto mode
                return window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
        }

        applyThemeAdjustments(config, isDark) {
            const adjustments = isDark ? DARK_MODE_ADJUSTMENTS : LIGHT_MODE_ADJUSTMENTS;
            return { ...config, ...adjustments };
        }

        async init() {
            if (this.initialized) return;

            try {
                this.renderer = new GlassRenderer();
                
                if (!this.renderer.gl) {
                    console.warn('LiquidGlass: WebGL not available, using CSS fallback');
                    this.applyCSSFallback();
                    return;
                }

                this.isDarkMode = this.detectTheme();
                this.elements = Array.from(this.root.querySelectorAll(this.selector));
                
                await this._captureAndRender();
                this._setupObservers();
                this._setupThemeListener();
                this.initialized = true;

            } catch (error) {
                console.error('LiquidGlass: Initialization error:', error);
                this.applyCSSFallback();
            }
        }

        applyCSSFallback() {
            const style = document.createElement('style');
            style.textContent = `
                ${this.selector} {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                }
                [data-theme="dark"] ${this.selector} {
                    background: rgba(30, 30, 30, 0.6);
                    border-color: rgba(255, 255, 255, 0.1);
                }
                [data-theme="light"] ${this.selector} {
                    background: rgba(255, 255, 255, 0.65);
                    border-color: rgba(0, 0, 0, 0.1);
                }
            `;
            document.head.appendChild(style);
            this.initialized = true;
        }

        async _captureAndRender() {
            const config = this.applyThemeAdjustments(this.config, this.isDarkMode);
            
            for (const el of this.elements) {
                await this._renderElement(el, config);
            }
        }

        async _renderElement(el, config) {
            if (this.canvases.has(el)) {
                const existing = this.canvases.get(el);
                if (existing.parentNode) {
                    existing.parentNode.removeChild(existing);
                }
                this.canvases.delete(el);
            }

            if (this.renderCanvases.has(el)) {
                const existing = this.renderCanvases.get(el);
                if (existing.parentNode) {
                    existing.parentNode.removeChild(existing);
                }
                this.renderCanvases.delete(el);
            }

            const captureCanvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;
            const rect = el.getBoundingClientRect();
            captureCanvas.width = rect.width * dpr;
            captureCanvas.height = rect.height * dpr;
            captureCanvas.style.position = 'absolute';
            captureCanvas.style.left = '0';
            captureCanvas.style.top = '0';
            captureCanvas.style.width = '100%';
            captureCanvas.style.height = '100%';
            captureCanvas.style.pointerEvents = 'none';

            const ctx = captureCanvas.getContext('2d');
            if (!ctx) return;

            ctx.scale(dpr, dpr);
            
            // Capture element content using html-to-image approach
            await this._captureElement(el, ctx, rect);

            el.appendChild(captureCanvas);
            this.canvases.set(el, captureCanvas);

            // Render glass effect
            const glassCanvas = this.renderer.renderGlass(captureCanvas, config, this.isDarkMode);
            if (glassCanvas) {
                el.appendChild(glassCanvas);
                this.renderCanvases.set(el, glassCanvas);
            }
        }

        async _captureElement(el, ctx, rect) {
            // Clone the element for rendering
            const clone = el.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.visibility = 'visible';
            clone.style.opacity = '1';
            clone.style.transform = 'none';
            clone.style.left = '-9999px';
            clone.style.top = '-9999px';
            clone.style.width = rect.width + 'px';
            clone.style.height = rect.height + 'px';
            clone.style.pointerEvents = 'none';
            
            // Copy computed styles
            const computedStyle = window.getComputedStyle(el);
            const properties = [
                'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
                'color', 'textAlign', 'lineHeight', 'letterSpacing',
                'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'
            ];
            
            properties.forEach(prop => {
                clone.style[prop] = computedStyle[prop];
            });

            document.body.appendChild(clone);

            try {
                // Use modern approach for capturing
                if (window.html2canvas) {
                    const canvas = await window.html2canvas(clone, {
                        backgroundColor: null,
                        scale: window.devicePixelRatio || 1,
                        logging: false,
                        useCORS: true,
                        allowTaint: false
                    });
                    ctx.drawImage(canvas, 0, 0);
                } else {
                    // Fallback: manual rendering
                    this._manualRender(clone, ctx, rect);
                }
            } catch (error) {
                console.warn('LiquidGlass: Capture failed, using manual render:', error);
                this._manualRender(clone, ctx, rect);
            } finally {
                document.body.removeChild(clone);
            }
        }

        _manualRender(el, ctx, rect) {
            const computedStyle = window.getComputedStyle(el);
            
            // Fill background
            ctx.fillStyle = computedStyle.backgroundColor || 'transparent';
            ctx.fillRect(0, 0, rect.width, rect.height);
            
            // Render text content
            const text = el.textContent || '';
            if (text.trim()) {
                ctx.fillStyle = computedStyle.color || '#000';
                ctx.font = computedStyle.font;
                ctx.textAlign = computedStyle.textAlign || 'left';
                ctx.fillText(text.trim(), 10, 30);
            }
        }

        _setupObservers() {
            // Resize observer for responsive updates
            this.resizeObserver = new ResizeObserver(() => {
                this._debouncedRefresh();
            });

            this.elements.forEach(el => {
                this.resizeObserver.observe(el);
            });

            // Mutation observer for content changes
            this.observer = new MutationObserver((mutations) => {
                let needsRefresh = false;
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' || mutation.type === 'attributes') {
                        needsRefresh = true;
                    }
                });
                if (needsRefresh) {
                    this._debouncedRefresh();
                }
            });

            this.elements.forEach(el => {
                this.observer.observe(el, {
                    childList: true,
                    attributes: true,
                    subtree: true,
                    characterData: true
                });
            });
        }

        _setupThemeListener() {
            const html = document.documentElement;
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.attributeName === 'data-theme') {
                        const newDarkMode = this.detectTheme();
                        if (newDarkMode !== this.isDarkMode) {
                            this.isDarkMode = newDarkMode;
                            this.refresh();
                        }
                    }
                });
            });

            observer.observe(html, { attributes: true });

            // Also listen for system preference changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (html.getAttribute('data-theme') === 'auto') {
                    this.isDarkMode = e.matches;
                    this.refresh();
                }
            });
        }

        _debounceTimeout = null;

        _debouncedRefresh() {
            if (this._debounceTimeout) {
                clearTimeout(this._debounceTimeout);
            }
            this._debounceTimeout = setTimeout(() => {
                this.refresh();
            }, 150);
        }

        refresh() {
            if (!this.initialized || !this.renderer) return;
            this._captureAndRender();
        }

        destroy() {
            if (this.observer) {
                this.observer.disconnect();
            }
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            if (this.renderer) {
                this.renderer.destroy();
            }
            this.canvases.forEach(canvas => {
                if (canvas.parentNode) {
                    canvas.parentNode.removeChild(canvas);
                }
            });
            this.renderCanvases.forEach(canvas => {
                if (canvas.parentNode) {
                    canvas.parentNode.removeChild(canvas);
                }
            });
            this.canvases.clear();
            this.renderCanvases.clear();
            this.elements = [];
            this.initialized = false;
        }
    }

    // Export to global scope
    window.LiquidGlass = LiquidGlass;
    window.LiquidGlassRenderer = GlassRenderer;

    // Auto-initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Check for elements with liquid-glass class
        const glassElements = document.querySelectorAll('.liquid-glass');
        if (glassElements.length > 0) {
            const lg = new LiquidGlass({
                selector: '.liquid-glass',
                config: {}
            });
            lg.init();
        }
    });

})();
