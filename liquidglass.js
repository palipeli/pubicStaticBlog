/**
 * Liquid Glass Effect - Enhanced WebGL Implementation
 * Based on: https://github.com/ybouane/liquidglass
 * 
 * Features:
 * - Advanced edge refraction with chromatic aberration
 * - Multi-surface light refraction (biconvex/dome modes)
 * - Dynamic Fresnel reflections
 * - Specular highlights with multi-light Blinn-Phong
 * - Edge-weighted blur mixing for crisp refraction boundaries
 * - Micro-distortion noise for realistic glass texture
 * - Inner border stroke highlights
 * - Environment-like reflections
 * - Drop shadows with contact shadows
 * - GPU-accelerated Gaussian blur
 * 
 * @version 2.0.0
 */

(function(global) {
    'use strict';

    // ──────────────────────────────────────────────
    // GLSL Shader Sources
    // ──────────────────────────────────────────────

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

        // Rounded-rect signed distance function
        float rrSDF(vec2 p, vec2 b, float r) {
            vec2 q = abs(p) - b + vec2(r);
            return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;
        }

        // Bevel height field for surface normal calculation
        // mode 0 = biconvex pill (dual refraction)
        // mode 1 = dome/plano-convex (single refraction)
        float bevelHeight(float d, float zR) {
            if (d <= 0.0) return 0.0;
            if (d >= zR) return zR;
            return sqrt(d * (2.0 * zR - d));
        }

        // Hash function for micro-distortion noise
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
            vec2 half_ = u_size * 0.5;
            float r = min(u_radius, min(half_.x, half_.y));
            float sdf = rrSDF(v_localPx, half_, r);

            // Shadow rendering (outside panel area)
            if (sdf > 0.0) {
                float sdfShadow = rrSDF(v_localPx - vec2(0.0, u_shadowOffY), half_, r);
                float d = max(sdfShadow - 1.0, 0.0);
                float spread = max(u_shadowSpread, 1.0);
                float falloff = 1.0 / (spread * spread);
                float outerShadow = exp(-d * d * falloff) * 0.65;
                float contactShadow = exp(-d * 0.08 / max(spread * 0.04, 0.01)) * 0.35;
                float shadow = (outerShadow + contactShadow) * u_shadowAlpha;
                gl_FragColor = vec4(0.0, 0.0, 0.0, shadow);
                return;
            }

            // Anti-aliased mask for smooth edges
            float mask = 1.0 - smoothstep(-1.5, 0.5, sdf);

            float maxD = min(half_.x, half_.y);
            float inside = -sdf;
            float edge = smoothstep(maxD * 0.35, 0.0, inside);

            // Surface normal calculation via bevel height field
            float zR = u_zRadius;
            float e = 2.0;
            float dC = inside;
            float dR = -rrSDF(v_localPx + vec2(e, 0.0), half_, r);
            float dL = -rrSDF(v_localPx - vec2(e, 0.0), half_, r);
            float dU = -rrSDF(v_localPx + vec2(0.0, e), half_, r);
            float dD = -rrSDF(v_localPx - vec2(0.0, e), half_, r);
            float hC = bevelHeight(dC, zR);
            float hR = bevelHeight(dR, zR);
            float hL = bevelHeight(dL, zR);
            float hU = bevelHeight(dU, zR);
            float hD = bevelHeight(dD, zR);
            vec2 hGrad = vec2(hR - hL, hU - hD) / (2.0 * e);
            vec3 N = normalize(vec3(-hGrad, 1.0));

            float depth = smoothstep(0.0, zR, inside);

            // Refraction calculation
            vec2 pxToUV = vec2(1.0, -1.0) / u_res;
            float ior = 1.5;
            float refrPow = 1.0 - 1.0 / ior;
            float thickness = hC * 2.0;
            float thickNorm = thickness / max(zR * 2.0, 1.0);
            vec2 refrPx;
            
            if (u_bevelMode < 0.5) {
                // Biconvex: dual-surface refraction (entry + exit)
                vec2 exitRefr = hGrad * refrPow;
                vec2 entryRefr = hGrad * refrPow;
                vec2 throughRefr = entryRefr * thickNorm * 0.5;
                refrPx = (exitRefr + entryRefr + throughRefr) * u_refract * 30.0;
                vec2 centerDir = -v_localPx / max(half_, vec2(1.0));
                refrPx += centerDir * u_refract * 4.0 * depth;
            } else {
                // Dome: plano-convex with uniform magnification
                refrPx = -v_localPx * u_refract * depth * 0.35;
            }
            vec2 refr = refrPx * pxToUV;

            // Micro-distortion noise for glass texture
            vec2 ns = v_localPx * 0.08;
            vec2 absPxToUV = vec2(1.0) / u_res;
            vec2 micro = (vec2(hash(ns), hash(ns + vec2(37.0))) - 0.5) * u_distort * 4.0 * absPxToUV;

            // Chromatic aberration - enhanced edge effect
            float caS = u_chroma * 18.0 * (edge * 0.7 + 0.3) * 2.0;
            vec2 caD = N.xy * caS * pxToUV;
            vec2 base = v_screenUV + refr + micro;

            // Sample sharp and blurred textures with chromatic offset
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

            // Edge-weighted blur mixing for crisp refraction boundaries
            float edgeMix = (1.0 - edge * 0.15);
            vec3 col = mix(sharp, blur, edgeMix);

            // Brightness adjustment
            col *= 1.0 + u_brightness;

            // Saturation enhancement
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(lum), col, 1.0 + u_sat);

            // Cool glass tint
            col = mix(col, col * vec3(0.92, 0.95, 1.05), u_tint);
            col *= 1.0 + 0.06 * depth;

            // Fresnel reflection
            float fres = pow(1.0 - abs(N.z), 4.0) * u_fresnel;

            // Multi-light specular highlights (Blinn-Phong)
            vec3 V = vec3(0.0, 0.0, 1.0);
            
            // Primary light
            vec3 L1 = normalize(vec3(0.4, 0.7, 1.0));
            vec3 H1 = normalize(L1 + V);
            float sp1 = pow(max(dot(N, H1), 0.0), 90.0);
            
            // Secondary light
            vec3 L2 = normalize(vec3(-0.3, -0.5, 1.0));
            vec3 H2 = normalize(L2 + V);
            float sp2 = pow(max(dot(N, H2), 0.0), 50.0) * 0.3;
            
            // Broad soft light
            vec3 L3 = normalize(vec3(0.1, 0.3, 1.0));
            float spB = pow(max(dot(N, L3), 0.0), 6.0) * 0.1;
            
            // Accent light
            vec3 L4 = normalize(vec3(0.0, 0.9, 0.4));
            vec3 H4 = normalize(L4 + V);
            float sp4 = pow(max(dot(N, H4), 0.0), 120.0) * 0.6;
            
            float totalSpec = (sp1 + sp2 + spB + sp4) * u_spec;

            // Inner border/stroke highlight
            float borderWidth = 1.5;
            float innerStroke = smoothstep(-borderWidth - 1.0, -borderWidth, sdf)
                              * (1.0 - smoothstep(-1.0, 0.0, sdf));
            float topBias = 0.5 + 0.5 * (-v_localPx.y / half_.y);
            innerStroke *= (0.4 + 0.6 * topBias);

            // Edge highlight and inner glow
            float rim = edge * u_edgeHL * 0.22;
            float innerGlow = smoothstep(5.0, 0.0, -sdf) * u_edgeHL * 0.15;

            // Environment-like reflection
            float envRefl = (N.y * 0.5 + 0.5) * fres * 0.08;

            // Final composite
            vec3 fin = col;
            fin += vec3(totalSpec);
            fin += vec3(rim + innerGlow);
            fin += vec3(innerStroke * u_edgeHL * 0.55);
            fin += vec3(envRefl);
            fin = mix(fin, vec3(1.0), fres * 0.2);

            gl_FragColor = vec4(fin, mask * u_alpha);
        }
    `;

    // ──────────────────────────────────────────────
    // Default Configuration
    // ──────────────────────────────────────────────

    const DEFAULTS = {
        // Refraction settings
        refraction: 1.0,
        chromaticAberration: 1.0,
        distortion: 0.5,
        
        // Lighting
        specular: 1.0,
        fresnel: 1.0,
        edgeHighlight: 1.0,
        
        // Appearance
        saturation: 0.2,
        tint: 0.3,
        brightness: 0.05,
        alpha: 1.0,
        
        // Geometry
        radius: 16,
        zRadius: 20,
        bevelMode: 0, // 0 = biconvex, 1 = dome
        
        // Shadow
        shadowAlpha: 0.4,
        shadowSpread: 2,
        shadowOffsetY: 10,
        
        // Blur
        blurAmount: 24,
        blurPasses: 2,
        
        // Performance
        downsampleFactor: 0.5,
        padding: 50
    };

    // ──────────────────────────────────────────────
    // WebGL Helper Classes
    // ──────────────────────────────────────────────

    class ShaderProgram {
        constructor(gl, vsSource, fsSource) {
            this.gl = gl;
            this.program = this.createProgram(vsSource, fsSource);
            this.uniforms = {};
            this.attributes = {};
        }

        createProgram(vsSource, fsSource) {
            const gl = this.gl;
            const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
            const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);
            
            const program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error('Shader program link error:', gl.getProgramInfoLog(program));
                gl.deleteProgram(program);
                return null;
            }

            gl.deleteShader(vs);
            gl.deleteShader(fs);
            return program;
        }

        createShader(type, source) {
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

        use() {
            this.gl.useProgram(this.program);
            return this;
        }

        getUniformLocation(name) {
            if (!this.uniforms[name]) {
                this.uniforms[name] = this.gl.getUniformLocation(this.program, name);
            }
            return this.uniforms[name];
        }

        getAttribLocation(name) {
            if (!this.attributes[name]) {
                this.attributes[name] = this.gl.getAttribLocation(this.program, name);
            }
            return this.attributes[name];
        }

        setUniform(name, ...values) {
            const loc = this.getUniformLocation(name);
            if (!loc) return;

            switch (values.length) {
                case 1: this.gl.uniform1f(loc, values[0]); break;
                case 2: this.gl.uniform2f(loc, values[0], values[1]); break;
                case 3: this.gl.uniform3f(loc, values[0], values[1], values[2]); break;
                case 4: this.gl.uniform4f(loc, values[0], values[1], values[2], values[3]); break;
            }
        }

        setTexture(name, texture, unit) {
            this.gl.activeTexture(this.gl.TEXTURE0 + unit);
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
            this.setUniform(name, unit);
        }
    }

    class TextureManager {
        constructor(gl) {
            this.gl = gl;
            this.textures = new Map();
        }

        createTexture(width, height, data = null, filter = null) {
            const gl = this.gl;
            const texture = gl.createTexture();
            
            gl.bindTexture(gl.TEXTURE_2D, texture);
            
            if (filter === 'nearest') {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            }
            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            if (data) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
            } else {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            }

            return texture;
        }

        updateTexture(texture, width, height, data) {
            const gl = this.gl;
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        }

        resizeTexture(texture, width, height) {
            const gl = this.gl;
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }

        destroyTexture(texture) {
            this.gl.deleteTexture(texture);
        }
    }

    // ──────────────────────────────────────────────
    // Glass Renderer
    // ──────────────────────────────────────────────

    class GlassRenderer {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.gl = canvas.getContext('webgl', {
                alpha: true,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false,
                antialias: false,
                depth: false,
                stencil: false
            });

            if (!this.gl) {
                throw new Error('WebGL not supported');
            }

            this.options = { ...DEFAULTS, ...options };
            this.textureManager = new TextureManager(this.gl);
            this.programs = {};
            this.buffers = {};
            this.panels = [];
            this.animationId = null;
            this.rootElement = document.documentElement;
            
            this.init();
        }

        init() {
            const gl = this.gl;
            
            // Initialize shaders
            this.programs.blit = new ShaderProgram(gl, VS_QUAD, FS_BLIT);
            this.programs.blur = new ShaderProgram(gl, VS_QUAD, FS_BLUR);
            this.programs.glass = new ShaderProgram(gl, VS_GLASS, FS_GLASS);

            // Create quad buffer
            this.buffers.quad = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1, -1,  1, -1,  -1,  1,
                -1,  1,  1, -1,   1,  1
            ]), gl.STATIC_DRAW);

            // Setup root size tracking
            this.updateRootSize();
            window.addEventListener('resize', () => this.onResize());
        }

        updateRootSize() {
            const rect = this.rootElement.getBoundingClientRect();
            this.rootWidth = Math.max(rect.width, window.innerWidth);
            this.rootHeight = Math.max(rect.height, window.innerHeight);
            
            // Update canvas size with device pixel ratio
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.canvas.width = this.rootWidth * dpr;
            this.canvas.height = this.rootHeight * dpr;
            this.canvas.style.width = this.rootWidth + 'px';
            this.canvas.style.height = this.rootHeight + 'px';
            
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }

        onResize() {
            this.updateRootSize();
            this.panels.forEach(panel => {
                if (panel.bgTexture) {
                    this.captureBackground(panel);
                }
            });
        }

        captureBackground(panel) {
            const gl = this.gl;
            const rect = panel.element.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            
            const width = Math.floor(rect.width * dpr);
            const height = Math.floor(rect.height * dpr);
            
            // Capture background using html2canvas or similar
            // For now, we'll use a placeholder approach
            if (panel.bgTexture) {
                this.textureManager.resizeTexture(panel.bgTexture, width, height);
            } else {
                panel.bgTexture = this.textureManager.createTexture(width, height);
            }

            // Calculate UV scale and offset for cover mode
            const rootRect = this.rootElement.getBoundingClientRect();
            const scaleX = this.rootWidth / rect.width;
            const scaleY = this.rootHeight / rect.height;
            const scale = Math.max(scaleX, scaleY);
            
            panel.uvScale = [scale, scale];
            panel.uvOffset = [
                (this.rootWidth - rect.width * scale) / (2 * this.rootWidth),
                (this.rootHeight - rect.height * scale) / (2 * this.rootHeight)
            ];
        }

        addPanel(element, options = {}) {
            const panelOptions = { ...this.options, ...options };
            const panel = {
                element: element,
                options: panelOptions,
                bgTexture: null,
                blurTexture: null,
                uvScale: [1, 1],
                uvOffset: [0, 0]
            };

            this.panels.push(panel);
            this.captureBackground(panel);
            
            // Create blur texture at downsampled resolution
            const dsFactor = panelOptions.downsampleFactor;
            const rect = element.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const blurWidth = Math.floor(rect.width * dpr * dsFactor);
            const blurHeight = Math.floor(rect.height * dpr * dsFactor);
            panel.blurTexture = this.textureManager.createTexture(blurWidth, blurHeight, null, 'linear');

            return panel;
        }

        removePanel(element) {
            const index = this.panels.findIndex(p => p.element === element);
            if (index !== -1) {
                const panel = this.panels[index];
                if (panel.bgTexture) {
                    this.textureManager.destroyTexture(panel.bgTexture);
                }
                if (panel.blurTexture) {
                    this.textureManager.destroyTexture(panel.blurTexture);
                }
                this.panels.splice(index, 1);
            }
        }

        render() {
            const gl = this.gl;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);

            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            this.panels.forEach(panel => {
                this.renderPanel(panel, dpr);
            });
        }

        renderPanel(panel, dpr) {
            const gl = this.gl;
            const rect = panel.element.getBoundingClientRect();
            const options = panel.options;

            // Calculate panel position in root coordinates (top-left origin)
            const centerX = (rect.left + rect.width / 2) * dpr;
            const centerY = (rect.top + rect.height / 2) * dpr;
            const width = rect.width * dpr;
            const height = rect.height * dpr;

            // Apply blur passes
            this.applyBlur(panel, options.blurAmount, options.blurPasses);

            // Render glass effect
            const glassProgram = this.programs.glass.use();
            
            // Set attributes
            const posLoc = glassProgram.getAttribLocation('a_pos');
            gl.enableVertexAttribArray(posLoc);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            // Set uniforms
            glassProgram.setTexture('u_bgTex', panel.bgTexture, 0);
            glassProgram.setTexture('u_blurTex', panel.blurTexture, 1);
            
            glassProgram.setUniform('u_size', width, height);
            glassProgram.setUniform('u_radius', options.radius * dpr);
            glassProgram.setUniform('u_res', this.canvas.width, this.canvas.height);
            glassProgram.setUniform('u_center', centerX, centerY);
            glassProgram.setUniform('u_pad', options.padding * dpr);

            // Refraction parameters
            glassProgram.setUniform('u_refract', options.refraction);
            glassProgram.setUniform('u_chroma', options.chromaticAberration);
            glassProgram.setUniform('u_distort', options.distortion);
            glassProgram.setUniform('u_edgeHL', options.edgeHighlight);
            
            // Lighting parameters
            glassProgram.setUniform('u_spec', options.specular);
            glassProgram.setUniform('u_fresnel', options.fresnel);
            
            // Appearance parameters
            glassProgram.setUniform('u_alpha', options.alpha);
            glassProgram.setUniform('u_sat', options.saturation);
            glassProgram.setUniform('u_tint', options.tint);
            glassProgram.setUniform('u_brightness', options.brightness);
            
            // Geometry parameters
            glassProgram.setUniform('u_zRadius', options.zRadius * dpr);
            glassProgram.setUniform('u_bevelMode', options.bevelMode);
            
            // Shadow parameters
            glassProgram.setUniform('u_shadowAlpha', options.shadowAlpha);
            glassProgram.setUniform('u_shadowSpread', options.shadowSpread);
            glassProgram.setUniform('u_shadowOffY', options.shadowOffsetY * dpr);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        applyBlur(panel, blurAmount, passes) {
            const gl = this.gl;
            const rect = panel.element.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const dsFactor = panel.options.downsampleFactor;

            const width = Math.floor(rect.width * dpr * dsFactor);
            const height = Math.floor(rect.height * dpr * dsFactor);

            // Create temporary textures for ping-pong blur
            const temp1 = this.textureManager.createTexture(width, height, null, 'linear');
            const temp2 = this.textureManager.createTexture(width, height, null, 'linear');

            // Calculate blur direction in UV space
            const blurUV = blurAmount / Math.max(width, height);

            // Horizontal blur pass
            const blurProgram = this.programs.blur.use();
            const posLoc = blurProgram.getAttribLocation('a_pos');
            gl.enableVertexAttribArray(posLoc);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            for (let i = 0; i < passes; i++) {
                // Horizontal pass
                gl.bindTexture(gl.TEXTURE_2D, panel.bgTexture);
                blurProgram.setTexture('u_tex', panel.bgTexture, 0);
                blurProgram.setUniform('u_dir', blurUV, 0);
                
                // Render to temp1
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.createFramebuffer(temp1, width, height));
                gl.viewport(0, 0, width, height);
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                // Vertical pass
                gl.bindTexture(gl.TEXTURE_2D, temp1);
                blurProgram.setTexture('u_tex', temp1, 0);
                blurProgram.setUniform('u_dir', 0, blurUV);
                
                // Render to temp2
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.createFramebuffer(temp2, width, height));
                gl.viewport(0, 0, width, height);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }

            // Copy final result to blurTexture
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.createFramebuffer(panel.blurTexture, width, height));
            gl.viewport(0, 0, width, height);
            gl.bindTexture(gl.TEXTURE_2D, temp2);
            blurProgram.setTexture('u_tex', temp2, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            // Cleanup
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            this.textureManager.destroyTexture(temp1);
            this.textureManager.destroyTexture(temp2);

            // Reset viewport
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }

        createFramebuffer(texture, width, height) {
            const gl = this.gl;
            const fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            return fb;
        }

        startAnimation() {
            if (this.animationId) return;
            
            const animate = () => {
                this.render();
                this.animationId = requestAnimationFrame(animate);
            };
            animate();
        }

        stopAnimation() {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }

        destroy() {
            this.stopAnimation();
            this.panels.forEach(panel => {
                if (panel.bgTexture) {
                    this.textureManager.destroyTexture(panel.bgTexture);
                }
                if (panel.blurTexture) {
                    this.textureManager.destroyTexture(panel.blurTexture);
                }
            });
            this.panels = [];
            
            if (this.buffers.quad) {
                this.gl.deleteBuffer(this.buffers.quad);
            }
            
            Object.values(this.programs).forEach(prog => {
                if (prog.program) {
                    this.gl.deleteProgram(prog.program);
                }
            });
        }

        // Public API for dynamic updates
        updatePanelOptions(element, newOptions) {
            const panel = this.panels.find(p => p.element === element);
            if (panel) {
                panel.options = { ...panel.options, ...newOptions };
            }
        }

        setGlobalOption(key, value) {
            this.options[key] = value;
            this.panels.forEach(panel => {
                panel.options[key] = value;
            });
        }
    }

    // ──────────────────────────────────────────────
    // LiquidGlass Main Class
    // ──────────────────────────────────────────────

    class LiquidGlass {
        constructor(options = {}) {
            this.options = {
                selector: '.liquid-glass',
                autoStart: true,
                canvasId: 'liquid-glass-canvas',
                ...options
            };

            this.renderer = null;
            this.canvas = null;
            this.initialized = false;

            if (this.options.autoStart) {
                this.init();
            }
        }

        init() {
            if (this.initialized) return;

            // Create canvas
            this.canvas = document.getElementById(this.options.canvasId);
            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
                this.canvas.id = this.options.canvasId;
                this.canvas.style.position = 'fixed';
                this.canvas.style.top = '0';
                this.canvas.style.left = '0';
                this.canvas.style.pointerEvents = 'none';
                this.canvas.style.zIndex = '9999';
                document.body.appendChild(this.canvas);
            }

            try {
                this.renderer = new GlassRenderer(this.canvas, this.options);
                this.registerPanels();
                this.renderer.startAnimation();
                this.initialized = true;
            } catch (error) {
                console.error('LiquidGlass initialization failed:', error);
            }
        }

        registerPanels() {
            const elements = document.querySelectorAll(this.options.selector);
            elements.forEach(el => {
                const options = this.parseElementOptions(el);
                this.renderer.addPanel(el, options);
            });
        }

        parseElementOptions(element) {
            const options = {};
            
            // Parse data attributes
            const attrs = element.attributes;
            for (let i = 0; i < attrs.length; i++) {
                const attr = attrs[i];
                if (attr.name.startsWith('data-lg-')) {
                    const key = attr.name.replace('data-lg-', '');
                    const value = attr.value;
                    
                    // Convert to appropriate type
                    if (value === 'true') {
                        options[key] = true;
                    } else if (value === 'false') {
                        options[key] = false;
                    } else if (!isNaN(value) && value !== '') {
                        options[key] = parseFloat(value);
                    } else {
                        options[key] = value;
                    }
                }
            }

            return options;
        }

        add(element, options = {}) {
            if (!this.renderer) {
                this.init();
            }
            return this.renderer.addPanel(element, options);
        }

        remove(element) {
            if (this.renderer) {
                this.renderer.removePanel(element);
            }
        }

        update(element, options) {
            if (this.renderer) {
                this.renderer.updatePanelOptions(element, options);
            }
        }

        setOption(key, value) {
            if (this.renderer) {
                this.renderer.setGlobalOption(key, value);
            }
        }

        refresh() {
            if (this.renderer) {
                this.renderer.panels = [];
                this.registerPanels();
            }
        }

        destroy() {
            if (this.renderer) {
                this.renderer.destroy();
                this.renderer = null;
            }
            if (this.canvas && this.canvas.parentElement) {
                this.canvas.parentElement.removeChild(this.canvas);
            }
            this.initialized = false;
        }

        // Static convenience methods
        static create(options) {
            return new LiquidGlass(options);
        }

        static init(selector, options) {
            const instance = new LiquidGlass({ selector, ...options });
            return instance;
        }
    }

    // ──────────────────────────────────────────────
    // Export
    // ──────────────────────────────────────────────

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LiquidGlass;
    } else {
        global.LiquidGlass = LiquidGlass;
    }

})(typeof window !== 'undefined' ? window : this);
