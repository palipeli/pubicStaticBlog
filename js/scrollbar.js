(function() {
    'use strict';
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()||(window.CP.isDevToolOpened&&window.CP.isDevToolOpened())){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP not verified'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e2){} throw e; }
    const MIN_THUMB_HEIGHT = 24;
    function createScrollbarElement() {
        const scrollbar = document.createElement('div');
        scrollbar.className = 'custom-scrollbar';
        const track = document.createElement('div');
        track.className = 'custom-scrollbar-track';
        const thumb = document.createElement('div');
        thumb.className = 'custom-scrollbar-thumb';
        track.appendChild(thumb);
        scrollbar.appendChild(track);
        return scrollbar;
    }
    function getThumbHeight(thumb) {
        return parseFloat(thumb.style.height) || MIN_THUMB_HEIGHT;
    }
    function attachCustomScrollbar(scroller, host) {
        const scrollbar = createScrollbarElement();
        host.appendChild(scrollbar);
        const track = scrollbar.querySelector('.custom-scrollbar-track');
        const thumb = scrollbar.querySelector('.custom-scrollbar-thumb');
        let isDragging = false;
        let dragStartY = 0;
        let dragStartTop = 0;
        let thumbOffsetY = 0;
        function setThumbOffset(y) {
            thumbOffsetY = y;
            thumb.style.transform = 'translate3d(0, ' + y + 'px, 0)';
        }
        function updateThumb() {
            const clientHeight = scroller.clientHeight;
            const scrollHeight = scroller.scrollHeight;
            const maxScroll = scrollHeight - clientHeight;
            if (maxScroll <= 1) {
                scrollbar.classList.add('is-idle');
                return;
            }
            scrollbar.classList.remove('is-idle');
            const trackHeight = track.clientHeight;
            const thumbHeight = Math.max(MIN_THUMB_HEIGHT, (clientHeight / scrollHeight) * trackHeight);
            thumb.style.height = thumbHeight + 'px';
            const ratio = scroller.scrollTop / maxScroll;
            setThumbOffset(Math.max(0, ratio * (trackHeight - thumbHeight)));
        }
        function onThumbPointerDown(event) {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.preventDefault();
            isDragging = true;
            dragStartY = event.clientY;
            dragStartTop = thumbOffsetY;
            scrollbar.classList.add('is-dragging');
            if (thumb.setPointerCapture) {
                try {
                    thumb.setPointerCapture(event.pointerId);
                } catch (err) {
                }
            }
        }
        function onThumbPointerMove(event) {
            if (!isDragging) return;
            const trackHeight = track.clientHeight;
            const thumbHeight = getThumbHeight(thumb);
            const maxTop = Math.max(0, trackHeight - thumbHeight);
            const newTop = Math.max(0, Math.min(maxTop, dragStartTop + (event.clientY - dragStartY)));
            setThumbOffset(newTop);
            const maxScroll = scroller.scrollHeight - scroller.clientHeight;
            if (maxScroll > 0 && maxTop > 0) {
                scroller.scrollTop = (newTop / maxTop) * maxScroll;
            }
        }
        function onThumbPointerUp() {
            if (!isDragging) return;
            isDragging = false;
            scrollbar.classList.remove('is-dragging');
        }
        function onTrackClick(event) {
            if (event.target === thumb || event.button !== 0) return;
            const trackRect = track.getBoundingClientRect();
            const trackHeight = trackRect.height;
            const thumbHeight = getThumbHeight(thumb);
            const maxTop = Math.max(0, trackHeight - thumbHeight);
            if (maxTop <= 0) return;
            const targetTop = Math.max(0, Math.min(maxTop, event.clientY - trackRect.top - thumbHeight / 2));
            const maxScroll = scroller.scrollHeight - scroller.clientHeight;
            if (maxScroll > 0) {
                scroller.scrollTop = (targetTop / maxTop) * maxScroll;
            }
            updateThumb();
        }
        scroller.addEventListener('scroll', function(){ requestAnimationFrame(updateThumb); }, {passive:true});
        window.addEventListener('resize', scheduleThumbUpdate);
        if(window.visualViewport) window.visualViewport.addEventListener('resize', scheduleThumbUpdate);
        thumb.addEventListener('pointerdown', onThumbPointerDown);
        thumb.addEventListener('pointermove', onThumbPointerMove);
        thumb.addEventListener('pointerup', onThumbPointerUp);
        thumb.addEventListener('pointercancel', onThumbPointerUp);
        track.addEventListener('click', onTrackClick);
        let thumbUpdateScheduled = false;
        function scheduleThumbUpdate() {
            if (thumbUpdateScheduled) return;
            thumbUpdateScheduled = true;
            requestAnimationFrame(() => {
                thumbUpdateScheduled = false;
                updateThumb();
            });
        }
        document.addEventListener('load', scheduleThumbUpdate, true);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(updateThumb).catch(function(){});
        }
        var observer=new MutationObserver(scheduleThumbUpdate);
        observer.observe(scroller,{childList:true,subtree:true,attributes:false,characterData:false});
        if('ResizeObserver' in window){
            var ro=new ResizeObserver(scheduleThumbUpdate);
            ro.observe(scroller);
            ro.observe(host);
            var grid=document.getElementById('blog-post-selector-grid');
            if(grid) ro.observe(grid);
            var article=document.getElementById('blog-article-content');
            if(article) ro.observe(article);
            document.addEventListener('blog:metadata-loaded', function(){
                var g=document.getElementById('blog-post-selector-grid');
                var a=document.getElementById('blog-article-content');
                try{ if(g) ro.observe(g); }catch(e){}
                try{ if(a) ro.observe(a); }catch(e){}
                scheduleThumbUpdate();
            });
        }
        updateThumb();
        window._updateContentScrollbar=updateThumb;
        return updateThumb;
    }
    function setupCustomScrollbars() {
        try{
            if(typeof CSS!=='undefined' && CSS.supports && CSS.supports('-webkit-touch-callout','none')) return;
            if(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
        }catch(e){}
        const contentArea = document.querySelector('.content-area');
        const mainContainer = document.querySelector('.main-container');
        if (contentArea && mainContainer) {
            const updateContentScrollbar = attachCustomScrollbar(contentArea, mainContainer);
            mainContainer.addEventListener('transitionend', function(e){
                if(e.propertyName==='margin-right') updateContentScrollbar();
            });
            document.addEventListener('sidebar:toggle', function(){ setTimeout(updateContentScrollbar, 350); });
        }
    }
    window.setupCustomScrollbars = setupCustomScrollbars;
})();
