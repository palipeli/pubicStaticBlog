(function() {
    'use strict';
    // The fixed header is translucent so the main content can keep scrolling
    // visibly underneath it. 
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
        // Thumb vertical offset, cached so drag math never has to re-parse
        // the transform string. Positioning via transform (instead of `top`)
        // keeps scroll updates off the layout path entirely.
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
                    // Pointer capture can throw if the pointer was already
                    // released; dragging still works while the pointer stays
                    // over the thumb.
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
        scroller.addEventListener('scroll', updateThumb, {passive: true});
        window.addEventListener('resize', updateThumb);
        thumb.addEventListener('pointerdown', onThumbPointerDown);
        thumb.addEventListener('pointermove', onThumbPointerMove);
        thumb.addEventListener('pointerup', onThumbPointerUp);
        thumb.addEventListener('pointercancel', onThumbPointerUp);
        track.addEventListener('click', onTrackClick);
        // Lazy images swap data-src -> src and fire capture-phase load events;
        // fonts reflow layout when they arrive. Both can change scroll height.
        document.addEventListener('load', updateThumb, true);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(updateThumb).catch(() => {});
        }
        const observer = new MutationObserver(updateThumb);
        observer.observe(scroller, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
        updateThumb();
        return updateThumb;
    }
    function setupCustomScrollbars() {
        const contentArea = document.querySelector('.content-area');
        const mainContainer = document.querySelector('.main-container');
        if (contentArea && mainContainer) {
            const updateContentScrollbar = attachCustomScrollbar(contentArea, mainContainer);
            // Sidebar collapse/expand animates margin-right and can reflow the
            // content width; refresh the thumb when the transition settles.
            mainContainer.addEventListener('transitionend', updateContentScrollbar);
        }
    }
    window.setupCustomScrollbars = setupCustomScrollbars;
})();
