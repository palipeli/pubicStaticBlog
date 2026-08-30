const {chromium} = require('playwright');
const SITE = 'http://127.0.0.1:8901';
const TRACKS = {Items: [
    {Id: 't1', Name: 'Song One', Artists: ['Artist A'], Album: 'Alb', ImageTags: {Primary: 'p1'}, RunTimeTicks: 180 * 10000000},
    {Id: 't2', Name: 'Song Two', Artists: ['Artist B'], Album: 'Alb2', RunTimeTicks: 210 * 10000000}
]};
let passed = 0, failed = 0;
function check(name, cond, extra) {
    if (cond) { passed++; console.log('  PASS ' + name); }
    else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
async function setupCapture(page, capture) {
    await page.addInitScript(() => {
        window.__jfAudioSrc = '';
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
    });
    await page.route(u => {
        try { const href = typeof u === 'string' ? u : (u.href || String(u)); return href.includes('/api/jellyfin'); } catch(e) { return false; }
    }, (route) => {
        const url = route.request().url();
        if (capture) capture.push(url);
        if (url.includes('/Audio/') && (url.includes('/stream') || url.includes('/universal'))) {
            return route.fulfill({status: 206, contentType: 'audio/mp4', headers: {'Content-Range': 'bytes 0-100/1000', 'Accept-Ranges': 'bytes'}, body: Buffer.alloc(100)});
        }
        let body = {ok: true};
        if (url.includes('/Users') && !url.includes('/Users/')) body = [{Name: 'kami', Id: 'u1'}];
        else if (url.includes('/Users/') || url.includes('IncludeItemTypes')) body = TRACKS;
        return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
    });
}
async function acceptConsent(page) {
    await page.goto(SITE + '/index.html');
    let sawOverlay = true;
    try { await page.waitForSelector('#consent-overlay', {state: 'visible', timeout: 4000}); } catch(e) { sawOverlay = false; }
    if (sawOverlay) {
        await page.waitForFunction(() => window.__WARNING_ASSETS_LOADED === true, null, {timeout: 20000});
        await page.click('#accept-btn');
        await page.waitForFunction(() => document.getElementById('consent-overlay').style.display === 'none');
    }
    await page.waitForSelector('#jf-player', {state: 'attached', timeout: 10000});
    await page.waitForTimeout(500);
}
async function clickFirstTrack(page) {
    await page.evaluate(() => { const row = document.querySelector('.jf-tracklist .jf-row'); if (row) row.click(); });
}
async function audioSrc(page) { return page.evaluate(() => window.__jfAudioSrc || ''); }

(async () => {
    const browser = await chromium.launch();

    console.log('T1: clean stream URL (no static=true) + correct catalog duration');
    {
        const ctx = await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block'});
        const page = await ctx.newPage();
        const streamUrls = [];
        await setupCapture(page, streamUrls);
        await acceptConsent(page);
        await page.waitForFunction(() => document.querySelector('.jf-row'), null, {timeout: 10000});
        if (await page.locator('.jf-panel').isHidden()) { await page.click('.jf-disc'); await page.waitForTimeout(600); }
        await clickFirstTrack(page);
        await page.waitForTimeout(700);
        const src = await audioSrc(page);
        check('stream URL has no static=true', !src.includes('static='), 'src=' + src);
        check('stream URL path is /Audio/<id>/stream', /\/Audio\/[^/]+\/stream/.test(src), 'src=' + src);
        check('initial play URL has no StartTimeTicks', !src.includes('StartTimeTicks') && !src.includes('startTimeTicks'), 'src=' + src);
        const streamHit = streamUrls.find(u => u.includes('/Audio/') && (u.includes('/stream') || u.includes('/universal')));
        check('network request for stream hit route', !!streamHit, 'hits=' + JSON.stringify(streamUrls.slice(-4)));
        if (streamHit) check('network stream URL has no static=true', !streamHit.includes('static='), 'hit=' + streamHit);
        await ctx.close();
    }

    console.log('T2: seek uses server seek with StartTimeTicks when beyond buffered range');
    {
        const ctx = await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block'});
        const page = await ctx.newPage();
        const streamUrls = [];
        await setupCapture(page, streamUrls);
        await acceptConsent(page);
        await page.waitForFunction(() => document.querySelector('.jf-row'), null, {timeout: 10000});
        if (await page.locator('.jf-panel').isHidden()) { await page.click('.jf-disc'); await page.waitForTimeout(600); }
        await clickFirstTrack(page);
        await page.waitForTimeout(700);
        streamUrls.length = 0;
        await page.evaluate(() => {
            const a = document.querySelector('audio');
            if (a) { try { Object.defineProperty(a, 'buffered', {value: {length: 0}, configurable: true}); } catch(e) {} }
        }).catch(() => {});
        await page.locator('.jf-seek').evaluate(el => {
            el.value = 900; el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true}));
        });
        await page.waitForTimeout(800);
        const after = await audioSrc(page);
        check('far seek triggers server seek (URL gains StartTimeTicks)', after.includes('StartTimeTicks') || after.includes('startTimeTicks'), 'src=' + after);
        if (after.includes('Ticks')) {
            const m = after.match(/[Ss]tartTimeTicks=(\d+)/);
            const ticks = m ? parseInt(m[1], 10) : 0;
            check('StartTimeTicks is digits and in expected range (far seek)', ticks > 100000000 && ticks < 3000000000, 'ticks=' + ticks);
        }
        const netHit = streamUrls.find(u => u.includes('/Audio/') && u.includes('Ticks'));
        check('network reflects server seek (Ticks param sent)', !!netHit, 'stream hits=' + JSON.stringify(streamUrls.slice(-4)));
        await ctx.close();
    }

    console.log('T3: catalog duration fallback when audio metadata not yet loaded (prevents 0:00 on transcode)');
    {
        const ctx = await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block'});
        const page = await ctx.newPage();
        await setupCapture(page, null);
        await acceptConsent(page);
        await page.waitForFunction(() => document.querySelector('.jf-row'), null, {timeout: 10000});
        if (await page.locator('.jf-panel').isHidden()) { await page.click('.jf-disc'); await page.waitForTimeout(600); }
        await clickFirstTrack(page);
        await page.waitForTimeout(800);
        const dur = await page.locator('.jf-duration').textContent();
        check('duration shows catalog runtime during transcode play (not 0:00)', dur.trim() !== '0:00' && /\d+:\d{2}/.test(dur), 'dur=' + JSON.stringify(dur));
        const innerSrc = await audioSrc(page);
        check('still on a transcode URL (no static=true) while duration fallback applies', !innerSrc.includes('static='), 'src=' + innerSrc);
        await ctx.close();
    }

    console.log('T4: player still expands/collapses and plays without regression');
    {
        const ctx = await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block'});
        const page = await ctx.newPage();
        await setupCapture(page, null);
        await acceptConsent(page);
        check('player visible', await page.locator('#jf-player').isVisible());
        await page.click('.jf-disc');
        await page.waitForTimeout(500);
        check('panel visible after expand (still works)', await page.locator('.jf-panel').isVisible());
        await page.click('.jf-collapse-btn');
        await page.waitForTimeout(600);
        check('panel collapses and mini returns', !(await page.locator('.jf-panel').isVisible()) && await page.locator('.jf-mini').isVisible());
        await ctx.close();
    }

    await browser.close();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e && e.message, e && e.stack); process.exit(2); });
