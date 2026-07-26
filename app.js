// app.js - Blog Platform Application Logic

// Global state for blog posts
let blogPosts = [];

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

// Fetch all markdown files from /blog/ using posts.json manifest
async function fetchBlogPosts() {
    try {
        // Fetch the posts.json manifest file
        const response = await fetch('/blog/posts.json');
        if (!response.ok) {
            throw new Error('Could not fetch blog manifest');
        }
        
        const postsMeta = await response.json();
        
        if (postsMeta.length === 0) {
            console.warn('No posts found in manifest');
            return [];
        }
        
        // Fetch each markdown file content
        const posts = await Promise.all(
            postsMeta.map(async (meta) => {
                try {
                    const mdResponse = await fetch(meta.slug);
                    if (!mdResponse.ok) throw new Error('Failed to fetch');
                    
                    const mdContent = await mdResponse.text();
                    const { frontmatter, content } = parseFrontmatter(mdContent);
                    
                    return {
                        id: meta.id,
                        slug: meta.slug,
                        title: frontmatter.title || meta.title || 'Untitled',
                        date: frontmatter.date || meta.date || '',
                        category: frontmatter.category || meta.category || 'Uncategorized',
                        icon: frontmatter.icon || meta.icon || '📄',
                        content: content,
                        htmlContent: parseMarkdown(content)
                    };
                } catch (err) {
                    console.error(`Error fetching ${meta.slug}:`, err);
                    // Return metadata even if content fetch fails
                    return {
                        id: meta.id,
                        slug: meta.slug,
                        title: meta.title || 'Untitled',
                        date: meta.date || '',
                        category: meta.category || 'Uncategorized',
                        icon: meta.icon || '📄',
                        content: '',
                        htmlContent: '<p>Error loading content.</p>'
                    };
                }
            })
        );
        
        // Sort by date
        blogPosts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
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

// Render category filter - REMOVED (categories no longer in sidebar)

// Filter posts by category - REMOVED (categories no longer in sidebar)

// Open a blog post
function openBlogPost(id) {
    const post = blogPosts.find(p => p.id === id);
    if (!post) return;
    
    // Check if we're currently on home or about page, and switch to blogs if so
    const currentPage = document.querySelector('.page-section.active');
    if (currentPage && (currentPage.id === 'home' || currentPage.id === 'about')) {
        // Find and click the blogs nav item to switch to blogs page
        const blogsNavItem = document.querySelector('.nav-item[data-page="blogs"]');
        if (blogsNavItem) {
            blogsNavItem.click();
        }
    }
    
    // Update active state in sidebar
    document.querySelectorAll('.post-selector-item').forEach((item, index) => {
        item.classList.toggle('active', blogPosts[index]?.id === id);
    });
    
    // Hide intro view, show post view
    document.getElementById('blog-intro-view').style.display = 'none';
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

// Show blog introduction (back from post view)
function showBlogIntro() {
    document.getElementById('blog-post-view').style.display = 'none';
    document.getElementById('blog-intro-view').style.display = 'block';
    
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
    const blogSidebarSection = document.getElementById('blog-sidebar-section');

    // Wrap home content in rectangle on initialization
    wrapHomeContentInRectangle();

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
            
            // Show/hide "All Posts" in sidebar on Home, About, and Blogs pages
            if (blogSidebarSection) {
                if (page === 'blogs' || page === 'home' || page === 'about') {
                    blogSidebarSection.style.display = 'block';
                } else {
                    blogSidebarSection.style.display = 'none';
                }
            }
            
            // Scroll to top when changing pages
            window.scrollTo(0, 0);
        });
    });
}

// Wrap home page content in a rectangle container (like blog and about pages)
function wrapHomeContentInRectangle() {
    const homeHero = document.getElementById('home-hero-content');
    if (!homeHero) return;
    
    // Check if already wrapped
    if (homeHero.parentElement.classList.contains('home-layout-container')) {
        return;
    }
    
    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'home-layout-container';
    
    // Insert wrapper before homeHero
    homeHero.parentNode.insertBefore(wrapper, homeHero);
    
    // Move homeHero into wrapper
    wrapper.appendChild(homeHero);
}

// Template selection - now handles theme switching with cookie persistence
function setupTemplates() {
    const themeBtns = document.querySelectorAll('.theme-btn');

    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const theme = btn.dataset.theme;
            applyTheme(theme);
            saveThemePreference(theme);
        });
    });
    
    // Load saved theme on initialization
    const savedTheme = getSavedTheme();
    const savedBtn = document.querySelector(`.theme-btn[data-theme="${savedTheme}"]`);
    if (savedBtn) {
        themeBtns.forEach(b => b.classList.remove('active'));
        savedBtn.classList.add('active');
        applyTheme(savedTheme);
    } else {
        // Default to auto if no button matches
        applyTheme('auto');
    }
}

// Apply different themes
function applyTheme(themeName) {
    const root = document.documentElement;
    
    if (themeName === 'auto') {
        // Auto theme - detect system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
        return;
    } else if (themeName === 'light') {
        // Adwaita Light Theme (GNOME default)
        root.style.setProperty('--bg-dark', '#f6f5f4');
        root.style.setProperty('--bg-panel', 'rgba(255, 255, 255, 0.95)');
        root.style.setProperty('--bg-header', 'rgba(246, 245, 244, 0.95)');
        root.style.setProperty('--accent-blue', '#3584e4');
        root.style.setProperty('--accent-blue-hover', '#1c71d8');
        root.style.setProperty('--text-primary', '#2e3436');
        root.style.setProperty('--text-secondary', '#5e5e5e');
        root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
        document.body.style.background = 'linear-gradient(135deg, #f6f5f4 0%, #ffffff 100%)';
    } else if (themeName === 'dark') {
        // Adwaita Dark Theme (GNOME) - Darker version
        root.style.setProperty('--bg-dark', '#121212');
        root.style.setProperty('--bg-panel', 'rgba(18, 18, 18, 0.9)');
        root.style.setProperty('--bg-header', 'rgba(12, 12, 12, 0.95)');
        root.style.setProperty('--accent-blue', '#3584e4');
        root.style.setProperty('--accent-blue-hover', '#62a0ea');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#9a9a9a');
        root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
        document.body.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)';
    }
}

// Cookie helpers for theme persistence
function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/';
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

// Check if first visit (no cookie set)
function isFirstVisit() {
    return getCookie('theme_preference') === null;
}

// Get saved theme or default to auto
function getSavedTheme() {
    if (isFirstVisit()) {
        return 'auto';
    }
    return getCookie('theme_preference') || 'auto';
}

// Save theme preference
function saveThemePreference(theme) {
    setCookie('theme_preference', theme, 365);
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

// Sidebar toggle functionality
function setupSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContainer = document.querySelector('.main-container');
    
    if (!sidebarToggle || !sidebar || !mainContainer) return;
    
    // Check if we're on mobile/small screen
    function isMobileView() {
        return window.innerWidth <= 768;
    }
    
    // Initialize sidebar state based on screen size
    function initSidebarState() {
        if (isMobileView()) {
            sidebar.classList.add('collapsed');
            sidebar.classList.remove('expanded');
            mainContainer.classList.add('sidebar-collapsed');
            sidebarToggle.setAttribute('aria-label', 'Open Sidebar');
            sidebarToggle.setAttribute('title', 'Open Sidebar');
        } else {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('expanded');
            mainContainer.classList.remove('sidebar-collapsed');
            sidebarToggle.setAttribute('aria-label', 'Collapse Sidebar');
            sidebarToggle.setAttribute('title', 'Collapse Sidebar');
        }
    }
    
    // Call on load
    initSidebarState();
    
    // Toggle sidebar on button click
    sidebarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('collapsed');
        sidebar.classList.toggle('expanded');
        mainContainer.classList.toggle('sidebar-collapsed');
        
        // Update toggle button aria-label and icon direction
        const isCollapsed = sidebar.classList.contains('collapsed');
        sidebarToggle.setAttribute('aria-label', isCollapsed ? 'Open Sidebar' : 'Collapse Sidebar');
        sidebarToggle.setAttribute('title', isCollapsed ? 'Open Sidebar' : 'Collapse Sidebar');
    });
    
    // Handle window resize - sidebar always accessible via button
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // On mobile, auto-collapse for space but button remains visible
            // On desktop, preserve user's choice
            if (isMobileView()) {
                if (!sidebar.classList.contains('collapsed')) {
                    sidebar.classList.add('collapsed');
                    sidebar.classList.remove('expanded');
                    mainContainer.classList.add('sidebar-collapsed');
                    sidebarToggle.setAttribute('aria-label', 'Open Sidebar');
                    sidebarToggle.setAttribute('title', 'Open Sidebar');
                }
            } else {
                // Desktop: only auto-expand if user hasn't manually collapsed it
                if (!sidebar.classList.contains('collapsed') && !sidebar.classList.contains('expanded')) {
                    sidebar.classList.add('expanded');
                    mainContainer.classList.remove('sidebar-collapsed');
                    sidebarToggle.setAttribute('aria-label', 'Collapse Sidebar');
                    sidebarToggle.setAttribute('title', 'Collapse Sidebar');
                }
            }
        }, 200);
    });
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    // Create floating particles
    createParticles();
    
    // Setup navigation
    setupNavigation();
    
    // Setup template selection
    setupTemplates();
    
    // Setup sidebar toggle
    setupSidebarToggle();
    
    // Fetch and render blog posts
    fetchBlogPosts().then(posts => {
        if (posts.length > 0) {
            // Introduction view is already visible by default in HTML
            // Just render the sidebar components
            renderPostSelector(posts);
            // Categories removed from sidebar - no longer rendering
            
            // Render blog buttons on home page (kamikami.eu style)
            renderBlogButtons(posts);
            
            // Show post selector sidebar on Home page by default (since it's the active page on load)
            const blogSidebarSection = document.getElementById('blog-sidebar-section');
            if (blogSidebarSection) {
                blogSidebarSection.style.display = 'block';
            }
        }
    });
});

// Render blog buttons on home page (inspired by kamikami.eu)
function renderBlogButtons(posts) {
    const container = document.getElementById('blog-buttons-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Filter posts to show only Michelle DNS and Privacy Policy on home page
    const homePagePosts = posts.filter(post => 
        post.id === 'michelle-dns-for-ios-sideloading' || 
        post.id === 'privacy-policy'
    );
    
    if (homePagePosts.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    homePagePosts.forEach(post => {
        const categoryClass = post.category ? 'category-' + post.category.toLowerCase().replace(/\s+/g, '-') : '';
        
        const button = document.createElement('a');
        button.className = `blog-btn ${categoryClass}`;
        button.href = '#';
        button.onclick = (e) => {
            e.preventDefault();
            openBlogPostFromHome(post.id);
        };
        
        button.innerHTML = `
            <i class="fa-solid fa-book"></i>
            <span>${post.title}</span>
        `;
        
        container.appendChild(button);
    });
    
    // Add "Send me cat pictures and files!" button (kamikami.eu style)
    const catButton = document.createElement('a');
    catButton.className = 'blog-btn category-fun';
    catButton.href = 'https://cloud.kamikami.eu/s/send-me-cat-pics';
    catButton.target = '_blank';
    catButton.rel = 'noopener noreferrer';
    
    catButton.innerHTML = `
        <i class="fa-solid fa-cat"></i>
        <span>Send me cat pictures and files!</span>
    `;
    
    container.appendChild(catButton);
}

// Open a blog post from home page button
function openBlogPostFromHome(id) {
    // Navigate to blogs page first
    const blogsNavItem = document.querySelector('.nav-item[data-page="blogs"]');
    if (blogsNavItem) {
        blogsNavItem.click();
    }
    
    // Then open the specific post after a short delay
    setTimeout(() => {
        openBlogPost(id);
    }, 100);
}
