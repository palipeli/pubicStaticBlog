// markdown.js - Markdown Parser and Blog Content Utilities
// Handles parsing markdown, frontmatter, and rendering blog content

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

    // Simple Markdown parser
    function parseMarkdown(markdown) {
        if (!markdown) return '';

        let html = markdown;

        // Escape HTML
        html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Code blocks (must be before other replacements)
        // Handle code blocks with optional language specifier - must have newline after opening ```
        html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');

        // Inline code with triple backticks (must be before single backtick inline code)
        html = html.replace(/```([^`\n]+)```/g, '<code>$1</code>');

        // Inline code with single backticks
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Headers
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');

        // Bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Images (must be before links since it uses similar syntax)
        // Add lazy-loading with data-src for hover-based loading
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            // Check if it's a media file or external image
            const isMediaFile = src.includes('/media/') || src.endsWith('.webp') || src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg') || src.endsWith('.gif') || src.endsWith('.svg');

            if (isMediaFile) {
                // Use data-src for lazy loading on hover, use a tiny transparent placeholder as initial src
                return `<img data-src="${src}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="${alt}" style="max-width: 100%; height: auto;" class="lazy-image" loading="lazy">`;
            } else {
                // For non-media images, load normally but still add lazy class for consistency
                return `<img src="${src}" alt="${alt}" style="max-width: 100%; height: auto;" class="lazy-image" loading="lazy">`;
            }
        });

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // Blockquotes
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

        // Process lists - need to handle them line by line first, then wrap
        const lines = html.split('\n');
        const processedLines = [];
        let inOrderedList = false;
        let inUnorderedList = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Check for ordered list item (number followed by period and space)
            const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
            // Check for unordered list item (dash followed by space)
            const unorderedMatch = line.match(/^-\s+(.+)$/);
            
            if (orderedMatch) {
                // Close unordered list if open
                if (inUnorderedList) {
                    processedLines.push('</ul>');
                    inUnorderedList = false;
                }
                // Open ordered list if not already open
                if (!inOrderedList) {
                    processedLines.push('<ol>');
                    inOrderedList = true;
                }
                processedLines.push(`<li>${orderedMatch[1]}</li>`);
            } else if (unorderedMatch) {
                // Close ordered list if open
                if (inOrderedList) {
                    processedLines.push('</ol>');
                    inOrderedList = false;
                }
                // Open unordered list if not already open
                if (!inUnorderedList) {
                    processedLines.push('<ul>');
                    inUnorderedList = true;
                }
                processedLines.push(`<li>${unorderedMatch[1]}</li>`);
            } else if (line.trim() === '') {
                // Blank line - don't close lists yet, check if next non-empty line continues the list
                processedLines.push(line);
            } else {
                // Non-list, non-blank line - close any open lists
                if (inOrderedList) {
                    processedLines.push('</ol>');
                    inOrderedList = false;
                }
                if (inUnorderedList) {
                    processedLines.push('</ul>');
                    inUnorderedList = false;
                }
                processedLines.push(line);
            }
        }
        
        // Close any remaining open lists
        if (inOrderedList) {
            processedLines.push('</ol>');
        }
        if (inUnorderedList) {
            processedLines.push('</ul>');
        }
        
        // Second pass: remove blank lines inside lists that break continuity
        let finalHtml = processedLines.join('\n');
        // Remove blank lines between </li> and <li> within the same list
        finalHtml = finalHtml.replace(/(<\/li>)\n+(\n*)(<li>)/g, '$1$3');
        // Remove blank lines between opening tag and first li
        finalHtml = finalHtml.replace(/(<(?:ol|ul)>)\n+(\n*)(<li>)/g, '$1$3');
        // Remove blank lines between last li and closing tag
        finalHtml = finalHtml.replace(/(<\/li>)\n+(\n*)(<\/(?:ol|ul)>)/g, '$1$3');
        
        html = finalHtml;

        // Paragraphs (simple approach - wrap remaining text blocks)

        // Clean up empty paragraphs and fix paragraph wrapping around block elements
        html = html.replace(/<p>\s*<(h[1-6]|ul|ol|li|pre|blockquote)/g, '<$1');
        html = html.replace(/<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/g, '<$1>');
        html = html.replace(/<p><\/p>/g, '');

        return html;
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

    // Expose functions globally
    window.parseMarkdown = parseMarkdown;
    window.parseFrontmatter = parseFrontmatter;
    window.blogIntroduction = blogIntroduction;
})();
