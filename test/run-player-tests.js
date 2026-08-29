const { chromium } = require('playwright');

const SITE = 'http://127.0.0.1:8901';
const TRACKS = {
    Items: [
        { Id: 't1', Name: 'Song One', Artists: ['Artist A'], Album: 'Alb', ImageTags: { Primary: 'p1' } },
        { Id: 't2', Name: 'Song Two', Artists: ['Artist B'], Album: 'Alb2' }
    ]
};

let passed = 0, failed = 0;
function check(name, cond, extra) {
    if (cond) { passed++; console.log('  PASS ' + name); }
    else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

async function setup(page) {
    await page.addInitScript(() => {
        window.__srcStarts = 0;
        const orig = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...a) {
            window.__srcStarts++;
            return orig.apply(this, a);
        };
    });
    await page.route(u => u.href.includes('/api/jellyfin'), (route) => {
        const url = route.request().url();
        let body = { ok: true };
        if (url.includes('/Users') && !url.includes('/Users/')) body = [{ Name: 'kami', Id: 'u1' }];
        else if (url.includes('/Users/') || url.includes('IncludeItemTypes')) body = TRACKS;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
}

async function acceptConsent(page) {
    await page.goto(SITE + '/index.html');
    await page.waitForSelector('#consent-overlay', { state: 'visible' });
    await page.waitForFunction(() => window.__WARNING_ASSETS_LOADED === true, null, { timeout: 20000 });
    await page.click('#accept-btn');
    await page.waitForFunction(() => document.getElementById('consent-overlay').style.display === 'none');
    await page.waitForSelector('#jf-player .jf-mini', { state: 'visible', timeout: 10000 });
}

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await setup(page);

    console.log('T1: compact pill + genie expand/collapse');
    await acceptConsent(page);
    const root = page.locator('#jf-player');
    check('player visible', await root.isVisible());
    check('mini visible, panel hidden', await page.locator('.jf-mini').isVisible() && !(await page.locator('.jf-panel').isVisible()));
    let box = await root.boundingBox();
    check('collapsed height <= 48px', box.height <= 48, 'h=' + box.height);
    check('collapsed width <= 230px', box.width <= 230, 'w=' + box.width);

    await page.click('.jf-disc');
    await page.waitForTimeout(120);
    check('genie-in class applied', await page.locator('.jf-panel.jf-genie-in').count() === 1);
    await page.waitForTimeout(400);
    check('panel visible after expand', await page.locator('.jf-panel').isVisible());
    check('mini hidden after expand', !(await page.locator('.jf-mini').isVisible()));
    box = await root.boundingBox();
    check('expanded height > 200px', box.height > 200, 'h=' + box.height);

    await page.click('.jf-collapse-btn');
    await page.waitForTimeout(120);
    check('genie-out class applied', await page.locator('.jf-panel.jf-genie-out').count() === 1);
    await page.waitForTimeout(500);
    check('panel hidden after collapse', !(await page.locator('.jf-panel').isVisible()));
    check('mini visible after collapse', await page.locator('.jf-mini').isVisible());
    check('mini-pop class applied', await page.locator('.jf-mini.jf-mini-pop').count() === 1);
    box = await root.boundingBox();
    check('back to compact height', box.height <= 48, 'h=' + box.height);

    console.log('T2: expanded state persists across reload');
    await page.click('.jf-disc');
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForFunction(() => window.__WARNING_ASSETS_LOADED === true, null, { timeout: 20000 });
    await page.waitForSelector('#jf-player', { timeout: 10000 });
    check('panel still expanded after reload', await page.locator('.jf-panel').isVisible());
    await page.evaluate(() => localStorage.setItem('jellyfin_player_prefs', JSON.stringify({ expanded: false })));

    console.log('T3: warning audio only on DECLINE, silent misclicks');
    await page.evaluate(() => { window.__srcStarts = 0; window.__flashes = 0; window.addEventListener('warning:flash', () => window.__flashes++); });
    await page.mouse.click(400, 400);
    await page.waitForTimeout(350);
    check('misclick plays no sound', await page.evaluate(() => window.__srcStarts) === 0);
    check('misclick still flashes', await page.evaluate(() => window.__flashes) > 0);

    await page.evaluate(() => localStorage.removeItem('system_warning_consent'));
    await page.goto(SITE + '/index.html?fresh=1');
    await page.waitForFunction(() => window.__WARNING_ASSETS_LOADED === true, null, { timeout: 20000 });
    await page.waitForSelector('#decline-btn:not([disabled])', { timeout: 20000 });
    await page.evaluate(() => { window.__srcStarts = 0; });
    await page.click('#decline-btn');
    await page.waitForTimeout(700);
    check('DECLINE plays sound', await page.evaluate(() => window.__srcStarts) > 0, 'starts=' + await page.evaluate(() => window.__srcStarts));

    console.log('T4: player interaction never flashes');
    await ctx.clearCookies();
    const page2 = await ctx.newPage();
    await setup(page2);
    await acceptConsent(page2);
    await page2.evaluate(() => { window.__flashes = 0; window.addEventListener('warning:flash', () => window.__flashes++); });
    await page2.click('.jf-disc');
    await page2.waitForTimeout(250);
    await page2.click('.jf-collapse-btn');
    await page2.waitForTimeout(250);
    await page2.click('.jf-mini-play');
    await page2.waitForTimeout(250);
    check('zero flashes from player clicks', await page2.evaluate(() => window.__flashes) === 0);

    console.log('T5: mini pill shows now-playing + play/pause sync');
    await page2.waitForFunction(() => document.querySelector('.jf-row'), null, { timeout: 10000 });
    if (await page2.locator('.jf-panel').isHidden()) {
        await page2.click('.jf-disc');
        await page2.waitForTimeout(500);
    }
    await page2.click('.jf-panel .jf-tracklist .jf-row');
    await page2.waitForTimeout(400);
    check('mini name updated', (await page2.locator('.jf-mini-name').textContent()).startsWith('Song'));
    check('mini play icon synced to pause', (await page2.locator('.jf-mini-play').textContent()).trim() === '⏸');
    check('disc spinning', await page2.locator('.jf-disc.jf-spinning').count() === 1);
    await page2.click('.jf-collapse-btn');
    await page2.waitForTimeout(600);
    await page2.click('.jf-mini-play');
    await page2.waitForTimeout(300);
    check('mini play icon back to play', (await page2.locator('.jf-mini-play').textContent()).trim() === '▶');

    await browser.close();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e.message); process.exit(2); });
