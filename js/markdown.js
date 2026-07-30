// markdown.js - Markdown Parser using Marked library
// Handles parsing markdown, frontmatter, and rendering blog content
// Uses marked library for improved GFM compatibility and performance

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
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut dolore magna aliqua."
            </blockquote>
            
            <p>Select a post from the sidebar to start reading.</p>
        `
    };

    // Configure marked options for GFM compatibility
    function configureMarked() {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                gfm: true,              // Enable GitHub Flavored Markdown
                breaks: false,          // Don't convert line breaks to <br> (require double space or newline)
                headerIds: true,        // Add IDs to headers
                mangle: false,          // Don't mangle email addresses
                sanitize: false,        // Don't sanitize HTML (we trust our content)
                silent: false           // Throw errors on invalid markdown
            });
        }
    }

    // Custom renderer to add lazy loading to images
    function createCustomRenderer() {
        if (typeof marked === 'undefined') return null;
        
        const renderer = new marked.Renderer();
        
        // Override image rendering to add lazy loading
        renderer.image = function(href, title, text) {
            // Check if it's a media file or external image
            const isMediaFile = href.includes('/media/') || 
                               href.endsWith('.webp') || 
                               href.endsWith('.png') || 
                               href.endsWith('.jpg') || 
                               href.endsWith('.jpeg') || 
                               href.endsWith('.gif') || 
                               href.endsWith('.svg');

            if (isMediaFile) {
                // Use data-src for lazy loading on hover, use a tiny transparent placeholder as initial src
                return `<img data-src="${href}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="${text}" style="max-width: 100%; height: auto;" class="lazy-image" loading="lazy">`;
            } else {
                // For non-media images, load normally but still add lazy class for consistency
                return `<img src="${href}" alt="${text}" style="max-width: 100%; height: auto;" class="lazy-image" loading="lazy">`;
            }
        };
        
        // Override link rendering to open in new tab
        renderer.link = function(href, title, text) {
            return `<a href="${href}" target="_blank">${text}</a>`;
        };
        
        return renderer;
    }

    // Simple Markdown parser using marked library
    function parseMarkdown(markdown) {
        if (!markdown) return '';

        // Check if marked library is available
        if (typeof marked === 'undefined') {
            console.warn('Marked library not loaded. Attempting to load from CDN...');
            // Return raw markdown as fallback if marked is not available
            return '<div class="markdown-content">' + 
                   markdown.replace(/\n/g, '<br>').replace(/#/g, '') + 
                   '<p style="color: var(--text-secondary); font-size: 0.9em;">Note: Markdown parser unavailable. Showing raw content.</p>' +
                   '</div>';
        }

        // Ensure marked is configured
        configureMarked();
        
        // Create custom renderer with lazy loading support
        const customRenderer = createCustomRenderer();
        
        // Parse markdown using marked with custom renderer
        if (customRenderer) {
            return marked.parse(markdown, { renderer: customRenderer });
        } else {
            return marked.parse(markdown);
        }
    }

    // Parse frontmatter from markdown
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

    // Initialize marked configuration when script loads
    function init() {
        // Wait for marked to be available if loaded asynchronously
        if (typeof marked === 'undefined') {
            console.warn('Marked library not yet loaded. Will configure on first parse.');
        } else {
            configureMarked();
        }
    }

    // Run initialization
    init();

    // Expose functions globally
    window.parseMarkdown = parseMarkdown;
    window.parseFrontmatter = parseFrontmatter;
    window.blogIntroduction = blogIntroduction;
})();
