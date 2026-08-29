(function() {
    'use strict';
    try{ if(!window.__CP_VERIFIED||!window.__CP_ALLOW_LOAD||!window.CP||typeof window.CP.isRunning!=='function'||!window.CP.version||window.CP.version!=='2.3.1-foolproof'||(Object.isFrozen&&!Object.isFrozen(window.CP))||!window.CP.isRunning()){ try{ if(window.__CP_RECOVER) window.__CP_RECOVER(); else if(window.__CP_FAIL) window.__CP_FAIL(); }catch(e){} throw new Error('CP not verified'); } if(window.CP.isDevToolOpened&&window.CP.isDevToolOpened()){ try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP devtool'); } if(window.__CP_GATE&&window.__CP_GATE.isWindowSizeIndicatingDevTools&&window.__CP_GATE.isWindowSizeIndicatingDevTools()){ try{window.CP.trigger()}catch(e){} try{window.__CP_FAIL&&window.__CP_FAIL()}catch(e){} throw new Error('CP size gate'); } }catch(e){ try{ if(e.message==='CP not verified'&&window.__CP_RECOVER) window.__CP_RECOVER(); else if(window.__CP_FAIL) window.__CP_FAIL(); }catch(e2){} throw e; }
    const API_BASE = '/api/jellyfin';
    const PREFS_KEY = 'jellyfin_player_prefs';
    const audio = new Audio();
    audio.preload = 'metadata';
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
    let root = null;
    function prefs() {
        try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (e) { return {}; }
    }
    function savePrefs() {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify({ shuffle: shuffle, repeat: repeat, volume: volume, expanded: expanded })); } catch (e) {}
    }
    function api(path, params) {
        const qs = params ? '?' + params.toString() : '';
        return fetch(API_BASE + '/' + path + qs, { cache: 'no-store' }).then(function(r) {
            if (!r.ok) throw new Error('jellyfin ' + r.status);
            return r.json();
        });
    }
    function streamUrl(id) {
        return API_BASE + '/Audio/' + id + '/stream?static=true';
    }
    function imageUrl(itemId, primaryItemId) {
        if (!primaryItemId) return '';
        return API_BASE + '/Items/' + itemId + '/Images/Primary?maxWidth=400&quality=80';
    }
    function mapItem(item) {
        return {
            id: item.Id,
            name: item.Name || 'Unknown',
            artist: (item.Artists && item.Artists[0]) || item.AlbumArtist || 'Unknown artist',
            album: item.Album || '',
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
                    <button class="jf-disc" type="button" aria-label="Open music player" title="Open music player">
                        <span class="jf-disc-grooves" aria-hidden="true"></span>
                        <span class="jf-disc-label" aria-hidden="true"></span>
                        <span class="jf-disc-hole" aria-hidden="true"></span>
                    </button>
                    <div class="jf-mini-meta">
                        <div class="jf-mini-name">Not playing</div>
                        <div class="jf-mini-artist"></div>
                    </div>
                    <button class="jf-icon-btn jf-mini-play" type="button" aria-label="Play" title="Play">▶</button>
                </div>
                <div class="jf-panel" hidden>
                    <div class="jf-panel-head">
                        <span class="jf-panel-title">Jellyfin</span>
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
        el('.jf-disc').addEventListener('click', function() { setExpanded(true); });
        el('.jf-mini-meta').addEventListener('click', function() { setExpanded(true); });
        el('.jf-collapse-btn').addEventListener('click', function() { setExpanded(false); });
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
        seek.addEventListener('input', function() {
            if (audio.duration) {
                el('.jf-current').textContent = fmtTime(audio.duration * seek.value / 1000);
            }
        });
        seek.addEventListener('change', function() {
            if (audio.duration) {
                audio.currentTime = audio.duration * seek.value / 1000;
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
        audio.src = streamUrl(t.id);
        audio.volume = volume;
        audio.play().catch(function() {});
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
    function wireAudio() {
        audio.addEventListener('play', syncButtons);
        audio.addEventListener('pause', syncButtons);
        audio.addEventListener('ended', function() {
            if (repeat === 'one') {
                audio.currentTime = 0;
                audio.play().catch(function() {});
            } else {
                playIndex(queuePos + 1, false);
            }
        });
        audio.addEventListener('timeupdate', function() {
            const seek = el('.jf-seek');
            if (!seek || document.activeElement === seek) return;
            if (audio.duration) {
                seek.value = Math.round(audio.currentTime / audio.duration * 1000);
                el('.jf-current').textContent = fmtTime(audio.currentTime);
                el('.jf-duration').textContent = fmtTime(audio.duration);
            }
        });
        audio.addEventListener('error', function() {
            if (!audio.src) return;
            const name = el('.jf-track-name');
            if (name) name.textContent = 'Playback error';
        });
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', function() { audio.play().catch(function() {}); });
            navigator.mediaSession.setActionHandler('pause', function() { audio.pause(); });
            navigator.mediaSession.setActionHandler('previoustrack', function() { playIndex(queuePos - 1, true); });
            navigator.mediaSession.setActionHandler('nexttrack', function() { playIndex(queuePos + 1, false); });
        }
    }
    function init() {
        fetch(API_BASE, { cache: 'no-store' }).then(function(r) {
            return r.ok ? r.json() : Promise.reject(new Error('proxy off'));
        }).then(function(info) {
            if (!info || info.ok !== true) return Promise.reject(new Error('proxy off'));
            return api('Users');
        }).then(function(users) {
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
        }).catch(function() {});
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.jellyfinPlayer = { play: togglePlay, pause: function() { audio.pause(); } };
})();
