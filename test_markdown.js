const fs = require('fs');
const markdown = fs.readFileSync('./blog/michelle-dns-for-ios-sideloading.md', 'utf8');

function parseMarkdown(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Code blocks (must be before other replacements)
    // Handle code blocks with optional language specifier
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    // Inline code with triple backticks (must be before single backtick inline code)
    html = html.replace(/```([^`]+)```/g, '<code>$1</code>');
    
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
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
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

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Unordered lists
    html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^(<li>.+<\/li>\n?)+/gm, '<ul>$&</ul>');
    
    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    // Paragraphs (simple approach - wrap remaining text blocks)
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs and fix paragraph wrapping around block elements
    html = html.replace(/<p>\s*<(h[1-6]|ul|ol|li|pre|blockquote)/g, '<$1');
    html = html.replace(/<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/g, '</$1>');
    html = html.replace(/<p><\/p>/g, '');
    
    return html;
}

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

const { frontmatter, content } = parseFrontmatter(markdown);
const html = parseMarkdown(content);

console.log("=== Full HTML output ===");
console.log(html);
