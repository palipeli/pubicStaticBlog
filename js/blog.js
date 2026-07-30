


(function() {
    
    window.blogPosts = []; 
    window.blogPostMetadata = []; 
    const blogContentCache = new Map(); 

    
    let blogPosts = window.blogPosts;
    let blogPostMetadata = window.blogPostMetadata;

    
    let blogIntroductionLoaded = false;

    
    let preloadTimeout = null;

    
    async function fetchBlogPostMetadata() {
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

            
            blogPostMetadata = postsMeta.map(meta => ({
                id: meta.id,
                slug: meta.slug,
                title: meta.title || 'Untitled',
                date: meta.date || '',
                category: meta.category || 'Uncategorized',
                icon: meta.icon || '📄',
                _contentLoaded: false 
            }));

            
            blogPostMetadata = blogPostMetadata.sort((a, b) => new Date(b.date) - new Date(a.date));

            
            window.blogPostMetadata = blogPostMetadata;

            return blogPostMetadata;
        } catch (err) {
            console.error('Error fetching blog post metadata:', err);
            return [];
        }
    }

    
    async function loadBlogIntroduction() {
        
        if (blogIntroductionLoaded) return;

        try {
            const response = await fetch('/blog/new-updated-look.md');
            if (!response.ok) {
                throw new Error('Could not fetch blog introduction');
            }

            const mdContent = await response.text();
            const htmlContent = window.parseMarkdown(mdContent);

            const introContainer = document.getElementById('blog-intro-content');
            if (introContainer) {
                introContainer.innerHTML = htmlContent;
                blogIntroductionLoaded = true;

                
                if (typeof window.initializeLazyLoading === 'function') {
                    window.initializeLazyLoading();
                }
            }
        } catch (err) {
            console.error('Error loading blog introduction:', err);
            const introContainer = document.getElementById('blog-intro-content');
            if (introContainer) {
                introContainer.innerHTML = '<p>Failed to load introduction. Please check the README.md for details.</p>';
            }
        }
    }

    
    function prefetchBlogIntroduction() {
        if (!blogIntroductionLoaded) {
            loadBlogIntroduction();
        }
    }

    
    async function loadBlogPostContent(postId) {
        
        if (blogContentCache.has(postId)) {
            return blogContentCache.get(postId);
        }

        
        const meta = blogPostMetadata.find(p => p.id === postId);
        if (!meta) {
            console.error(`Post with id ${postId} not found`);
            return null;
        }

        
        if (meta._contentLoaded && meta.htmlContent) {
            return meta;
        }

        try {
            const mdResponse = await fetch(meta.slug);
            if (!mdResponse.ok) throw new Error('Failed to fetch content');

            const mdContent = await mdResponse.text();
            const { frontmatter, content } = window.parseFrontmatter(mdContent);

            
            meta.title = frontmatter.title || meta.title;
            meta.date = frontmatter.date || meta.date;
            meta.category = frontmatter.category || meta.category;
            meta.icon = frontmatter.icon || meta.icon;
            meta.content = content;
            meta.htmlContent = window.parseMarkdown(content);
            meta._contentLoaded = true;

            
            blogContentCache.set(postId, meta);

            return meta;
        } catch (err) {
            console.error(`Error fetching content for ${meta.slug}:`, err);
            
            meta.content = '';
            meta.htmlContent = '<p>Error loading content.</p>';
            meta._contentLoaded = true;
            blogContentCache.set(postId, meta);
            return meta;
        }
    }

    
    function preloadBlogPostContent(postId) {
        
        if (preloadTimeout) {
            clearTimeout(preloadTimeout);
        }

        
        preloadTimeout = setTimeout(() => {
            
            if (!blogContentCache.has(postId)) {
                loadBlogPostContent(postId).then(post => {
                    if (post) {
                        console.log(`Preloaded content for: ${post.title}`);
                    }
                });
            }
        }, 150); 
    }

    
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
                        <a href="#" class="read-more" onclick="event.preventDefault(); window.openBlogPost('${post.id}')">Read More →</a>
                    </div>
                </div>
            `;

            container.appendChild(card);
        });
    }

    
    function renderPostSelector(posts) {
        const container = document.getElementById('post-selector-list');
        if (!container) return;

        container.innerHTML = '';

        posts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'post-selector-item';
            
            item.setAttribute('data-post-id', post.id);
            
            item.onclick = () => window.openBlogPostLazy(post.id);
            
            item.onmouseenter = () => {
                preloadBlogPostContent(post.id);
            };

            item.innerHTML = `
                <div class="post-selector-title">${post.icon} ${post.title}</div>
                <div class="post-selector-meta">${post.date}</div>
            `;

            container.appendChild(item);
        });
    }

    
    function renderBlogPostSelectorGrid(posts) {
        const container = document.getElementById('blog-post-selector-grid');
        if (!container) return;

        container.innerHTML = '';

        if (posts.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No posts found.</p>';
            return;
        }

        posts.forEach((post, index) => {
            const card = document.createElement('div');
            card.className = 'blog-card';
            card.style.animationDelay = (index * 0.03) + 's';

            card.innerHTML = `
                <div class="blog-image">${post.icon}</div>
                <div class="blog-content">
                    <h3 class="blog-title">${post.title}</h3>
                    <p class="blog-meta">${post.category} • ${post.date}</p>
                </div>
            `;

            
            card.style.cursor = 'pointer';
            card.onclick = () => {
                window.openBlogPostLazy(post.id);
            };

            
            card.onmouseenter = () => {
                preloadBlogPostContent(post.id);
            };

            container.appendChild(card);
        });
    }

    
    function openBlogPost(id) {
        const post = blogPosts.find(p => p.id === id);
        if (!post) return;

        
        const currentPage = document.querySelector('.page-section.active');
        if (currentPage && (currentPage.id === 'home' || currentPage.id === 'about')) {
            
            window.navigateToBlogsPageWithoutPrefetch();
        }

        
        document.querySelectorAll('.post-selector-item').forEach((item, index) => {
            item.classList.toggle('active', blogPosts[index]?.id === id);
        });

        
        document.getElementById('blog-intro-view').style.display = 'none';
        document.getElementById('blog-post-view').style.display = 'block';

        
        const article = document.getElementById('blog-article-content');
        article.innerHTML = `
            <h1>${post.icon} ${post.title}</h1>
            <div class="blog-meta" style="margin-bottom: 20px;">
                <span class="blog-date">${post.date}</span>
                <span style="margin-left: 15px;">${post.category}</span>
            </div>
            <div class="blog-post-content">${post.htmlContent}</div>
        `;

        
        window.scrollTo(0, 0);
    }

    
    const navigationHistory = [];
    
    
    async function openBlogPostLazy(id) {
        
        const article = document.getElementById('blog-article-content');

        
        const currentPage = document.querySelector('.page-section.active');
        let previousPage = null;
        if (currentPage && (currentPage.id === 'home' || currentPage.id === 'about')) {
            
            previousPage = currentPage.id;
            
            window.navigateToBlogsPageWithoutPrefetch();
        } else if (currentPage && currentPage.id === 'blogs') {
            
            const introView = document.getElementById('blog-intro-view');
            if (introView && introView.style.display !== 'none') {
                previousPage = 'blog-intro';
            } else {
                
                const activeItem = document.querySelector('.post-selector-item.active');
                if (activeItem) {
                    previousPage = activeItem.getAttribute('data-post-id');
                } else {
                    previousPage = 'blog-intro';
                }
            }
        }
        
        
        if (previousPage) {
            navigationHistory.push(previousPage);
        }
        
        
        updateBlogIntroBackButton();

        
        document.querySelectorAll('.post-selector-item').forEach((item, index) => {
            item.classList.toggle('active', blogPostMetadata[index]?.id === id);
        });

        
        document.getElementById('blog-intro-view').style.display = 'none';
        document.getElementById('blog-post-view').style.display = 'block';

        
        article.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p class="loading-text">Loading post...</p>
            </div>
        `;

        
        const post = await loadBlogPostContent(id);
        if (!post) {
            article.innerHTML = '<p style="color: var(--text-secondary);">Error loading post.</p>';
            return;
        }

        
        article.innerHTML = `
            <h1>${post.icon} ${post.title}</h1>
            <div class="blog-meta" style="margin-bottom: 20px;">
                <span class="blog-date">${post.date}</span>
                <span style="margin-left: 15px;">${post.category}</span>
            </div>
            <div class="blog-post-content">${post.htmlContent}</div>
        `;

        
        if (typeof window.initializeLazyLoading === 'function') {
            window.initializeLazyLoading();
        }

        
        setTimeout(window.saveAppState, 100);

        
        window.scrollTo(0, 0);
    }
    
    
    function updateBlogIntroBackButton() {
        const backBtn = document.getElementById('blog-intro-back-btn');
        if (backBtn) {
            
            backBtn.style.display = navigationHistory.length > 0 ? 'inline-block' : 'none';
        }
    }
    
    
    function goBackFromBlogIntro() {
        goBack();
    }

    
    function goBack() {
        const article = document.getElementById('blog-article-content');
        const postView = document.getElementById('blog-post-view');
        const introView = document.getElementById('blog-intro-view');
        
        
        const previousState = navigationHistory.pop();
        
        if (!previousState) {
            
            showBlogIntro();
            return;
        }
        
        
        document.querySelectorAll('.post-selector-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (previousState === 'home') {
            
            const homeNavItem = document.querySelector('.nav-item[data-page="home"]');
            if (homeNavItem) {
                homeNavItem.click();
            }
        } else if (previousState === 'about') {
            
            const aboutNavItem = document.querySelector('.nav-item[data-page="about"]');
            if (aboutNavItem) {
                aboutNavItem.click();
            }
        } else if (previousState === 'blog-intro') {
            
            postView.style.display = 'none';
            introView.style.display = 'block';
            renderBlogPostSelectorGrid(blogPostMetadata);
            
            updateBlogIntroBackButton();
        } else {
            
            
            const blogsNavItem = document.querySelector('.nav-item[data-page="blogs"]');
            if (blogsNavItem && !document.querySelector('#blogs.page-section.active')) {
                blogsNavItem.click();
            }
            
            
            introView.style.display = 'none';
            postView.style.display = 'block';
            
            
            loadBlogPostContent(previousState).then(post => {
                if (post) {
                    article.innerHTML = `
                        <h1>${post.icon} ${post.title}</h1>
                        <div class="blog-meta" style="margin-bottom: 20px;">
                            <span class="blog-date">${post.date}</span>
                            <span style="margin-left: 15px;">${post.category}</span>
                        </div>
                        <div class="blog-post-content">${post.htmlContent}</div>
                    `;
                    
                    
                    document.querySelectorAll('.post-selector-item').forEach((item, index) => {
                        item.classList.toggle('active', blogPostMetadata[index]?.id === previousState);
                    });
                    
                    if (typeof window.initializeLazyLoading === 'function') {
                        window.initializeLazyLoading();
                    }
                } else {
                    
                    showBlogIntro();
                }
            });
        }
        
        
        setTimeout(window.saveAppState, 100);
    }

    
    function showBlogIntro() {
        document.getElementById('blog-post-view').style.display = 'none';
        document.getElementById('blog-intro-view').style.display = 'block';

        
        document.querySelectorAll('.post-selector-item').forEach(item => {
            item.classList.remove('active');
        });

        
        renderBlogPostSelectorGrid(blogPostMetadata);

        
        updateBlogIntroBackButton();

        
        setTimeout(window.saveAppState, 100);
    }

    
    window.fetchBlogPostMetadata = fetchBlogPostMetadata;
    window.loadBlogIntroduction = loadBlogIntroduction;
    window.prefetchBlogIntroduction = prefetchBlogIntroduction;
    window.loadBlogPostContent = loadBlogPostContent;
    window.preloadBlogPostContent = preloadBlogPostContent;
    window.renderBlogCards = renderBlogCards;
    window.renderPostSelector = renderPostSelector;
    window.renderBlogPostSelectorGrid = renderBlogPostSelectorGrid;
    window.openBlogPost = openBlogPost;
    window.openBlogPostLazy = openBlogPostLazy;
    window.showBlogIntro = showBlogIntro;
    window.goBack = goBack;
    window.goBackFromBlogIntro = goBackFromBlogIntro;
    window.updateBlogIntroBackButton = updateBlogIntroBackButton;
    window.isBlogIntroductionLoaded = () => blogIntroductionLoaded;
})();
