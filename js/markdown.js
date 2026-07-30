// markdown.js - Markdown Parser and Blog Content Utilities
// Handles parsing markdown, frontmatter, and rendering blog content
// Updated for GitHub Flavored Markdown (GFM) compatibility

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

    // GFM-compatible Markdown parser
    function parseMarkdown(markdown) {
        if (!markdown) return '';

        let html = markdown;

        // Escape HTML (must be first to prevent XSS and handle special chars)
        html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Fenced code blocks (GFM)
        // Must have newline after opening ``` and before closing ```
        // Optional language specifier after opening ```
        html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, function(match, lang, code) {
            return '<pre><code>' + code + '</code></pre>';
        });

        // Indented code blocks (4 spaces or 1 tab)
        // Process line by line for indented code blocks
        var lines = html.split('\n');
        var processedLines = [];
        var inCodeBlock = false;
        var codeBlockContent = [];
        
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var indentedMatch = line.match(/^    (.*)$/);
            var tabbedMatch = line.match(/^\t(.*)$/);
            
            if (indentedMatch || tabbedMatch) {
                var codeLine = indentedMatch ? indentedMatch[1] : tabbedMatch[1];
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    codeBlockContent = [];
                }
                codeBlockContent.push(codeLine);
            } else {
                if (inCodeBlock) {
                    processedLines.push('<pre><code>' + codeBlockContent.join('\n') + '</code></pre>');
                    inCodeBlock = false;
                    codeBlockContent = [];
                }
                processedLines.push(line);
            }
        }
        
        // Close any remaining code block
        if (inCodeBlock) {
            processedLines.push('<pre><code>' + codeBlockContent.join('\n') + '</code></pre>');
        }
        
        html = processedLines.join('\n');

        // Inline code with triple backticks (for short code spans without newlines, e.g., ```PPQCheck```)
        html = html.replace(/```([^\`\n]+)```/g, '<code>$1</code>');

        // Inline code with single backticks
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // ATX Headers (GFM supports 1-6 # symbols)
        // Note: order matters - check h6 first, then h5, etc.
        html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Bold (** or __)
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // Italic (* or _) - must come after bold
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

        // Strikethrough (GFM extension)
        html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

        // Images (must be before links since it uses similar syntax)
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, src) {
            var isMediaFile = src.includes('/media/') || src.endsWith('.webp') || src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg') || src.endsWith('.gif') || src.endsWith('.svg');
            if (isMediaFile) {
                return '<img data-src="' + src + '" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="' + alt + '" style="max-width: 100%; height: auto;" class="lazy-image" loading="lazy">';
            } else {
                return '<img src="' + src + '" alt="' + alt + '" style="max-width: 100%; height: auto;" class="lazy-image" loading="lazy">';
            }
        });

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // Blockquotes (handle > followed by space)
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

        // Horizontal rules / thematic breaks (GFM: 3+ *, -, or _ on their own line)
        html = html.replace(/^([-*_])\1{2,}$/gm, '<hr />');

        // Process lists - need to handle them line by line, then wrap
        var listLines = html.split('\n');
        var listProcessedLines = [];
        var inOrderedList = false;
        var inUnorderedList = false;
        
        for (var j = 0; j < listLines.length; j++) {
            var listLine = listLines[j];
            
            // Check for ordered list item (number followed by period and space)
            var orderedMatch = listLine.match(/^\d+\.\s+(.+)$/);
            // Check for unordered list item (-, *, or + followed by space)
            var unorderedMatch = listLine.match(/^[-*+]\s+(.+)$/);
            
            if (orderedMatch) {
                if (inUnorderedList) {
                    listProcessedLines.push('</ul>');
                    inUnorderedList = false;
                }
                if (!inOrderedList) {
                    listProcessedLines.push('<ol>');
                    inOrderedList = true;
                }
                listProcessedLines.push('<li>' + orderedMatch[1] + '</li>');
            } else if (unorderedMatch) {
                if (inOrderedList) {
                    listProcessedLines.push('</ol>');
                    inOrderedList = false;
                }
                if (!inUnorderedList) {
                    listProcessedLines.push('<ul>');
                    inUnorderedList = true;
                }
                listProcessedLines.push('<li>' + unorderedMatch[1] + '</li>');
            } else if (listLine.trim() === '') {
                listProcessedLines.push(listLine);
            } else {
                if (inOrderedList) {
                    listProcessedLines.push('</ol>');
                    inOrderedList = false;
                }
                if (inUnorderedList) {
                    listProcessedLines.push('</ul>');
                    inUnorderedList = false;
                }
                listProcessedLines.push(listLine);
            }
        }
        
        // Close any remaining open lists
        if (inOrderedList) {
            listProcessedLines.push('</ol>');
        }
        if (inUnorderedList) {
            listProcessedLines.push('</ul>');
        }
        
        html = listProcessedLines.join('\n');
        
        // Clean up empty paragraphs and fix paragraph wrapping around block elements
        html = html.replace(/<p>\s*<(h[1-6]|ul|ol|li|pre|blockquote)/g, '<$1');
        html = html.replace(/(<\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/g, '$1>');
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
