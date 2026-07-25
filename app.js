/* app.js - Main Application Logic */

document.addEventListener('DOMContentLoaded', () => {
    // Data
    const blogPosts = [
        { id: 1, title: "Getting Started with Blender UI", excerpt: "Learn how to navigate the complex yet powerful interface of Blender 3D.", category: "Tutorial", date: "Oct 12" },
        { id: 2, title: "The Art of Glass Materials", excerpt: "Creating realistic glass and transparency effects in Cycles renderer.", category: "Shading", date: "Oct 10" },
        { id: 3, title: "Lighting Techniques for Interiors", excerpt: "Mastering HDRI and area lights for photorealistic interior renders.", category: "Lighting", date: "Oct 08" },
        { id: 4, title: "Sculpting Organic Shapes", excerpt: "A deep dive into dynamic topology and sculpting brushes.", category: "Sculpting", date: "Oct 05" },
        { id: 5, title: "Node Wrangler Essentials", excerpt: "Speed up your shading workflow with these essential node shortcuts.", category: "Workflow", date: "Oct 01" },
        { id: 6, title: "Geometry Nodes Basics", excerpt: "Introduction to procedural modeling with geometry nodes.", category: "Nodes", date: "Sep 28" }
    ];

    const templates = [
        { id: 'modern', name: 'Modern Grid', icon: '#007aff' },
        { id: 'classic', name: 'Classic List', icon: '#ff9500' },
        { id: 'magazine', name: 'Magazine', icon: '#ff2d55' },
        { id: 'minimal', name: 'Minimal', icon: '#34c759' }
    ];

    // Elements
    const contentArea = document.getElementById('content-area');
    const templateList = document.getElementById('template-list');
    const bigBlueBtn = document.getElementById('big-blue-btn');
    const navItems = document.querySelectorAll('.nav-item');

    // State
    let currentTemplate = 'modern';

    // Render Functions
    function renderBlogGrid(posts) {
        contentArea.innerHTML = '<div class="blog-grid"></div>';
        const grid = contentArea.querySelector('.blog-grid');
        
        posts.forEach((post, index) => {
            const card = document.createElement('div');
            card.className = 'blog-card glass-panel';
            card.style.animationDelay = `${index * 0.05}s`;
            
            card.innerHTML = `
                <div class="blog-title">${post.title}</div>
                <div class="blog-excerpt">${post.excerpt}</div>
                <div class="blog-meta">${post.category} • ${post.date}</div>
            `;
            
            grid.appendChild(card);
        });
    }

    function renderBlogList(posts) {
        contentArea.innerHTML = '<div style="display:flex; flex-direction:column; gap:10px;"></div>';
        const list = contentArea.querySelector('div');
        
        posts.forEach((post, index) => {
            const card = document.createElement('div');
            card.className = 'blog-card glass-panel';
            card.style.animationDelay = `${index * 0.05}s`;
            card.style.flexDirection = 'row';
            card.style.alignItems = 'center';
            card.style.gap = '15px';
            
            card.innerHTML = `
                <div style="flex:1">
                    <div class="blog-title">${post.title}</div>
                    <div class="blog-excerpt" style="-webkit-line-clamp:1">${post.excerpt}</div>
                </div>
                <div class="blog-meta">${post.date}</div>
            `;
            
            list.appendChild(card);
        });
    }

    function renderMagazine(posts) {
        contentArea.innerHTML = '<div style="display:grid; grid-template-columns: 2fr 1fr; gap:15px;"></div>';
        const grid = contentArea.querySelector('div');
        
        // Featured post
        if (posts.length > 0) {
            const featured = posts[0];
            const featuredCard = document.createElement('div');
            featuredCard.className = 'blog-card glass-panel';
            featuredCard.style.gridRow = 'span 2';
            featuredCard.style.background = 'rgba(0, 122, 255, 0.15)';
            featuredCard.innerHTML = `
                <div class="blog-title" style="font-size:18px">${featured.title}</div>
                <div class="blog-excerpt" style="font-size:13px; line-height:1.6">${featured.excerpt}</div>
                <div class="blog-meta">${featured.category} • ${featured.date}</div>
            `;
            grid.appendChild(featuredCard);
        }

        // Other posts
        posts.slice(1).forEach((post, index) => {
            const card = document.createElement('div');
            card.className = 'blog-card glass-panel';
            card.style.animationDelay = `${index * 0.05}s`;
            card.innerHTML = `
                <div class="blog-title">${post.title}</div>
                <div class="blog-excerpt">${post.excerpt}</div>
                <div class="blog-meta">${post.category}</div>
            `;
            grid.appendChild(card);
        });
    }

    function renderMinimal(posts) {
        contentArea.innerHTML = '<div style="display:flex; flex-direction:column; gap:20px; max-width:600px; margin:0 auto;"></div>';
        const list = contentArea.querySelector('div');
        
        posts.forEach((post, index) => {
            const card = document.createElement('div');
            card.className = 'blog-card glass-panel';
            card.style.animationDelay = `${index * 0.05}s`;
            card.style.border = 'none';
            card.style.background = 'transparent';
            card.style.boxShadow = 'none';
            card.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            card.style.borderRadius = '0';
            card.style.padding = '20px 0';
            
            card.innerHTML = `
                <div class="blog-title" style="font-size:16px">${post.title}</div>
                <div class="blog-excerpt" style="font-size:12px; margin-top:5px">${post.excerpt}</div>
                <div class="blog-meta" style="margin-top:10px">${post.date}</div>
            `;
            
            list.appendChild(card);
        });
    }

    function applyTemplate(templateId) {
        currentTemplate = templateId;
        
        // Update active state in sidebar
        document.querySelectorAll('.template-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.template === templateId) {
                item.classList.add('active');
            }
        });

        // Render based on template
        switch(templateId) {
            case 'modern':
                renderBlogGrid(blogPosts);
                break;
            case 'classic':
                renderBlogList(blogPosts);
                break;
            case 'magazine':
                renderMagazine(blogPosts);
                break;
            case 'minimal':
                renderMinimal(blogPosts);
                break;
        }
    }

    // Initialize Sidebar
    function initSidebar() {
        templateList.innerHTML = '';
        templates.forEach(template => {
            const item = document.createElement('div');
            item.className = 'template-item';
            item.dataset.template = template.id;
            item.innerHTML = `
                <div class="icon-box" style="background:${template.icon}"></div>
                <span>${template.name}</span>
            `;
            item.addEventListener('click', () => applyTemplate(template.id));
            templateList.appendChild(item);
        });

        // Set default active
        applyTemplate('modern');
    }

    // Event Listeners
    bigBlueBtn.addEventListener('click', (e) => {
        // Add ripple effect
        bigBlueBtn.classList.add('ripple');
        setTimeout(() => bigBlueBtn.classList.remove('ripple'), 500);
        
        // Random action for fun
        const actions = ["Exploring...", "Rendering...", "Compiling...", "Baking..."];
        const originalText = bigBlueBtn.innerText;
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        
        bigBlueBtn.innerText = randomAction;
        setTimeout(() => {
            bigBlueBtn.innerText = originalText;
        }, 1000);
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Simple page simulation
            const page = item.innerText.toLowerCase();
            if (page === 'home') {
                applyTemplate(currentTemplate);
            } else if (page === 'about') {
                contentArea.innerHTML = `
                    <div class="glass-panel" style="padding:30px; border-radius:10px; animation:fadeIn 0.5s">
                        <h2 style="font-size:20px; margin-bottom:15px">About Blender Blog</h2>
                        <p style="font-size:13px; line-height:1.6; color:var(--text-dim)">
                            A static blogging platform inspired by Blender's UI and Apple's liquid glass design. 
                            Built with pure HTML, CSS, and JavaScript. Features aggressive transparency, 
                            compact controls, and smooth animations.
                        </p>
                    </div>
                `;
            } else if (page === 'blogs') {
                applyTemplate('modern');
            }
        });
    });

    // Initialize
    initSidebar();
});
