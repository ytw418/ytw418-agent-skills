// 로그인된 로컬 cue(https://localhost:5173)의 '사용자별 사용량' 탭을 회사 자동화 크롬(9224)의 자기 탭에서 조작하며 녹화한다.
// 화면 아래 단계 라벨·가짜 커서를 띄우고, 화면을 연속 캡처해 ffmpeg 로 영상을 만든다. 탭은 끝나면 닫는다.
// node record-app.mjs <워크스페이스 경로> <outDir>
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { connect } from './cdp.mjs';

const [ws, outArg] = process.argv.slice(2);
const out = resolve(outArg);
const frames = join(out, 'frames');
const downloads = join(out, 'download');
rmSync(frames, { recursive: true, force: true });
rmSync(downloads, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const CDP = 'http://127.0.0.1:9224';
const KEY = 'ALLIBEE_1679_FAKE_USAGE_MEMBERS';
// 5173 을 다른 작업이 쓰면 다른 포트로 띄우고 CUE_ORIGIN 으로 넘긴다(로그인 저장소는 포트마다 따로라 옮겨 줘야 한다)
const base = `${process.env.CUE_ORIGIN ?? 'https://localhost:5173'}/${ws}/settings/usage`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const tab = await (await fetch(`${CDP}/json/new?${encodeURI(base)}`, { method: 'PUT' })).json();
const c = await connect(tab.id);
const stamps = [];
let recording = true;
let loop;

const OVERLAY = `(() => {
    if (document.getElementById('__rec_label')) return true;
    const st = document.createElement('style');
    // 라벨은 왼쪽 메뉴 아래 빈 자리에 둬서 본문(표 아래쪽 행)을 가리지 않는다
    st.textContent = '#__rec_label{position:fixed;left:12px;bottom:16px;width:196px;z-index:2147483647;background:rgba(12,12,15,.88);color:#fff;border-radius:12px;padding:12px 14px;font:500 12.5px/1.5 Pretendard,-apple-system,sans-serif;pointer-events:none}'
        + '#__rec_label h3{font-size:14px;font-weight:700;margin:0 0 6px}#__rec_label ul{margin:0;padding:0}#__rec_label li{list-style:none;color:#E1E3EB}#__rec_label li:before{content:"· ";color:#12E575}'
        + '#__rec_cursor{position:fixed;z-index:2147483647;width:22px;height:22px;pointer-events:none;left:1100px;top:640px;transition:left .45s ease,top .45s ease}'
        + '#__rec_ripple{position:fixed;z-index:2147483646;border:3px solid #00C763;border-radius:50%;pointer-events:none;opacity:0}';
    document.head.appendChild(st);
    const l = document.createElement('div'); l.id = '__rec_label'; document.body.appendChild(l);
    const k = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); k.id = '__rec_cursor'; k.setAttribute('viewBox', '0 0 22 22');
    k.innerHTML = '<path d="M3 2l14 8.5-6.2 1.3 3.6 6.6-2.6 1.4-3.6-6.6L3.6 17z" fill="#0C0C0F" stroke="#fff" stroke-width="1.4"/>'; document.body.appendChild(k);
    const r = document.createElement('div'); r.id = '__rec_ripple'; document.body.appendChild(r);
    // 로컬 개발용 'Dev Tools' 떠 있는 창은 녹화에서만 숨긴다
    [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && /^Dev Tools/.test(e.textContent.trim())).forEach(e => { e.style.display = 'none'; });
    window.__recLabel = (t, cs) => {
        l.replaceChildren(); l.style.display = t ? '' : 'none';
        const h = document.createElement('h3'); h.textContent = t; l.appendChild(h);
        const ul = document.createElement('ul'); cs.forEach(x => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); }); l.appendChild(ul);
    };
    window.__recFind = (sel, text) => {
        const el = [...document.querySelectorAll(sel)].find(e => !text || e.textContent.trim().includes(text));
        if (!el) return null;
        el.scrollIntoView({ block: 'nearest' });
        const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2];
    };
    window.__recRipple = (x, y) => r.animate([{ left: x - 6 + 'px', top: y - 6 + 'px', width: '12px', height: '12px', opacity: 1 }, { left: x - 24 + 'px', top: y - 24 + 'px', width: '48px', height: '48px', opacity: 0 }], { duration: 450 });
    return true;
})()`;

async function waitFor(expr, ms = 15000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        try { if (await c.evaluate(expr)) return; } catch {}
        await sleep(200);
    }
    throw new Error(`시간 초과: ${expr}`);
}
const label = (t, cs = []) => c.evaluate(`__recLabel(${JSON.stringify(t)}, ${JSON.stringify(cs)})`);
const shot = async name => writeFileSync(join(out, `${name}.png`), Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const has = (sel, text = '') => c.evaluate(`!!__recFind(${JSON.stringify(sel)}, ${JSON.stringify(text)})`);
async function moveTo(sel, text = '', { click = false, hold = 0 } = {}) {
    const p = await c.evaluate(`__recFind(${JSON.stringify(sel)}, ${JSON.stringify(text)})`);
    if (!p) throw new Error(`요소 없음: ${sel} ${text}`);
    const [x, y] = p;
    await c.evaluate(`(() => { const k = document.getElementById('__rec_cursor'); k.style.left = ${x - 3} + 'px'; k.style.top = ${y - 2} + 'px'; return 1; })()`);
    await sleep(520);
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    if (click) {
        await c.evaluate(`__recRipple(${x}, ${y})`);
        await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
    if (hold) await sleep(hold);
}
const tableReady = `document.querySelectorAll('tbody tr').length > 3`;

try {
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.bringToFront');
    await c.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await waitFor(`document.readyState === 'complete' && !!document.querySelector('button[role="tab"]')`, 60000);
    await c.evaluate(`localStorage.removeItem('${KEY}')`);
    await c.evaluate(OVERLAY);
    loop = (async () => {
        for (let i = 0; recording; i++) {
            const t = Date.now();
            try {
                const f = join(frames, `f${String(i).padStart(5, '0')}.jpg`);
                // 페이지가 다시 그려지는 순간 캡처 요청이 응답 없이 멈출 수 있어 2.5초가 넘으면 건너뛴다(멈추면 그 뒤 장면이 통째로 빠진다)
                const shotP = c.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
                const { data } = await Promise.race([shotP, sleep(2500).then(() => { throw new Error('캡처 지연'); })]);
                writeFileSync(f, Buffer.from(data, 'base64'));
                stamps.push([f, t]);
            } catch {}
            await sleep(Math.max(0, 110 - (Date.now() - t)));
        }
    })();

    await label("1. 설정 > 사용량 — '사용자별 사용량'·'크레딧 변경내역' 탭", ['마스터에게만 보인다, 모든 플랜에서 제공', "기존 화면은 '전체 사용량' 탭으로"]);
    await sleep(1800);
    await moveTo('button[role="tab"]', '사용자별 사용량', { click: true });
    await waitFor(tableReady);
    await label('2. 구성원별 사용량 — 총 사용량(토큰)과 기능별 토큰', ['기본 이번 달, 총 사용량 많은 순', '전자서명 발송·계약서 등록은 건수']);
    await sleep(2800);
    await shot('usage-01-members-tab');

    await label('3. 표를 오른쪽으로 넘기면 전자서명 발송(건)·계약서 등록(건)', ['토큰이 없는 기능은 건수로 — 열이 9개라 가로로 넘긴다']);
    const scrollX = to => c.evaluate(`(() => { let el = document.querySelector('table').parentElement; while (el && getComputedStyle(el).overflowX === 'visible') el = el.parentElement; el.scrollTo({ left: ${to} === 'end' ? el.scrollWidth : 0, behavior: 'smooth' }); return el.scrollWidth - el.clientWidth; })()`);
    await moveTo('tbody tr:nth-child(2) td:nth-child(4)', '');
    await scrollX("'end'");
    await sleep(2600);
    await shot('usage-07-count-columns');
    await scrollX('0');
    await sleep(900);

    await label('4. 총 사용량에 마우스를 올리면 AI 크레딧', ['AI 크레딧 합계와 기능별 크레딧']);
    await moveTo('tbody tr:nth-child(1) [data-testid="member-usage-tokens"]', '', { hold: 2800 });
    await shot('usage-02-credit-tooltip');

    await label('5. 기간 — 이번 달·지난 달·최근 3개월·직접 선택', ['최대 1년, 미래 날짜는 고를 수 없다']);
    await moveTo('button[role="tab"]', '지난 달', { click: true, hold: 2200 });
    await moveTo('button[role="tab"]', '최근 3개월', { click: true, hold: 2400 });
    await shot('usage-03-last-3-months');

    await label('6. 정렬 — 기능별 토큰 열로도 오름·내림', ['다시 불러오지 않고 화면에서, 기타 행은 늘 맨 아래']);
    await moveTo('th button', '계약서 검토', { click: true, hold: 1700 });
    await moveTo('th button', '계약서 검토', { click: true, hold: 1900 });

    await label('7. 내보낸 구성원·탈퇴한 사용자·게스트·기타 행', ['기간 안에 기록이 있으면 표에 남는다 — 합계가 전체 사용량과 맞도록']);
    await c.evaluate(`(document.querySelector('tbody tr:last-child').scrollIntoView({ block: 'center' }), 1)`);
    await moveTo('tbody tr:last-child', '', { hold: 2600 });
    await shot('usage-04-status-badges');

    await label('8. 엑셀 다운로드 — 지금 기간·정렬 그대로', ['받는 중에는 버튼만 로딩, 실패하면 토스트']);
    await moveTo('button', '엑셀 다운로드', { click: true, hold: 2800 });

    await label('9. 크레딧 변경내역 — 충전·플랜 지급·이벤트·가입 축하·관리자 조정·만료', ['실제 API(GET /credits/event-histories/v1) 데이터', '+ 지급 / − 차감, 지급분은 유효기한']);
    await moveTo('button[role="tab"]', '크레딧 변경내역', { click: true });
    await waitFor(`document.querySelectorAll('tbody tr').length > 0 || document.body.innerText.includes('변경내역이 없어요')`, 15000);
    await sleep(2800);
    await shot('usage-05-credit-history');

    await label('10. 사용 내역 포함 — 사용(−)까지 함께', []);
    await moveTo('label:has([data-testid="credit-history-include-consume"])', '', { click: true });
    await sleep(2800);
    await shot('usage-06-credit-history-with-usage');
    if (await has('[data-testid="credit-history-load-more"]')) {
        await label('11. 더 보기 — 20건씩 이어 받는다', []);
        await moveTo('[data-testid="credit-history-load-more"]', '', { click: true, hold: 2600 });
    }

    await c.evaluate(`localStorage.setItem('${KEY}', 'error')`);
    await label('12. 불러오기 실패 — 다시 시도로 다시 불러온다');
    const errorShown = `document.body.innerText.includes('사용량을 불러오지 못했어요')`;
    await moveTo('button[role="tab"]', '사용자별 사용량', { click: true });
    await waitFor(errorShown, 10000);
    await sleep(2000);
    await c.evaluate(`localStorage.removeItem('${KEY}')`);
    await moveTo('button', '다시 시도', { click: true });
    await waitFor(tableReady, 10000);
    await sleep(1600);
    await label('끝');
    await sleep(1500);
} finally {
    recording = false;
    await loop?.catch(() => undefined);
    await c.evaluate(`localStorage.removeItem('${KEY}')`).catch(() => undefined);
    c.close();
    await fetch(`${CDP}/json/close/${tab.id}`).catch(() => undefined);
}

// 프레임 사이 실제 시간 간격대로 이어 붙인다
const list = stamps.map(([f, t], i) => `file '${f}'\nduration ${((stamps[i + 1]?.[1] ?? t + 1200) - t) / 1000}`).join('\n') + `\nfile '${stamps.at(-1)[0]}'\n`;
writeFileSync(join(out, 'frames.txt'), list);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(out, 'frames.txt'), '-vf', 'fps=12,scale=1440:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', join(out, 'usage-by-member-flow.mp4')]);
rmSync(frames, { recursive: true, force: true });
rmSync(join(out, 'frames.txt'), { force: true });
console.log('frames', stamps.length, 'download', existsSync(downloads) ? readdirSync(downloads) : []);
