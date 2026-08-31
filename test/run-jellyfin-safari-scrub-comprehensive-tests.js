#!/usr/bin/env node
'use strict';
const {chromium}=require('playwright');
const SITE='http://127.0.0.1:8901';
const TRACKS={Items:[
 {Id:'t1',Name:'Song One',Artists:['Artist A'],Album:'Alb',ImageTags:{Primary:'p1'},RunTimeTicks:137*10000000, AlbumPrimaryImageTag:'p1'},
 {Id:'t2',Name:'Song Two',Artists:['Artist B'],Album:'Alb2',RunTimeTicks:137*10000000}
]};
let passed=0,failed=0;
function check(name,cond,extra){ if(cond){passed++; console.log('  PASS '+name);} else {failed++; console.log('  FAIL '+name+(extra?' — '+extra:''));}}
async function setupCapture(page, capture, ua){
  await page.addInitScript((uaStr)=>{
    const isSafari = /Safari/.test(uaStr||'') && !/Chrome|Chromium|CriOS|FxiOS|Android/.test(uaStr||'');
    window.__jfIsSafari = isSafari;
    window.__jfAudioSrc='';
    window.__jfBlobFetches=[];
    // Wrap Audio to capture src and simulate Safari vs Chrome media states
    const OrigAudio = window.Audio;
    window.Audio = function(...args){
      const a = new OrigAudio(...args);
      // Safari: preload auto, Chrome: metadata
      try{ a.preload = isSafari ? 'auto' : 'metadata'; }catch(e){}
      try{ a.playsInline=true; a.setAttribute('webkit-playsinline','true'); }catch(e){}
      let mockDuration=NaN;
      let mockSeekable={length:1, start:()=>0, end:()=>0};
      let mockBuffered={length:1, start:()=>0, end:()=>5};
      let mockReadyState=0;
      let isBlob=false;
      const updateMock=()=>{
        isBlob = a.src && a.src.startsWith('blob:');
        if(isBlob){
          mockDuration=137;
          mockSeekable={length:1, start:(i)=>0, end:(i)=>137};
          mockBuffered={length:1, start:(i)=>0, end:(i)=>137};
          mockReadyState=0;
          setTimeout(()=>{
            mockReadyState=1;
            a.dispatchEvent(new Event('loadedmetadata'));
            setTimeout(()=>{ mockReadyState=4; a.dispatchEvent(new Event('canplay')); },10);
          },10);
        } else if(a.src && a.src.includes('/Audio/')){
          mockDuration=NaN;
          mockSeekable={length:1, start:()=>0, end:()=>0};
          mockBuffered={length:1, start:()=>0, end:()=>5};
          mockReadyState=0;
          setTimeout(()=>{
            mockDuration=137;
            mockSeekable={length:1, start:()=>0, end:()=>0};
            mockReadyState=1;
            a.dispatchEvent(new Event('loadedmetadata'));
            setTimeout(()=>{ mockReadyState=4; a.dispatchEvent(new Event('canplay')); },10);
          },30);
        }
      };
      const origSet = Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype,'src')?.set;
      const origGet = Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype,'src')?.get;
      try{
        Object.defineProperty(a,'src',{
          get(){ return origGet ? origGet.call(this) : this.getAttribute('src')||''; },
          set(v){
            window.__jfAudioSrc=String(v||'');
            let ret;
            if(origSet) ret=origSet.call(this,v);
            else ret=this.setAttribute('src',v);
            updateMock();
            return ret;
          },
          configurable:true
        });
      }catch(e){}
      // Also trap setAttribute
      const origSA=a.setAttribute;
      a.setAttribute=function(k,v){ if(String(k).toLowerCase()==='src') { window.__jfAudioSrc=String(v||''); const r=origSA.call(this,k,v); updateMock(); return r; } return origSA.call(this,k,v); };
      const origAddEvent=a.addEventListener;
      // Expose mock getters
      try{
        Object.defineProperty(a,'duration',{ get(){ return mockDuration; }, configurable:true });
        Object.defineProperty(a,'seekable',{ get(){ return mockSeekable; }, configurable:true });
        Object.defineProperty(a,'buffered',{ get(){ return mockBuffered; }, configurable:true });
        Object.defineProperty(a,'readyState',{ get(){ return mockReadyState; }, configurable:true });
      }catch(e){}
      // Track currentTime sets
      let _currentTime=0;
      try{
        Object.defineProperty(a,'currentTime',{
          get(){ return _currentTime; },
          set(v){
            // For stream with seekable 0-0, setting currentTime beyond 0 should not work (Safari restarts to 0)
            // For blob, any 0-137 works
            if(isBlob){
              _currentTime=Math.max(0,Math.min(v,137));
            } else {
              // stream: only 0-5 is seekable
              const seekable = mockSeekable;
              let can=false;
              for(let i=0;i<seekable.length;i++) try{ if(v>=seekable.start(i)&&v<=seekable.end(i)) can=true; }catch(e){}
              if(can) _currentTime=v;
              else {
                // would restart to 0 in real Safari/Chrome with serverSeek - we simulate by not changing
                // but our fixed code should not call this path; it should use blob
                _currentTime=0;
              }
            }
          },
          configurable:true
        });
      }catch(e){}
      if(!window.__firstAudio) window.__firstAudio=a;
      return a;
    };
    window.Audio.prototype=OrigAudio.prototype;
    // Track fetch for blob
    const origFetch = window.fetch;
    window.fetch = function(input, init){
      const u=String(input);
      if(u.includes('/Audio/') && u.includes('/stream')){
        window.__jfBlobFetches.push(u);
      }
      return origFetch.call(this, input, init);
    };
  }, ua);
  await page.route(u=>{
    try{ const href=typeof u==='string'?u:(u.href||String(u)); return href.includes('/api/jellyfin'); }catch(e){return false;}
  }, route=>{
    const url=route.request().url();
    if(capture) capture.push(url);
    const headers=route.request().headers();
    const uaH=headers['user-agent']||'';
    const isSafari = /Safari/.test(uaH) && !/Chrome|Chromium|CriOS|FxiOS|Android/.test(uaH);
    if(url.includes('/Audio/') && (url.includes('/stream')||url.includes('/universal'))){
      // For Safari, return mp3-like (audio/mpeg), for Chrome fMP4 (video/mp4)
      const ct = isSafari ? 'audio/mpeg' : 'video/mp4';
      const ar = isSafari ? 'bytes' : 'none';
      return route.fulfill({status:200, contentType:ct, headers:{'Accept-Ranges':ar, 'Content-Length':'4217709'}, body:Buffer.alloc(5000)});
    }
    let body={ok:true};
    if(url.includes('/Users')&&!url.includes('/Users/')) body=[{Name:'kami',Id:'u1'}];
    else if(url.includes('/Users/')||url.includes('IncludeItemTypes')) body=TRACKS;
    return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify(body)});
  });
}
async function acceptConsent(page){
  await page.goto(SITE+'/index.html');
  let sawOverlay=true;
  try{ await page.waitForSelector('#consent-overlay',{state:'visible',timeout:4000}); }catch(e){sawOverlay=false;}
  if(sawOverlay){
    await page.waitForFunction(()=>window.__WARNING_ASSETS_LOADED===true,null,{timeout:20000});
    await page.click('#accept-btn');
    await page.waitForFunction(()=>document.getElementById('consent-overlay').style.display==='none');
  }
  await page.waitForSelector('#jf-player',{state:'attached',timeout:10000});
  await page.waitForTimeout(500);
}
async function audioSrc(page){ return page.evaluate(()=>window.__jfAudioSrc||''); }
async function audioState(page){ return page.evaluate(()=>{
  const a=window.__firstAudio;
  const seek=document.querySelector('.jf-seek');
  const cur=document.querySelector('.jf-current');
  const dur=document.querySelector('.jf-duration');
  return {
    src: a&&a.src||'',
    currentTime: a?Math.round(a.currentTime*10)/10:0,
    duration: a? (isFinite(a.duration)?Math.round(a.duration*10)/10:String(a.duration)):0,
    readyState: a&&a.readyState,
    seekVal: seek&&seek.value,
    seekDisabled: seek&&seek.disabled,
    cur: cur&&cur.textContent,
    dur: dur&&dur.textContent,
    blobFetches: (window.__jfBlobFetches||[]).slice(-3),
    pendingSeek: window.__jfPendingSeek||null,
    blobSeekSeq: window.__jfPendingSeek?window.__jfPendingSeek.seq:0
  };
}); }

(async()=>{
  const browser=await chromium.launch();
  const uas={
    chromium: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  };
  for(const [label,ua] of Object.entries(uas)){
    console.log(`\n=== ${label} (${ua.slice(0,40)}...) ===`);
    const ctx=await browser.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block', userAgent:ua});
    const page=await ctx.newPage();
    const streamUrls=[];
    await setupCapture(page, streamUrls, ua);
    await acceptConsent(page);
    await page.waitForFunction(()=>document.querySelector('.jf-row'),null,{timeout:10000});
    if(await page.locator('.jf-panel').isHidden()){ await page.click('.jf-disc'); await page.waitForTimeout(600); }
    await page.evaluate(()=>{document.querySelector('.jf-tracklist .jf-row').click();});
    await page.waitForTimeout(900);
    let st=await audioState(page);
    check(`${label}: initial play src is stream (not blob, no ticks)`, st.src.includes('/Audio/') && st.src.includes('/stream') && !st.src.includes('Ticks') && !st.src.startsWith('blob:'), st.src.slice(-60));
    // T: scrub to 50% (68s)
    console.log(`-- ${label} scrub 50% --`);
    streamUrls.length=0;
    await page.locator('.jf-seek').evaluate(el=>{ el.value=500; el.dispatchEvent(new Event('input',{bubbles:true})); });
    await page.waitForTimeout(100);
    st=await audioState(page);
    check(`${label}: input updates jf-current to ~1:08`, st.cur && st.cur.includes('1:0'), st.cur);
    await page.locator('.jf-seek').evaluate(el=>{ el.dispatchEvent(new Event('change',{bubbles:true})); });
    await page.waitForTimeout(2000); // wait for blob fetch (if any) + metadata (slow network: 4MB over 3G ~ 10s, but mock is fast)
    st=await audioState(page);
    // After 50% scrub, should be either blob with currentTime 68, or native if seekable
    const isBlob50 = st.src.startsWith('blob:');
    console.log(`  after 50% scrub: src=${st.src.slice(0,30)} currentTime=${st.currentTime} duration=${st.duration} readyState=${st.readyState} blobFetches=${st.blobFetches.length}`);
    check(`${label}: 50% scrub lands near 68s (not 0)`, st.currentTime>60 && st.currentTime<75, `currentTime=${st.currentTime} src=${st.src.slice(-20)}`);
    check(`${label}: 50% scrub does not restart to 0`, st.currentTime!==0, `currentTime=${st.currentTime}`);
    // T: second scrub to 30% (41s) — the flaky bug case
    console.log(`-- ${label} second scrub 30% (the flaky case) --`);
    await page.locator('.jf-seek').evaluate(el=>{ el.value=300; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); });
    await page.waitForTimeout(1200);
    st=await audioState(page);
    console.log(`  after 30% second scrub: currentTime=${st.currentTime} src=${st.src.slice(0,30)}`);
    check(`${label}: second scrub 30% lands near 41s (not restart to 0)`, st.currentTime>35 && st.currentTime<50, `currentTime=${st.currentTime}`);
    check(`${label}: second scrub is blob (fully seekable)`, st.src.startsWith('blob:'), st.src.slice(0,20));
    // T: third scrub to 90% (123s)
    console.log(`-- ${label} scrub 90% --`);
    await page.locator('.jf-seek').evaluate(el=>{ el.value=900; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); });
    await page.waitForTimeout(800);
    st=await audioState(page);
    check(`${label}: 90% scrub lands near 123s`, st.currentTime>115 && st.currentTime<130, `currentTime=${st.currentTime}`);
    // T: scrub to 0% (beginning)
    console.log(`-- ${label} scrub 0% --`);
    await page.locator('.jf-seek').evaluate(el=>{ el.value=0; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); });
    await page.waitForTimeout(800);
    st=await audioState(page);
    check(`${label}: 0% scrub lands near 0`, st.currentTime>=0 && st.currentTime<5, `currentTime=${st.currentTime}`);
    // T: rapid scrub while blob fetch in progress (abort)
    console.log(`-- ${label} rapid scrub abort --`);
    await page.locator('.jf-seek').evaluate(el=>{ el.value=700; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); });
    await page.waitForTimeout(50); // before fetch completes
    await page.locator('.jf-seek').evaluate(el=>{ el.value=200; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); });
    await page.waitForTimeout(1200);
    st=await audioState(page);
    check(`${label}: rapid abort second scrub wins (near 27s)`, st.currentTime>20 && st.currentTime<35, `currentTime=${st.currentTime}`);
    // T: Media Session seekto
    console.log(`-- ${label} Media Session seekto 60s --`);
    await page.evaluate(()=>{ try{ navigator.mediaSession.setActionHandler('seekto', null); }catch(e){} });
    // Re-trigger via direct call: we will dispatch a synthetic seekto by calling the handler via page.evaluate
    await page.evaluate(()=>{
      // Find the seekto handler by triggering it via Media Session? Instead directly call the player's logic:
      // Simulate by dispatching a seek change to 438 (60s /137*1000)
      const seek=document.querySelector('.jf-seek');
      if(seek){ seek.value=438; seek.dispatchEvent(new Event('change',{bubbles:true})); }
    });
    await page.waitForTimeout(800);
    st=await audioState(page);
    check(`${label}: Media Session style seek 60s lands near 60`, st.currentTime>55 && st.currentTime<70, `currentTime=${st.currentTime}`);
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
})().catch(e=>{ console.error(e.stack); process.exit(1);});
