(function () {
    'use strict';

    var TICK_MS = 200;
    var SIZE_GAP = 220;
    var REDIRECT = '/media/tracks/I_see_what_you_doing.webm';
    var fired = false;

    function shut() {
        if (fired) return;
        fired = true;
        window.__devtoolClosing = true;
        try {
            window.opener = null;
            window.open('', '_self');
            window.close();
        } catch (e) { /* ignored */ }
        try {
            location.replace(location.origin + REDIRECT);
        } catch (e) { /* ignored */ }
    }

    function sizeGap() {
        if (window.outerWidth === 0 && window.outerHeight === 0) return false;
        return window.outerWidth - window.innerWidth > SIZE_GAP ||
            window.outerHeight - window.innerHeight > SIZE_GAP;
    }

    function logSpy() {
        try {
            console.log({
                get __console_open__() {
                    shut();
                    return false;
                }
            });
        } catch (e) { /* ignored */ }
    }

    function debuggerDelay() {
        var start = performance.now();
        debugger;
        return performance.now() - start > 100;
    }

    function tick() {
        if (fired) return;
        if (sizeGap()) { shut(); return; }
        logSpy();
        if (debuggerDelay()) shut();
    }

    if (sizeGap() || debuggerDelay()) {
        shut();
        return;
    }
    logSpy();

    document.addEventListener('keydown', function (e) {
        if (fired) return;
        if (e.key === 'F12') { e.preventDefault(); shut(); return; }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            var k = (e.key || '').toLowerCase();
            if (k === 'i' || k === 'j' || k === 'c' || k === 'k' || k === 'u') {
                e.preventDefault();
                shut();
            }
        }
    }, true);

    window.addEventListener('resize', function () {
        if (!fired && sizeGap()) shut();
    });

    setInterval(tick, TICK_MS);
})();
