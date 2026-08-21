(function () {
    'use strict';

    /* ── Configuration ─────────────────────────────────────────────── */
    var REDIRECT          = '/media/tracks/I_see_what_you_doing.webm';
    var TIME_OUT_URL      = '';
    var INTERVAL          = 200;
    var DISABLE_MENU      = true;
    var DISABLE_SELECT    = true;
    var DISABLE_COPY      = true;
    var DISABLE_CUT       = true;
    var DISABLE_PASTE     = true;
    var CLEAR_LOG         = false;
    var SEO_BOT           = false;

    /* ── State ─────────────────────────────────────────────────────── */
    var fired       = false;
    var devOpen     = false;
    var nativeLog   = console.log;
    var nativeTable = console.table;
    var nativeClear = console.clear;
    var REDIRECT_URL = TIME_OUT_URL || location.origin + REDIRECT;

    /* ── Helpers ───────────────────────────────────────────────────── */
    function isSEOBot() {
        if (!SEO_BOT) return false;
        return /bot|spider|crawl|slurp|mediapartners|AdsBot|Googlebot/i
            .test(navigator.userAgent);
    }

    /* ── MD5 (minimal, for token bypass) ──────────────────────────── */
    function md5(str) {
        function L(k, d) { return (k << d) | (k >>> (32 - d)); }
        function K(G, k) {
            var I, d, F, H, x;
            F = (G & 2147483648); H = (k & 2147483648);
            I = (G & 1073741824); d = (k & 1073741824);
            x = (G & 1073741823) + (k & 1073741823);
            if (I & d) return (x ^ 2147483648 ^ F ^ H);
            if (I | d) return (x & 1073741824) ? (x ^ 3221225472 ^ F ^ H) : (x ^ 1073741824 ^ F ^ H);
            return (x ^ F ^ H);
        }
        function aa(a,b,c,d,x,s,ac){a=K(a,K(K(b&c|~b&d,x),ac));return K(L(a,s),b);}
        function bb(a,b,c,d,x,s,ac){a=K(a,K(K(b&d|c&~d,x),ac));return K(L(a,s),b);}
        function cc(a,b,c,d,x,s,ac){a=K(a,K(K(b^c^d,x),ac));return K(L(a,s),b);}
        function dd(a,b,c,d,x,s,ac){a=K(a,K(K(c^(b|~d),x),ac));return K(L(a,s),b);}
        function ConvertToWordArray(str){
            var lMessageLength=str.length,lNumberOfWords_temp1=lMessageLength+8;
            var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1%64))/64;
            var lNumberOfWords=(lNumberOfWords_temp2+1)*16;
            var lWordArray=Array(lNumberOfWords-1);
            var lBytePosition=0,lByteCount=0,lWordCount=0;
            while(lByteCount<lMessageLength){lWordCount=(lByteCount-(lByteCount%4))/4;lBytePosition=(lByteCount%4)*8;lWordArray[lWordCount]=(lWordArray[lWordCount]|(str.charCodeAt(lByteCount)<<lBytePosition));lByteCount++;}
            lWordCount=(lByteCount-(lByteCount%4))/4;lBytePosition=(lByteCount%4)*8;
            lWordArray[lWordCount]=lWordArray[lWordCount]|(128<<lBytePosition);
            lWordArray[lNumberOfWords-2]=lMessageLength<<3;
            lWordArray[lNumberOfWords-1]=lMessageLength>>>29;
            return lWordArray;
        }
        function WordToHex(lValue){var w='',t='',lByte,lCount;for(lCount=0;lCount<=3;lCount++){lByte=(lValue>>>(lCount*8))&255;t='0'+lByte.toString(16);w=w+t.substr(t.length-2,2);}return w;}
        var x=ConvertToWordArray(str);
        var a=0x67452301,b=0xEFCDAB89,c=0x98BADCFE,d=0x10325476;
        var S11=7,S12=12,S13=17,S14=22,S21=5,S22=9,S23=14,S24=20;
        var S31=4,S32=11,S33=16,S34=23,S41=6,S42=10,S43=15,S44=21;
        var k,AA,BB,CC,DD;
        for(k=0;k<x.length;k+=16){AA=a;BB=b;CC=c;DD=d;
        a=aa(a,b,c,d,x[k+0],S11,0xD76AA478);d=aa(d,a,b,c,x[k+1],S12,0xE8C7B756);
        c=aa(c,d,a,b,x[k+2],S13,0x242070DB);b=aa(b,c,d,a,x[k+3],S14,0xC1BDCEEE);
        a=aa(a,b,c,d,x[k+4],S11,0xF57C0FAF);d=aa(d,a,b,c,x[k+5],S12,0x4787C62A);
        c=aa(c,d,a,b,x[k+6],S13,0xA8304613);b=aa(b,c,d,a,x[k+7],S14,0xFD469501);
        a=aa(a,b,c,d,x[k+8],S11,0x698098D8);d=aa(d,a,b,c,x[k+9],S12,0x8B44F7AF);
        c=aa(c,d,a,b,x[k+10],S13,0xFFFF5BB1);b=aa(b,c,d,a,x[k+11],S14,0x895CD7BE);
        a=aa(a,b,c,d,x[k+12],S11,0x6B901122);d=aa(d,a,b,c,x[k+13],S12,0xFD987193);
        c=aa(c,d,a,b,x[k+14],S13,0xA679438E);b=aa(b,c,d,a,x[k+15],S14,0x49B40821);
        a=bb(a,b,c,d,x[k+1],S21,0xF61E2562);d=bb(d,a,b,c,x[k+6],S22,0xC040B340);
        c=bb(c,d,a,b,x[k+11],S23,0x265E5A51);b=bb(b,c,d,a,x[k+0],S24,0xE9B6C7AA);
        a=bb(a,b,c,d,x[k+5],S21,0xD62F105D);d=bb(d,a,b,c,x[k+10],S22,0x02441453);
        c=bb(c,d,a,b,x[k+15],S23,0xD8A1E681);b=bb(b,c,d,a,x[k+4],S24,0xE7D3FBC8);
        a=bb(a,b,c,d,x[k+9],S21,0x21E1CDE6);d=bb(d,a,b,c,x[k+14],S22,0xC33707D6);
        c=bb(c,d,a,b,x[k+3],S23,0xF4D50D87);b=bb(b,c,d,a,x[k+8],S24,0x455A14ED);
        a=bb(a,b,c,d,x[k+13],S21,0xA9E3E905);d=bb(d,a,b,c,x[k+2],S22,0xFCEFA3F8);
        c=bb(c,d,a,b,x[k+7],S23,0x676F02D9);b=bb(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
        a=cc(a,b,c,d,x[k+5],S31,0xFFFA3942);d=cc(d,a,b,c,x[k+8],S32,0x8771F681);
        c=cc(c,d,a,b,x[k+11],S33,0x6D9D6122);b=cc(b,c,d,a,x[k+14],S34,0xFDE5380C);
        a=cc(a,b,c,d,x[k+1],S31,0xA4BEEA44);d=cc(d,a,b,c,x[k+4],S32,0x4BDECFA9);
        c=cc(c,d,a,b,x[k+7],S33,0xF6BB4B60);b=cc(b,c,d,a,x[k+10],S34,0xBEBFBC70);
        a=cc(a,b,c,d,x[k+13],S31,0x289B7EC6);d=cc(d,a,b,c,x[k+0],S32,0xEAA127FA);
        c=cc(c,d,a,b,x[k+3],S33,0xD4EF3085);b=cc(b,c,d,a,x[k+6],S34,0x04881D05);
        a=cc(a,b,c,d,x[k+9],S31,0xD9D4D039);d=cc(d,a,b,c,x[k+12],S32,0xE6DB99E5);
        c=cc(c,d,a,b,x[k+15],S33,0x1FA27CF8);b=cc(b,c,d,a,x[k+2],S34,0xC4AC5665);
        a=dd(a,b,c,d,x[k+0],S41,0xF4292244);d=dd(d,a,b,c,x[k+7],S42,0x432AFF97);
        c=dd(c,d,a,b,x[k+14],S43,0xAB9423A7);b=dd(b,c,d,a,x[k+5],S44,0xFC93A039);
        a=dd(a,b,c,d,x[k+12],S41,0x655B59C3);d=dd(d,a,b,c,x[k+3],S42,0x8F0CCC92);
        c=dd(c,d,a,b,x[k+10],S43,0xFFEFF47D);b=dd(b,c,d,a,x[k+1],S44,0x85845DD1);
        a=dd(a,b,c,d,x[k+8],S41,0x6FA87E4F);d=dd(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
        c=dd(c,d,a,b,x[k+6],S43,0xA3014314);b=dd(b,c,d,a,x[k+13],S44,0x4E0811A1);
        a=dd(a,b,c,d,x[k+4],S41,0xF7537E82);d=dd(d,a,b,c,x[k+11],S42,0xBD3AF235);
        c=dd(c,d,a,b,x[k+2],S43,0x2AD7D2BB);b=dd(b,c,d,a,x[k+9],S44,0xEB86D391);
        a=K(a,AA);b=K(b,BB);c=K(c,CC);d=K(d,DD);}
        return(WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d)).toLowerCase();
    }

    function getToken(name) {
        var search = window.location.search;
        var hash = window.location.hash;
        if (search === '' && hash !== '') search = '?' + (hash.split('?')[1] || '');
        if (search === undefined || search === '') return '';
        var re = new RegExp('(^|&)' + name + '=([^&]*)(&|$)', 'i');
        var match = search.substr(1).match(re);
        if (match !== null) return decodeURIComponent(match[2]);
        return '';
    }

    /* ── Action on detection (robust) ──────────────────────────────── */
    function trigger() {
        if (fired) return;
        fired = true;
        window.__devtoolClosing = true;
        try {
            location.replace(REDIRECT_URL);
        } catch (e1) {
            try {
                location.href = REDIRECT_URL;
            } catch (e2) {
                window.location = REDIRECT_URL;
            }
        }
    }

    function onDevToolOpen() {
        trigger();
    }

    /* ── Block content interaction ─────────────────────────────────── */
    function blockContextMenu(e) { if (DISABLE_MENU) e.preventDefault(); }
    function blockSelect(e) { if (DISABLE_SELECT) e.preventDefault(); }
    function blockCopy(e) { if (DISABLE_COPY) e.preventDefault(); }
    function blockCut(e) { if (DISABLE_CUT) e.preventDefault(); }
    function blockPaste(e) { if (DISABLE_PASTE) e.preventDefault(); }

    /* ── Detection 1: RegToString ──────────────────────────────────── */
    var regSpyCount = 0;
    var regRegex = null;

    function initRegToString() {
        try {
            var re = new RegExp('debugger');
            Object.defineProperty(re, 'toString', {
                get: function () {
                    regSpyCount++;
                    return function () { return ''; };
                }
            });
            regRegex = re;
        } catch (e) { /* unsupported */ }
    }

    function detectRegToString() {
        if (!regRegex) return;
        regSpyCount = 0;
        try { nativeLog(regRegex); nativeClear(); } catch (e) { /* ignored */ }
        if (regSpyCount >= 2) onDevToolOpen();
    }

    /* ── Detection 2: DefineId (DOM element id getter) ─────────────── */
    var defineIdSpy = 0;
    var defineIdEl = null;

    function initDefineId() {
        try {
            var el = document.createElement('div');
            Object.defineProperty(el, 'id', {
                get: function () {
                    defineIdSpy++;
                    return '';
                }
            });
            defineIdEl = el;
        } catch (e) { /* unsupported */ }
    }

    function detectDefineId() {
        if (!defineIdEl) return;
        defineIdSpy = 0;
        try { nativeLog(defineIdEl); nativeClear(); } catch (e) { /* ignored */ }
        if (defineIdSpy >= 2) onDevToolOpen();
    }

    /* ── Detection 3: Size (DPI-aware) ─────────────────────────────── */
    var sizeRatio = (function () {
        try {
            if (window.screen && window.screen.deviceXDPI && window.screen.logicalXDPI) {
                return window.screen.deviceXDPI / window.screen.logicalXDPI;
            }
        } catch (e) { /* ignored */ }
        return 1;
    })();

    function detectSize() {
        try {
            if (window.outerWidth === 0 && window.outerHeight === 0) return;
            var w = window.outerWidth  - window.innerWidth  * sizeRatio;
            var h = window.outerHeight - window.innerHeight * sizeRatio;
            if (w > 200 || h > 300) onDevToolOpen();
        } catch (e) { /* ignored */ }
    }

    /* ── Detection 4: DateToString ─────────────────────────────────── */
    var dateSpyCount = 0;
    var testDate = null;

    function initDateToString() {
        try {
            testDate = new Date();
            Object.defineProperty(testDate, 'toString', {
                get: function () {
                    dateSpyCount++;
                    return function () { return ''; };
                }
            });
        } catch (e) { /* unsupported */ }
    }

    function detectDateToString() {
        if (!testDate) return;
        dateSpyCount = 0;
        try { nativeLog(testDate); nativeClear(); } catch (e) { /* ignored */ }
        if (dateSpyCount >= 2) onDevToolOpen();
    }

    /* ── Detection 5: FuncToString ─────────────────────────────────── */
    var funcSpyCount = 0;
    var testFunc = null;

    function initFuncToString() {
        try {
            testFunc = function () {};
            Object.defineProperty(testFunc, 'toString', {
                get: function () {
                    funcSpyCount++;
                    return function () { return ''; };
                }
            });
        } catch (e) { /* unsupported */ }
    }

    function detectFuncToString() {
        if (!testFunc) return;
        funcSpyCount = 0;
        try { nativeLog(testFunc); nativeClear(); } catch (e) { /* ignored */ }
        if (funcSpyCount >= 2) onDevToolOpen();
    }

    /* ── Detection 6: Debugger timing (init only — not in tick) ────── */
    function detectDebugger() {
        try {
            var start = performance.now();
            debugger;
            if (performance.now() - start > 100) onDevToolOpen();
        } catch (e) { /* ignored */ }
    }

    /* ── Detection 7: Performance (console.table timing) ───────────── */
    var perfCount = 0;
    var maxTableTime = 0;
    var largeObjArray = null;

    function initPerformance() {
        try {
            largeObjArray = [];
            for (var i = 0; i < 10000; i++) {
                largeObjArray.push({ key: 'item' + i, value: i, flag: true });
            }
        } catch (e) { /* ignored */ }
    }

    function detectPerformance() {
        if (!largeObjArray) return;
        try {
            var start1 = performance.now();
            nativeTable(largeObjArray);
            var tableTime = performance.now() - start1;

            var start2 = performance.now();
            nativeLog(largeObjArray);
            var logTime = performance.now() - start2;

            nativeClear();

            maxTableTime = Math.max(maxTableTime, tableTime);
            if (logTime === 0 || maxTableTime === 0) return;
            if (tableTime > 10 * maxTableTime) {
                if (perfCount >= 2) { onDevToolOpen(); }
                else { perfCount++; detectPerformance(); }
            }
        } catch (e) { /* ignored */ }
    }

    /* ── Detection 8: Console getter trap (lightweight tick check) ──── */
    function detectConsoleGetter() {
        try {
            var count = 0;
            console.log({
                get devtools() {
                    count++;
                    return false;
                }
            });
            nativeClear();
            if (count >= 1) onDevToolOpen();
        } catch (e) { /* ignored */ }
    }

    /* ── Keyboard blocking ─────────────────────────────────────────── */
    function blockKeys(e) {
        if (fired) return;
        var k = (e.key || '').toLowerCase();
        if (k === 'f12') {
            e.preventDefault();
            onDevToolOpen();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            if (k === 'i' || k === 'j' || k === 'c' || k === 'k' || k === 'u') {
                e.preventDefault();
                onDevToolOpen();
                return;
            }
        }
        if ((e.ctrlKey || e.metaKey) && k === 'u') {
            e.preventDefault();
            onDevToolOpen();
            return;
        }
    }

    /* ── Resize listener ───────────────────────────────────────────── */
    function onResize() {
        if (!fired) detectSize();
    }

    /* ── Console clear helper ──────────────────────────────────────── */
    function clearConsole() {
        if (CLEAR_LOG) {
            try { nativeClear(); } catch (e) { /* ignored */ }
        }
    }

    /* ── Tick: lightweight detectors only (no debugger!) ────────────── */
    function tick() {
        if (fired) return;
        clearConsole();
        detectSize();
        detectRegToString();
        detectDefineId();
        detectDateToString();
        detectFuncToString();
        detectConsoleGetter();
    }

    /* ── Initialization ────────────────────────────────────────────── */
    function init() {
        if (isSEOBot()) return;

        initRegToString();
        initDefineId();
        initDateToString();
        initFuncToString();
        initPerformance();

        detectSize();
        detectDebugger();
        detectRegToString();
        detectDefineId();
        detectPerformance();

        document.addEventListener('keydown', blockKeys, true);
        if (DISABLE_MENU)   document.addEventListener('contextmenu', blockContextMenu, true);
        if (DISABLE_SELECT)  document.addEventListener('selectstart', blockSelect, true);
        if (DISABLE_COPY)    document.addEventListener('copy', blockCopy, true);
        if (DISABLE_CUT)     document.addEventListener('cut', blockCut, true);
        if (DISABLE_PASTE)   document.addEventListener('paste', blockPaste, true);
        window.addEventListener('resize', onResize);

        setInterval(tick, INTERVAL);
    }

    /* ── Public API ────────────────────────────────────────────────── */
    window.CP = {
        version:         '2.1.0',
        isRunning:       function () { return !fired; },
        isDevToolOpened: function () { return devOpen; },
        md5:             md5,
        trigger:         trigger
    };

    init();
})();
