// 목업 HTML을 회사 자동화 크롬(CDP 9224)의 새 탭에 열고 renderAt(t)로 프레임을 그려 영상·스크린샷을 만든다.
// 새 브라우저를 띄우지 않고, 탭은 끝나면 닫는다. 실행: node record-mockup.mjs <mockup.html> <outDir> [영상이름]
// 찍을 시각은 목업의 window.SHOTS = [[파일이름, 초], ...] 에서 읽는다. QUICK=1 이면 PNG 만.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const [html, out] = process.argv.slice(2, 4).map(p => resolve(p));
const name = process.argv[4] || 'flow';
const CDP = 'http://127.0.0.1:9224';
const FPS = 12;

const frames = join(out, 'frames');
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const tab = await (await fetch(`${CDP}/json/new?${encodeURI(`file://${html}?record=1`)}`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((ok, ng) => { ws.onopen = ok; ws.onerror = ng; });
let seq = 0;
const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); };
const send = (method, params = {}) => new Promise((ok, ng) => {
    const id = ++seq;
    const timer = setTimeout(() => ng(new Error(`${method} 10초 초과`)), 10_000);
    pending.set(id, m => { clearTimeout(timer); m.error ? ng(new Error(`${method}: ${m.error.message}`)) : ok(m.result); });
    ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
const shoot = async (file, format) => writeFileSync(file, Buffer.from((await send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 90 : undefined })).data, 'base64'));

try {
    await send('Page.bringToFront');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (let i = 0; i < 100 && !(await evaluate('document.readyState === "complete" && !!window.renderAt && document.fonts.ready.then(() => true)')); i++) await new Promise(r => setTimeout(r, 100));
    const total = await evaluate('TOTAL');
    const SHOTS = (await evaluate('window.SHOTS || []'));
    // QUICK=1 이면 스크린샷만 — 화면 확인용
    for (let i = 0; !process.env.QUICK && i < Math.ceil(total * FPS); i++) {
        await evaluate(`renderAt(${i / FPS})`);
        await shoot(join(frames, `f${String(i).padStart(5, '0')}.jpg`), 'jpeg');
    }
    for (const [file, t] of SHOTS) {
        await evaluate(`renderAt(${t})`);
        await shoot(join(out, `${file}.png`), 'png');
    }
} finally {
    ws.close();
    await fetch(`${CDP}/json/close/${tab.id}`).catch(() => undefined);
}

if (!process.env.QUICK) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', join(out, `${name}.mp4`)]);
rmSync(frames, { recursive: true, force: true });
console.log('done', out);
