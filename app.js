// app.js - Blog Platform Application Logic

// Global state for blog posts
let blogPosts = [];
let currentCategory = 'all';

// Simple Markdown parser
function parseMarkdown(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Code blocks (must be before other replacements)
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    // Inline code
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

// Fetch all markdown files from /blog/
async function fetchBlogPosts() {
    try {
        // Fetch the index of blog files
        const response = await fetch('/blog/');
        if (!response.ok) {
            throw new Error('Could not fetch blog directory');
        }
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract links to .md files
        const links = Array.from(doc.querySelectorAll('a[href$=".md"]'))
            .map(a => a.getAttribute('href'));
        
        if (links.length === 0) {
            console.warn('No markdown files found in /blog/');
            return [];
        }
        
        // Fetch each markdown file
        const posts = await Promise.all(
            links.map(async (href) => {
                try {
                    const mdResponse = await fetch(href);
                    if (!mdResponse.ok) throw new Error('Failed to fetch');
                    
                    const mdContent = await mdResponse.text();
                    const { frontmatter, content } = parseFrontmatter(mdContent);
                    
                    return {
                        id: href.replace('.md', '').replace('/blog/', ''),
                        slug: href,
                        title: frontmatter.title || 'Untitled',
                        date: frontmatter.date || '',
                        category: frontmatter.category || 'Uncategorized',
                        icon: frontmatter.icon || '📄',
                        content: content,
                        htmlContent: parseMarkdown(content)
                    };
                } catch (err) {
                    console.error(`Error fetching ${href}:`, err);
                    return null;
                }
            })
        );
        
        // Filter out failed fetches and sort by date
        blogPosts = posts
            .filter(post => post !== null)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return blogPosts;
    } catch (err) {
        console.error('Error fetching blog posts:', err);
        return [];
    }
}

// Render blog cards in the main content area
function renderBlogCards(posts) {
    const container = document.getElementById('blog-posts-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (posts.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No posts found.</p>';
        return;
    }
    
    posts.forEach((post, index) => {
        const card = document.createElement('div');
        card.className = 'blog-card';
        card.style.animationDelay = (index * 0.1) + 's';
        
        card.innerHTML = `
            <div class="blog-image">${post.icon}</div>
            <div class="blog-content">
                <h3 class="blog-title">${post.title}</h3>
                <p class="blog-excerpt">${post.content.substring(0, 150)}...</p>
                <div class="blog-meta">
                    <span class="blog-date">${post.date}</span>
                    <a href="#" class="read-more" onclick="event.preventDefault(); openBlogPost('${post.id}')">Read More →</a>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Render post selector in sidebar
function renderPostSelector(posts) {
    const container = document.getElementById('post-selector-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    posts.forEach(post => {
        const item = document.createElement('div');
        item.className = 'post-selector-item';
        item.onclick = () => openBlogPost(post.id);
        
        item.innerHTML = `
            <div class="post-selector-title">${post.icon} ${post.title}</div>
            <div class="post-selector-meta">${post.date}</div>
        `;
        
        container.appendChild(item);
    });
}

// Render category filter
function renderCategories(posts) {
    const container = document.getElementById('category-filter');
    if (!container) return;
    
    // Count posts per category
    const categories = {};
    posts.forEach(post => {
        const cat = post.category;
        categories[cat] = (categories[cat] || 0) + 1;
    });
    
    container.innerHTML = '';
    
    // All categories option
    const allItem = document.createElement('div');
    allItem.className = 'category-item active';
    allItem.dataset.category = 'all';
    allItem.innerHTML = `
        <span>All Posts</span>
        <span class="category-count">${posts.length}</span>
    `;
    allItem.onclick = () => filterByCategory('all');
    container.appendChild(allItem);
    
    // Individual categories
    Object.entries(categories).forEach(([cat, count]) => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.dataset.category = cat;
        item.innerHTML = `
            <span>${cat}</span>
            <span class="category-count">${count}</span>
        `;
        item.onclick = () => filterByCategory(cat);
        container.appendChild(item);
    });
}

// Filter posts by category
function filterByCategory(category) {
    currentCategory = category;
    
    // Update active state
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.toggle('active', item.dataset.category === category);
    });
    
    // Filter and re-render
    const filtered = category === 'all' 
        ? blogPosts 
        : blogPosts.filter(post => post.category === category);
    
    renderBlogCards(filtered);
}

// Open a blog post
function openBlogPost(id) {
    const post = blogPosts.find(p => p.id === id);
    if (!post) return;
    
    // Update active state in sidebar
    document.querySelectorAll('.post-selector-item').forEach((item, index) => {
        item.classList.toggle('active', blogPosts[index]?.id === id);
    });
    
    // Show post view, hide list
    document.getElementById('blog-posts-list').style.display = 'none';
    document.getElementById('blog-post-view').style.display = 'block';
    
    // Render post content
    const article = document.getElementById('blog-article-content');
    article.innerHTML = `
        <h1>${post.icon} ${post.title}</h1>
        <div class="blog-meta" style="margin-bottom: 20px;">
            <span class="blog-date">${post.date}</span>
            <span style="margin-left: 15px;">${post.category}</span>
        </div>
        <div class="blog-post-content">${post.htmlContent}</div>
    `;
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Show blog list (back from post view)
function showBlogList() {
    document.getElementById('blog-posts-list').style.display = 'grid';
    document.getElementById('blog-post-view').style.display = 'none';
    
    // Clear active state
    document.querySelectorAll('.post-selector-item').forEach(item => {
        item.classList.remove('active');
    });
}

// Initialize particles
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        container.appendChild(particle);
    }
}

// Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.page-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show corresponding section
            const page = item.dataset.page;
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === page) {
                    section.classList.add('active');
                }
            });
            
            // Scroll to top when changing pages
            window.scrollTo(0, 0);
        });
    });
}

// Template selection - now handles theme switching
function setupTemplates() {
    const themeBtns = document.querySelectorAll('.theme-btn');

    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const theme = btn.dataset.theme;
            applyTheme(theme);
        });
    });
}

// Apply different themes
function applyTheme(themeName) {
    const root = document.documentElement;
    
    if (themeName === 'blender') {
        // Blender Dark Theme
        root.style.setProperty('--bg-dark', '#1d1d1d');
        root.style.setProperty('--bg-panel', 'rgba(40, 40, 40, 0.85)');
        root.style.setProperty('--bg-header', 'rgba(30, 30, 30, 0.9)');
        root.style.setProperty('--accent-blue', '#4772b3');
        root.style.setProperty('--accent-blue-hover', '#5a8fd9');
        root.style.setProperty('--text-primary', '#e6e6e6');
        root.style.setProperty('--text-secondary', '#a0a0a0');
        root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.1)');
        document.body.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)';
    } else if (themeName === 'adwaita') {
        // Adwaita Dark Theme (GNOME)
        root.style.setProperty('--bg-dark', '#1e1e1e');
        root.style.setProperty('--bg-panel', 'rgba(30, 30, 30, 0.9)');
        root.style.setProperty('--bg-header', 'rgba(24, 24, 24, 0.95)');
        root.style.setProperty('--accent-blue', '#3584e4');
        root.style.setProperty('--accent-blue-hover', '#62a0ea');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#9a9a9a');
        root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
        document.body.style.background = 'linear-gradient(135deg, #242424 0%, #1a1a1a 100%)';
    }
}

// Click me button handler
function handleClickMe() {
    const button = document.querySelector('.blue-button');
    if (!button) return;
    
    button.style.animation = 'pulse 0.3s ease';

    setTimeout(() => {
        button.style.animation = '';
    }, 300);

    // Create ripple effect
    const ripple = document.createElement('div');
    ripple.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 10px;
        height: 10px;
        background: rgba(71, 114, 179, 0.6);
        border-radius: 50%;
        animation: rippleEffect 0.6s ease-out forwards;
        pointer-events: none;
        z-index: 9999;
    `;

    document.body.appendChild(ripple);

    setTimeout(() => {
        ripple.remove();
    }, 600);

    // Show friendly message
    alert('🎉 Thanks for clicking! Explore the blogs using the navigation menu above.');
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    // Create floating particles
    createParticles();
    
    // Setup navigation
    setupNavigation();
    
    // Setup template selection
    setupTemplates();
    
    // Fetch and render blog posts
    fetchBlogPosts().then(posts => {
        if (posts.length > 0) {
            renderBlogCards(posts);
            renderPostSelector(posts);
            renderCategories(posts);
        }
    });
});
