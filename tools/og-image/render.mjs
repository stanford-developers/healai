// Renders tools/og-image/og-image.html to assets/og-image.png (1200x630), the
// picture shown when someone shares a link to the site (Slack, LinkedIn, …).
// Run after changing the hero headline:  node tools/og-image/render.mjs
// Needs Google Chrome installed and an internet connection (for the fonts).
// Not published: tools/ is not in the deploy's SITE_PATHS.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9335;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 50 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.type === 'page'); } catch { await sleep(200); } }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const wait = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file://' + path.join(DIR, 'og-image.html') });
await sleep(1500);
const r0 = await send('Runtime.evaluate', { expression: `document.fonts.ready.then(() => JSON.stringify({fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.style+' '+f.weight), h1:document.querySelector('h1').getBoundingClientRect().bottom, foot:document.querySelector('.foot').getBoundingClientRect().top, logo:document.querySelector('.logo').complete}))`, awaitPromise: true, returnByValue: true });
const info = JSON.parse(r0.result.result.value);
if (info.fonts.length < 4 || !info.logo || info.h1 > info.foot - 20) { console.error('render looks wrong:', info); process.exit(1); }
await sleep(500);
const r = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(DIR, '..', '..', 'assets', 'og-image.png'), Buffer.from(r.result.data, 'base64'));
console.log('wrote assets/og-image.png');
ws.close(); chrome.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
