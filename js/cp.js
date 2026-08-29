(function () {
    'use strict';
    var REDIRECT          = '/media/tracks/I_see_what_you_doing.webm';
    var TIME_OUT_URL      = '';
    var INTERVAL          = 50;
    var DISABLE_MENU      = true;
    var DISABLE_SELECT    = true;
    var DISABLE_COPY      = true;
    var DISABLE_CUT       = true;
    var DISABLE_PASTE     = true;
    var CLEAR_LOG         = false;
    var SEO_BOT           = false;
    var DETECTORS         = 'all';
    var URL_OVERRIDE      = '';
    var REWRITE_HTML      = '';
    var TOKEN_MD5         = '';
    var TOKEN_NAME        = 'ddtk';
    var STOP_INTERVAL_TIME = 5000;
    var CLEAR_INTERVAL_WHEN_OPEN = false;
    var DISABLE_IFRAME_PARENTS = true;
    var DISABLE_SELECT_INPUT = false;
    var DETECTOR_TYPE = { Unknown: -1, RegToString: 0, DefineId: 1, Size: 2, DateToString: 3, FuncToString: 4, Debugger: 5, Performance: 6, DebugLib: 7 };
    var fired       = false;
    var devOpen     = false;
    var S           = {};
    var wasOpen     = false;
    var nativeLog   = console.log;
    var nativeTable = console.table;
    var nativeClear = console.clear;
    var REDIRECT_URL = URL_OVERRIDE || TIME_OUT_URL || location.origin + REDIRECT;
    var _pause      = false;
    var intervalId  = 0;
    var timeoutId   = 0;
    var timeCount   = 0;
    var detectorCalls = [];
    try {
        var _cfg = window.CPConfig || window.DisableDevtoolConfig || null;
        if (_cfg && typeof _cfg === 'object' && TOKEN_MD5) {
            if (typeof _cfg.md5 === 'string' && _cfg.md5 === TOKEN_MD5) {
            }
        }
        try { window.CPConfig = undefined; window.DisableDevtoolConfig = undefined; } catch (e) {}
    } catch (e) {  }
    function isSEOBot() {
        if (!SEO_BOT) return false;
        return /bot|spider|crawl|slurp|mediapartners|AdsBot|Googlebot/i
            .test(navigator.userAgent);
    }
    var IS = {
        iframe: false, pc: false, qqBrowser: false, firefox: false,
        macos: false, edge: false, oldEdge: false, ie: false,
        iosChrome: false, iosEdge: false, chrome: false, seoBot: false, mobile: false
    };
    function isMobileByUa() {
        return /(iphone|ipad|ipod|ios|android)/i.test(navigator.userAgent.toLowerCase());
    }
    function isMobile() {
        try {
            var platform = navigator.platform;
            var maxTouchPoints = navigator.maxTouchPoints;
            if (typeof maxTouchPoints === 'number') return maxTouchPoints > 1;
            if (typeof platform === 'string') {
                var v = platform.toLowerCase();
                if (/(mac|win)/i.test(v)) return false;
                if (/(android|iphone|ipad|ipod|arch)/i.test(v)) return true;
            }
        } catch (e) {  }
        return isMobileByUa();
    }
    function initIS() {
        var ua = navigator.userAgent.toLowerCase();
        function has(name) { return ua.indexOf(name) !== -1; }
        var mobile = isMobile();
        var iframe = !!window.top && window !== window.top;
        var pc = !mobile;
        var qqBrowser = has('qqbrowser');
        var firefox = has('firefox');
        var macos = has('macintosh');
        var edge = has('edge');
        var oldEdge = edge && !has('chrome');
        var ie = oldEdge || has('trident') || has('msie');
        var iosChrome = has('crios');
        var iosEdge = has('edgios');
        var chrome = has('chrome') || iosChrome;
        var seoBot = !mobile && /(googlebot|baiduspider|bingbot|applebot|petalbot|yandexbot|bytespider|chrome\-lighthouse|moto g power)/i.test(ua);
        IS.iframe = iframe; IS.pc = pc; IS.qqBrowser = qqBrowser; IS.firefox = firefox;
        IS.macos = macos; IS.edge = edge; IS.oldEdge = oldEdge; IS.ie = ie;
        IS.iosChrome = iosChrome; IS.iosEdge = iosEdge; IS.chrome = chrome;
        IS.seoBot = seoBot; IS.mobile = mobile;
    }
    function initLogs() {
        var c = window.console || { log: function () {}, table: function () {}, clear: function () {} };
        if (IS.ie) {
            nativeLog = function () { return c.log.apply(c, arguments); };
            nativeTable = function () { return c.table.apply(c, arguments); };
            nativeClear = function () { return c.clear(); };
        } else {
            nativeLog = c.log.bind(c);
            nativeTable = c.table ? c.table.bind(c) : function () {};
            nativeClear = c.clear ? c.clear.bind(c) : function () {};
        }
    }
    function clearConsole(force) {
        if (CLEAR_LOG || force) {
            try { nativeClear(); } catch (e) {}
        }
    }
    function clearOpenState(type) { S[type] = false; }
    function markOpenState(type) { S[type] = true; devOpen = true; }
    function isDevToolOpened() { for (var k in S) if (S[k]) return true; return false; }
    function checkOnDevClose() {
        var nowOpen = isDevToolOpened();
        if (typeof ONDEVTOOL_CLOSE === 'function' && wasOpen && !nowOpen) {
            try { ONDEVTOOL_CLOSE(); } catch (e) {}
        }
        wasOpen = nowOpen;
        if (!nowOpen) devOpen = false;
    }
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
    function isTokenPassed() {
        if (!TOKEN_MD5) return false;
        var tk = getToken(TOKEN_NAME);
        if (!tk) return false;
        try { return md5(tk) === TOKEN_MD5; } catch (e) { return false; }
    }
    function now() {
        try { return performance.now(); } catch (e) { return (new Date()).getTime(); }
    }
    function calculateTime(fn) { var s = now(); try { fn(); } catch (e) {} return now() - s; }
    function createLargeObject() {
        var o = {};
        for (var i = 0; i < 150; i++) o['' + i] = '' + i;
        return o;
    }
    function createLargeObjectArray() {
        var obj = createLargeObject();
        var arr = [];
        for (var i = 0; i < 20; i++) arr.push(obj);
        return arr;
    }
    function hackAlert(before, after) {
        var _alert = window.alert;
        var _confirm = window.confirm;
        var _prompt = window.prompt;
        function mod(fn) {
            return function () {
                if (before) before();
                var r = fn.apply(window, arguments);
                if (after) after();
                return r;
            };
        }
        try { window.alert = mod(_alert); window.confirm = mod(_confirm); window.prompt = mod(_prompt); } catch (e) {}
    }
    function onPageShowHide(onShow, onHide) {
        var doc = document;
        var hidden, state, visibilityChange;
        if (typeof doc.hidden !== 'undefined') { hidden = 'hidden'; state = 'visibilityState'; visibilityChange = 'visibilitychange'; }
        else if (typeof doc.mozHidden !== 'undefined') { hidden = 'mozHidden'; state = 'mozVisibilityState'; visibilityChange = 'mozvisibilitychange'; }
        else if (typeof doc.msHidden !== 'undefined') { hidden = 'msHidden'; state = 'msVisibilityState'; visibilityChange = 'msvisibilitychange'; }
        else if (typeof doc.webkitHidden !== 'undefined') { hidden = 'webkitHidden'; state = 'webkitVisibilityState'; visibilityChange = 'webkitvisibilitychange'; }
        else return;
        var cb = function () {
            if (doc[state] === hidden) { if (onHide) onHide(); }
            else { if (onShow) onShow(); }
        };
        try { doc.removeEventListener(visibilityChange, cb, false); } catch (e) {}
        doc.addEventListener(visibilityChange, cb, false);
    }
    var ONDEVTOOL_OPEN = null;
    var ONDEVTOOL_CLOSE = null;
    function closeWindowFallback() {
        if (URL_OVERRIDE) {
            try { window.location.href = URL_OVERRIDE; return; } catch (e) {}
        }
        if (REWRITE_HTML) {
            try { document.documentElement.innerHTML = REWRITE_HTML; return; } catch (e) { try { document.documentElement.innerText = REWRITE_HTML; return; } catch (e2) {} }
        }
        try { window.opener = null; window.open('', '_self'); window.close(); window.history.back(); } catch (e) { try { console.log(e); } catch (e2) {} }
        var u = TIME_OUT_URL || URL_OVERRIDE || ('https://theajack.github.io/disable-devtool/404.html?h=' + encodeURIComponent(location.host));
        if (!TIME_OUT_URL && !URL_OVERRIDE) u = REDIRECT_URL;
        try { window.location.href = u; } catch (e) {}
        try { location.replace(u); } catch (e) {}
        try { window.location = u; } catch (e) {}
        try { window.open(u, '_self'); } catch (e) {}
        try { document.documentElement.innerHTML='<meta http-equiv="refresh" content="0;url='+u+'">'; }catch(e){}
    }
    function nukePage() {
        try { window.stop(); } catch (e) {}
        try { document.documentElement.style.display = 'none'; } catch (e) {}
        try { try{ document.open(); document.write(''); document.close(); }catch(e2){} } catch (e) {}
        try { clearConsole(true); } catch (e) {}
    }
    function trigger() {
        if (fired) return;
        fired = true;
        window.__devtoolClosing = true;
        nukePage();
        try { clearInterval(intervalId); } catch (e) {}
        try { clearTimeout(timeoutId); } catch (e) {}
        var u = REDIRECT_URL;
        var _origReplace = window.__CP_ORIG_REPLACE || null;
        var _origHrefSetter = window.__CP_ORIG_HREF_SETTER || null;
        try { if(_origReplace) _origReplace.call(window.location, u); else location.replace(u); } catch (e) { try{ location.replace(u);}catch(e2){} }
        try { if(_origHrefSetter) _origHrefSetter.call(window.location, u); else window.location.href = u; } catch (e) { try{ window.location.href = u; }catch(e2){} }
        try { window.location = u; } catch (e) {}
        try { window.open(u, '_self'); } catch (e) {}
        try { document.documentElement.innerHTML='<meta http-equiv="refresh" content="0;url='+u+'">'; }catch(e){}
    }
    function onDevToolOpen(type) {
        if (fired) return;
        if (typeof type === 'undefined') type = DETECTOR_TYPE.Unknown;
        markOpenState(type);
        if (CLEAR_INTERVAL_WHEN_OPEN) {
            try { clearInterval(intervalId); } catch (e) {}
        }
        try { clearTimeout(timeoutId); } catch (e) {}
        if (typeof ONDEVTOOL_OPEN === 'function') {
            try { ONDEVTOOL_OPEN(type, closeWindowFallback); return; } catch (e) {}
        }
        trigger();
    }
    function preventEvent(e, win) {
        if (window.CP && window.CP.isSuspend) return false;
        win = win || window;
        e = e || win.event;
        if (!e) return false;
        try { e.returnValue = false; } catch (e2) {}
        try { e.preventDefault(); } catch (e2) {}
        return false;
    }
    function blockContextMenu(e) {
        if (!DISABLE_MENU) return;
        if (e.pointerType === 'touch') return;
        e.preventDefault();
    }
    function blockSelect(e) {
        var t = e.target;
        var tag = t && t.tagName;
        var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.getAttribute && t.getAttribute('contenteditable') === 'true');
        if (isInput) {
            if (DISABLE_SELECT_INPUT) e.preventDefault();
            return;
        }
        if (DISABLE_SELECT) e.preventDefault();
    }
    function blockCopy(e) { if (DISABLE_COPY) e.preventDefault(); }
    function blockCut(e) { if (DISABLE_CUT) e.preventDefault(); }
    function blockPaste(e) { if (DISABLE_PASTE) e.preventDefault(); }
    var regLastTime = 0;
    var regRegex = null;
    function initRegToString() {
        try {
            var re = /./;
            re.toString = function () {
                if (IS.qqBrowser) {
                    var cur = now();
                    if (regLastTime && cur - regLastTime < 100) onDevToolOpen(DETECTOR_TYPE.RegToString);
                    else regLastTime = cur;
                } else if (IS.firefox) {
                    onDevToolOpen(DETECTOR_TYPE.RegToString);
                }
                return '';
            };
            regRegex = re;
        } catch (e) {  }
    }
    function detectRegToString() {
        if (fired) return;
        if (!regRegex) return;
        if (!IS.qqBrowser && !IS.firefox) return;
        try { nativeLog(regRegex); } catch (e) {}
        clearConsole(true);
    }
    var defineIdEl = null;
    function initDefineId() {
        try {
            var el = document.createElement('div');
            try { el.__defineGetter__('id', function () { onDevToolOpen(DETECTOR_TYPE.DefineId); }); } catch (e) {}
            Object.defineProperty(el, 'id', {
                get: function () {
                    onDevToolOpen(DETECTOR_TYPE.DefineId);
                    return '';
                },
                configurable: true
            });
            defineIdEl = el;
        } catch (e) {  }
    }
    function detectDefineId() {
        if (fired) return;
        if (!defineIdEl) return;
        try { nativeLog(defineIdEl); } catch (e) {}
        clearConsole(true);
    }
    function getDeviceRatio() {
        try {
            if (window.devicePixelRatio != null) return window.devicePixelRatio;
        } catch (e) {}
        try {
            var s = window.screen;
            if (s && s.deviceXDPI && s.logicalXDPI) return s.deviceXDPI / s.logicalXDPI;
        } catch (e) {}
        return false;
    }
    var sizeCount=0;
    function checkWindowSizeUneven() {
        var ratio = getDeviceRatio();
        if (ratio === false) return true;
        try {
            if (window.outerWidth === 0 && window.outerHeight === 0) {
                sizeCount=0; return true;
            }
            var w = window.outerWidth - window.innerWidth * ratio;
            var h = window.outerHeight - window.innerHeight * ratio;
            if (w > 200 || h > 200) { if(++sizeCount>=2){ onDevToolOpen(DETECTOR_TYPE.Size); return false; } return true; }
            sizeCount=0; clearOpenState(DETECTOR_TYPE.Size);
        } catch (e) {  }
        return true;
    }
    function isWindowSizeIndicatingDevTools() {
        try {
            var ratio = getDeviceRatio();
            if (ratio === false) return false;
            if (window.outerWidth === 0 && window.outerHeight === 0) return false;
            var w = window.outerWidth - window.innerWidth * ratio;
            var h = window.outerHeight - window.innerHeight * ratio;
            return (w > 200 || h > 200);
        } catch (e) { return false; }
    }
    function detectSize() {
        if (fired) return;
        checkWindowSizeUneven();
    }
    function onResize() {
        if (fired) return;
        checkWindowSizeUneven();
    }
    var dateSpyCount = 0;
    var testDate = null;
    function initDateToString() {
        if (IS.iosChrome || IS.iosEdge) return;
        try {
            testDate = new Date();
            var self = { countRef: function () { return dateSpyCount; } };
            Object.defineProperty(testDate, 'toString', {
                get: function () {
                    dateSpyCount++;
                    return function () { return ''; };
                },
                configurable: true
            });
        } catch (e) { testDate = null; }
    }
    function detectDateToString() {
        if (fired) return;
        if (!testDate) return;
        if (IS.iosChrome || IS.iosEdge) return;
        dateSpyCount = 0;
        try { nativeLog(testDate); } catch (e) {}
        clearConsole(true);
        if (dateSpyCount >= 2) onDevToolOpen(DETECTOR_TYPE.DateToString);
    }
    var funcSpyCount = 0;
    var testFunc = null;
    function initFuncToString() {
        if (IS.iosChrome || IS.iosEdge) return;
        try {
            testFunc = function () {};
            Object.defineProperty(testFunc, 'toString', {
                get: function () {
                    funcSpyCount++;
                    return function () { return ''; };
                },
                configurable: true
            });
        } catch (e) { testFunc = null; }
    }
    function detectFuncToString() {
        if (fired) return;
        if (!testFunc) return;
        if (IS.iosChrome || IS.iosEdge) return;
        funcSpyCount = 0;
        try { nativeLog(testFunc); } catch (e) {}
        clearConsole(true);
        if (funcSpyCount >= 2) onDevToolOpen(DETECTOR_TYPE.FuncToString);
    }
    function detectDebugger() {
        if (!IS.iosChrome && !IS.iosEdge) return;
        try {
            var start = now();
            (function () { debugger; })();
            if (now() - start > 100) onDevToolOpen(DETECTOR_TYPE.Debugger);
        } catch (e) {  }
    }
    function detectDebuggerOnce() {
        try {
            var start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : now();
            (function () { debugger; })();
            var end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : now();
            if (end - start > 100) onDevToolOpen(DETECTOR_TYPE.Debugger);
        } catch (e) {}
    }
    var perfCount = 0;
    var maxTableTime = 0;
    var largeObjArray = null;
    var perfTick = 0;
    function initPerformance() {
        if (!IS.chrome && IS.mobile) return;
        try {
            largeObjArray = createLargeObjectArray();
            if (largeObjArray) {
                var t = calculateTime(function () { try { nativeLog(largeObjArray); } catch (e) {} });
                maxTableTime = Math.max(maxTableTime, t);
                clearConsole(true);
            }
        } catch (e) { largeObjArray = null; }
    }
    function detectPerformance() {
        if (fired) return;
        if (!largeObjArray) return;
        if (!IS.chrome && IS.mobile) return;
        perfTick++;
        if (perfTick % 4 !== 0) return;
        try {
            var tableTime = calculateTime(function () { try { nativeTable(largeObjArray); } catch (e) {} });
            var logTime = calculateTime(function () { try { nativeLog(largeObjArray); } catch (e) {} });
            maxTableTime = Math.max(maxTableTime, logTime);
            clearConsole(true);
            if (tableTime === 0 || maxTableTime === 0) return;
            if (tableTime > 8 * maxTableTime && tableTime > 20) {
                perfCount++;
                if (perfCount >= 3) onDevToolOpen(DETECTOR_TYPE.Performance);
            } else {
                perfCount = 0;
            }
        } catch (e) {  }
    }
    function isDebugLibUsing() {
        try {
            if (window.eruda && window.eruda._devTools && window.eruda._devTools._isShow === true) return true;
        } catch (e) {}
        try {
            if (window._vcOrigConsole && document.querySelector('#__vconsole.vc-toggle')) return true;
        } catch (e) {}
        return false;
    }
    function detectDebugLib() {
        if (fired) return;
        if (isDebugLibUsing()) onDevToolOpen(DETECTOR_TYPE.DebugLib);
    }
    function detectConsoleGetter() {
        if (fired) return;
        try {
            var count = 0;
            var obj = {};
            Object.defineProperty(obj, 'devtools', {
                get: function () { count++; return false; },
                configurable: true
            });
            try { nativeLog(obj); } catch (e) {}
            clearConsole(true);
            if (count >= 1) onDevToolOpen(DETECTOR_TYPE.Unknown);
        } catch (e) {  }
    }
    var DetectorMap = {};
    DetectorMap[DETECTOR_TYPE.RegToString] = { type: DETECTOR_TYPE.RegToString, init: initRegToString, detect: detectRegToString, enabled: function () { return IS.qqBrowser || IS.firefox; } };
    DetectorMap[DETECTOR_TYPE.DefineId]    = { type: DETECTOR_TYPE.DefineId,    init: initDefineId,    detect: detectDefineId,    enabled: function () { return true; } };
    DetectorMap[DETECTOR_TYPE.Size]        = { type: DETECTOR_TYPE.Size,        init: function () { checkWindowSizeUneven(); window.addEventListener('resize', onResize, true); }, detect: detectSize, enabled: function () { return !IS.iframe && !IS.edge; } };
    DetectorMap[DETECTOR_TYPE.DateToString]= { type: DETECTOR_TYPE.DateToString,init: initDateToString,detect: detectDateToString,enabled: function () { return !IS.iosChrome && !IS.iosEdge; } };
    DetectorMap[DETECTOR_TYPE.FuncToString]= { type: DETECTOR_TYPE.FuncToString,init: initFuncToString,detect: detectFuncToString,enabled: function () { return !IS.iosChrome && !IS.iosEdge; } };
    DetectorMap[DETECTOR_TYPE.Debugger]    = { type: DETECTOR_TYPE.Debugger,    init: function () {},  detect: detectDebugger,    enabled: function () { return IS.iosChrome || IS.iosEdge; } };
    DetectorMap[DETECTOR_TYPE.Performance] = { type: DETECTOR_TYPE.Performance, init: initPerformance, detect: detectPerformance, enabled: function () { return IS.chrome || !IS.mobile; } };
    DetectorMap[DETECTOR_TYPE.DebugLib]    = { type: DETECTOR_TYPE.DebugLib,    init: function () {},  detect: detectDebugLib,    enabled: function () { return true; } };
    function isDetectorEnabled(type) {
        if (DETECTORS === 'all') return true;
        if (Array.isArray(DETECTORS)) return DETECTORS.indexOf(type) !== -1;
        return true;
    }
    function initDetectors() {
        var list = DETECTORS === 'all' ? Object.keys(DetectorMap) : DETECTORS;
        for (var i = 0; i < list.length; i++) {
            var t = parseInt(list[i], 10);
            var d = DetectorMap[t];
            if (!d) continue;
            if (d.enabled && !d.enabled()) continue;
            if (!isDetectorEnabled(t)) continue;
            try { d.init(); } catch (e) {}
            detectorCalls.push(d);
        }
        detectorCalls.push({ type: DETECTOR_TYPE.Unknown, detect: detectConsoleGetter });
    }
    function blockKeys(e) {
        if (fired) return;
        if (window.CP && window.CP.isSuspend) return;
        e = e || window.event;
        var keyCode = e.keyCode || e.which;
        var key = (e.key || '').toLowerCase();
        if (keyCode === 123 || key === 'f12') {
            preventEvent(e);
            onDevToolOpen(DETECTOR_TYPE.Unknown);
            return;
        }
        var isMac = IS.macos;
        var ctrlShift = isMac ? (e.metaKey && e.altKey) : (e.ctrlKey && e.shiftKey);
        var ctrlAltUorS = isMac ? (e.metaKey && e.altKey && (key === 'u' || keyCode === 85) || e.metaKey && (key === 's' || keyCode === 83)) : (e.ctrlKey && (key === 'u' || key === 's' || keyCode === 85 || keyCode === 83));
        if (ctrlShift) {
            if (keyCode === 73 || keyCode === 74 || key === 'i' || key === 'j' || key === 'c' || key === 'k') {
                preventEvent(e);
                onDevToolOpen(DETECTOR_TYPE.Unknown);
                return;
            }
        }
        if (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c' || key === 'k' || key === 'u')) {
            preventEvent(e);
            onDevToolOpen(DETECTOR_TYPE.Unknown);
            return;
        }
        if (isMac && e.metaKey && e.altKey && (key === 'i' || key === 'j')) {
            preventEvent(e);
            onDevToolOpen(DETECTOR_TYPE.Unknown);
            return;
        }
        if (ctrlAltUorS) {
            preventEvent(e);
            onDevToolOpen(DETECTOR_TYPE.Unknown);
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'u' || keyCode === 85)) {
            preventEvent(e);
            onDevToolOpen(DETECTOR_TYPE.Unknown);
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (key === 'u' || keyCode === 85)) {
            preventEvent(e);
            onDevToolOpen(DETECTOR_TYPE.Unknown);
            return;
        }
    }
    function disableKeyAndMenuForWindow(win) {
        try {
            win.addEventListener('keydown', blockKeys, true);
            if (DISABLE_MENU) win.addEventListener('contextmenu', function (e) {
                if (e.pointerType === 'touch') return;
                if (DISABLE_MENU) { e.preventDefault(); }
            }, true);
            if (DISABLE_SELECT || DISABLE_SELECT_INPUT) win.addEventListener('selectstart', blockSelect, true);
            if (DISABLE_COPY) win.addEventListener('copy', blockCopy, true);
            if (DISABLE_CUT) win.addEventListener('cut', blockCut, true);
            if (DISABLE_PASTE) win.addEventListener('paste', blockPaste, true);
        } catch (e) {}
    }
    function tick() {
        if (fired) return;
        if (window.CP && window.CP.isSuspend) return;
        if (_pause) return;
        for (var i = 0; i < detectorCalls.length; i++) {
            if (fired) break;
            var d = detectorCalls[i];
            if (typeof d.type !== 'undefined') clearOpenState(d.type);
            try { d.detect(timeCount); } catch (e) {}
            if (fired) break;
        }
        clearConsole(true);
        checkOnDevClose();
        timeCount++;
    }
    function setupIntervals() {
        hackAlert(function () { _pause = true; }, function () { _pause = false; });
        onPageShowHide(function () { _pause = false; }, function () { _pause = true; });
        intervalId = setInterval(tick, INTERVAL);
        timeoutId = setTimeout(function () {
            if (!IS.pc && !isDebugLibUsing()) {
                try { clearInterval(intervalId); } catch (e) {}
            }
        }, STOP_INTERVAL_TIME);
    }
    function clearDDInterval() { try { clearInterval(intervalId); } catch (e) {} }
    function clearDDTimeout() { try { clearTimeout(timeoutId); } catch (e) {} }
    function init() {
        initIS();
        initLogs();
        if (isTokenPassed()) return;
        if (isSEOBot()) return;
        if (IS.seoBot && SEO_BOT) return;
        if (typeof ONDEVTOOL_CLOSE === 'function' && CLEAR_INTERVAL_WHEN_OPEN) {
            CLEAR_INTERVAL_WHEN_OPEN = false;
            try { console.warn('[cp] clearIntervalWhenDevOpenTrigger disabled when ondevtoolclose is set'); } catch (e) {}
        }
        initDetectors();
        try { checkWindowSizeUneven(); } catch (e) {}
        for (var i = 0; i < detectorCalls.length; i++) {
            var d = detectorCalls[i];
            if (d.type === DETECTOR_TYPE.Performance) continue;
            try { d.detect(0); } catch (e) {}
            if (fired) break;
        }
        clearConsole(true);
        disableKeyAndMenuForWindow(window);
        if (DISABLE_IFRAME_PARENTS) {
            try {
                var topWin = window.top;
                var parentWin = window.parent;
                if (topWin && parentWin && topWin !== window) {
                    var cur = parentWin;
                    while (cur !== topWin) {
                        disableKeyAndMenuForWindow(cur);
                        cur = cur.parent;
                    }
                    disableKeyAndMenuForWindow(topWin);
                }
            } catch (e) {  }
        }
        setupIntervals();
    }
    var _suspend = false;
    window.CP = {
        version:         '2.3.1-foolproof',
        isRunning:       function () { return !fired; },
        isDevToolOpened: function () { return isDevToolOpened() || devOpen; },
        isWindowSizeIndicatingDevTools: isWindowSizeIndicatingDevTools,
        md5:             md5,
        trigger:         trigger,
        closeWindow:     closeWindowFallback,
        DetectorType:    DETECTOR_TYPE,
        _IS:             IS,
        _clearInterval:  clearDDInterval
    };
    Object.defineProperty(window.CP, 'isSuspend', {
        get: function(){ return _suspend; },
        set: function(v){  if(window.__CP_ALLOW_SUSPEND) _suspend = !!v; },
        enumerable: true,
        configurable: false
    });
    window.DisableDevtool = window.CP;
    Object.defineProperty(window.CP, 'ondevtoolopen', {
        get: function () { return ONDEVTOOL_OPEN; },
        set: function (v) { if (typeof v === 'function' && ONDEVTOOL_OPEN===null) ONDEVTOOL_OPEN = v; },
        configurable: false, enumerable: true
    });
    Object.defineProperty(window.CP, 'ondevtoolclose', {
        get: function () { return ONDEVTOOL_CLOSE; },
        set: function (v) { if (typeof v === 'function' && ONDEVTOOL_CLOSE===null) ONDEVTOOL_CLOSE = v; },
        configurable: false, enumerable: true
    });
    try { Object.freeze(window.CP.DetectorType); } catch(e){}
    window.__CP_GATE = {
        isWindowSizeIndicatingDevTools: isWindowSizeIndicatingDevTools,
        checkSizeNow: function(){ return checkWindowSizeUneven(); }
    };
    init();
    try {
        if (!fired && !isDevToolOpened() && !isWindowSizeIndicatingDevTools()) {
            window.__CP_VERIFIED = true;
            window.__CP_ALLOW_LOAD = true;
        } else if (!fired) {
            if (isWindowSizeIndicatingDevTools() || isDevToolOpened()) {
                trigger();
            }
        }
    } catch(e){}
    try { Object.freeze(window.CP); } catch(e){}
    try { Object.freeze(window.CP._IS); } catch(e){}
    try { Object.freeze(window.__CP_GATE); } catch(e){}
})();
