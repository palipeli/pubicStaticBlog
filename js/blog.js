// blog.js - Blog Post Management and Rendering
// Handles fetching, caching, lazy loading, and rendering of blog posts

(function() {
    // Global state for blog posts - exposed on window for cross-module access
    window.blogPosts = []; // Full posts with content (lazy-loaded)
    window.blogPostMetadata = []; // Metadata only (loaded initially)
    const blogContentCache = new Map(); // Cache for loaded blog content

    // Shorthand references for cleaner code
    let blogPosts = window.blogPosts;
    let blogPostMetadata = window.blogPostMetadata;

    // Preload timeout for debouncing
    let preloadTimeout = null;

    // Fetch only blog post metadata from /blog/ using posts.json manifest (lazy load content)
    async function fetchBlogPostMetadata() {
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

            // Store only metadata (no content fetched yet)
            blogPostMetadata = postsMeta.map(meta => ({
                id: meta.id,
                slug: meta.slug,
                title: meta.title || 'Untitled',
                date: meta.date || '',
                category: meta.category || 'Uncategorized',
                icon: meta.icon || '📄',
                _contentLoaded: false // Flag to track if content has been loaded
            }));

            // Sort by date
            blogPostMetadata = blogPostMetadata.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Sync with window object for cross-module access
            window.blogPostMetadata = blogPostMetadata;

            return blogPostMetadata;
        } catch (err) {
            console.error('Error fetching blog post metadata:', err);
            return [];
        }
    }

    // Lazy load a single blog post's content on demand
    async function loadBlogPostContent(postId) {
        // Check if already loaded in cache
        if (blogContentCache.has(postId)) {
            return blogContentCache.get(postId);
        }

        // Find the post metadata
        const meta = blogPostMetadata.find(p => p.id === postId);
        if (!meta) {
            console.error(`Post with id ${postId} not found`);
            return null;
        }

        // Check if content already loaded in the post object
        if (meta._contentLoaded && meta.htmlContent) {
            return meta;
        }

        try {
            const mdResponse = await fetch(meta.slug);
            if (!mdResponse.ok) throw new Error('Failed to fetch content');

            const mdContent = await mdResponse.text();
            const { frontmatter, content } = window.parseFrontmatter(mdContent);

            // Update metadata with full content
            meta.title = frontmatter.title || meta.title;
            meta.date = frontmatter.date || meta.date;
            meta.category = frontmatter.category || meta.category;
            meta.icon = frontmatter.icon || meta.icon;
            meta.content = content;
            meta.htmlContent = window.parseMarkdown(content);
            meta._contentLoaded = true;

            // Cache the loaded post
            blogContentCache.set(postId, meta);

            return meta;
        } catch (err) {
            console.error(`Error fetching content for ${meta.slug}:`, err);
            // Return metadata with error state
            meta.content = '';
            meta.htmlContent = '<p>Error loading content.</p>';
            meta._contentLoaded = true;
            blogContentCache.set(postId, meta);
            return meta;
        }
    }

    // Preload content for posts near the cursor (hover optimization)
    function preloadBlogPostContent(postId) {
        // Clear any existing preload timeout
        if (preloadTimeout) {
            clearTimeout(preloadTimeout);
        }

        // Debounce preload to avoid excessive requests during rapid hover
        preloadTimeout = setTimeout(() => {
            // Only preload if not already loaded
            if (!blogContentCache.has(postId)) {
                loadBlogPostContent(postId).then(post => {
                    if (post) {
                        console.log(`Preloaded content for: ${post.title}`);
                    }
                });
            }
        }, 150); // 150ms delay before preloading on hover
    }

    // Render post selector in sidebar (with lazy loading and hover preload)
    function renderPostSelector(posts) {
        const container = document.getElementById('post-selector-list');
        if (!container) return;

        container.innerHTML = '';

        posts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'post-selector-item';
            // Add data attribute for state persistence
            item.setAttribute('data-post-id', post.id);
            // Use metadata-only approach: load content on click, preload on hover
            item.onclick = () => window.openBlogPostLazy(post.id);
            // Only prefetch the specific post content on hover (not the blog introduction)
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

    // Render blog post selector grid in main content area
    function renderBlogPostSelectorGrid(posts) {
        const container = document.getElementById('blog-post-selector-grid');
        if (!container) return;

        // Signature guard
        if (typeof posts === 'undefined' || !Array.isArray(posts)) return;

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

            // Make entire card clickable
            card.style.cursor = 'pointer';
            card.onclick = () => {
                window.openBlogPostLazy(post.id);
            };

            // Prefetch on hover
            card.onmouseenter = () => {
                preloadBlogPostContent(post.id);
            };

            container.appendChild(card);
        });
    }

    // Open a blog post (legacy - uses pre-loaded posts)
    function openBlogPost(id) {
        const post = blogPosts.find(p => p.id === id);
        if (!post) return;

        // Check if we're currently on home or about page, and switch to blogs if so
        const currentPage = document.querySelector('.page-section.active');
        if (currentPage && (currentPage.id === 'home' || currentPage.id === 'about')) {
            // Navigate to blogs page without triggering prefetch
            window.navigateToBlogsPageWithoutPrefetch();
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

    // Track navigation history for back button
    const navigationHistory = [];
    
    // Open a blog post with lazy loading (new approach - loads content on demand)
    async function openBlogPostLazy(id) {
        // Show loading state first
        const article = document.getElementById('blog-article-content');

        // Wait for metadata to be loaded first (critical for refresh scenario)
        if (!window.blogPostMetadata || window.blogPostMetadata.length === 0) {
            await waitForBlogMetadata();
        }

        // Check if we're currently on home or about page, and switch to blogs if so
        const currentPage = document.querySelector('.page-section.active');
        let previousPage = null;
        if (currentPage && (currentPage.id === 'home' || currentPage.id === 'about')) {
            // Save the previous page before navigating to blogs
            previousPage = currentPage.id;
            // Navigate to blogs page without triggering blog introduction prefetch
            window.navigateToBlogsPageWithoutPrefetch();
        } else if (currentPage && currentPage.id === 'blogs') {
            // Check if we're in intro view or post view
            const introView = document.getElementById('blog-intro-view');
            if (introView && introView.style.display !== 'none') {
                previousPage = 'blog-intro';
            } else {
                // Already viewing a post, save current post ID
                const activeItem = document.querySelector('.post-selector-item.active');
                if (activeItem) {
                    previousPage = activeItem.getAttribute('data-post-id');
                } else {
                    previousPage = 'blog-intro';
                }
            }
        }
        
        // Push previous state to navigation history
        if (previousPage) {
            navigationHistory.push(previousPage);
        }
        
        // Update the visibility of back button on blog intro based on history
        updateBlogIntroBackButton();

        // Update active state in sidebar (use window.blogPostMetadata to ensure we have latest data)
        document.querySelectorAll('.post-selector-item').forEach((item) => {
            const postId = item.getAttribute('data-post-id');
            item.classList.toggle('active', postId === id);
        });

        // Hide intro view, show post view with loading indicator
        document.getElementById('blog-intro-view').style.display = 'none';
        document.getElementById('blog-post-view').style.display = 'block';

        // Show enhanced loading state with spinner
        article.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p class="loading-text">Loading post...</p>
            </div>
        `;

        // Load the post content (will use cache if already loaded)
        const post = await loadBlogPostContent(id);
        if (!post) {
            article.innerHTML = '<p style="color: var(--text-secondary);">Error loading post.</p>';
            return;
        }

        // Render post content with fade-in animation (keep loading state visible until render completes)
        requestAnimationFrame(() => {
            article.innerHTML = `
                <h1>${post.icon} ${post.title}</h1>
                <div class="blog-meta" style="margin-bottom: 20px;">
                    <span class="blog-date">${post.date}</span>
                    <span style="margin-left: 15px;">${post.category}</span>
                </div>
                <div class="blog-post-content">${post.htmlContent}</div>
            `;

            // Initialize lazy loading for images in the rendered content
            if (typeof window.initializeLazyLoading === 'function') {
                window.initializeLazyLoading();
            }
        });

        // Save state after opening a post
        setTimeout(window.saveAppState, 100);

        // Scroll to top
        window.scrollTo(0, 0);
    }
    
    // Helper function to wait for blog metadata to be loaded
    function waitForBlogMetadata() {
        return new Promise((resolve) => {
            const checkMetadata = () => {
                if (window.blogPostMetadata && window.blogPostMetadata.length > 0) {
                    resolve();
                } else {
                    setTimeout(checkMetadata, 100);
                }
            };
            checkMetadata();
        });
    }
    
    // Update the visibility of the back button on blog intro page
    function updateBlogIntroBackButton() {
        const backBtn = document.getElementById('blog-intro-back-btn');
        if (backBtn) {
            // Show back button only if there's navigation history
            backBtn.style.display = navigationHistory.length > 0 ? 'inline-block' : 'none';
        }
    }
    
    // Go back from blog intro page
    function goBackFromBlogIntro() {
        goBack();
    }

    // Go back to previous page using navigation history
    function goBack() {
        const article = document.getElementById('blog-article-content');
        const postView = document.getElementById('blog-post-view');
        const introView = document.getElementById('blog-intro-view');
        
        // Pop the last state from navigation history
        const previousState = navigationHistory.pop();
        
        if (!previousState) {
            // No history, default to blog intro
            showBlogIntro();
            return;
        }
        
        // Clear active state
        document.querySelectorAll('.post-selector-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (previousState === 'home') {
            // Navigate back to home page
            const homeNavItem = document.querySelector('.nav-item[data-page="home"]');
            if (homeNavItem) {
                homeNavItem.click();
            }
        } else if (previousState === 'about') {
            // Navigate back to about page
            const aboutNavItem = document.querySelector('.nav-item[data-page="about"]');
            if (aboutNavItem) {
                aboutNavItem.click();
            }
        } else if (previousState === 'blog-intro') {
            // Show blog introduction/grid
            postView.style.display = 'none';
            introView.style.display = 'block';
            renderBlogPostSelectorGrid(blogPostMetadata);
            // Update back button visibility after returning to intro
            updateBlogIntroBackButton();
        } else {
            // Previous state is a post ID - navigate to that post
            // First ensure we're on blogs page
            const blogsNavItem = document.querySelector('.nav-item[data-page="blogs"]');
            if (blogsNavItem && !document.querySelector('#blogs.page-section.active')) {
                blogsNavItem.click();
            }
            
            // Show post view and load the previous post
            introView.style.display = 'none';
            postView.style.display = 'block';
            
            // Load and render the previous post
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
                    
                    // Update active state in sidebar
                    document.querySelectorAll('.post-selector-item').forEach((item, index) => {
                        item.classList.toggle('active', blogPostMetadata[index]?.id === previousState);
                    });
                    
                    if (typeof window.initializeLazyLoading === 'function') {
                        window.initializeLazyLoading();
                    }
                } else {
                    // Failed to load post, show intro instead
                    showBlogIntro();
                }
            });
        }
        
        // Save state after going back
        setTimeout(window.saveAppState, 100);
    }

    // Show blog introduction (back from post view) - legacy function kept for compatibility
    function showBlogIntro() {
        document.getElementById('blog-post-view').style.display = 'none';
        document.getElementById('blog-intro-view').style.display = 'block';

        // Clear active state
        document.querySelectorAll('.post-selector-item').forEach(item => {
            item.classList.remove('active');
        });

        // Render the blog post selector grid
        renderBlogPostSelectorGrid(blogPostMetadata);

        // Update back button visibility
        updateBlogIntroBackButton();

        // Save state after going back to intro
        setTimeout(window.saveAppState, 100);
    }

    // Expose functions globally
    window.fetchBlogPostMetadata = fetchBlogPostMetadata;
    window.loadBlogIntroduction = loadBlogIntroduction;
    window.prefetchBlogIntroduction = prefetchBlogIntroduction;
    window.loadBlogPostContent = loadBlogPostContent;
    window.preloadBlogPostContent = preloadBlogPostContent;
    window.renderPostSelector = renderPostSelector;
    window.renderBlogPostSelectorGrid = renderBlogPostSelectorGrid;
    window.openBlogPost = openBlogPost;
    window.openBlogPostLazy = openBlogPostLazy;
    window.showBlogIntro = showBlogIntro;
    window.goBack = goBack;
    window.goBackFromBlogIntro = goBackFromBlogIntro;
    window.updateBlogIntroBackButton = updateBlogIntroBackButton;
    window.isBlogIntroductionLoaded = () => blogIntroductionLoaded;
    window.waitForBlogMetadata = waitForBlogMetadata;
})();
