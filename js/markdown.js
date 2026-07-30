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

        // Extract and protect blockquotes BEFORE escaping HTML
        // Blockquotes can start with > or be indented with 4 spaces + >
        const blockquotes = [];
        let bqIndex = 0;
        
        // First pass: find all blockquotes and replace with placeholders
        html = html.replace(/^(    )?> (.+)$/gm, (match, indent, content) => {
            blockquotes.push(content);
            return `__BQ_${bqIndex++}__`;
        });
        
        // Now escape HTML
        html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Restore blockquotes and escape their content
        for (let i = 0; i < blockquotes.length; i++) {
            const escapedContent = blockquotes[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            html = html.replace(`__BQ_${i}__`, `<blockquote>${escapedContent}</blockquote>`);
        }

        // Process lists FIRST before code blocks - this is critical for indented lists
        // According to Daring Fireball, indented lists (4 spaces) should still be lists, not code
        const lines = html.split('\n');
        const processedLines = [];
        let inOrderedList = false;
        let inUnorderedList = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Check for ordered list item (number followed by period and space) - with optional leading indent
            const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
            // Check for unordered list item (dash or asterisk followed by space) - with optional leading indent
            const unorderedMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
            
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
                processedLines.push(`<li>${orderedMatch[2]}</li>`);
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
                processedLines.push(`<li>${unorderedMatch[2]}</li>`);
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

        // Code blocks (must be after list processing)
        // Handle indented code blocks (4+ spaces or 1 tab) - but NOT list items
        // Only treat as code block if the line starts with 4+ spaces AND the content doesn't look like a list item
        const codeLines = html.split('\n');
        const codeProcessedLines = [];
        let inCodeBlock = false;
        let codeBlockContent = [];
        
        for (let i = 0; i < codeLines.length; i++) {
            const line = codeLines[i];
            // Check if line starts with 4+ spaces or tab
            const indentMatch = line.match(/^(    +|\t)(.+)$/);
            
            if (indentMatch && !inCodeBlock) {
                const content = indentMatch[2];
                // Don't treat as code if it looks like a list item marker or HTML tags
                if (!/^[*-+]\s/.test(content) && !/^\d+\.\s/.test(content) && !content.startsWith('<')) {
                    inCodeBlock = true;
                    codeBlockContent.push(content);
                } else {
                    codeProcessedLines.push(line);
                }
            } else if (indentMatch && inCodeBlock) {
                const content = indentMatch[2];
                // Continue code block if still indented and not a list marker or HTML
                if (!/^[*-+]\s/.test(content) && !/^\d+\.\s/.test(content) && !content.startsWith('<')) {
                    codeBlockContent.push(content);
                } else {
                    // End code block and process this as a regular line
                    codeProcessedLines.push('<pre><code>' + codeBlockContent.join('\n') + '</code></pre>');
                    inCodeBlock = false;
                    codeBlockContent = [];
                    codeProcessedLines.push(line);
                }
            } else if (line.trim() === '' && inCodeBlock) {
                // Empty line might end code block or be part of it
                codeBlockContent.push('');
            } else {
                if (inCodeBlock) {
                    codeProcessedLines.push('<pre><code>' + codeBlockContent.join('\n') + '</code></pre>');
                    inCodeBlock = false;
                    codeBlockContent = [];
                }
                codeProcessedLines.push(line);
            }
        }
        
        // Close any remaining code block
        if (inCodeBlock) {
            codeProcessedLines.push('<pre><code>' + codeBlockContent.join('\n') + '</code></pre>');
        }
        
        html = codeProcessedLines.join('\n');

        // Handle fenced multi-line code blocks with optional language specifier - must have newline after opening ```
        html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');

        // Inline code with triple backticks (for short code spans without newlines, e.g., ```PPQCheck```)
        // This must come AFTER multi-line code blocks to avoid conflicts
        html = html.replace(/```([^`\n]+)```/g, '<code>$1</code>');

        // Inline code with single backticks
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Setext-style headers (must come before horizontal rules)
        // H1: text followed by line of ===
        html = html.replace(/^(.+)\n===+\s*$/gm, '<h1>$1</h1>');
        // H2: text followed by line of ---
        html = html.replace(/^(.+)\n---+\s*$/gm, '<h2>$1</h2>');

        // ATX-style Headers
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');

        // Horizontal rules (after headers to avoid conflict with --- underline)
        html = html.replace(/^([-*_])\s*\1\s*\1[\s\1]*$/gm, '<hr>');

        // Bold (must come before italic)
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

        // Reference-style links: [text][id] and [id]: url
        // First, extract reference definitions and store them
        const linkRefs = {};
        html = html.replace(/^\s*\[([^\]]+)\]:\s*(\S+)(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*$/gm, (match, id, url, title1, title2, title3) => {
            linkRefs[id.toLowerCase()] = { url: url, title: title1 || title2 || title3 };
            return ''; // Remove the definition from output
        });
        // Then replace reference-style links
        html = html.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (match, text, refId) => {
            const id = (refId || text).toLowerCase();
            if (linkRefs[id]) {
                return `<a href="${linkRefs[id].url}" target="_blank">${text}</a>`;
            }
            return match; // Keep original if no reference found
        });

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

        // Links (inline style)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // Blockquotes (handle both > at start of line and indented >)
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
        html = html.replace(/^\s*> (.+)$/gm, '<blockquote>$1</blockquote>');


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
