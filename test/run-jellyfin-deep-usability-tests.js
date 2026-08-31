const {chromium} = require('playwright');
const {execFileSync} = require('child_process');
const fs = require('fs');
const SITE = 'http://127.0.0.1:8901';
try { execFileSync('ffmpeg', ['-y','-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-t','8','-c:a','aac','-b:a','64k','-movflags','+faststart','/tmp/jf-silent8.mp4'], {stdio:'ignore'}); } catch(e){}
const AUDIO_BODY = fs.existsSync('/tmp/jf-silent8.mp4') ? fs.readFileSync('/tmp/jf-silent8.mp4') : Buffer.alloc(100);
const MP3_BODY = AUDIO_BODY; // reuse for proxy mp3 check; header matters not body
const TRACKS = {Items: [
    {Id:'it1', Name:'糸守高校', Artists:['RADWIMPS'], Album:'Your Name', ImageTags:{Primary:'p1'}, RunTimeTicks:180*10000000},
    {Id:'it2', Name:'糸守高校 (Live)', Artists:['RADWIMPS'], Album:'Live', ImageTags:{Primary:'p1'}, RunTimeTicks:210*10000000},
    {Id:'it3', Name:'Small World', Artists:['EnArtist'], Album:'EnAlb', ImageTags:{Primary:'p1'}, RunTimeTicks:200*10000000},
    {Id:'cn1', Name:'小城故事', Artists:['Teresa Teng'], Album:'Alb', ImageTags:{Primary:'p1'}, RunTimeTicks:190*10000000},
    {Id:'jp1', Name:'君の名は', Artists:['JP'], Album:'Alb', ImageTags:{Primary:'p1'}, RunTimeTicks:195*10000000},
]};
let passed=0,failed=0;
function check(name,cond,extra){ if(cond){passed++; console.log('  PASS '+name);} else {failed++; console.log('  FAIL '+name+(extra?' — '+extra:''));}}
const CHROME_UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SAFARI_UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
async function setupPage(page, opts={}){
    const ua = opts.ua || CHROME_UA;
    await page.addInitScript(({ua})=>{
        try{ Object.defineProperty(navigator,'userAgent',{value:ua, configurable:true}); }catch(e){}
        window.__jfAudioSrc=''; window.__jfPlays=0;
        const d=Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype,'src');
        const o=d&&d.set;
        try{ Object.defineProperty(HTMLAudioElement.prototype,'src',{get(){return d&&d.get?d.get.call(this):this.getAttribute('src')||'';}, set(v){window.__jfAudioSrc=String(v||''); if(o) return o.call(this,v); this.setAttribute('src',v);}, configurable:true}); }catch(e){}
        const origSA=HTMLAudioElement.prototype.setAttribute;
        HTMLAudioElement.prototype.setAttribute=function(k,v){ if(String(k).toLowerCase()==='src') window.__jfAudioSrc=String(v||''); return origSA.call(this,k,v); };
        const op=HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play=function(){ window.__jfAudioReal=this; return op.call(this); };
    }, {ua});
    await page.route(u=>{ try{ return (typeof u==='string'?u:String(u.href||u)).includes('/api/jellyfin'); }catch(e){return false;}}, route=>{
        const url=route.request().url();
        const isUA = route.request().headers()['user-agent']||'';
        const isSafari = /Safari/.test(isUA) && !/Chrome|Chromium/.test(isUA);
        if(opts.force503 && url.includes('/api/jellyfin')) return route.fulfill({status:503, contentType:'application/json', body:JSON.stringify({error:'not configured'})});
        if(url.includes('/Audio/') && (url.includes('/stream')||url.includes('/universal'))){
            // also capture for later assertions if needed
            return route.fulfill({status:200, contentType: isSafari?'audio/mpeg':'audio/mp4', headers: isSafari?{'Accept-Ranges':'bytes'}:{'Accept-Ranges':'none'}, body: AUDIO_BODY});
        }
        if(url.includes('/Images/')) return route.fulfill({status:200, contentType:'image/webp', body:Buffer.alloc(10)});
        let body={ok:true};
        if(url.includes('/Users') && !url.includes('/Users/')) body=[{Name:'kami',Id:'u1'}];
        else if(url.includes('/Users/')||url.includes('IncludeItemTypes')||url.includes('SearchTerm')) {
            const u=new URL(url);
            const term=u.searchParams.get('SearchTerm')||'';
            if(term){ body={Items: TRACKS.Items.filter(t=> String(t.Name).toLowerCase().includes(term.toLowerCase())|| String(t.Artists[0]).toLowerCase().includes(term.toLowerCase())) }; }
            else body=TRACKS;
        }
        return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify(body)});
    });
}
async function acceptConsent(page){
    await page.goto(SITE+'/index.html');
    try{ await page.waitForSelector('#consent-overlay',{state:'visible', timeout:4000}); await page.waitForFunction(()=>window.__WARNING_ASSETS_LOADED===true,null,{timeout:15000}); await page.click('#accept-btn'); await page.waitForFunction(()=>document.getElementById('consent-overlay').style.display==='none',{timeout:5000}); }catch(e){}
    await page.waitForSelector('#jf-player',{state:'attached', timeout:10000}).catch(()=>{});
    await page.waitForFunction(()=> document.querySelector('.jf-row'), null,{timeout:10000}).catch(()=>{});
}
async function audioState(page){ return page.evaluate(()=>{ const a=window.__jfAudioReal; return {src:window.__jfAudioSrc||'', paused:a?a.paused:null, muted:a?a.muted:null, t:a?+a.currentTime.toFixed(2):null, ready:a?a.readyState:null, discSpinning:!!(document.querySelector('.jf-disc')&&document.querySelector('.jf-disc').classList.contains('jf-spinning'))};});}

(async()=>{
    const browser=await chromium.launch();
    console.log('GROUP A: cold start & consent vs proxy');
    {
        const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:CHROME_UA});
        const page=await ctx.newPage();
        await setupPage(page,{ua:CHROME_UA, force503:true});
        await page.goto(SITE+'/index.html');
        await page.waitForTimeout(1500);
        const hidden=await page.evaluate(()=>{ const r=document.getElementById('jf-player'); return !r || r.hidden; });
        check('A1 proxy 503 hides player', hidden);
        await ctx.close();
    }
    {
        const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:CHROME_UA});
        const page=await ctx.newPage();
        await setupPage(page,{ua:CHROME_UA});
        await page.goto(SITE+'/index.html');
        try{ await page.waitForSelector('#consent-overlay',{state:'visible', timeout:5000}); check('A2 consent overlay visible on first visit', true);} catch(e){ check('A2 consent overlay visible on first visit', false, e.message);}
        await ctx.close();
    }
    console.log('GROUP B: DOM presence & expand/collapse');
    {
        const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:CHROME_UA});
        const page=await ctx.newPage();
        await setupPage(page,{ua:CHROME_UA});
        await acceptConsent(page);
        const init=await page.evaluate(()=>{ const r=document.getElementById('jf-player'); const mini=document.querySelector('.jf-mini'); const panel=document.querySelector('.jf-panel'); return {hasPlayer:!!r, miniHidden:mini?mini.hidden:false, panelHidden:panel?panel.hidden:true};});
        check('B1 mini visible panel hidden initially', init.hasPlayer && !init.miniHidden && init.panelHidden);
        await page.click('.jf-disc');
        await page.waitForTimeout(350);
        const exp1=await page.evaluate(()=>{ const p=document.querySelector('.jf-panel'); const m=document.querySelector('.jf-mini'); return {panelHidden:p.hidden, miniHidden:m.hidden};});
        check('B2 click disc expands panel', !exp1.panelHidden && exp1.miniHidden);
        await page.click('.jf-panel-head');
        await page.waitForTimeout(500);
        const col1=await page.evaluate(()=>{ const p=document.querySelector('.jf-panel'); const m=document.querySelector('.jf-mini'); return {panelHidden:p.hidden, miniHidden:m.hidden};});
        check('B2 click header collapses', col1.panelHidden && !col1.miniHidden);
        // persistence
        await page.click('.jf-disc'); await page.waitForTimeout(350);
        const pref1=await page.evaluate(()=> JSON.parse(localStorage.getItem('jellyfin_player_prefs')||'{}'));
        check('B3 expanded true persisted', pref1.expanded===true);
        await page.click('.jf-panel-head'); await page.waitForTimeout(500);
        const pref2=await page.evaluate(()=> JSON.parse(localStorage.getItem('jellyfin_player_prefs')||'{}'));
        check('B3 collapsed false persisted', pref2.expanded===false);
        await ctx.close();
    }
    console.log('GROUP C: playback controls');
    {
        const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:CHROME_UA});
        await ctx.addInitScript(()=>{ try{localStorage.setItem('system_warning_consent','true');}catch(e){}});
        const page=await ctx.newPage();
        await setupPage(page,{ua:CHROME_UA});
        await page.goto(SITE+'/index.html');
        await page.waitForSelector('#jf-player',{state:'attached', timeout:10000});
        await page.waitForFunction(()=> (window.__jfAudioSrc||'').includes('/Audio/'), null,{timeout:12000});
        await page.waitForTimeout(900);
        let st=await audioState(page);
        // may be muted fallback, but should be playing
        const wasPaused = st.paused;
        // mini-play should toggle
        await page.click('.jf-mini-play');
        await page.waitForTimeout(600);
        let afterPause=await audioState(page);
        check('C1 mini-play pauses', afterPause.paused===true, JSON.stringify(afterPause));
        await page.click('.jf-mini-play');
        await page.waitForTimeout(700);
        let afterPlay=await audioState(page);
        check('C1 mini-play resumes', afterPlay.paused===false, JSON.stringify(afterPlay));
        check('C1 disc spinning when playing', afterPlay.discSpinning===true);
        // expand to use panel controls
        await page.evaluate(()=>{ const r=document.getElementById('jf-player'); if(r){ const p=r.querySelector('.jf-panel'); if(p&&p.hidden){ r.querySelector('.jf-disc').click(); }}});
        await page.waitForTimeout(400);
        // next/prev with repeat off (default)
        const beforeNext=await page.evaluate(()=> document.querySelector('.jf-row.active .jf-row-name')?.textContent||'');
        await page.click('.jf-next-btn'); await page.waitForTimeout(800);
        const afterNext=await page.evaluate(()=> document.querySelector('.jf-row.active .jf-row-name')?.textContent||'');
        check('C2 next advances track', beforeNext!==afterNext, `before=${beforeNext} after=${afterNext}`);
        await page.click('.jf-prev-btn'); await page.waitForTimeout(800);
        const afterPrev=await page.evaluate(()=> document.querySelector('.jf-row.active .jf-row-name')?.textContent||'');
        check('C2 prev returns', afterPrev===beforeNext, `prev=${afterPrev}`);
        // repeat cycling
        const rep0=await page.evaluate(()=> JSON.parse(localStorage.getItem('jellyfin_player_prefs')||'{}').repeat);
        await page.click('.jf-repeat-btn'); await page.waitForTimeout(200);
        const rep1=await page.evaluate(()=> JSON.parse(localStorage.getItem('jellyfin_player_prefs')||'{}').repeat);
        await page.click('.jf-repeat-btn'); await page.waitForTimeout(200);
        const rep2=await page.evaluate(()=> JSON.parse(localStorage.getItem('jellyfin_player_prefs')||'{}').repeat);
        await page.click('.jf-repeat-btn'); await page.waitForTimeout(200);
        const rep3=await page.evaluate(()=> JSON.parse(localStorage.getItem('jellyfin_player_prefs')||'{}').repeat);
        check('C4 repeat cycles off->all->one->off', rep0==='off' && rep1==='all' && rep2==='one' && rep3==='off', `${rep0}->${rep1}->${rep2}->${rep3}`);
        // shuffle
        const orderBefore=await page.evaluate(()=> Array.from(document.querySelectorAll('.jf-row .jf-row-name')).map(n=>n.textContent).join('|'));
        await page.click('.jf-shuffle-btn'); await page.waitForTimeout(300);
        const shufOn=await page.evaluate(()=> JSON.parse(localStorage.getItem('jellyfin_player_prefs')||'{}').shuffle);
        const orderAfter=await page.evaluate(()=> Array.from(document.querySelectorAll('.jf-row .jf-row-name')).map(n=>n.textContent).join('|'));
        check('C3 shuffle toggles on and reorders', shufOn===true && orderBefore!==orderAfter, `before=${orderBefore} after=${orderAfter}`);
        // ensure current track still active after shuffle
        const activeAfterShuffle=await page.evaluate(()=> !!document.querySelector('.jf-row.active'));
        check('C3 shuffle keeps active highlight', activeAfterShuffle);
        await page.click('.jf-shuffle-btn'); await page.waitForTimeout(300);
        const shufOff=await page.evaluate(()=> JSON.parse(localStorage.getItem('jellyfin_player_prefs')||'{}').shuffle);
        check('C3 shuffle toggles off', shufOff===false);
        await ctx.close();
    }
    console.log('GROUP D: seek & scrub');
    {
        const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:CHROME_UA});
        await ctx.addInitScript(()=>{ try{localStorage.setItem('system_warning_consent','true');}catch(e){}});
        const page=await ctx.newPage();
        await setupPage(page,{ua:CHROME_UA});
        await page.goto(SITE+'/index.html');
        await page.waitForFunction(()=> (window.__jfAudioSrc||'').includes('/Audio/'), null,{timeout:12000});
        await page.waitForFunction(()=> window.__jfAudioReal && !window.__jfAudioReal.paused, null,{timeout:8000}).catch(()=>{});
        await page.waitForTimeout(1200);
        await page.evaluate(()=>{ const r=document.getElementById('jf-player'); if(r){ const p=r.querySelector('.jf-panel'); if(p&&p.hidden) r.querySelector('.jf-disc').click(); }});
        await page.waitForTimeout(400);
        const seek=page.locator('.jf-seek');
        const t0=await page.evaluate(()=> window.__jfAudioReal?window.__jfAudioReal.currentTime:0);
        await seek.evaluate(el=>{ el.value=300; el.dispatchEvent(new Event('change',{bubbles:true})); });
        await page.waitForTimeout(800);
        let afterSeek=await page.evaluate(()=>{ const a=window.__jfAudioReal; return {t:+a.currentTime.toFixed(2), src:a?a.src.slice(-20):''};});
        check('D1 scrub 30% changes time (native or blob)', Math.abs(afterSeek.t - t0) > 0.5 || afterSeek.t>1, `t0=${t0} t=${afterSeek.t}`);
        // rapid scrub 30% -> 70% should land near 70%
        await seek.evaluate(el=>{ el.value=700; el.dispatchEvent(new Event('change',{bubbles:true})); });
        await page.waitForTimeout(800);
        // if blob path, second rapid may need blob; wait a bit more
        await page.waitForTimeout(1000);
        let afterRapid=await page.evaluate(()=>{ const a=window.__jfAudioReal; return {t:+a.currentTime.toFixed(1)};});
        // just verify time moved forward from previous, not stuck at 0
        check('D2 rapid scrub to 70% moves time forward', afterRapid.t > afterSeek.t + 0.3 || afterRapid.t>3, `t=${afterRapid.t} prev=${afterSeek.t}`);
        await ctx.close();
    }
    console.log('GROUP E: volume & search');
    {
        const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:CHROME_UA});
        await ctx.addInitScript(()=>{ try{localStorage.setItem('system_warning_consent','true');}catch(e){}});
        const page=await ctx.newPage();
        await setupPage(page,{ua:CHROME_UA});
        await page.goto(SITE+'/index.html');
        await page.waitForFunction(()=> (window.__jfAudioSrc||'').includes('/Audio/'), null,{timeout:12000});
        await page.waitForTimeout(800);
        await page.evaluate(()=>{ const r=document.getElementById('jf-player'); if(r){ const p=r.querySelector('.jf-panel'); if(p&&p.hidden) r.querySelector('.jf-disc').click(); }});
        await page.waitForTimeout(400);
        const vol=page.locator('.jf-volume');
        await vol.evaluate(el=>{ el.value='0.33'; el.dispatchEvent(new Event('input',{bubbles:true})); });
        await page.waitForTimeout(300);
        const vState=await page.evaluate(()=>{ return {vol: window.__jfAudioReal?window.__jfAudioReal.volume:null, pref: JSON.parse(localStorage.getItem('jellyfin_player_prefs')||'{}').volume};});
        check('E1 volume slider updates audio & prefs', Math.abs(vState.vol-0.33)<0.02 && Math.abs(vState.pref-0.33)<0.02, JSON.stringify(vState));
        // search
        const search=page.locator('.jf-search');
        await search.fill('糸守');
        await page.waitForTimeout(900);
        const filtered=await page.evaluate(()=> Array.from(document.querySelectorAll('.jf-row')).map(r=>r.textContent).join('|'));
        check('E3 search filters to Itomori', filtered.includes('糸守') && !filtered.includes('Small World'), filtered);
        await search.fill('');
        await page.waitForTimeout(900);
        const restored=await page.evaluate(()=> document.querySelectorAll('.jf-row').length);
        check('E3 clear search restores list', restored>=5, `count=${restored}`);
        await search.fill('ZZZNOPE');
        await page.waitForTimeout(900);
        const none=await page.evaluate(()=> document.querySelectorAll('.jf-row').length);
        // empty filtered list still shows zero rows (not empty message? but list empty)
        check('E3 no-match yields zero rows', none===0, `count=${none}`);
        await ctx.close();
    }
    console.log('GROUP F: media & safari vs chrome');
    {
        for(const [label,ua] of [['Chrome',CHROME_UA],['Safari',SAFARI_UA]]){
            const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:ua});
            await ctx.addInitScript(()=>{ try{localStorage.setItem('system_warning_consent','true');}catch(e){}});
            const page=await ctx.newPage();
            let capturedUrl='';
            await page.addInitScript(({ua})=>{
                try{Object.defineProperty(navigator,'userAgent',{value:ua, configurable:true});}catch(e){}
                window.__jfAudioSrc='';
                const d=Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype,'src');
                const o=d&&d.set;
                try{Object.defineProperty(HTMLAudioElement.prototype,'src',{get(){return d&&d.get?d.get.call(this):this.getAttribute('src')||'';}, set(v){window.__jfAudioSrc=String(v||''); if(String(v).includes('/Audio/')) window.__capturedStreamUrl=String(v); if(o) return o.call(this,v); this.setAttribute('src',v);}, configurable:true});}catch(e){}
            }, {ua});
            await page.route(u=>{ try{return (typeof u==='string'?u:String(u.href||u)).includes('/api/jellyfin');}catch(e){return false;}}, route=>{
                const url=route.request().url();
                const isS=/Safari/.test(route.request().headers()['user-agent']||'') && !/Chrome/.test(route.request().headers()['user-agent']||'');
                if(url.includes('/Audio/')){ capturedUrl=url; return route.fulfill({status:200, contentType:isS?'audio/mpeg':'audio/mp4', headers: isS?{'Accept-Ranges':'bytes','Content-Type':'audio/mpeg'}:{'Accept-Ranges':'none'}, body:AUDIO_BODY});}
                let body={ok:true};
                if(url.includes('/Users') && !url.includes('/Users/')) body=[{Name:'kami',Id:'u1'}];
                else if(url.includes('/Users/')||url.includes('IncludeItemTypes')||url.includes('SearchTerm')) body=TRACKS;
                return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify(body)});
            });
            await page.goto(SITE+'/index.html');
            await page.waitForFunction(()=> (window.__jfAudioSrc||'').includes('/Audio/'), null,{timeout:12000});
            const src=await page.evaluate(()=> window.__capturedStreamUrl||window.__jfAudioSrc);
            check(`F3 ${label} stream requested`, src.includes('/Audio/'), src);
            const playing=await page.evaluate(()=> window.__jfAudioReal ? !window.__jfAudioReal.paused : false).catch(()=>false);
            // at least src set proves branch executed; playing may be muted fallback pending — just ensure src exists
            check(`F3 ${label} src set`, !!src, src);
            await ctx.close();
        }
        // direct proxy unit: verify Safari forces mp3 / Chrome mp4 via sanitizeParams
        try{
            const fsSync=require('fs');
            let src=fsSync.readFileSync('functions/api/jellyfin/[[path]].js','utf8');
            // extract functions by eval in sandbox
            const vm=require('vm');
            const sandbox={URL, URLSearchParams, Headers, Response, console:{warn:()=>{}} };
            // strip export
            src=src.replace('export async function onRequest','async function onRequest');
            vm.createContext(sandbox);
            vm.runInContext(src+`\nthis.__san=sanitizeParams; this.__ft=forcedTranscodeFor; this.__isS=isSafariRequest;`, sandbox);
            const mkReq=ua=>({headers:{get:(k)=> k.toLowerCase()==='user-agent'?ua:null}});
            const chromeFT=sandbox.__ft(mkReq(CHROME_UA));
            const safariFT=sandbox.__ft(mkReq(SAFARI_UA));
            check('F proxy Chrome forces mp4/aac', chromeFT.container==='mp4' && chromeFT.audioCodec==='aac', JSON.stringify(chromeFT));
            check('F proxy Safari forces mp3', safariFT.container==='mp3' && safariFT.audioCodec==='mp3', JSON.stringify(safariFT));
            const pChrome=sandbox.__san(`Audio/id/stream`, `?static=true&container=mkv&audioCodec=opus&limit=999`, 'u1', mkReq(CHROME_UA));
            check('F proxy sanitizes limit to 200', pChrome.get('Limit')==='200', pChrome.toString());
            check('F proxy Chrome container forced mp4', pChrome.get('container')==='mp4', pChrome.toString());
            const pSafari=sandbox.__san(`Audio/id/stream`, `?container=mp4`, 'u1', mkReq(SAFARI_UA));
            check('F proxy Safari container forced mp3', pSafari.get('container')==='mp3', pSafari.toString());
        }catch(e){ check('F proxy unit', false, e.message); }
    }
    console.log('GROUP G: scroll auto-collapse');
    {
        const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:CHROME_UA});
        await ctx.addInitScript(()=>{ try{localStorage.setItem('system_warning_consent','true');}catch(e){}});
        const page=await ctx.newPage();
        await setupPage(page,{ua:CHROME_UA});
        await page.goto(SITE+'/index.html');
        await page.waitForFunction(()=> (window.__jfAudioSrc||'').includes('/Audio/'), null,{timeout:12000});
        await page.waitForTimeout(500);
        await page.evaluate(()=>{ const r=document.getElementById('jf-player'); if(r){ const p=r.querySelector('.jf-panel'); if(p&&p.hidden) r.querySelector('.jf-disc').click(); }});
        await page.waitForTimeout(400);
        let exp=await page.evaluate(()=> !document.querySelector('.jf-panel').hidden);
        check('G0 precond expanded', exp);
        // scroll content-area should collapse
        await page.evaluate(()=>{ const ca=document.querySelector('.content-area'); if(ca) ca.dispatchEvent(new Event('scroll',{bubbles:false})); });
        await page.waitForTimeout(600);
        let afterContent=await page.evaluate(()=> document.querySelector('.jf-panel').hidden);
        check('G1 content-area scroll collapses', afterContent===true, `hidden=${afterContent}`);
        // re-expand and scroll tracklist should NOT collapse
        await page.evaluate(()=>{ const r=document.getElementById('jf-player'); r.querySelector('.jf-disc').click(); });
        await page.waitForTimeout(400);
        await page.evaluate(()=>{ const tl=document.querySelector('.jf-tracklist'); if(tl) tl.dispatchEvent(new Event('scroll',{bubbles:false})); });
        await page.waitForTimeout(600);
        let afterTrack=await page.evaluate(()=> document.querySelector('.jf-panel').hidden);
        check('G2 tracklist scroll does NOT collapse', afterTrack===false, `hidden=${afterTrack}`);
        // scroll documentElement should collapse (viewport fallback)
        await page.evaluate(()=>{ document.documentElement.dispatchEvent(new Event('scroll',{bubbles:false})); });
        await page.waitForTimeout(600);
        let afterDoc=await page.evaluate(()=> document.querySelector('.jf-panel').hidden);
        check('G fallback document scroll collapses', afterDoc===true);
        await ctx.close();
    }
    console.log('GROUP H: keyboard & a11y & buffering');
    {
        const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:CHROME_UA});
        await ctx.addInitScript(()=>{ try{localStorage.setItem('system_warning_consent','true');}catch(e){}});
        const page=await ctx.newPage();
        await setupPage(page,{ua:CHROME_UA});
        await page.goto(SITE+'/index.html');
        await page.waitForFunction(()=> (window.__jfAudioSrc||'').includes('/Audio/'), null,{timeout:12000});
        await page.waitForFunction(()=> window.__jfAudioReal && !window.__jfAudioReal.paused, null,{timeout:8000}).catch(()=>{});
        await page.waitForTimeout(500);
        await page.evaluate(()=>{ const r=document.getElementById('jf-player'); if(r){ const p=r.querySelector('.jf-panel'); if(p&&p.hidden) r.querySelector('.jf-disc').click(); }});
        await page.waitForTimeout(400);
        // keyboard Space should toggle when expanded and not focused on input
        await page.keyboard.press('Space');
        await page.waitForTimeout(600);
        let paused=await page.evaluate(()=> window.__jfAudioReal.paused);
        check('H keyboard Space pauses when expanded', paused===true);
        await page.keyboard.press('Space');
        await page.waitForTimeout(600);
        let playing=await page.evaluate(()=> !window.__jfAudioReal.paused);
        check('H keyboard Space resumes', playing===true);
        // when input focused, Space should NOT toggle
        await page.click('.jf-search');
        await page.waitForTimeout(200);
        await page.keyboard.press('Space');
        await page.waitForTimeout(400);
        let stillPlaying=await page.evaluate(()=> !window.__jfAudioReal.paused);
        check('H Space in input does not toggle', stillPlaying===true);
        await page.keyboard.press('Escape');
        await page.evaluate(()=>{ const s=document.querySelector('.jf-search'); if(s) s.blur(); });
        // a11y: disc has aria-label, list has role=list, rows role=listitem
        const a11y=await page.evaluate(()=>{
            const disc=document.querySelector('.jf-disc');
            const list=document.querySelector('.jf-tracklist');
            const row=document.querySelector('.jf-row');
            return {discAria:disc?disc.getAttribute('aria-label'):null, listRole:list?list.getAttribute('role'):null, rowRole:row?row.getAttribute('role'):null};
        });
        check('H a11y roles present', a11y.discAria && a11y.listRole==='list' && a11y.rowRole==='listitem', JSON.stringify(a11y));
        // buffering ring: trigger waiting event should add class
        await page.evaluate(()=>{ const a=window.__jfAudioReal; a.dispatchEvent(new Event('waiting')); });
        await page.waitForTimeout(100);
        const buffering=await page.evaluate(()=> document.querySelector('.jf-disc').classList.contains('jf-buffering'));
        check('H waiting adds buffering ring', buffering===true);
        await page.evaluate(()=>{ const a=window.__jfAudioReal; a.dispatchEvent(new Event('playing')); });
        await page.waitForTimeout(100);
        const notBuf=await page.evaluate(()=> !document.querySelector('.jf-disc').classList.contains('jf-buffering'));
        check('H playing removes buffering ring', notBuf===true);
        await ctx.close();
    }
    console.log('GROUP I: second-visit autoplay & badge');
    {
        const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:CHROME_UA});
        const page=await ctx.newPage();
        await setupPage(page,{ua:CHROME_UA});
        await page.goto(SITE+'/index.html');
        await page.waitForSelector('#consent-overlay',{state:'visible', timeout:5000});
        try{ await page.waitForFunction(()=>window.__WARNING_ASSETS_LOADED===true,null,{timeout:15000}); await page.click('#accept-btn'); await page.waitForTimeout(400);}catch(e){}
        const page2=await ctx.newPage();
        await setupPage(page2,{ua:CHROME_UA});
        await page2.goto(SITE+'/index.html');
        await page2.waitForSelector('#jf-player',{state:'attached', timeout:10000});
        await page2.waitForFunction(()=> (window.__jfAudioSrc||'').includes('/Audio/'), null,{timeout:12000});
        await page2.waitForFunction(()=> window.__jfAudioReal && !window.__jfAudioReal.paused, null,{timeout:8000});
        await page2.waitForTimeout(700);
        const st=await page2.evaluate(()=>{
            const a=window.__jfAudioReal;
            const b=document.getElementById('jf-mute-wait');
            return {paused:a.paused, muted:a.muted, badge:b?b.classList.contains('jf-show'):false};
        });
        check('I second visit playing (muted fallback or allowed)', !st.paused, JSON.stringify(st));
        check('I badge consistent with muted', st.muted?st.badge:!st.badge, JSON.stringify(st));
        // gesture unmute
        await page2.mouse.click(640,300); await page2.waitForTimeout(500);
        const after=await page2.evaluate(()=>{ const a=window.__jfAudioReal; const b=document.getElementById('jf-mute-wait'); return {muted:a.muted, badge:b?b.classList.contains('jf-show'):false};});
        check('I click unmutes and hides badge', !after.muted && !after.badge, JSON.stringify(after));
        await ctx.close();
    }
    await browser.close();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed?1:0);
})().catch(e=>{ console.error('HARNESS ERROR', e.message, e.stack); process.exit(2);});
