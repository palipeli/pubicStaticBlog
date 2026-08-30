const {chromium} = require('playwright');
const SITE = 'http://127.0.0.1:8901';
const TRACKS = {Items: [
    {Id: 'cn1', Name: '小城故事', Artists: ['Teresa Teng'], Album: 'Alb', ImageTags: {Primary: 'p1'}, RunTimeTicks: 180 * 10000000},
    {Id: 'cn2', Name: 'K歌之王', Artists: ['Eason Chan'], Album: 'Alb2', RunTimeTicks: 210 * 10000000},
    {Id: 'cn3', Name: 'I LOVE YOU feat.有華', Artists: ['X'], Album: 'Alb3', RunTimeTicks: 200 * 10000000},
    {Id: 'jp1', Name: '君の瞳', Artists: ['JP Artist'], Album: 'Alb4', RunTimeTicks: 190 * 10000000},
    {Id: 'jp2', Name: '03 - 八月、某、月明かり', Artists: ['JP Artist2'], Album: 'Alb5', RunTimeTicks: 220 * 10000000},
    {Id: 'en1', Name: 'Rasputin', Artists: ['Boney M'], Album: 'Alb6', RunTimeTicks: 230 * 10000000}
]};
const CHINESE_IDS = ['cn1', 'cn2', 'cn3'];
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
async function audioSrc(page) { return page.evaluate(() => window.__jfAudioSrc || ''); }
function idFromSrc(src) { const m = src.match(/\/Audio\/([^/]+)\//); return m ? m[1] : ''; }

(async () => {
    const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});

    console.log('T1: fresh visitor accepts consent -> random Chinese-title track autoplays');
    {
        const ctx = await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block'});
        const page = await ctx.newPage();
        await setupCapture(page, null);
        await acceptConsent(page);
        await page.waitForFunction(() => document.querySelector('.jf-row'), null, {timeout: 10000});
        await page.waitForFunction(() => (window.__jfAudioSrc || '').includes('/Audio/'), null, {timeout: 10000});
        const src = await audioSrc(page);
        const id = idFromSrc(src);
        check('audio src is a stream URL', /\/Audio\/[^/]+\/stream/.test(src), 'src=' + src);
        check('autoplay track is from the Chinese-title pool', CHINESE_IDS.indexOf(id) !== -1, 'id=' + id + ' src=' + src);
        const miniName = await page.locator('.jf-mini-name').textContent();
        check('mini pill shows the Chinese track name', miniName && miniName.trim() !== 'Not playing', 'name=' + JSON.stringify(miniName));
        const row = await page.locator('.jf-row.active .jf-row-name').first().textContent().catch(() => '');
        check('tracklist highlights the playing row', !!row, 'active row=' + JSON.stringify(row));
        await ctx.close();
    }

    console.log('T2: returning visitor (consent preset) -> autoplays without any interaction');
    {
        const ctx = await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block'});
        await ctx.addInitScript(() => { try { localStorage.setItem('system_warning_consent', 'true'); } catch(e) {} });
        const page = await ctx.newPage();
        await setupCapture(page, null);
        await page.goto(SITE + '/index.html');
        await page.waitForSelector('#jf-player', {state: 'attached', timeout: 10000});
        await page.waitForFunction(() => (window.__jfAudioSrc || '').includes('/Audio/'), null, {timeout: 10000});
        const src = await audioSrc(page);
        const id = idFromSrc(src);
        check('no-overlay visit autoplays Chinese track', CHINESE_IDS.indexOf(id) !== -1, 'id=' + id + ' src=' + src);
        const overlayHidden = await page.evaluate(() => { const o = document.getElementById('consent-overlay'); return !o || o.style.display === 'none'; });
        check('consent overlay absent/hidden for returning visitor', overlayHidden);
        await ctx.close();
    }

    console.log('T3: visitor never consented -> player loads but nothing autoplays');
    {
        const ctx = await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block'});
        const page = await ctx.newPage();
        await setupCapture(page, null);
        await page.goto(SITE + '/index.html');
        await page.waitForSelector('#consent-overlay', {state: 'visible', timeout: 8000});
        await page.waitForFunction(() => document.querySelector('.jf-row'), null, {timeout: 10000});
        await page.waitForTimeout(1500);
        const src = await audioSrc(page);
        check('no audio src before consent', !src.includes('/Audio/'), 'src=' + src);
        const miniName = await page.locator('.jf-mini-name').textContent();
        check('player still shows idle state', miniName.trim() === 'Not playing', 'name=' + JSON.stringify(miniName));
        await ctx.close();
    }

    console.log('T4: pool filter stability across repeat visits (mixed CN/JP/EN library)');
    {
        const seen = new Set();
        for (let i = 0; i < 5; i++) {
            const ctx = await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block'});
            await ctx.addInitScript(() => { try { localStorage.setItem('system_warning_consent', 'true'); } catch(e) {} });
            const page = await ctx.newPage();
            await setupCapture(page, null);
            await page.goto(SITE + '/index.html');
            await page.waitForFunction(() => (window.__jfAudioSrc || '').includes('/Audio/'), null, {timeout: 15000});
            const id = idFromSrc(await audioSrc(page));
            check('visit ' + (i + 1) + ': picked Chinese-title track', CHINESE_IDS.indexOf(id) !== -1, 'id=' + id);
            seen.add(id);
            await ctx.close();
        }
        check('randomness observed across visits (at least 2 distinct picks)', seen.size >= 2, 'seen=' + JSON.stringify([...seen]));
    }

    await browser.close();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e && e.message, e && e.stack); process.exit(2); });
