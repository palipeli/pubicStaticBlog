// home.js - Home Page Blog Buttons and Legacy Functions
// Handles rendering of blog buttons on home page and legacy blog post functions

(function() {
    // Render blog buttons on home page (inspired by kamikami.eu) - legacy version
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
                window.openBlogPostFromHome(post.id);
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

        // Add "My Blog" button - opens blog introduction page/blog post selector
        const myBlogButton = document.createElement('a');
        myBlogButton.className = 'blog-btn category-blog-home';
        myBlogButton.href = '#';
        myBlogButton.onclick = (e) => {
            e.preventDefault();
            // Navigate to blogs page to show blog post selector
            const navItem = document.querySelector('.nav-item[data-page="blogs"]');
            if (navItem) {
                navItem.click();
            }
        };

        myBlogButton.innerHTML = `
            <i class="fa-solid fa-rss"></i>
            <span>My Blog</span>
        `;

        container.appendChild(myBlogButton);

        // Add "Monitoring" button - redirects to stats.kamikami.eu/status/one
        const monitoringButton = document.createElement('a');
        monitoringButton.className = 'blog-btn category-monitoring';
        monitoringButton.href = 'https://stats.kamikami.eu/status/one';
        monitoringButton.target = '_blank';
        monitoringButton.rel = 'noopener noreferrer';

        monitoringButton.innerHTML = `
            <i class="fa-solid fa-chart-line"></i>
            <span>Monitoring</span>
        `;

        container.appendChild(monitoringButton);
    }

    // Render blog buttons on home page with lazy loading support (new version)
    function renderBlogButtonsLazy(posts) {
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
            // Only prefetch the specific post content on hover (not the blog introduction)
            button.onmouseenter = () => {
                window.preloadBlogPostContent(post.id);
            };
            button.onclick = (e) => {
                e.preventDefault();
                window.openBlogPostFromHomeLazy(post.id);
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

        // Add "My Blog" button - opens blog introduction page/blog post selector
        const myBlogButton = document.createElement('a');
        myBlogButton.className = 'blog-btn category-blog-home';
        myBlogButton.href = '#';
        myBlogButton.onclick = (e) => {
            e.preventDefault();
            // Navigate to blogs page to show blog post selector
            const navItem = document.querySelector('.nav-item[data-page="blogs"]');
            if (navItem) {
                navItem.click();
            }
        };

        myBlogButton.innerHTML = `
            <i class="fa-solid fa-rss"></i>
            <span>My Blog</span>
        `;

        container.appendChild(myBlogButton);

        // Add "Monitoring" button - redirects to stats.kamikami.eu/status/one
        const monitoringButton = document.createElement('a');
        monitoringButton.className = 'blog-btn category-monitoring';
        monitoringButton.href = 'https://stats.kamikami.eu/status/one';
        monitoringButton.target = '_blank';
        monitoringButton.rel = 'noopener noreferrer';

        monitoringButton.innerHTML = `
            <i class="fa-solid fa-chart-line"></i>
            <span>Monitoring</span>
        `;

        container.appendChild(monitoringButton);
    }

    // Open a blog post from home page button (legacy)
    function openBlogPostFromHome(id) {
        // Navigate to blogs page first without triggering prefetch
        window.navigateToBlogsPageWithoutPrefetch();

        // Then open the specific post after a short delay
        setTimeout(() => {
            window.openBlogPost(id);
        }, 100);
    }

    // Open a blog post from home page button with lazy loading (new)
    function openBlogPostFromHomeLazy(id) {
        // Navigate to blogs page first without triggering prefetch
        window.navigateToBlogsPageWithoutPrefetch();

        // Then open the specific post with lazy loading after a short delay (skipNavigation=true since nav already handled)
        setTimeout(() => {
            window.openBlogPostLazy(id, true);
        }, 100);
    }

    // Fetch all markdown files from /blog/ using posts.json manifest (legacy - loads all content immediately)
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
                        const { frontmatter, content } = window.parseFrontmatter(mdContent);

                        return {
                            id: meta.id,
                            slug: meta.slug,
                            title: frontmatter.title || meta.title || 'Untitled',
                            date: frontmatter.date || meta.date || '',
                            category: frontmatter.category || meta.category || 'Uncategorized',
                            icon: frontmatter.icon || meta.icon || '📄',
                            content: content,
                            htmlContent: window.parseMarkdown(content)
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
            window.blogPosts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));

            return window.blogPosts;
        } catch (err) {
            console.error('Error fetching blog posts:', err);
            return [];
        }
    }

    // Expose functions globally
    window.renderBlogButtons = renderBlogButtons;
    window.renderBlogButtonsLazy = renderBlogButtonsLazy;
    window.openBlogPostFromHome = openBlogPostFromHome;
    window.openBlogPostFromHomeLazy = openBlogPostFromHomeLazy;
    window.fetchBlogPosts = fetchBlogPosts;
})();
