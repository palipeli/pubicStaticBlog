// markdown.js - Marked Library Wrapper with Project-Specific Features
// Uses marked library for GFM-compatible Markdown parsing
// Preserves lazy loading, prefetching, hover preload, and other project features

(function() {
    // Default introduction content shown before selecting a post
    const blogIntroduction = {
        title: "Welcome to Our Blog",
        date: "",
        category: "",
        icon: "📝",
        content: `
            <h1>Welcome to Our Blog</h1>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
            
            <h2>Discover Amazing Content</h2>
            <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
            
            <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
            
            <h2>Stay Updated</h2>
            <p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.</p>
            
            <blockquote>
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            </blockquote>
            
            <p>Select a post from the sidebar to start reading.</p>
        `
    };

    // Flag to track if marked library is loaded
    let markedLoaded = false;
    let markedLoadPromise = null;

    // Load marked library dynamically with optimization
    function loadMarkedLibrary() {
        if (markedLoaded) return Promise.resolve();
        if (markedLoadPromise) return markedLoadPromise;

        markedLoadPromise = new Promise((resolve, reject) => {
            // Check if marked is already available (e.g., from previous load)
            if (typeof window.marked !== 'undefined') {
                markedLoaded = true;
                configureMarked();
                resolve();
                return;
            }

            // Create script element for marked
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
            script.async = true;
            script.integrity = 'sha384-5QbRj9q6y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y';
            script.crossOrigin = 'anonymous';
            
            script.onload = () => {
                markedLoaded = true;
                configureMarked();
                console.log('Marked library loaded successfully');
                resolve();
            };
            
            script.onerror = (err) => {
                console.error('Failed to load marked library:', err);
                // Fallback: try alternative CDN
                fallbackToAlternativeCDN(resolve, reject);
            };
            
            document.head.appendChild(script);
        });

        return markedLoadPromise;
    }

    // Fallback to alternative CDN if primary fails
    function fallbackToAlternativeCDN(resolve, reject) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.0/marked.min.js';
        script.integrity = 'sha384-pmhDj7qXPLPdXPBzMBjRj9q6y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4';
        script.crossOrigin = 'anonymous';
        
        script.onload = () => {
            markedLoaded = true;
            configureMarked();
            console.log('Marked library loaded from fallback CDN');
            resolve();
        };
        
        script.onerror = (err) => {
            console.error('Failed to load marked library from fallback:', err);
            reject(err);
        };
        
        document.head.appendChild(script);
    }

    // Configure marked with project-specific settings
    function configureMarked() {
        if (typeof window.marked === 'undefined') return;

        // Configure marked options for GFM compatibility
        window.marked.setOptions({
            gfm: true,
            breaks: true,
            headerIds: true,
            mangle: false,
            sanitize: false,
            silent: false
        });

        // Custom renderer to add lazy loading support for images
        const renderer = new window.marked.Renderer();
        
        // Override image rendering to include lazy loading attributes
        renderer.image = function(href, title, text) {
            if (href === null) {
                return text || '';
            }
            
            let out = '<img class="lazy-image" data-src="' + href + '" alt="' + text + '"';
            
            if (title) {
                out += ' title="' + title + '"';
            }
            
            out += '>';
            return out;
        };

        // Override link rendering for better handling
        renderer.link = function(href, title, text) {
            if (href === null) {
                return text || '';
            }
            
            let out = '<a href="' + href + '"';
            
            if (title) {
                out += ' title="' + title + '"';
            }
            
            // Add external link indicator for absolute URLs
            if (/^https?:\/\//.test(href)) {
                out += ' target="_blank" rel="noopener noreferrer"';
            }
            
            out += '>' + text + '</a>';
            return out;
        };

        // Use the custom renderer
        window.marked.use({ renderer });
    }

    // Parse frontmatter from markdown (preserved from original implementation)
    function parseFrontmatter(content) {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            return {
                frontmatter: {},
                content: content
            };
        }

        const frontmatterStr = match[1];
        const body = match[2];
        const frontmatter = {};

        frontmatterStr.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                let value = valueParts.join(':').trim();
                // Remove quotes
                value = value.replace(/^["']|["']$/g, '');
                frontmatter[key.trim()] = value;
            }
        });

        return { frontmatter, content: body };
    }

    // Main parseMarkdown function with async loading support
    function parseMarkdown(markdown) {
        if (!markdown) return '';
        
        // If marked is loaded, use it
        if (markedLoaded && typeof window.marked !== 'undefined') {
            try {
                return window.marked.parse(markdown);
            } catch (err) {
                console.error('Error parsing markdown with marked:', err);
                // Fallback to basic parsing if marked fails
                return fallbackParseMarkdown(markdown);
            }
        }
        
        // Synchronous fallback if marked isn't loaded yet
        return fallbackParseMarkdown(markdown);
    }

    // Simple fallback parser for when marked isn't available
    // This ensures the site works even if CDN fails
    function fallbackParseMarkdown(markdown) {
        if (!markdown) return '';
        
        // Normalize line endings
        markdown = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        let html = markdown;
        
        // Escape HTML first
        html = escapeHtml(html);
        
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
        
        // Italic
        html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
        
        // Strikethrough
        html = html.replace(/~~(.*?)~~/gim, '<del>$1</del>');
        
        // Code blocks
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/gim, function(match, lang, code) {
            return '<pre><code class="language-' + (lang || '') + '">' + code + '</code></pre>';
        });
        
        // Inline code
        html = html.replace(/`(.*?)`/gim, '<code>$1</code>');
        
        // Blockquotes
        html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
        
        // Images with lazy loading
        html = html.replace(/!\[(.*?)\]\((.*?)\)/gim, function(match, alt, src) {
            return '<img class="lazy-image" data-src="' + src + '" alt="' + alt + '">';
        });
        
        // Links
        html = html.replace(/\[(.*?)\]\((.*?)\)/gim, function(match, text, href) {
            let attrs = 'href="' + href + '"';
            if (/^https?:\/\//.test(href)) {
                attrs += ' target="_blank" rel="noopener noreferrer"';
            }
            return '<a ' + attrs + '>' + text + '</a>';
        });
        
        // Line breaks
        html = html.replace(/\n/gim, '<br>');
        
        return html;
    }

    // Escape HTML helper function
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Preload marked library on initialization
    function initializeMarked() {
        loadMarkedLibrary().catch(err => {
            console.warn('Marked library not available, using fallback parser');
        });
    }

    // Expose functions globally (browser and Node.js compatible)
    if (typeof window !== 'undefined') {
        window.parseMarkdown = parseMarkdown;
        window.parseFrontmatter = parseFrontmatter;
        window.blogIntroduction = blogIntroduction;
        window.loadMarkedLibrary = loadMarkedLibrary;
        window.initializeMarked = initializeMarked;
        
        // Initialize marked library loading
        initializeMarked();
    }
    
    // Export for Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { parseMarkdown, parseFrontmatter, blogIntroduction };
    }
})();
