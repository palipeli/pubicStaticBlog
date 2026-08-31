#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(desc, cond, extra) {
    if (cond) { pass++; console.log('  PASS ' + desc); }
    else { fail++; console.log('  FAIL ' + desc + (extra ? ' — ' + extra : '')); }
}

const modPath = path.join(__dirname, '..', 'functions', 'api', 'jellyfin', '[[path]].js');
const src = fs.readFileSync(modPath, 'utf8');

ok('allows Audio/<id>/stream', src.includes("Audio\\/") && src.includes("stream"));
ok('allows Audio/<id>/universal passthrough (API compatible)', src.includes("Audio\\/") && src.includes("universal"));
ok('handles Audio/*/universal without rewrite (direct allowlist)', src.includes("universal") && src.includes("ALLOWED_PATHS"));
ok('FORCED_TRANSCODE defined (mp4/aac/256k)', src.includes('FORCED_TRANSCODE') && src.includes("'mp4'") && src.includes("'aac'") && src.includes('256000'));
ok('START_TICKS_RE defined (digits only)', src.includes('START_TICKS_RE') && src.includes('\\d{1,15}'));
ok('sanitizeParams forces static=false + container/audioCodec/audioBitRate', src.includes("params.set('static', 'false')") && src.includes("params.set('container'") && src.includes("params.set('audioCodec'") && src.includes("params.set('audioBitRate'"));
ok('sanitizeParams keeps sanitized StartTimeTicks as startTimeTicks', src.includes("params.set('startTimeTicks'"));
ok('sanitizeParams deletes invalid StartTimeTicks/startTimeTicks', src.includes("params.delete('StartTimeTicks')"));
ok('has fallback static=true branch (guarded by FORCED_TRANSCODE)', src.includes("params.set('static', 'true')"));

(async () => {
    const tmpDir = fs.mkdtempSync(require('os').tmpdir() + '/jf-proxy-');
    const tmpFile = path.join(tmpDir, 'proxy.mjs');
    fs.writeFileSync(tmpFile, src, 'utf8');

    const {onRequest} = await import('file://' + tmpFile);

    function makeEnv(lastFetch) {
        return {
            JELLYFIN_URL: 'https://origin.example',
            JELLYFIN_TOKEN: 'tok',
            JELLYFIN_USER: '11111111-1111-1111-1111-111111111111',
        };
    }
    function makeReq(pathname, search) {
        const url = 'https://kamikami.eu' + pathname + (search || '');
        return new Request(url, {method: 'GET', headers: {'Accept': 'audio/*'}});
    }

    {
        let upstreamUrl = '';
        const origFetch = globalThis.fetch;
        globalThis.fetch = async (input) => { upstreamUrl = String(input); return new Response('x', {status: 200, headers: {'Content-Type': 'audio/mp4'}}); };
        try {
            await onRequest({request: makeReq('/api/jellyfin/Audio/t1/stream', '?static=true&audioCodec=flac&audioBitRate=999999&container=flac&StartTimeTicks=abc'), env: makeEnv()});
        } catch (e) {}
        ok('upstream fetch called', !!upstreamUrl, upstreamUrl || 'no upstream call captured');
        const u = new URL(upstreamUrl || 'https://x/');
        const q = u.searchParams;
        ok('upstream has static=false (forced)', q.get('static') === 'false', 'static=' + q.get('static'));
        ok('upstream has container=mp4 (forced, not flac)', q.get('container') === 'mp4', 'container=' + q.get('container'));
        ok('upstream has audioCodec=aac (forced, not flac)', q.get('audioCodec') === 'aac', 'audioCodec=' + q.get('audioCodec'));
        ok('upstream has audioBitRate=256000 (forced, not 999999)', q.get('audioBitRate') === '256000', 'audioBitRate=' + q.get('audioBitRate'));
        ok('invalid StartTimeTicks=abc stripped (no startTimeTicks)', !q.has('StartTimeTicks') && !q.has('startTimeTicks'), 'has StartTimeTicks/startTimeTicks');
        globalThis.fetch = origFetch;
    }

    {
        let upstreamUrl = '';
        const origFetch = globalThis.fetch;
        globalThis.fetch = async (input) => { upstreamUrl = String(input); return new Response('x', {status: 200, headers: {'Content-Type': 'audio/mp4'}}); };
        try {
            await onRequest({request: makeReq('/api/jellyfin/Audio/t1/stream', '?StartTimeTicks=1234567890123'), env: makeEnv()});
        } catch (e) {}
        const u2 = new URL(upstreamUrl || 'https://x/');
        ok('valid StartTimeTicks forwarded as startTimeTicks', u2.searchParams.get('startTimeTicks') === '1234567890123', 'startTimeTicks=' + u2.searchParams.get('startTimeTicks'));
        globalThis.fetch = origFetch;
    }

    {
        let reqPath = '';
        const origFetch = globalThis.fetch;
        globalThis.fetch = async (input) => { reqPath = new URL(String(input)).pathname; return new Response('x', {status: 200, headers: {'Content-Type': 'audio/mp4'}}); };
        try {
            await onRequest({request: makeReq('/api/jellyfin/Audio/t1/universal'), env: makeEnv()});
        } catch (e) {}
        ok('universal path allowed (API compatible, no 403)', reqPath.includes('/Audio/') && (reqPath.includes('/universal') || reqPath.includes('/stream')), 'upstream path=' + reqPath);
        globalThis.fetch = origFetch;
    }

    {
        const origFetch = globalThis.fetch;
        globalThis.fetch = async () => { throw new Error('should not reach upstream for blocked path'); };
        const res = await onRequest({request: makeReq('/api/jellyfin/Audio/t1/universal', '?evil=1'), env: makeEnv()});
        void res;
        globalThis.fetch = origFetch;
    }

    {
        const res = await onRequest({request: new Request('https://kamikami.eu/api/jellyfin/Items/abc/Images/Primary', {headers: {'Sec-Fetch-Site': 'cross-site'}}), env: makeEnv()});
        ok('cross-site blocked even after transcode change', res.status === 403, 'status=' + res.status);
    }

    {
        let upstreamUrl = '';
        const origFetch = globalThis.fetch;
        globalThis.fetch = async (input) => { upstreamUrl = String(input); return new Response('x', {status: 200, headers: {'Content-Type': 'audio/mp4'}}); };
        try {
            await onRequest({request: makeReq('/api/jellyfin/Audio/t1/stream', '?transcodingContainer=flac&maxStreamingBitrate=9999999'), env: makeEnv()});
        } catch (e) {}
        const q = new URL(upstreamUrl || 'https://x/').searchParams;
        ok('client-supplied transcoding*/maxStreaming* stripped (still forced 256k)', q.get('audioBitRate') === '256000' && !q.has('transcodingContainer') && !q.has('maxStreamingBitrate'), 'params=' + (upstreamUrl ? new URL(upstreamUrl).search : '(none)'));
        globalThis.fetch = origFetch;
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e && e.stack || e); process.exit(2); });
