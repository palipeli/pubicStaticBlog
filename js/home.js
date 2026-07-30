


(function() {
    
    function renderBlogButtons(posts) {
        const container = document.getElementById('blog-buttons-container');
        if (!container) return;

        container.innerHTML = '';

        
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

        
        const catButton = document.createElement('a');
        catButton.className = 'blog-btn category-fun';
        catButton.href = 'https:
        catButton.target = '_blank';
        catButton.rel = 'noopener noreferrer';

        catButton.innerHTML = `
            <i class="fa-solid fa-cat"></i>
            <span>Send me cat pictures and files!</span>
        `;

        container.appendChild(catButton);

        
        const myBlogButton = document.createElement('a');
        myBlogButton.className = 'blog-btn category-blog-home';
        myBlogButton.href = '#';
        myBlogButton.onclick = (e) => {
            e.preventDefault();
            
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

        
        const monitoringButton = document.createElement('a');
        monitoringButton.className = 'blog-btn category-monitoring';
        monitoringButton.href = 'https:
        monitoringButton.target = '_blank';
        monitoringButton.rel = 'noopener noreferrer';

        monitoringButton.innerHTML = `
            <i class="fa-solid fa-chart-line"></i>
            <span>Monitoring</span>
        `;

        container.appendChild(monitoringButton);
    }

    
    function renderBlogButtonsLazy(posts) {
        const container = document.getElementById('blog-buttons-container');
        if (!container) return;

        container.innerHTML = '';

        
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

        
        const catButton = document.createElement('a');
        catButton.className = 'blog-btn category-fun';
        catButton.href = 'https:
        catButton.target = '_blank';
        catButton.rel = 'noopener noreferrer';

        catButton.innerHTML = `
            <i class="fa-solid fa-cat"></i>
            <span>Send me cat pictures and files!</span>
        `;

        container.appendChild(catButton);

        
        const myBlogButton = document.createElement('a');
        myBlogButton.className = 'blog-btn category-blog-home';
        myBlogButton.href = '#';
        myBlogButton.onclick = (e) => {
            e.preventDefault();
            
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

        
        const monitoringButton = document.createElement('a');
        monitoringButton.className = 'blog-btn category-monitoring';
        monitoringButton.href = 'https:
        monitoringButton.target = '_blank';
        monitoringButton.rel = 'noopener noreferrer';

        monitoringButton.innerHTML = `
            <i class="fa-solid fa-chart-line"></i>
            <span>Monitoring</span>
        `;

        container.appendChild(monitoringButton);
    }

    
    function openBlogPostFromHome(id) {
        
        window.navigateToBlogsPageWithoutPrefetch();

        
        setTimeout(() => {
            window.openBlogPost(id);
        }, 100);
    }

    
    function openBlogPostFromHomeLazy(id) {
        
        window.navigateToBlogsPageWithoutPrefetch();

        
        setTimeout(() => {
            window.openBlogPostLazy(id);
        }, 100);
    }

    
    async function fetchBlogPosts() {
        try {
            
            const response = await fetch('/blog/posts.json');
            if (!response.ok) {
                throw new Error('Could not fetch blog manifest');
            }

            const postsMeta = await response.json();

            if (postsMeta.length === 0) {
                console.warn('No posts found in manifest');
                return [];
            }

            
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

            
            window.blogPosts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));

            return window.blogPosts;
        } catch (err) {
            console.error('Error fetching blog posts:', err);
            return [];
        }
    }

    
    window.renderBlogButtons = renderBlogButtons;
    window.renderBlogButtonsLazy = renderBlogButtonsLazy;
    window.openBlogPostFromHome = openBlogPostFromHome;
    window.openBlogPostFromHomeLazy = openBlogPostFromHomeLazy;
    window.fetchBlogPosts = fetchBlogPosts;
})();
