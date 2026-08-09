(function() {
    'use strict';

    // The fixed header is translucent so the sidebar and the main content can
    // keep scrolling visibly underneath it. Native scrollbars cannot match that
    // layout: they always span the full height of their scroll container, so no
    // CSS-only offset can stop them from running up behind the header. This
    // module hides the native scrollbars on the two main scroll containers and
    // draws slim custom scrollbars that only span the area below the header.
    //
    // Each custom scrollbar is positioned against the same containing block the
    // scroll container lives in (.main-container for the content area, .sidebar
    // for the sidebar wrapper), so it follows sidebar collapse/expand and window
    // resizing automatically without extra bookkeeping.

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
            thumb.style.top = Math.max(0, ratio * (trackHeight - thumbHeight)) + 'px';
        }

        function onThumbPointerDown(event) {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.preventDefault();
            isDragging = true;
            dragStartY = event.clientY;
            dragStartTop = parseFloat(thumb.style.top) || 0;
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
            thumb.style.top = newTop + 'px';
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
        const sidebar = document.getElementById('sidebar');
        const sidebarWrapper = document.querySelector('.sidebar-content-wrapper');
        if (sidebar && sidebarWrapper) {
            const updateSidebarScrollbar = attachCustomScrollbar(sidebarWrapper, sidebar);
            sidebar.addEventListener('transitionend', updateSidebarScrollbar);
        }
    }

    window.setupCustomScrollbars = setupCustomScrollbars;
})();
