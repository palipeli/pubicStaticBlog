(function() {
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()){ try{ if(window.__CP_RECOVER) window.__CP_RECOVER(); else if(window.__CP_FAIL) window.__CP_FAIL(); }catch(e){} throw new Error('CP not verified'); } if(window.CP.isDevToolOpened&&window.CP.isDevToolOpened()){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP devtool'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{ if(e.message==='CP not verified'&&window.__CP_RECOVER) window.__CP_RECOVER(); else if(window.__CP_FAIL) window.__CP_FAIL(); }catch(e2){} throw e; }
    const STORAGE_KEY = 'system_warning_consent';
    const SCROLL_THRESHOLD = 10;
    const VOLUME_GAIN = 4.0;
    const AUDIO_LAYERS = 6;
    const phrases = [
        "STOP", "DON'T TOUCH", "NO!", "YAMETEEEEEE!",
        "DAME!", "BAKA!", "ERROR", "FATAL", "FORBIDDEN",
        "ASU", "KYAAAAA!", "ANJING", "BUTO", "BABI", "PUKIMAK", "ANJING",
        "やめて!",
        "触らないで!",
        "ダメ!",
        "うるさい!",
        "警告",
        "エラー",
        "不要!",
        "禁止",
        "错误",
        "停下",
        "住手",
        "別碰"
    ];
    const audioSources = [
        '/media/tracks/intro1.mp3', '/media/tracks/intro2.mp3',
        '/media/tracks/intro3.mp3', '/media/tracks/intro4.mp3'
    ];
    let audioContext = null;
    let audioBuffers = [];
    let isPlaying = false;
    let lastAudioIndex = -1;
    let bypassWarning = false;
    window.addEventListener('click', (e) => {
        if (e.target.closest('a') ||
            e.target.closest('#themeToggle') ||
            e.target.closest('.menu-toggle') ||
            e.target.closest('.theme-btn') ||
            e.target.closest('.nav-item') ||
            e.target.closest('.blue-button') ||
            e.target.closest('.mc-btn') ||
            e.target.closest('.post-selector-item') ||
            e.target.closest('.sidebar-toggle') ||
            e.target.closest('.mobile-tray-toggle') ||
            e.target.closest('.mobile-tray-close') ||
            e.target.closest('.mobile-theme-btn') ||
            e.target.closest('.mobile-nav-item') ||
            e.target.closest('.mobile-post-item') ||
            e.target.closest('#mobile-nav-tray') ||
            e.target.closest('#mobile-tray-overlay') ||
            e.target.closest('.header-right') ||
            e.target.closest('.back-to-intro-btn') ||
            e.target.closest('.blog-card') ||
            e.target.closest('.github-graph-range-btn') ||
            e.target.closest('#jf-player')) {
            bypassWarning = true;
            setTimeout(() => {bypassWarning = false;}, 1000);
        }
    });
    window.addEventListener('beforeunload', (e) => {
        if (!bypassWarning && !window.__devtoolClosing) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    let isAccepted = false;
    let areAssetsLoaded = false;
    let touchStartX = 0;
    let touchStartY = 0;
    const hasPriorConsent = localStorage.getItem(STORAGE_KEY) === 'true';
    const selBlock = document.createElement('style');
    selBlock.textContent = 'body { -webkit-user-select:none; user-select:none; }';
    document.head.appendChild(selBlock);
    try{
        var printWm=document.createElement('div');
        printWm.id='print-watermark';
        printWm.setAttribute('aria-hidden','true');
        var hatch=document.createElement('div');
        hatch.className='print-watermark-hatch';
        printWm.appendChild(hatch);
        document.body.appendChild(printWm);
    }catch(e){}
    const style = document.createElement('style');
    style.innerHTML = `
        #consent-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            background-color: rgba(0, 0, 0, 0.4);
            z-index: 2147483646;
            display: flex; align-items: flex-end; justify-content: center;
            padding-bottom: 50px; opacity: 1; transition: opacity 0.3s ease-out;
        }
        #consent-box {
            background-color: #3a3a3a; color: #fff;
            width: 90%; max-width: 900px;
            border: 4px solid #000;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            display: flex; flex-direction: column;
            font-family: 'VT323', monospace;
            overflow: hidden;
        }
        .consent-content-wrapper {
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
        }
        .consent-text h3 {margin: 0; color: #ff6ec7; font-size: 1.8rem; text-transform: uppercase; text-shadow: 2px 2px 0 #000;}
        .consent-text p {margin: 5px 0 0 0; font-size: 1.1rem; color: #ccc;}
        #loading-status {color: #ff92df; font-weight: bold;}
        .btn-group {display: flex; gap: 10px;}
        .mc-btn {
            background: #000; color: #fff; border: 2px solid #fff;
            padding: 10px 20px; font-family: inherit; font-size: 1.2rem;
            cursor: pointer; text-transform: uppercase;
        }
        .mc-btn:hover:not(:disabled) {background: #fff; color: #000;}
        .mc-btn:disabled {opacity: 0.5; cursor: wait;}
        #warning-flash {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: rgba(242, 0, 255, 1);
            z-index: 2147483647; pointer-events: none; opacity: 0;
            display: flex; justify-content: center; align-items: center;
        }
        #hdr-pre-flash {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: white;
            z-index: 2147483648; pointer-events: none; opacity: 0;
        }
        #warning-text {
            font-family: 'VT323', monospace; font-size: 6rem;
            font-weight: 900; text-transform: uppercase;
            text-shadow: 4px 4px 0px #000;
            animation: shake 0.1s infinite;
        }
        @media (max-width: 600px) {
            .consent-content-wrapper {flex-direction: column; text-align: center;}
            .btn-group {width: 100%; flex-direction: column;}
            .btn-group button {width: 100%;}
        }
        @keyframes shake {
            0% {transform: translate(2px, 2px);}
            100% {transform: translate(-2px, -2px);}
        }
    `;
    document.head.appendChild(style);
    const preFlashOverlay = document.createElement('div');
    preFlashOverlay.id = 'hdr-pre-flash';
    document.body.appendChild(preFlashOverlay);
    const flashOverlay = document.createElement('div');
    flashOverlay.id = 'warning-flash';
    const textSpan = document.createElement('span');
    textSpan.id = 'warning-text';
    flashOverlay.appendChild(textSpan);
    document.body.appendChild(flashOverlay);
    const consentOverlay = document.createElement('div');
    consentOverlay.id = 'consent-overlay';
    if (hasPriorConsent) {
        consentOverlay.style.display = 'none';
        isAccepted = true;
    }
    consentOverlay.innerHTML = `
        <div id="consent-box">
            <div class="consent-content-wrapper">
                <div class="consent-text">
                    <h3>₊˚⊹ᰔ✨ ⚠️FLASHING LIGHTS NOTICE!⚠️</h3>
                    <p>Web contents may be unsuitable for individuals with epileptic photosensitivity and/or loud noises. Agreeing loads resources without data collection (excluding Cloudflare stats). Rejecting displays contents at increased intensity.</p>
                    <p id="loading-status">Loading Assets...</p>
                </div>
                <div class="btn-group">
                    <button id="decline-btn" class="mc-btn" style="color: red; opacity: 1;" disabled>DECLINE</button>
                    <button id="accept-btn" class="mc-btn" disabled>INITIALIZING</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(consentOverlay);
    async function loadAudio(url) {
        if (!audioContext) return null;
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            return await audioContext.decodeAudioData(arrayBuffer);
        } catch (err) {
            console.warn('Failed to load audio:', url, err);
            return null;
        }
    }
    function playSound(buffer) {
        if (!audioContext || !buffer) return;
        for (let i = 0; i < AUDIO_LAYERS; i++) {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            const gainNode = audioContext.createGain();
            gainNode.gain.value = VOLUME_GAIN;
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            source.start(0);
            if (i === AUDIO_LAYERS - 1) {
                source.onended = () => { isPlaying = false; };
            }
        }
    }
    async function initAudio() {
        const acceptBtn = document.getElementById('accept-btn');
        const declineBtn = document.getElementById('decline-btn');
        const loadText = document.getElementById('loading-status');
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (err) {
            console.warn('Web Audio API not available:', err);
        }
        const loadPromises = audioSources.map(src => loadAudio(src));
        const results = await Promise.allSettled(loadPromises);
        audioBuffers = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value);
        areAssetsLoaded = true;
        var cpOk = !!(window.__CP_VERIFIED && window.__CP_ALLOW_LOAD && window.CP && typeof window.CP.isRunning === 'function' && window.CP.isRunning() && !(window.CP.isDevToolOpened && window.CP.isDevToolOpened()));
        if (cpOk && window.__CP_GATE && typeof window.__CP_GATE.isWindowSizeIndicatingDevTools === 'function' && window.__CP_GATE.isWindowSizeIndicatingDevTools()) cpOk = false;
        if (cpOk) {
            loadText.innerText = 'Browser verified \u2713 \u2014 ' + (audioBuffers.length > 0 ? `Assets Loaded. (${audioBuffers.length} tracks)` : 'Assets Loaded.');
            loadText.style.color = '#7cff7c';
            loadText.title = 'CP verification passed — assets decrypted';
        } else {
            loadText.innerText = audioBuffers.length > 0
                ? `Assets Loaded. (${audioBuffers.length} tracks)`
                : "Assets Loaded.";
        }
        window.__WARNING_ASSETS_LOADED = true;
        window.__WARNING_CP_OK = cpOk;
        try { window.dispatchEvent(new CustomEvent('warning:assets-loaded', {detail:{cpOk:cpOk, tracks:audioBuffers.length}})); } catch(e){}
        if (hasPriorConsent && cpOk) {
            try {
                var badge = document.createElement('div');
                badge.id = 'browser-verified-badge';
                badge.textContent = 'Browser verified \u2713';
                badge.setAttribute('role','status');
                badge.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483645;background:rgba(0,0,0,0.78);color:#7cff7c;border:1px solid #7cff7c;padding:6px 10px;font-family:VT323,monospace;font-size:12px;letter-spacing:0.5px;border-radius:4px;opacity:0;transition:opacity 0.35s ease;pointer-events:none;';
                document.body.appendChild(badge);
                requestAnimationFrame(function(){ badge.style.opacity='1'; });
                setTimeout(function(){ badge.style.opacity='0'; setTimeout(function(){ if(badge.parentNode) badge.parentNode.removeChild(badge); }, 400); }, 4200);
            } catch(e){}
        }
        acceptBtn.innerText = "ACCEPT";
        acceptBtn.disabled = false;
        declineBtn.disabled = false;
        acceptBtn.addEventListener('click', async () => {
            if (audioContext && audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            localStorage.setItem(STORAGE_KEY, 'true');
            consentOverlay.style.opacity = '0';
            document.dispatchEvent(new CustomEvent('warning:cleared'));
            setTimeout(() => {
                consentOverlay.style.display = 'none';
                isAccepted = true;
            }, 300);
        });
        declineBtn.addEventListener('click', async () => {
            localStorage.removeItem(STORAGE_KEY);
            acceptBtn.disabled = true;
            declineBtn.disabled = true;
            const intervalId = setInterval(() => {triggerWarning(null, true);}, 100);
            setTimeout(() => {
                clearInterval(intervalId);
                bypassWarning = true;
                location.reload();
            }, 3000);
        });
    }
    async function triggerWarning(e, withSound = false) {
        if (!withSound) {
            if (!isAccepted || !areAssetsLoaded) return;
            if (e && e.target && (
                e.target.closest('#consent-overlay') ||
                e.target.closest('a') ||
                e.target.closest('#themeToggle') ||
                e.target.closest('.menu-toggle') ||
                e.target.closest('.theme-btn') ||
                e.target.closest('.nav-item') ||
                e.target.closest('.blue-button') ||
                e.target.closest('.mc-btn') ||
                e.target.closest('.post-selector-item') ||
                e.target.closest('.sidebar-toggle') ||
                e.target.closest('.mobile-tray-toggle') ||
                e.target.closest('.mobile-tray-close') ||
                e.target.closest('.mobile-theme-btn') ||
                e.target.closest('.mobile-nav-item') ||
                e.target.closest('.mobile-post-item') ||
                e.target.closest('#mobile-nav-tray') ||
                e.target.closest('#mobile-tray-overlay') ||
                e.target.closest('.header-right') ||
                e.target.closest('.back-to-intro-btn') ||
                e.target.closest('.blog-card') ||
                e.target.closest('.github-graph-range-btn') ||
                e.target.closest('#jf-player')
            )) return;
        }
        if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        preFlashOverlay.style.opacity = '1';
        setTimeout(() => {
            textSpan.innerText = phrases[Math.floor(Math.random() * phrases.length)];
            flashOverlay.style.opacity = '1';
            if (withSound) {
                isPlaying = true;
                let newIndex;
                do {
                    newIndex = Math.floor(Math.random() * audioBuffers.length);
                } while (newIndex === lastAudioIndex && audioBuffers.length > 1);
                lastAudioIndex = newIndex;
                if (audioBuffers[newIndex]) {
                    playSound(audioBuffers[newIndex]);
                } else {
                    isPlaying = false;
                }
            }
            setTimeout(() => {flashOverlay.style.opacity = '0';}, 100);
            window.dispatchEvent(new Event('warning:flash'));
        }, 5);
        setTimeout(() => {preFlashOverlay.style.opacity = '0';}, 25);
    }
    initAudio();
    window.addEventListener('keydown', (e) => isAccepted && triggerWarning(e));
    window.addEventListener('mousedown', (e) => isAccepted && triggerWarning(e));
    window.addEventListener('selectstart', (e) => {
        if (!isAccepted) return;
        e.preventDefault();
        window.getSelection().removeAllRanges();
        triggerWarning(e);
        window.dispatchEvent(new Event('denied:flash'));
    });
    window.addEventListener('contextmenu', (e) => {
        if (!isAccepted) return;
        e.preventDefault();
        triggerWarning(e);
        window.dispatchEvent(new Event('denied:flash'));
    });
    window.addEventListener('touchstart', (e) => {
        if(isAccepted && e.touches.length > 0) {
            touchStartX = e.touches[0].screenX;
            touchStartY = e.touches[0].screenY;
        }
    }, {passive: true});
    window.addEventListener('touchend', (e) => {
        if(isAccepted && e.changedTouches.length > 0) {
            const diffX = Math.abs(e.changedTouches[0].screenX - touchStartX);
            const diffY = Math.abs(e.changedTouches[0].screenY - touchStartY);
            if (diffX < SCROLL_THRESHOLD && diffY < SCROLL_THRESHOLD) triggerWarning(e);
        }
    });
})();
