


(function() {
    
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

    
    function parseMarkdown(markdown) {
        if (!markdown) return '';

        let html = markdown;

        
        html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        
        
        html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');

        
        html = html.replace(/```([^`\n]+)```/g, '<code>$1</code>');

        
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');

        
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        
        
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            
            const isMediaFile = src.includes('/media/') || src.endsWith('.webp') || src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg') || src.endsWith('.gif') || src.endsWith('.svg');

            if (isMediaFile) {
                
                return `<img data-src="${src}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP
            } else {
                
                return `<img src="${src}" alt="${alt}" style="max-width: 100%; height: auto;" class="lazy-image" loading="lazy">`;
            }
        });

        
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

        
        html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^(<li>.+<\/li>\n?)+/gm, '<ul>$&</ul>');

        
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

        
        html = html.replace(/\n\n/g, '</p>\n<p>');
        html = '<p>' + html + '</p>';

        
        html = html.replace(/<p>\s*<(h[1-6]|ul|ol|li|pre|blockquote)/g, '<$1');
        html = html.replace(/<(\/h[1-6]|\/ul|\/ol|\/li|\/pre|\/blockquote)>\s*<\/p>/g, '<$1>');
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
                
                value = value.replace(/^["']|["']$/g, '');
                frontmatter[key.trim()] = value;
            }
        });

        return { frontmatter, content: body };
    }

    
    window.parseMarkdown = parseMarkdown;
    window.parseFrontmatter = parseFrontmatter;
    window.blogIntroduction = blogIntroduction;
})();
