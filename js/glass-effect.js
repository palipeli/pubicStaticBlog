/**
 * WebGL Glass Edge Refraction Effect
 * Creates a liquid glass-like refraction effect on element edges
 * Inspired by https://github.com/ybouane/liquidglass
 */

(function() {
    'use strict';

    // Vertex shader for full-screen quad
    const VERTEX_SHADER_SOURCE = `
        attribute vec2 a_position;
        varying vec2 v_texCoord;
        void main() {
            v_texCoord = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    // Fragment shader for glass edge refraction (optimized for performance)
    const FRAGMENT_SHADER_SOURCE = `
        precision highp float;
        
        varying vec2 v_texCoord;
        
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec2 u_elementSize;
        uniform vec2 u_elementPos;
        uniform float u_borderRadius;
        uniform float u_glassThickness;
        uniform vec3 u_glassColor;
        uniform float u_refractionIndex;
        uniform float u_specularIntensity;
        uniform float u_roughness;
        uniform vec2 u_mousePos;
        uniform bool u_hasMouseInteraction;
        
        // Simplex noise (same as above)
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            float n_ = 1.0/7.0;
            vec3  ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);
            vec4 x = x_ * ns.x + ns.yyyy;
            vec4 y = y_ * ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        
        float sdRoundedRect(vec2 p, vec2 b, float r) {
            vec2 d = abs(p) - b + vec2(r);
            return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
        }
        
        float getEdgeFactor(vec2 pos, vec2 size, float radius, float thickness) {
            vec2 halfSize = size * 0.5;
            float dist = sdRoundedRect(pos, halfSize, radius);
            float innerDist = sdRoundedRect(pos, halfSize - vec2(thickness), max(radius - thickness, 0.0));
            float edgeDist = min(abs(dist), abs(innerDist));
            if (edgeDist > thickness * 1.5) return 0.0;
            return 1.0 - smoothstep(0.0, thickness, edgeDist);
        }
        
        float fresnel(float cosTheta, float ior) {
            float f0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
            return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
        }
        
        void main() {
            vec2 uv = v_texCoord;
            vec2 screenPos = uv * u_resolution;
            vec2 localPos = screenPos - u_elementPos;
            vec2 center = u_elementSize * 0.5;
            vec2 pos = localPos - center;
            
            float edgeFactor = getEdgeFactor(pos, u_elementSize, u_borderRadius, u_glassThickness);
            
            if (edgeFactor < 0.01) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
                return;
            }
            
            // Organic noise distortion
            float noise = snoise(vec3(pos * 0.008, u_time * 0.25)) * 0.5;
            edgeFactor *= 1.0 + noise * 0.12;
            
            // Normal calculation
            vec2 eps = vec2(2.0, 0.0) / u_resolution;
            float d = sdRoundedRect(pos, u_elementSize * 0.5, u_borderRadius);
            float dx = sdRoundedRect(pos + vec2(eps.x, 0.0), u_elementSize * 0.5, u_borderRadius);
            float dy = sdRoundedRect(pos + vec2(0.0, eps.y), u_elementSize * 0.5, u_borderRadius);
            vec2 normal = normalize(vec2(dx - d, dy - d));
            
            // View direction
            vec2 viewDir = normalize(-pos + vec2(0.0, 0.1));
            float cosTheta = dot(normal, viewDir);
            
            // Fresnel specular
            float specular = fresnel(abs(cosTheta), u_refractionIndex);
            specular = pow(specular, 2.0 - u_roughness) * u_specularIntensity * edgeFactor;
            
            // Rim lighting
            float rim = 1.0 - abs(dot(normal, viewDir));
            rim = pow(rim, 4.0) * 0.4 * edgeFactor;
            
            // Caustics
            float caustics = sin(pos.x * 0.03 + u_time * 1.5) * sin(pos.y * 0.03 + u_time * 1.3);
            caustics = caustics * 0.5 + 0.5;
            caustics = pow(caustics, 10.0) * edgeFactor * 0.12;
            
            // Mouse interaction
            float mouseInfluence = 0.0;
            if (u_hasMouseInteraction) {
                vec2 mouseLocal = (u_mousePos - u_elementPos) / u_elementSize - 0.5;
                float mouseDist = length(pos - mouseLocal * u_elementSize);
                mouseInfluence = smoothstep(180.0, 0.0, mouseDist) * 0.25;
                edgeFactor += mouseInfluence;
            }
            
            // Breathing animation
            float breathe = sin(u_time * 0.8) * 0.02 + 1.0;
            edgeFactor *= breathe;
            
            // Final color composition
            vec3 glassBase = u_glassColor * edgeFactor * 0.35;
            vec3 specularColor = vec3(1.0, 1.0, 1.0) * specular;
            vec3 rimColor = u_glassColor * rim;
            vec3 causticColor = vec3(1.0, 1.0, 1.0) * caustics;
            
            // Subtle chromatic aberration
            float chromatic = edgeFactor * 0.3;
            vec3 finalColor = glassBase + specularColor + rimColor + causticColor;
            finalColor.r += chromatic * 0.015;
            finalColor.b -= chromatic * 0.015;
            
            float alpha = edgeFactor * 0.5 + specular * 0.9 + rim * 0.5 + caustics * 0.8;
            alpha = clamp(alpha * 0.85, 0.0, 0.9);
            
            gl_FragColor = vec4(finalColor * alpha, alpha);
        }
    `;

    class GlassEffect {
        constructor(options = {}) {
            this.canvas = null;
            this.gl = null;
            this.program = null;
            this.element = null;
            this.animationId = null;
            this.startTime = performance.now();
            this.mousePos = { x: 0, y: 0 };
            this.hasMouseInteraction = false;
            this.resizeObserver = null;
            
            // Default configuration
            this.config = {
                glassThickness: options.glassThickness || 30,
                borderRadius: options.borderRadius || 16,
                glassColor: options.glassColor || [1.0, 1.0, 1.0],
                refractionIndex: options.refractionIndex || 1.52,
                specularIntensity: options.specularIntensity || 1.2,
                roughness: options.roughness || 0.1,
                enableMouseInteraction: options.enableMouseInteraction !== false,
                enableCaustics: options.enableCaustics !== false,
                className: options.className || 'glass-edge-effect'
            };
            
            // Uniform locations cache
            this.uniforms = {};
        }
        
        init(element) {
            this.element = element;
            
            // Check for reduced motion preference
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return false;
            }
            
            // Create canvas
            this.canvas = document.createElement('canvas');
            this.canvas.className = this.config.className;
            this.canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1;
                border-radius: inherit;
            `;
            
            // Insert canvas as first child
            element.style.position = 'relative';
            element.insertBefore(this.canvas, element.firstChild);
            
            // Initialize WebGL
            this.gl = this.canvas.getContext('webgl', {
                alpha: true,
                antialias: true,
                preserveDrawingBuffer: false,
                powerPreference: 'high-performance'
            });
            
            if (!this.gl) {
                console.warn('WebGL not supported, glass effect disabled');
                this.canvas.remove();
                return false;
            }
            
            // Check for required extensions
            const ext = this.gl.getExtension('OES_standard_derivatives');
            if (!ext) {
                console.warn('OES_standard_derivatives not supported, using fallback');
            }
            
            this.initShaders();
            this.initBuffers();
            this.setupEventListeners();
            this.resize();
            this.startRenderLoop();
            
            return true;
        }
        
        initShaders() {
            const gl = this.gl;
            
            let vertexShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
            let fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
            
            this.program = this.createProgram(vertexShader, fragmentShader);
            
            if (!this.program) {
                throw new Error('Failed to create shader program');
            }
            
            gl.useProgram(this.program);
            
            // Cache uniform locations
            this.uniforms = {
                resolution: gl.getUniformLocation(this.program, 'u_resolution'),
                time: gl.getUniformLocation(this.program, 'u_time'),
                elementSize: gl.getUniformLocation(this.program, 'u_elementSize'),
                elementPos: gl.getUniformLocation(this.program, 'u_elementPos'),
                borderRadius: gl.getUniformLocation(this.program, 'u_borderRadius'),
                glassThickness: gl.getUniformLocation(this.program, 'u_glassThickness'),
                glassColor: gl.getUniformLocation(this.program, 'u_glassColor'),
                refractionIndex: gl.getUniformLocation(this.program, 'u_refractionIndex'),
                specularIntensity: gl.getUniformLocation(this.program, 'u_specularIntensity'),
                roughness: gl.getUniformLocation(this.program, 'u_roughness'),
                mousePos: gl.getUniformLocation(this.program, 'u_mousePos'),
                hasMouseInteraction: gl.getUniformLocation(this.program, 'u_hasMouseInteraction')
            };
            
            // Position attribute
            this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
        }
        
        compileShader(type, source) {
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
        
        createProgram(vertexShader, fragmentShader) {
            const gl = this.gl;
            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error('Program link error:', gl.getProgramInfoLog(program));
                gl.deleteProgram(program);
                return null;
            }
            return program;
        }
        
        initBuffers() {
            const gl = this.gl;
            
            // Full-screen quad vertices
            const positions = new Float32Array([
                -1, -1,
                 1, -1,
                -1,  1,
                -1,  1,
                 1, -1,
                 1,  1
            ]);
            
            this.positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        }
        
        setupEventListeners() {
            if (this.config.enableMouseInteraction) {
                this.element.addEventListener('mousemove', this.onMouseMove.bind(this));
                this.element.addEventListener('mouseleave', this.onMouseLeave.bind(this));
                this.element.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true });
                this.element.addEventListener('touchend', this.onMouseLeave.bind(this));
            }
            
            // Resize observer
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(this.element);
            
            // Theme change observer
            const themeObserver = new MutationObserver(() => this.updateThemeColors());
            themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        }
        
        onMouseMove(e) {
            const rect = this.element.getBoundingClientRect();
            this.mousePos.x = e.clientX - rect.left;
            this.mousePos.y = e.clientY - rect.top;
            this.hasMouseInteraction = true;
        }
        
        onMouseLeave() {
            this.hasMouseInteraction = false;
        }
        
        onTouchMove(e) {
            if (e.touches.length > 0) {
                const rect = this.element.getBoundingClientRect();
                this.mousePos.x = e.touches[0].clientX - rect.left;
                this.mousePos.y = e.touches[0].clientY - rect.top;
                this.hasMouseInteraction = true;
            }
        }
        
        resize() {
            if (!this.canvas || !this.gl) return;
            
            const rect = this.element.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            
            this.elementRect = rect;
        }
        
        updateThemeColors() {
            // Update glass color based on theme
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                this.config.glassColor = [0.95, 0.95, 1.0]; // Cool white for dark
            } else {
                this.config.glassColor = [1.0, 1.0, 1.0]; // Pure white for light
            }
        }
        
        render() {
            if (!this.gl || !this.program || !this.elementRect) return;
            
            const gl = this.gl;
            const now = performance.now();
            const time = (now - this.startTime) * 0.001;
            
            // Clear
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // Enable blending for transparency
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.disable(gl.DEPTH_TEST);
            
            gl.useProgram(this.program);
            
            // Bind position buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.enableVertexAttribArray(this.positionLocation);
            gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
            
            // Set uniforms
            const rect = this.elementRect;
            const dpr = window.devicePixelRatio || 1;
            
            gl.uniform2f(this.uniforms.resolution, rect.width * dpr, rect.height * dpr);
            gl.uniform1f(this.uniforms.time, time);
            gl.uniform2f(this.uniforms.elementSize, rect.width, rect.height);
            gl.uniform2f(this.uniforms.elementPos, rect.left, rect.top);
            gl.uniform1f(this.uniforms.borderRadius, this.config.borderRadius);
            gl.uniform1f(this.uniforms.glassThickness, this.config.glassThickness);
            gl.uniform3fv(this.uniforms.glassColor, this.config.glassColor);
            gl.uniform1f(this.uniforms.refractionIndex, this.config.refractionIndex);
            gl.uniform1f(this.uniforms.specularIntensity, this.config.specularIntensity);
            gl.uniform1f(this.uniforms.roughness, this.config.roughness);
            gl.uniform2f(this.uniforms.mousePos, this.mousePos.x, this.mousePos.y);
            gl.uniform1i(this.uniforms.hasMouseInteraction, this.hasMouseInteraction ? 1 : 0);
            
            // Draw
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        
        startRenderLoop() {
            const loop = () => {
                this.render();
                this.animationId = requestAnimationFrame(loop);
            };
            loop();
        }
        
        stopRenderLoop() {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }
        
        destroy() {
            this.stopRenderLoop();
            
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            
            if (this.config.enableMouseInteraction && this.element) {
                this.element.removeEventListener('mousemove', this.onMouseMove);
                this.element.removeEventListener('mouseleave', this.onMouseLeave);
                this.element.removeEventListener('touchmove', this.onTouchMove);
                this.element.removeEventListener('touchend', this.onMouseLeave);
            }
            
            if (this.gl) {
                this.gl.deleteProgram(this.program);
                this.gl.deleteBuffer(this.positionBuffer);
            }
            
            if (this.canvas && this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
            }
            
            this.element = null;
            this.canvas = null;
            this.gl = null;
            this.program = null;
        }
        
        // Update configuration at runtime
        updateConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
        }
    }
    
    // Manager for multiple glass effects
    class GlassEffectManager {
        constructor() {
            this.effects = new Map();
            this.selectors = [
                '.home-hero',
                '.about-hero',
                '.blog-article'
            ];
        }
        
        init() {
            // Check reduced motion
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                console.log('Reduced motion enabled, skipping glass effect');
                return;
            }
            
            // Check WebGL support
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) {
                console.warn('WebGL not supported, glass effect disabled');
                return;
            }
            
            // Initialize effects for existing elements
            this.selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => this.attachEffect(el, selector));
            });
            
            // Watch for dynamically added elements
            this.setupMutationObserver();
        }
        
        attachEffect(element, selector) {
            if (this.effects.has(element)) return;
            
            // Get border radius from computed style
            const computedStyle = window.getComputedStyle(element);
            const borderRadius = parseFloat(computedStyle.borderRadius) || 16;
            
            // Determine config based on element type
            let config = {
                borderRadius: borderRadius,
                glassThickness: 28,
                enableMouseInteraction: true,
                enableCaustics: true
            };
            
            if (selector === '.home-hero') {
                config.glassThickness = 32;
                config.specularIntensity = 1.3;
                config.glassColor = [1.0, 0.98, 1.0];
            } else if (selector === '.about-hero') {
                config.glassThickness = 30;
                config.specularIntensity = 1.2;
                config.glassColor = [1.0, 1.0, 0.98];
            } else if (selector === '.blog-article') {
                config.glassThickness = 24;
                config.specularIntensity = 1.0;
                config.glassColor = [1.0, 1.0, 1.0];
            }
            
            const effect = new GlassEffect(config);
            const success = effect.init(element);
            
            if (success) {
                this.effects.set(element, effect);
            } else {
                effect.destroy();
            }
        }
        
        setupMutationObserver() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.selectors.forEach(selector => {
                                if (node.matches && node.matches(selector)) {
                                    this.attachEffect(node, selector);
                                }
                                node.querySelectorAll(selector).forEach(el => {
                                    this.attachEffect(el, selector);
                                });
                            });
                        }
                    });
                    
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.selectors.forEach(selector => {
                                if (node.matches && node.matches(selector)) {
                                    this.detachEffect(node);
                                }
                                node.querySelectorAll(selector).forEach(el => {
                                    this.detachEffect(el);
                                });
                            });
                        }
                    });
                });
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
            this.mutationObserver = observer;
        }
        
        detachEffect(element) {
            const effect = this.effects.get(element);
            if (effect) {
                effect.destroy();
                this.effects.delete(element);
            }
        }
        
        destroy() {
            this.effects.forEach((effect, element) => {
                effect.destroy();
            });
            this.effects.clear();
            
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
            }
        }
        
        // Update all effects on theme change
        updateTheme() {
            this.effects.forEach((effect) => {
                effect.updateThemeColors();
            });
        }
    }
    
    // Export to window
    window.GlassEffect = GlassEffect;
    window.GlassEffectManager = GlassEffectManager;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.glassEffectManager = new GlassEffectManager();
            window.glassEffectManager.init();
        });
    } else {
        window.glassEffectManager = new GlassEffectManager();
        window.glassEffectManager.init();
    }
    
})();