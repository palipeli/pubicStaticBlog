(function() {
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()||(window.CP.isDevToolOpened&&window.CP.isDevToolOpened())){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP not verified'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e2){} throw e; }
    var escapeHtml=window.escapeHtml||function(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;'); };
    let pendingPostOpenTimer = null;
    let pendingPostOpenId = null;
    const homePageFooter = `
        <footer>
            <p style="font-size:0.7rem;">What the fuck are you looking at? All the contents are above, but thanks for looking at though!</p>
            <p style="font-size:0.6rem; color:#666;">Idjen Boulevard No.48, Kota Malang 65112, Indonesia.</p>
            <p style="font-size:0.6rem; color:#666;">sel@kamikami.eu.</p>
            <p style="font-size:0.6rem; color:#666;">Copyright © Michelle, 2026</p>
        </footer>
    `;
    function appendHomePageFooter() {
        const homeHero = document.getElementById('home-hero-content');
        if (!homeHero || homeHero.querySelector('.home-page-footer')) return;
        const footer = document.createElement('div');
        footer.innerHTML = homePageFooter;
        footer.firstElementChild.className = 'home-page-footer';
        homeHero.appendChild(footer.firstElementChild);
    }
    appendHomePageFooter();
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
                <span>${escapeHtml(post.title)}</span>
            `;
            container.appendChild(button);
        });
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
        monitoringButton.href = 'https://stats.kamikami.eu/status/one';
        monitoringButton.target = '_blank';
        monitoringButton.rel = 'noopener noreferrer';
        monitoringButton.innerHTML = `
            <i class="fa-solid fa-chart-line"></i>
            <span>Monitoring</span>
        `;
        container.appendChild(monitoringButton);
    }
    function openBlogPostFromHomeLazy(id) {
        if (pendingPostOpenId === id && pendingPostOpenTimer) return;
        if (pendingPostOpenTimer) {
            clearTimeout(pendingPostOpenTimer);
        }
        pendingPostOpenId = id;
        window.navigateToBlogsPageWithoutPrefetch();
        pendingPostOpenTimer = setTimeout(() => {
            pendingPostOpenTimer = null;
            pendingPostOpenId = null;
            window.openBlogPostLazy(id);
        }, 100);
    }
    window.renderBlogButtonsLazy = renderBlogButtonsLazy;
    window.openBlogPostFromHomeLazy = openBlogPostFromHomeLazy;
})();
