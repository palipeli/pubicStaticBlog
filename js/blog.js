(function() {

    window.blogPostMetadata = [];
    const blogContentCache = new Map();
    const blogContentInflight = new Map();
    let activeNavigationToken = 0;

    let blogPostMetadata = window.blogPostMetadata;

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

            document.dispatchEvent(new CustomEvent('blog:metadata-loaded', {detail: blogPostMetadata}));

            return blogPostMetadata;
        } catch (err) {
            console.error('Error fetching blog post metadata:', err);
            return [];
        }
    }

    async function loadBlogPostContentInternal(postId) {

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

        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const mdResponse = await fetch(meta.slug);
                if (!mdResponse.ok) throw new Error(`Failed to fetch content: ${mdResponse.status}`);

                const mdContent = await mdResponse.text();
                const {frontmatter, content} = window.parseFrontmatter(mdContent);

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
                lastError = err;
                console.warn(`Attempt ${attempt}/${maxRetries} failed for ${meta.slug}:`, err.message);

                if (attempt < maxRetries) {

                    const delay = 500 * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        console.error(`All retries failed for ${meta.slug}:`, lastError);
        throw lastError;
    }

    function loadBlogPostContent(postId) {
        if (blogContentCache.has(postId)) {
            return Promise.resolve(blogContentCache.get(postId));
        }

        if (blogContentInflight.has(postId)) {
            return blogContentInflight.get(postId);
        }

        const loadPromise = loadBlogPostContentInternal(postId)
            .finally(() => blogContentInflight.delete(postId));
        blogContentInflight.set(postId, loadPromise);
        return loadPromise;
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

    const blogPostFooter = `
        <footer class="home-page-footer">
            <p style="font-size:0.7rem;">What the fuck are you looking at? All the contents are above, but thanks for looking at though!</p>
            <p style="font-size:0.6rem; color:#666;">Idjen Boulevard No.48, Kota Malang 65112, Indonesia.</p>
            <p style="font-size:0.6rem; color:#666;">sel@kamikami.eu.</p>
            <p style="font-size:0.6rem; color:#666;">Copyright © Michelle, 2026</p>
        </footer>
    `;

    function getNextPostId(currentPostId) {
        const currentIndex = blogPostMetadata.findIndex(p => p.id === currentPostId);
        if (currentIndex === -1) return null;

        if (currentIndex + 1 < blogPostMetadata.length) {
            return blogPostMetadata[currentIndex + 1].id;
        }
        return null;
    }

    function getPreviousPostId(currentPostId) {
        const currentIndex = blogPostMetadata.findIndex(p => p.id === currentPostId);
        if (currentIndex === -1) return null;

        if (currentIndex - 1 >= 0) {
            return blogPostMetadata[currentIndex - 1].id;
        }
        return null;
    }

    async function goToNextPost() {
        const activeItem = document.querySelector('.post-selector-item.active');
        if (!activeItem) return;

        const currentPostId = activeItem.getAttribute('data-post-id');
        const nextPostId = getNextPostId(currentPostId);

        if (nextPostId) {

            await window.openBlogPostLazy(nextPostId);
        }
    }

    function preloadNextPostOnHover() {
        const activeItem = document.querySelector('.post-selector-item.active');
        if (!activeItem) return;

        const currentPostId = activeItem.getAttribute('data-post-id');
        const nextPostId = getNextPostId(currentPostId);

        if (nextPostId) {

            window.preloadBlogPostContent(nextPostId);
        }
    }

    async function openBlogPostLazy(id) {
        const navigationToken = ++activeNavigationToken;

        const article = document.getElementById('blog-article-content');

        if (!window.blogPostMetadata || window.blogPostMetadata.length === 0) {
            await waitForBlogMetadata();
        }

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

        document.querySelectorAll('.post-selector-item').forEach((item) => {
            const postId = item.getAttribute('data-post-id');
            item.classList.toggle('active', postId === id);
        });

        document.getElementById('blog-intro-view').style.display = 'none';
        document.getElementById('blog-post-view').style.display = 'block';

        article.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p class="loading-text">Loading post...</p>
            </div>
        `;

        let post;
        try {
            post = await loadBlogPostContent(id);
        } catch (err) {
            if (navigationToken !== activeNavigationToken) return;
            console.error('Error loading blog post:', err);
            article.innerHTML = `
                <div class="error-message">
                    <h2>Error Loading Post</h2>
                    <p>${err.message}</p>
                    <button onclick="window.openBlogPostLazy('${id}')">Retry</button>
                </div>
            `;
            return;
        }

        if (navigationToken !== activeNavigationToken) return;

        if (!post) {
            article.innerHTML = '<p style="color: var(--text-secondary);">Error loading post.</p>';
            return;
        }

        requestAnimationFrame(() => {
            if (navigationToken !== activeNavigationToken) return;
            article.innerHTML = `
                <h1>${post.icon} ${post.title}</h1>
                <div class="blog-meta" style="margin-bottom: 20px;">
                    <span class="blog-date">${post.date}</span>
                    <span style="margin-left: 15px;">${post.category}</span>
                </div>
                <div class="blog-post-content">${post.htmlContent}</div>
                ${blogPostFooter}
            `;

            if (typeof window.initializeLazyLoading === 'function') {
                window.initializeLazyLoading();
            }

            const nextPostBtn = document.getElementById('next-post-btn');
            if (nextPostBtn) {
                const nextPostId = getNextPostId(id);
                nextPostBtn.style.display = nextPostId ? 'inline-block' : 'none';
            }

            const backBtn = document.getElementById('blog-post-view').querySelector('.back-to-intro-btn:not(.next-post-btn)');
            if (backBtn) {
                const previousPostId = getPreviousPostId(id);
                backBtn.style.display = previousPostId ? 'inline-block' : 'none';
            }
        });

        if (typeof window.updateHash === 'function') {
            window.updateHash('', id, true);
        }

        setTimeout(window.saveAppState, 100);

        window.scrollTo(0, 0);
    }

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

    function preloadPreviousPageOnHover() {
        const activeItem = document.querySelector('.post-selector-item.active');
        if (!activeItem) return;

        const currentPostId = activeItem.getAttribute('data-post-id');
        const previousPostId = getPreviousPostId(currentPostId);

        if (previousPostId) {

            window.preloadBlogPostContent(previousPostId);
        }
    }

    function goBack() {
        const article = document.getElementById('blog-article-content');
        const postView = document.getElementById('blog-post-view');
        const introView = document.getElementById('blog-intro-view');

        const activeItem = document.querySelector('.post-selector-item.active');
        if (!activeItem) {

            showBlogIntro();
            return;
        }

        const currentPostId = activeItem.getAttribute('data-post-id');
        const previousPostId = getPreviousPostId(currentPostId);

        if (!previousPostId) {

            showBlogIntro();
            return;
        }

        document.querySelectorAll('.post-selector-item').forEach(item => {
            item.classList.remove('active');
        });

        introView.style.display = 'none';
        postView.style.display = 'block';

        loadBlogPostContent(previousPostId).then(post => {
            if (post) {
                article.innerHTML = `
                    <h1>${post.icon} ${post.title}</h1>
                    <div class="blog-meta" style="margin-bottom: 20px;">
                        <span class="blog-date">${post.date}</span>
                        <span style="margin-left: 15px;">${post.category}</span>
                    </div>
                    <div class="blog-post-content">${post.htmlContent}</div>
                    ${blogPostFooter}
                `;

                document.querySelectorAll('.post-selector-item').forEach((item) => {
                    item.classList.toggle('active', item.getAttribute('data-post-id') === previousPostId);
                });

                if (typeof window.initializeLazyLoading === 'function') {
                    window.initializeLazyLoading();
                }

                const nextPostBtn = document.getElementById('next-post-btn');
                if (nextPostBtn) {
                    const nextPostId = getNextPostId(previousPostId);
                    nextPostBtn.style.display = nextPostId ? 'inline-block' : 'none';
                }

                const backBtn = document.getElementById('blog-post-view').querySelector('.back-to-intro-btn:not(.next-post-btn)');
                if (backBtn) {
                    const prevPostId = getPreviousPostId(previousPostId);
                    backBtn.style.display = prevPostId ? 'inline-block' : 'none';
                }

                if (typeof window.updateHash === 'function') {
                    window.updateHash('', previousPostId, false);
                }
            } else {

                showBlogIntro();
            }
        });

        setTimeout(window.saveAppState, 100);
    }

    function showBlogIntro() {
        document.getElementById('blog-post-view').style.display = 'none';
        document.getElementById('blog-intro-view').style.display = 'block';

        document.querySelectorAll('.post-selector-item').forEach(item => {
            item.classList.remove('active');
        });

        renderBlogPostSelectorGrid(blogPostMetadata);

        if (typeof window.updateHash === 'function') {
            window.updateHash('blogs', null, false);
        }

        setTimeout(window.saveAppState, 100);
    }

    window.fetchBlogPostMetadata = fetchBlogPostMetadata;
    window.preloadBlogPostContent = preloadBlogPostContent;
    window.renderPostSelector = renderPostSelector;
    window.renderBlogPostSelectorGrid = renderBlogPostSelectorGrid;
    window.openBlogPostLazy = openBlogPostLazy;
    window.showBlogIntro = showBlogIntro;
    window.goBack = goBack;
    window.waitForBlogMetadata = waitForBlogMetadata;
    window.goToNextPost = goToNextPost;
    window.preloadNextPostOnHover = preloadNextPostOnHover;
    window.preloadPreviousPageOnHover = preloadPreviousPageOnHover;
})();
