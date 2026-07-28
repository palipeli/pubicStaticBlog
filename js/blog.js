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

    // Flag to track if blog introduction has been loaded
    let blogIntroductionLoaded = false;

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

    // Load blog introduction content from /blog/new-updated-look.md (lazy - called on hover or navigation)
    async function loadBlogIntroduction() {
        // Prevent duplicate loading
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

                // Initialize lazy loading for images in the loaded content
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

    // Prefetch blog introduction on demand (called on hover)
    function prefetchBlogIntroduction() {
        if (!blogIntroductionLoaded) {
            loadBlogIntroduction();
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
                        <a href="#" class="read-more" onclick="event.preventDefault(); window.openBlogPost('${post.id}')">Read More →</a>
                    </div>
                </div>
            `;

            container.appendChild(card);
        });
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
            // Pass the current page ID so we can return to it with the back button
            window.navigateToBlogsPageWithoutPrefetch(currentPage.id);
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

    // Open a blog post with lazy loading (new approach - loads content on demand)
    async function openBlogPostLazy(id) {
        // Show loading state first
        const article = document.getElementById('blog-article-content');

        // Check if we're currently on home or about page, and switch to blogs if so
        const currentPage = document.querySelector('.page-section.active');
        if (currentPage && (currentPage.id === 'home' || currentPage.id === 'about')) {
            // Navigate to blogs page without triggering blog introduction prefetch
            // Pass the current page ID so we can return to it with the back button
            window.navigateToBlogsPageWithoutPrefetch(currentPage.id);
        }

        // Update active state in sidebar
        document.querySelectorAll('.post-selector-item').forEach((item, index) => {
            item.classList.toggle('active', blogPostMetadata[index]?.id === id);
        });

        // Hide intro view, show post view with loading indicator
        document.getElementById('blog-intro-view').style.display = 'none';
        document.getElementById('blog-post-view').style.display = 'block';
        
        // Show back button when viewing a post
        const blogsBackBtn = document.getElementById('blogs-back-btn');
        if (blogsBackBtn) {
            blogsBackBtn.style.display = 'block';
        }

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

        // Render post content with fade-in animation
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

        // Save state after opening a post
        setTimeout(window.saveAppState, 100);

        // Scroll to top
        window.scrollTo(0, 0);
    }

    // Show blog introduction (back from post view) - legacy function for backward compatibility
    function showBlogIntro() {
        document.getElementById('blog-post-view').style.display = 'none';
        document.getElementById('blog-intro-view').style.display = 'block';

        // Hide back button when showing intro
        const blogsBackBtn = document.getElementById('blogs-back-btn');
        if (blogsBackBtn) {
            blogsBackBtn.style.display = 'none';
        }

        // Clear active state
        document.querySelectorAll('.post-selector-item').forEach(item => {
            item.classList.remove('active');
        });

        // Render the blog post selector grid
        renderBlogPostSelectorGrid(blogPostMetadata);

        // Save state after going back to intro
        setTimeout(window.saveAppState, 100);
    }

    // Handle back button click - restore previous state using saved state
    function handleBackButtonClick() {
        // Load the saved state to determine where the user came from
        const savedState = window.loadAppState();
        
        // Get the current page and view state BEFORE clearing anything
        const currentPage = window.getCurrentPage();
        const blogIntroView = document.getElementById('blog-intro-view');
        const blogPostView = document.getElementById('blog-post-view');
        const isViewingPost = blogPostView && blogPostView.style.display !== 'none';
        const isOnBlogIntro = blogIntroView && blogIntroView.style.display !== 'none';
        
        // Check if we have a previous page stored
        // The savedState.previousPage tells us where we should go back to
        if (savedState && savedState.previousPage && savedState.previousPage !== 'blogs') {
            // User came from home or about page directly to a blog post, or navigated to blogs/about
            // Navigate back to that page
            const navItem = document.querySelector(`.nav-item[data-page="${savedState.previousPage}"]`);
            if (navItem) {
                // Clear the previousPage from state since we're navigating away
                try {
                    const STATE_STORAGE_KEY = 'blogPlatformState';
                    delete savedState.previousPage;
                    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(savedState));
                } catch (err) {
                    console.warn('Failed to clear previousPage:', err);
                }
                navItem.click();
                return;
            }
        }
        
        // Default behavior based on current page and view state:
        
        // If on about page, go back to home
        if (currentPage === 'about') {
            const homeNavItem = document.querySelector('.nav-item[data-page="home"]');
            if (homeNavItem) {
                homeNavItem.click();
                return;
            }
        }
        
        // If on blogs page
        if (currentPage === 'blogs') {
            if (isViewingPost) {
                // We're viewing a blog post, go back to blog intro (list of posts)
                showBlogIntro();
                return;
            } else if (isOnBlogIntro) {
                // We're on the blog intro page (list of posts), go back to home
                const homeNavItem = document.querySelector('.nav-item[data-page="home"]');
                if (homeNavItem) {
                    homeNavItem.click();
                    return;
                }
            }
        }
        
        // Fallback: go back to home
        const homeNavItem = document.querySelector('.nav-item[data-page="home"]');
        if (homeNavItem) {
            homeNavItem.click();
        }
    }

    // Expose functions globally
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
    window.handleBackButtonClick = handleBackButtonClick;
    window.isBlogIntroductionLoaded = () => blogIntroductionLoaded;
})();
