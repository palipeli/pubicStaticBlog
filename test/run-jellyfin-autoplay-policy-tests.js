const {chromium} = require('playwright');
const {execFileSync} = require('child_process');
const fs = require('fs');
const SITE = 'http://127.0.0.1:8901';
execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '8', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', '/tmp/jf-silent8.mp4'], {stdio: 'ignore'});
const AUDIO_BODY = fs.readFileSync('/tmp/jf-silent8.mp4');
const TRACKS = {Items: [
    {Id: 'it1', Name: '糸守高校', Artists: ['RADWIMPS'], Album: 'Your Name', ImageTags: {Primary: 'p1'}, RunTimeTicks: 180 * 10000000},
    {Id: 'it2', Name: '糸守高校 (Live)', Artists: ['RADWIMPS'], Album: 'Live', ImageTags: {Primary: 'p1'}, RunTimeTicks: 210 * 10000000},
    {Id: 'cn1', Name: '小城故事', Artists: ['Teresa Teng'], Album: 'Alb', ImageTags: {Primary: 'p1'}, RunTimeTicks: 180 * 10000000}
]};
let passed = 0, failed = 0;
function check(name, cond, extra) {
    if (cond) { passed++; console.log('  PASS ' + name); }
    else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
async function setupCapture(page) {
    await page.addInitScript(() => {
        window.__jfAudioSrc = '';
        window.__jfPlayErrors = [];
        const d = Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype, 'src');
        const o = d && d.set;
        try {
            Object.defineProperty(HTMLAudioElement.prototype, 'src', {
                get() { return d && d.get ? d.get.call(this) : this.getAttribute('src') || ''; },
                set(v) { window.__jfAudioSrc = String(v || ''); if (o) return o.call(this, v); this.setAttribute('src', v); },
                configurable: true
            });
        } catch (e) {}
        const origSA = HTMLAudioElement.prototype.setAttribute;
        HTMLAudioElement.prototype.setAttribute = function(k, v) {
            if (String(k).toLowerCase() === 'src') window.__jfAudioSrc = String(v || '');
            return origSA.call(this, k, v);
        };
        const op = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
            window.__jfAudioReal = this;
            const p = op.call(this);
            if (p && p.catch) p.catch(e => { window.__jfPlayErrors.push(String((e && e.name) || e)); });
            return p;
        };
    });
    await page.route(u => { try { return (typeof u === 'string' ? u : String(u.href || u)).includes('/api/jellyfin'); } catch (e) { return false; } }, route => {
        const url = route.request().url();
        if (url.includes('/Audio/') && (url.includes('/stream') || url.includes('/universal'))) {
            return route.fulfill({status: 200, contentType: 'audio/mp4', headers: {'Accept-Ranges': 'none'}, body: AUDIO_BODY});
        }
        let body = {ok: true};
        if (url.includes('/Users') && !url.includes('/Users/')) body = [{Name: 'kami', Id: 'u1'}];
        else if (url.includes('/Users/') || url.includes('IncludeItemTypes')) body = TRACKS;
        return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
    });
}
async function audioState(page) {
    return page.evaluate(() => {
        const a = window.__jfAudioReal;
        return {
            src: window.__jfAudioSrc || '',
            errs: (window.__jfPlayErrors || []).slice(),
            audio: a ? {paused: a.paused, muted: a.muted, t: a.currentTime} : null,
            badge: (() => { const b = document.getElementById('jf-mute-wait'); return b ? b.classList.contains('jf-show') : false; })(),
            spinning: !!(document.querySelector('.jf-disc') && document.querySelector('.jf-disc').classList.contains('jf-spinning'))
        };
    });
}
async function waitForSrc(page) {
    await page.waitForFunction(() => (window.__jfAudioSrc || '').includes('/Audio/'), null, {timeout: 12000});
}
async function waitForPlaying(page) {
    await page.waitForFunction(() => window.__jfAudioReal && !window.__jfAudioReal.paused, null, {timeout: 8000});
}
async function acceptConsent(page) {
    await page.goto(SITE + '/index.html');
    await page.waitForSelector('#consent-overlay', {state: 'visible', timeout: 8000});
    try { await page.waitForFunction(() => window.__WARNING_ASSETS_LOADED === true, null, {timeout: 15000}); } catch (e) {}
    await page.click('#accept-btn');
    await page.waitForTimeout(400);
}

(async () => {
    const browser = await chromium.launch();
    console.log('T1: first visit + ACCEPT gesture -> unmuted autoplay, no badge');
    {
        const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
        const page = await ctx.newPage();
        await setupCapture(page);
        await acceptConsent(page);
        await waitForSrc(page);
        await waitForPlaying(page);
        await page.waitForTimeout(900);
        const st = await audioState(page);
        check('audio playing after accept', st.audio && !st.audio.paused, JSON.stringify(st.audio));
        check('first visit plays UNMUTED (sticky activation)', st.audio && !st.audio.muted, JSON.stringify(st.audio));
        check('no mute-wait badge on first visit', !st.badge);
        check('playback time advances', st.audio && st.audio.t > 0.2, 't=' + (st.audio && st.audio.t));
        await ctx.close();
    }

    console.log('T2: SECOND visit (no gesture) -> muted autoplay + badge, click unmutes');
    {
        const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
        const page = await ctx.newPage();
        await setupCapture(page);
        await acceptConsent(page);
        const page2 = await ctx.newPage();
        await setupCapture(page2);
        await page2.goto(SITE + '/index.html');
        await page2.waitForSelector('#jf-player', {state: 'attached', timeout: 10000});
        await waitForSrc(page2);
        await waitForPlaying(page2);
        await page2.waitForTimeout(900);
        let st = await audioState(page2);
        check('second visit: playback STARTS (muted fallback or policy-allowed)', st.audio && !st.audio.paused, JSON.stringify(st.audio));
        check('second visit: badge consistent with muted state', st.audio.muted ? st.badge : !st.badge, 'muted=' + st.audio.muted + ' badge=' + st.badge);
        check('second visit: time advances while muted', st.audio && st.audio.t > 0.2, 't=' + (st.audio && st.audio.t));
        check('second visit: disc spins (UI shows playing)', st.spinning);
        await page2.mouse.click(640, 300);
        await page2.waitForTimeout(500);
        st = await audioState(page2);
        check('after click: UNMUTED', st.audio && !st.audio.muted, JSON.stringify(st.audio));
        check('after click: still playing', st.audio && !st.audio.paused, JSON.stringify(st.audio));
        check('after click: badge hidden', !st.badge);
        await ctx.close();
    }

    console.log('T3: second visit + keyboard gesture -> unmutes (non-pointer path)');
    {
        const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
        const page = await ctx.newPage();
        await setupCapture(page);
        await acceptConsent(page);
        const page2 = await ctx.newPage();
        await setupCapture(page2);
        await page2.goto(SITE + '/index.html');
        await waitForSrc(page2);
        await waitForPlaying(page2);
        await page2.waitForTimeout(600);
        await page2.keyboard.press('Shift');
        await page2.waitForTimeout(500);
        const st = await audioState(page2);
        check('after keydown: UNMUTED and playing', st.audio && !st.audio.muted && !st.audio.paused, JSON.stringify(st.audio));
        check('after keydown: badge hidden', !st.badge);
        await ctx.close();
    }

    console.log('T4: second visit + volume slider input -> unmutes without click');
    {
        const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
        const page = await ctx.newPage();
        await setupCapture(page);
        await acceptConsent(page);
        const page2 = await ctx.newPage();
        await setupCapture(page2);
        await page2.goto(SITE + '/index.html');
        await waitForSrc(page2);
        await waitForPlaying(page2);
        await page2.waitForTimeout(600);
        await page2.evaluate(() => {
            const v = document.querySelector('.jf-volume');
            v.value = '0.7';
            v.dispatchEvent(new Event('input', {bubbles: true}));
        });
        await page2.waitForTimeout(500);
        const st = await audioState(page2);
        check('after volume input: UNMUTED and playing', st.audio && !st.audio.muted && !st.audio.paused, JSON.stringify(st.audio));
        check('after volume input: badge hidden', !st.badge);
        await ctx.close();
    }

    console.log('T5: stability — 3 repeat visits all end audible after gesture');
    {
        const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
        const page = await ctx.newPage();
        await setupCapture(page);
        await acceptConsent(page);
        for (let i = 0; i < 3; i++) {
            const page2 = await ctx.newPage();
            await setupCapture(page2);
            await page2.goto(SITE + '/index.html');
            await waitForSrc(page2);
            await waitForPlaying(page2);
            await page2.waitForTimeout(500);
            const mid = await audioState(page2);
            check('visit ' + (i + 1) + ': autoplay running', mid.audio && !mid.audio.paused, JSON.stringify(mid.audio));
            check('visit ' + (i + 1) + ': badge consistent with muted state', mid.audio.muted ? mid.badge : !mid.badge, 'muted=' + mid.audio.muted + ' badge=' + mid.badge);
            await page2.mouse.click(640, 300);
            await page2.waitForTimeout(400);
            const fin = await audioState(page2);
            check('visit ' + (i + 1) + ': audible after gesture', fin.audio && !fin.audio.paused && !fin.audio.muted, JSON.stringify(fin.audio));
            await page2.close();
        }
        await ctx.close();
    }

    await browser.close();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e && e.message, e && e.stack); process.exit(2); });
