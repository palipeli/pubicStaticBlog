// app.js - Blog Platform Application Logic

// Blog Data
const blogPosts = [
    {
        id: 1,
        title: "Getting Started with Web Development",
        excerpt: "Learn the fundamentals of modern web development including HTML, CSS, and JavaScript. This comprehensive guide will help you build your first website.",
        date: "Dec 15, 2024",
        icon: "🚀",
        category: "Tutorial"
    },
    {
        id: 2,
        title: "Mastering CSS Grid Layout",
        excerpt: "Discover the power of CSS Grid and create complex, responsive layouts with ease. Perfect for modern web design projects.",
        date: "Dec 14, 2024",
        icon: "🎨",
        category: "Design"
    },
    {
        id: 3,
        title: "JavaScript ES6+ Features You Should Know",
        excerpt: "Explore the latest JavaScript features including arrow functions, destructuring, async/await, and more to write cleaner code.",
        date: "Dec 13, 2024",
        icon: "⚡",
        category: "Technology"
    },
    {
        id: 4,
        title: "Building Responsive Designs",
        excerpt: "Learn best practices for creating websites that look great on all devices, from mobile phones to large desktop screens.",
        date: "Dec 12, 2024",
        icon: "📱",
        category: "Design"
    },
    {
        id: 5,
        title: "Introduction to Web Accessibility",
        excerpt: "Make your websites accessible to everyone. Learn about ARIA labels, semantic HTML, and inclusive design principles.",
        date: "Dec 11, 2024",
        icon: "♿",
        category: "Tutorial"
    },
    {
        id: 6,
        title: "Performance Optimization Tips",
        excerpt: "Speed up your website with these proven optimization techniques. Improve loading times and user experience.",
        date: "Dec 10, 2024",
        icon: "🏎️",
        category: "Technology"
    }
];

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

// Render blog cards
function renderBlogCards(containerId, posts) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';

    posts.forEach((post, index) => {
        const card = document.createElement('div');
        card.className = 'blog-card';
        card.style.animationDelay = (index * 0.1) + 's';

        card.innerHTML = `
            <div class="blog-image">${post.icon}</div>
            <div class="blog-content">
                <h3 class="blog-title">${post.title}</h3>
                <p class="blog-excerpt">${post.excerpt}</p>
                <div class="blog-meta">
                    <span class="blog-date">${post.date}</span>
                    <a href="#" class="read-more" onclick="event.preventDefault(); openBlog(${post.id})">Read More →</a>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

// Open blog post (placeholder function)
function openBlog(id) {
    const post = blogPosts.find(p => p.id === id);
    if (post) {
        alert(`Opening blog post: ${post.title}\n\nThis would navigate to the full article page in a production environment.`);
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
    
    // Render blog cards ONLY for the blogs page
    renderBlogCards('blogs-blog-grid', blogPosts);
    
    // Setup navigation
    setupNavigation();
    
    // Setup template selection
    setupTemplates();
});
