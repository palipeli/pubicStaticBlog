(function() {
    'use strict';
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()){ try{ if(window.__CP_RECOVER) window.__CP_RECOVER(); else if(window.__CP_FAIL) window.__CP_FAIL(); }catch(e){} throw new Error('CP not verified'); } if(window.CP.isDevToolOpened&&window.CP.isDevToolOpened()){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP devtool'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{ if(e.message==='CP not verified'&&window.__CP_RECOVER) window.__CP_RECOVER(); else if(window.__CP_FAIL) window.__CP_FAIL(); }catch(e2){} throw e; }
    const API_BASE = '/api/jellyfin';
    const PREFS_KEY = 'jellyfin_player_prefs';
    const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
    const KANA_RE = /[\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff]/;
    const audio = new Audio();
    const _isSafari = (function(){ try{ const ua=navigator.userAgent||''; return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Android/.test(ua); }catch(e){return false;}})();
    audio.preload = _isSafari ? 'auto' : 'metadata';
    try { audio.playsInline = true; audio.setAttribute('webkit-playsinline','true'); } catch(e) {}
    let userId = '';
    let tracks = [];
    let queue = [];
    let queuePos = -1;
    let shuffle = false;
    let repeat = 'off';
    let volume = 0.8;
    let expanded = false;
    let searchTimer = null;
    let searchToken = 0;
    let serverStart = 0;
    let lastAdvanceAt = 0;
    let root = null;
    let blobUrl = null;
    let blobFetchAbort = null;
    let blobFetchTimeout = null;
    let blobFetchPos = null;
    let isScrubbing = false;
    const TRACK_END_THRESHOLD = 1.2;
    function prefs() {
        try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (e) { return {}; }
    }
    function savePrefs() {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify({ shuffle: shuffle, repeat: repeat, volume: volume, expanded: expanded })); } catch (e) {}
    }
    function api(path, params) {
        const qs = params ? '?' + params.toString() : '';
        return fetch(API_BASE + '/' + path + qs, { cache: 'default' }).then(function(r) {
            if (!r.ok) throw new Error('jellyfin ' + r.status);
            return r.json();
        });
    }
    function streamUrl(id, startTicks) {
        return API_BASE + '/Audio/' + id + '/stream' + (startTicks > 0 ? '?StartTimeTicks=' + Math.round(startTicks) : '');
    }
    function imageUrl(itemId, primaryItemId) {
        if (!primaryItemId) return '';
        return API_BASE + '/Items/' + itemId + '/Images/Primary?maxWidth=400&quality=80';
    }
    function mapItem(item) {
        const runtimeSeconds = Math.round((item.RunTimeTicks || 0) / 10000000);
        return {
            id: item.Id,
            name: item.Name || 'Unknown',
            artist: (item.Artists && item.Artists[0]) || item.AlbumArtist || 'Unknown artist',
            album: item.Album || '',
            runtimeSeconds: runtimeSeconds > 0 ? runtimeSeconds : 0,
            image: imageUrl(item.Id, item.ImageTags && item.ImageTags.Primary ? item.ImageTags.Primary : item.AlbumPrimaryImageTag)
        };
    }
    function el(sel) { return root ? root.querySelector(sel) : null; }
    function buildDom() {
        root = document.createElement('div');
        root.id = 'jf-player';
        root.className = 'jf-player';
        root.innerHTML = `
            <div class="jf-shell">
                <div class="jf-mini">
                    <span class="jf-mini-bar">
                        <button class="jf-disc" type="button" aria-label="Open music player" title="Open music player">
                            <span class="jf-disc-grooves" aria-hidden="true"></span>
                            <span class="jf-disc-label" aria-hidden="true"></span>
                            <span class="jf-disc-hole" aria-hidden="true"></span>
                        </button>
                        <span class="jf-mini-meta">
                            <span class="jf-mini-name">Not playing</span>
                            <span class="jf-mini-artist"></span>
                        </span>
                    </span>
                    <button class="jf-icon-btn jf-mini-play" type="button" aria-label="Play" title="Play">▶</button>
                </div>
                <div class="jf-panel" hidden>
                    <div class="jf-panel-head">
                        <span class="jf-panel-title" title="Collapse player">Jellyfin</span>
                        <button class="jf-icon-btn jf-collapse-btn" type="button" aria-label="Collapse player" title="Collapse player">▾</button>
                    </div>
                    <div class="jf-now">
                        <div class="jf-art" aria-hidden="true"></div>
                        <div class="jf-meta">
                            <div class="jf-track-name">Not playing</div>
                            <div class="jf-track-artist"></div>
                        </div>
                    </div>
                    <div class="jf-seek-row">
                        <span class="jf-time jf-current">0:00</span>
                        <input class="jf-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek">
                        <span class="jf-time jf-duration">0:00</span>
                    </div>
                    <div class="jf-controls">
                        <button class="jf-icon-btn jf-shuffle-btn" type="button" aria-label="Shuffle" title="Shuffle">⇄</button>
                        <button class="jf-icon-btn jf-prev-btn" type="button" aria-label="Previous" title="Previous">⏮</button>
                        <button class="jf-icon-btn jf-play-btn" type="button" aria-label="Play" title="Play">▶</button>
                        <button class="jf-icon-btn jf-next-btn" type="button" aria-label="Next" title="Next">⏭</button>
                        <button class="jf-icon-btn jf-repeat-btn" type="button" aria-label="Repeat" title="Repeat">↻</button>
                    </div>
                    <div class="jf-utility-row">
                        <span class="jf-vol-icon">🔊</span>
                        <input class="jf-volume" type="range" min="0" max="1" step="0.01" value="0.8" aria-label="Volume">
                        <input class="jf-search" type="search" placeholder="Search…" aria-label="Search music">
                    </div>
                    <div class="jf-tracklist" role="list"></div>
                </div>
            </div>`;
        document.body.appendChild(root);
        el('.jf-mini-bar').addEventListener('click', function() { setExpanded(true); });
        el('.jf-panel-head').addEventListener('click', function() { setExpanded(false); });
        el('.jf-play-btn').addEventListener('click', togglePlay);
        el('.jf-mini-play').addEventListener('click', togglePlay);
        el('.jf-prev-btn').addEventListener('click', function() { playIndex(queuePos - 1, true); });
        el('.jf-next-btn').addEventListener('click', function() { playIndex(queuePos + 1, false); });
        el('.jf-shuffle-btn').addEventListener('click', function() {
            shuffle = !shuffle;
            savePrefs();
            applyQueueOrder();
            renderTracklist();
        });
        el('.jf-repeat-btn').addEventListener('click', function() {
            repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
            savePrefs();
            syncButtons();
        });
        const seek = el('.jf-seek');
        seek.addEventListener('pointerdown', function(){ isScrubbing = true; });
        seek.addEventListener('mousedown', function(){ isScrubbing = true; });
        seek.addEventListener('touchstart', function(){ isScrubbing = true; }, {passive:true});
        const endScrub = function(){ isScrubbing = false; };
        seek.addEventListener('pointerup', endScrub);
        seek.addEventListener('mouseup', endScrub);
        seek.addEventListener('touchend', endScrub);
        seek.addEventListener('touchcancel', endScrub);
        seek.addEventListener('blur', endScrub);
        seek.addEventListener('input', function() {
            isScrubbing = true;
            if (trackDuration()) {
                el('.jf-current').textContent = fmtTime(trackDuration() * seek.value / 1000);
            }
        });
        seek.addEventListener('change', function() {
            isScrubbing = false;
            try { seek.blur(); } catch(e) {}
            const dur = trackDuration();
            if (!dur) return;
            const pos = Math.min(Math.max(dur * seek.value / 1000, 0), dur - 0.25);
            if (!isFinite(pos)) return;
            const absPos = Math.max(pos - serverStart, 0);
            if (blobUrl && audio.src && audio.src.startsWith('blob:')) { try { audio.currentTime = pos; return; } catch(e) {} }
            try {
                if (isFinite(dur) && dur > 0 && audio.seekable && audio.seekable.length) {
                    let canNative = false;
                    for (let i = 0; i < audio.seekable.length; i++) {
                        try { if (absPos >= audio.seekable.start(i) && absPos <= audio.seekable.end(i)) { canNative = true; break; } } catch(e) {}
                    }
                    if (canNative) { audio.currentTime = absPos; return; }
                }
                if (pos >= serverStart && pos < bufferedEnd() - 0.5) { audio.currentTime = absPos; return; }
                if (isFinite(dur) && dur > 0) {
                    let seekableEmpty = false;
                    try { seekableEmpty = !audio.seekable.length || (audio.seekable.length===1 && audio.seekable.end(0)===0); } catch(e) { seekableEmpty = true; }
                    if (!seekableEmpty) { audio.currentTime = absPos; return; }
                }
            } catch (e) {}
            let seekableEmpty = false;
            try { seekableEmpty = !audio.seekable.length || (audio.seekable.length===1 && audio.seekable.end(0)===0); } catch(e) { seekableEmpty = true; }
            if (seekableEmpty && isFinite(dur) && dur>0) { fetchBlobAndSeek(pos); return; }
            if (pos < serverStart || pos >= bufferedEnd() - 0.5) {
                // serverSeek restarts to 0 on this Jellyfin (Range/StartTimeTicks ignored) — avoid for finite dur, use Blob
                if (isFinite(dur) && dur>0) { fetchBlobAndSeek(pos); return; }
                serverSeek(pos);
            } else {
                try { audio.currentTime = absPos; } catch (e) { if (isFinite(dur) && dur>0) fetchBlobAndSeek(pos); else serverSeek(pos); }
            }
        });
        el('.jf-volume').addEventListener('input', function() {
            volume = parseFloat(this.value);
            audio.volume = volume;
            savePrefs();
        });
        el('.jf-search').addEventListener('input', function() {
            const term = this.value.trim();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() { runSearch(term); }, 400);
        });
        el('.jf-tracklist').addEventListener('click', function(e) {
            const row = e.target.closest('[data-qi]');
            if (row) playIndex(parseInt(row.getAttribute('data-qi'), 10), false);
        });
        document.addEventListener('keydown', function(e) {
            if (!root || root.hidden || !expanded) return;
            const t = e.target;
            if (t && (t.closest && t.closest('#jf-player') || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            }
        });
        setupAutoCollapse();
    }
    function setExpanded(value) {
        if (value === expanded) return;
        expanded = value;
        const panel = el('.jf-panel');
        const mini = el('.jf-mini');
        const disc = el('.jf-disc');
        panel.classList.remove('jf-genie-in', 'jf-genie-out');
        mini.classList.remove('jf-mini-pop');
        if (value) {
            mini.hidden = true;
            panel.hidden = false;
            void panel.offsetWidth;
            panel.classList.add('jf-genie-in');
        } else {
            panel.classList.add('jf-genie-out');
            let done = false;
            const finish = function() {
                if (done) return;
                done = true;
                panel.hidden = true;
                panel.classList.remove('jf-genie-out');
                mini.hidden = false;
                void mini.offsetWidth;
                mini.classList.add('jf-mini-pop');
                disc.focus({ preventScroll: true });
            };
            panel.addEventListener('animationend', function h(ev) {
                if (ev.target !== panel) return;
                panel.removeEventListener('animationend', h);
                finish();
            });
            setTimeout(finish, 400);
        }
        savePrefs();
    }
    const COLLAPSE_ZONE_FLAG = '__jfScrollCollapseZone';
    function registerScrollCollapseZone(elm) {
        if (!elm || elm[COLLAPSE_ZONE_FLAG]) return;
        elm[COLLAPSE_ZONE_FLAG] = true;
    }
    function setupAutoCollapse() {
        function handleCollapseScroll(ev) {
            if (!root || !expanded) return;
            let target = null;
            try { target = (ev.composedPath && ev.composedPath()[0]) || ev.target; } catch (e) { target = ev.target; }
            let node = target;
            while (node) {
                if (node.id === 'jf-player' || (node.classList && node.classList.contains('jf-tracklist'))) return;
                if (node[COLLAPSE_ZONE_FLAG]) {
                    setExpanded(false);
                    return;
                }
                if (node === document || node === window || node === document.documentElement || node === document.body) {
                    setExpanded(false);
                    return;
                }
                node = node.parentElement;
            }
        }
        window.addEventListener('scroll', handleCollapseScroll, { capture: true, passive: true });
        document.addEventListener('scroll', handleCollapseScroll, { capture: true, passive: true });
        const contentArea = document.querySelector('.content-area');
        if (contentArea) registerScrollCollapseZone(contentArea);
        const sidebar = document.getElementById('sidebar');
        if (sidebar) registerScrollCollapseZone(sidebar);
        const tray = document.getElementById('mobile-nav-tray');
        if (tray) registerScrollCollapseZone(tray);
        if (typeof MutationObserver !== 'undefined') {
            try {
                const mo = new MutationObserver(function(muts) {
                    for (let i = 0; i < muts.length; i++) {
                        const list = muts[i].addedNodes;
                        for (let j = 0; j < list.length; j++) {
                            const n = list[j];
                            if (!n || n.nodeType !== 1) continue;
                            if (n.matches && (n.matches('.content-area') || n.matches('#sidebar') || n.matches('#mobile-nav-tray'))) registerScrollCollapseZone(n);
                            const ca = n.querySelector ? n.querySelector('.content-area') : null;
                            if (ca) registerScrollCollapseZone(ca);
                            const sb = n.querySelector ? n.querySelector('#sidebar') : null;
                            if (sb) registerScrollCollapseZone(sb);
                            const tr = n.querySelector ? n.querySelector('#mobile-nav-tray') : null;
                            if (tr) registerScrollCollapseZone(tr);
                        }
                    }
                });
                mo.observe(document.body, { childList: true, subtree: true });
            } catch (e) {}
        }
    }
    function fmtTime(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }
    function orderedTracks() {
        const idx = tracks.map(function(_, i) { return i; });
        if (shuffle) {
            for (let i = idx.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
            }
        }
        return idx;
    }
    function applyQueueOrder() {
        const currentId = queue[queuePos] !== undefined && tracks[queue[queuePos]] ? tracks[queue[queuePos]].id : '';
        const order = orderedTracks();
        queue = order;
        queuePos = currentId ? order.findIndex(function(i) { return tracks[i].id === currentId; }) : -1;
        if (queuePos === -1 && currentId && order.length) queuePos = 0;
        syncButtons();
    }
    function renderTracklist() {
        const list = el('.jf-tracklist');
        if (!list) return;
        if (!tracks.length) {
            list.innerHTML = '<div class="jf-empty">No tracks loaded.</div>';
            return;
        }
        list.innerHTML = queue.map(function(ti, qi) {
            const t = tracks[ti];
            const active = qi === queuePos ? ' active' : '';
            return `<div class="jf-row${active}" role="listitem" data-qi="${qi}">
                <span class="jf-row-name">${escapeHtml(t.name)}</span>
                <span class="jf-row-artist">${escapeHtml(t.artist)}</span>
            </div>`;
        }).join('');
    }
    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function runSearch(term) {
        const token = ++searchToken;
        let p;
        if (!term) {
            p = loadLibrary();
        } else {
            const params = new URLSearchParams({
                IncludeItemTypes: 'Audio', Recursive: 'true', Limit: '100',
                SearchTerm: term, SortBy: 'SortName'
            });
            if (userId) params.set('UserId', userId);
            p = api('Items', params).then(function(data) {
                return (data.Items || []).map(mapItem);
            });
        }
        p.then(function(items) {
            if (token !== searchToken) return;
            tracks = items;
            applyQueueOrder();
            renderTracklist();
        }).catch(function() {
            if (token !== searchToken) return;
            const list = el('.jf-tracklist');
            if (list) list.innerHTML = '<div class="jf-empty">Search failed.</div>';
        });
    }
    function loadLibrary() {
        const params = new URLSearchParams({
            IncludeItemTypes: 'Audio', Recursive: 'true', Limit: '200', SortBy: 'Random'
        });
        if (userId) params.set('UserId', userId);
        return api('Users/' + userId + '/Items', params).then(function(data) {
            return (data.Items || []).map(mapItem);
        });
    }
    function currentTrack() {
        const ti = queue[queuePos];
        return ti === undefined ? null : tracks[ti];
    }
    function playIndex(qi, allowWrapBack) {
        if (!queue.length) return;
        if (qi < 0) qi = repeat === 'all' || allowWrapBack ? queue.length - 1 : 0;
        if (qi >= queue.length) qi = repeat === 'all' ? 0 : queue.length - 1;
        queuePos = qi;
        const t = currentTrack();
        if (!t) return;
        serverStart = 0;
        isScrubbing = false;
        try { const sk = el('.jf-seek'); if (sk) { sk.disabled = false; sk.blur(); } } catch(e) {}
        if (blobFetchTimeout) { try { clearTimeout(blobFetchTimeout); } catch(e){} blobFetchTimeout=null; }
        blobFetchPos=null;
        if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch(e) {} blobUrl = null; }
        if (blobFetchAbort) { try { blobFetchAbort.abort(); } catch(e) {} blobFetchAbort = null; try { const sk2 = el('.jf-seek'); if (sk2) sk2.disabled = false; } catch(e) {} }
        audio.src = streamUrl(t.id, 0);
        audio.volume = volume;
        audio.play().catch(function(e) {
            try {
                const n = e && e.name || '';
                if (n === 'NotAllowedError' || n === 'AbortError') return;
            } catch(_e){}
        });
        showNowPlaying(t);
        renderTracklist();
    }
    function showNowPlaying(t) {
        el('.jf-track-name').textContent = t.name;
        el('.jf-track-artist').textContent = t.artist + (t.album ? ' — ' + t.album : '');
        el('.jf-mini-name').textContent = t.name;
        el('.jf-mini-artist').textContent = t.artist;
        el('.jf-art').style.backgroundImage = t.image ? 'url("' + t.image + '")' : '';
        el('.jf-disc-label').style.backgroundImage = t.image ? 'url("' + t.image + '")' : '';
        if (t.runtimeSeconds) el('.jf-duration').textContent = fmtTime(t.runtimeSeconds);
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: t.name, artist: t.artist, album: t.album || 'Jellyfin',
                artwork: t.image ? [{ src: t.image, sizes: '400x400' }] : []
            });
        }
    }
    function togglePlay() {
        if (!queue.length) {
            playIndex(0, false);
            return;
        }
        if (audio.paused) audio.play().catch(function() {}); else audio.pause();
    }
    function syncButtons() {
        const playing = !audio.paused;
        const icon = playing ? '⏸' : '▶';
        el('.jf-play-btn').textContent = icon;
        el('.jf-play-btn').setAttribute('aria-label', playing ? 'Pause' : 'Play');
        el('.jf-mini-play').textContent = icon;
        el('.jf-mini-play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
        el('.jf-disc').classList.toggle('jf-spinning', playing);
        el('.jf-shuffle-btn').classList.toggle('jf-on', shuffle);
        el('.jf-repeat-btn').classList.toggle('jf-on', repeat !== 'off');
        el('.jf-repeat-btn').textContent = repeat === 'one' ? '🔁' : '↻';
    }
    function trackDuration() {
        return (isFinite(audio.duration) && audio.duration > 0) ? audio.duration : (currentTrack() ? currentTrack().runtimeSeconds : 0);
    }
    function bufferedEnd() {
        try {
            if (audio.buffered.length && isFinite(audio.duration) && audio.duration > 0) {
                return serverStart + audio.buffered.end(audio.buffered.length - 1);
            }
        } catch (e) {}
        return serverStart;
    }
    function serverSeek(pos) {
        const t = currentTrack();
        if (!t || !t.id) return;
        pos = Math.max(pos || 0, 0);
        serverStart = pos;
        if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch(e) {} blobUrl = null; }
        if (blobFetchAbort) { try { blobFetchAbort.abort(); } catch(e) {} blobFetchAbort = null; }
        const wasPlaying = !audio.paused;
        audio.src = streamUrl(t.id, Math.round(pos * 10000000));
        audio.volume = volume;
        if (wasPlaying) audio.play().catch(function() {});
        const seek = el('.jf-seek');
        if (seek) {
            const dur = trackDuration();
            if (dur > 0) seek.value = Math.round(pos / dur * 1000);
        }
        el('.jf-current').textContent = fmtTime(pos);
    }
    function fetchBlobAndSeek(pos) {
        const t = currentTrack();
        if (!t || !t.id) return;
        pos = Math.max(pos || 0, 0);
        const wasPlaying = !audio.paused;
        const dur = trackDuration();
        const seek = el('.jf-seek');
        if (seek && dur > 0) seek.value = Math.round(pos / dur * 1000);
        el('.jf-current').textContent = fmtTime(pos);
        if (blobFetchAbort) { try { blobFetchAbort.abort(); } catch(e) {} }
        if (blobFetchTimeout) { try { clearTimeout(blobFetchTimeout); } catch(e){} blobFetchTimeout=null; }
        blobFetchPos = pos;
        blobFetchAbort = new AbortController();
        const signal = blobFetchAbort.signal;
        const myPos = pos;
        el('.jf-seek').disabled = true;
        fetch(streamUrl(t.id, 0), { cache: 'no-store', signal: signal }).then(function(r) {
            if (!r.ok) throw new Error('blob fetch ' + r.status);
            return r.blob();
        }).then(function(blob) {
            if (signal.aborted || blobFetchPos !== myPos) { try { el('.jf-seek').disabled = false; } catch(e) {} return; }
            if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch(e) {} }
            blobUrl = URL.createObjectURL(blob);
            serverStart = 0;
            audio.src = blobUrl;
            audio.volume = volume;
            audio.load();
            const onMeta = function() {
                if (blobFetchPos !== myPos) return;
                audio.removeEventListener('loadedmetadata', onMeta);
                if (blobFetchTimeout) { try{ clearTimeout(blobFetchTimeout);}catch(e){} blobFetchTimeout=null; }
                el('.jf-seek').disabled = false;
                try { audio.currentTime = myPos; } catch(e) {}
                if (wasPlaying) audio.play().catch(function(e) {
                    try { const n=e&&e.name||''; if(n==='NotAllowedError'||n==='AbortError') return; }catch(_e){}
                });
            };
            audio.addEventListener('loadedmetadata', onMeta);
            blobFetchTimeout = setTimeout(function() {
                if (blobFetchPos !== myPos) return;
                try { audio.removeEventListener('loadedmetadata', onMeta); } catch(e) {}
                el('.jf-seek').disabled = false;
                try { if (isFinite(myPos)) audio.currentTime = myPos; } catch(e) {}
                if (wasPlaying) audio.play().catch(function(e) {
                    try { const n=e&&e.name||''; if(n==='NotAllowedError'||n==='AbortError') return; }catch(_e){}
                });
            }, 4000);
        }).catch(function(e) {
            try { el('.jf-seek').disabled = false; } catch(e2) {}
            if (signal.aborted || blobFetchPos !== myPos) return;
            if (isFinite(dur) && dur>0) fetchBlobAndSeek(myPos); else serverSeek(myPos);
            // fallback to serverSeek only if blob repeatedly fails and dur is not finite; for finite dur we already use blob
        });
    }
    function effectiveCurrentTime() {
        return serverStart + (isFinite(audio.currentTime) ? audio.currentTime : 0);
    }
    function wireAudio() {
        audio.addEventListener('play', syncButtons);
        audio.addEventListener('pause', syncButtons);
        audio.addEventListener('ended', function() {
            const now = Date.now();
            if (now - lastAdvanceAt < 800) return;
            lastAdvanceAt = now;
            if (repeat === 'one' && currentTrack()) {
                serverStart = 0;
                audio.src = streamUrl(currentTrack().id, 0);
                audio.volume = volume;
                audio.play().catch(function() {});
            } else {
                playIndex(queuePos + 1, false);
            }
        });
        audio.addEventListener('timeupdate', function() {
            const seek = el('.jf-seek');
            if (!seek || isScrubbing) return;
            const dur = trackDuration();
            if (dur) {
                const pos = effectiveCurrentTime();
                if (audio.currentTime > 0.3 && pos > dur - TRACK_END_THRESHOLD && pos < dur + 60) {
                    audio.pause();
                    audio.dispatchEvent(new Event('ended'));
                    return;
                }
                seek.value = Math.round(Math.min(pos / dur, 1) * 1000);
                el('.jf-current').textContent = fmtTime(Math.min(pos, dur));
                el('.jf-duration').textContent = fmtTime(dur);
                if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && isFinite(audio.duration) && audio.duration > 0) {
                    try {
                        navigator.mediaSession.setPositionState({
                            duration: audio.duration,
                            playbackRate: audio.playbackRate,
                            position: Math.min(audio.currentTime, audio.duration)
                        });
                    } catch (e) {}
                }
            }
        });
        audio.addEventListener('error', function() {
            if (!audio.src) return;
            try {
                const e = audio.error;
                if (e) {
                    const code = e.code;
                    // 1=aborted 2=network 3=decode 4=src_not_supported
                    // Safari fMP4 gives 4; with mp3 fix it should not fire. Log for diagnostics.
                    if (code === 4 && _isSafari) {
                        console.warn('[jf] Safari src not supported', {code: code, src: audio.src && audio.src.slice(-80), type: audio.src && audio.src.indexOf('.mp3')!==-1?'mp3':'mp4'});
                    }
                }
            } catch(_e){}
            const name = el('.jf-track-name');
            if (name) name.textContent = 'Playback error';
        });
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', function() { audio.play().catch(function() {}); });
            navigator.mediaSession.setActionHandler('pause', function() { audio.pause(); });
            navigator.mediaSession.setActionHandler('previoustrack', function() { playIndex(queuePos - 1, true); });
            navigator.mediaSession.setActionHandler('nexttrack', function() { playIndex(queuePos + 1, false); });
            try { navigator.mediaSession.setActionHandler('seekto', function(details) {
                if (!details || !isFinite(details.seekTime)) return;
                const dur = trackDuration();
                let pos = details.seekTime;
                if (isFinite(dur) && dur > 0 && pos >= dur) pos = dur - 0.5;
                if (pos < 0) pos = 0;
                if (blobUrl && audio.src && audio.src.startsWith('blob:')) { try { audio.currentTime = pos; return; } catch(e) {} }
                let seekableEmpty = false;
                try { seekableEmpty = !audio.seekable.length || (audio.seekable.length===1 && audio.seekable.end(0)===0); } catch(e) { seekableEmpty = true; }
                if (seekableEmpty && isFinite(dur) && dur>0) { fetchBlobAndSeek(pos); return; }
                const abs = Math.max(pos - serverStart, 0);
                try { if (isFinite(dur) && dur > 0) { audio.currentTime = abs; return; } } catch(e) {}
                if (pos < serverStart || pos >= bufferedEnd() - 0.5) {
                    if (isFinite(dur) && dur>0) fetchBlobAndSeek(pos); else serverSeek(pos);
                } else try { audio.currentTime = abs; } catch(e) { if (isFinite(dur) && dur>0) fetchBlobAndSeek(pos); else serverSeek(pos); }
            }); } catch (e) {}
        }
    }
    function isChineseTitle(t) {
        return !!t && HAN_RE.test(t.name || '') && !KANA_RE.test(t.name || '');
    }
    function startChineseDefault() {
        if (!tracks.length) return;
        const pool = tracks.filter(isChineseTitle);
        if (!pool.length) return;
        const order = orderedTracks();
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const pos = order.indexOf(tracks.indexOf(pick));
        queue = order;
        queuePos = pos >= 0 ? pos : 0;
        playIndex(queuePos, false);
    }
    function maybeStartChinese() {
        if (defaultStarted || !consentGranted) return;
        defaultStarted = true;
        startChineseDefault();
    }
    let consentGranted = false;
    let defaultStarted = false;
    try { consentGranted = localStorage.getItem('system_warning_consent') === 'true'; } catch (e) {}
    document.addEventListener('warning:cleared', function() {
        consentGranted = true;
        maybeStartChinese();
    });
    function init() {
        api('Users').then(function(users) {
            if (!Array.isArray(users) || !users.length) throw new Error('no users');
            userId = users[0].Id;
            const stored = prefs();
            shuffle = !!stored.shuffle;
            repeat = ['off', 'all', 'one'].indexOf(stored.repeat) !== -1 ? stored.repeat : 'off';
            volume = typeof stored.volume === 'number' ? Math.min(Math.max(stored.volume, 0), 1) : 0.8;
            audio.volume = volume;
            buildDom();
            wireAudio();
            root.hidden = false;
            setExpanded(!!stored.expanded);
            syncButtons();
            return loadLibrary();
        }).then(function(items) {
            tracks = items;
            applyQueueOrder();
            renderTracklist();
            maybeStartChinese();
        }).catch(function() {});
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.jfRegisterScrollCollapseZone = registerScrollCollapseZone;
    window.jellyfinPlayer = { play: togglePlay, pause: function() { audio.pause(); } };
})();
