#!/usr/bin/env node
// iOS 시뮬레이터 Safari에 Safari WebDriver 터치 액션을 보내 실제 WebKit 터치 파이프라인(hit-test, touch-action,
// pointer/touch 이벤트)을 거친 결과를 표로 출력한다. safaridriver가 --port 에서 떠 있어야 한다.
//
// node ios-touch.mjs --udid <UDID> --url <URL> --selector <CSS> [options]
//   --offsets 0,-6,6     요소 중심에서 시작점 Y 오프셋(px) 목록 (기본 0)
//   --dx 0 --dy 120      드래그 이동량(px). 둘 다 0이면 탭
//   --move-ms 300        드래그 이동 시간
//   --repeat 1           오프셋 목록 반복 횟수
//   --wait-ms 1000       selector가 나타난 뒤 액션 전 대기(초기 렌더/리마운트 회피)
//   --result "<JS 식>"    액션 후 평가할 식. 예: "!document.querySelector('[role=dialog]')"
//   --port 4447          safaridriver 포트
//   --session <id>       기존 세션 재사용(없으면 만들고 끝나면 지운다)
import { parseArgs } from 'node:util';

const { values: opt } = parseArgs({
    options: {
        udid: { type: 'string' },
        url: { type: 'string' },
        selector: { type: 'string' },
        offsets: { type: 'string', default: '0' },
        dx: { type: 'string', default: '0' },
        dy: { type: 'string', default: '120' },
        'move-ms': { type: 'string', default: '300' },
        repeat: { type: 'string', default: '1' },
        'wait-ms': { type: 'string', default: '1000' },
        result: { type: 'string', default: 'null' },
        port: { type: 'string', default: '4447' },
        session: { type: 'string' },
    },
});

if (!opt.url || !opt.selector || (!opt.udid && !opt.session)) {
    console.error('필수: --url, --selector, 그리고 --udid 또는 --session');
    process.exit(2);
}

const base = `http://localhost:${opt.port}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(method, path, body) {
    const res = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json();
    if (json.value?.error) throw new Error(`${method} ${path}: ${json.value.error} — ${json.value.message}`);
    return json.value;
}

let sessionId = opt.session;
const ownsSession = !sessionId;
if (ownsSession) {
    const created = await request('POST', '/session', {
        capabilities: { alwaysMatch: { browserName: 'Safari', platformName: 'iOS', 'safari:useSimulator': true, 'safari:deviceUDID': opt.udid } },
    });
    sessionId = created.sessionId;
    console.log(`session ${sessionId} (${created.capabilities['safari:deviceName']} iOS ${created.capabilities['safari:platformVersion']})`);
}
const session = (method, path, body) => request(method, `/session/${sessionId}${path}`, body);
const exec = (script, args = []) => session('POST', '/execute/sync', { script, args });

const INSTALL_LOGGER = `
    window.__touchLog = [];
    const describe = el => {
        if (!el || !el.closest) return String(el && el.nodeName);
        const owner = el.closest('[data-slot],[data-testid],[id]');
        if (!owner) return el.tagName.toLowerCase();
        return owner.getAttribute('data-slot') || owner.getAttribute('data-testid') || '#' + owner.id;
    };
    const push = (type, target, y) => window.__touchLog.push(type + ':' + describe(target) + '@' + Math.round(y));
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
        document.addEventListener(type, e => push(type, e.target, e.clientY), true);
    }
    for (const type of ['gotpointercapture', 'lostpointercapture']) {
        document.addEventListener(type, e => window.__touchLog.push(type + ':' + describe(e.target)), true);
    }
    for (const type of ['touchstart', 'touchend', 'touchcancel']) {
        document.addEventListener(type, e => push(type, e.target, e.changedTouches[0] ? e.changedTouches[0].clientY : NaN), { capture: true, passive: true });
    }
    const rect = document.querySelector(arguments[0]).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: rect.width, h: rect.height };
`;

const offsets = opt.offsets.split(',').map(Number);
const [dx, dy, moveMs, waitMs] = [opt.dx, opt.dy, opt['move-ms'], opt['wait-ms']].map(Number);
const rows = [];

try {
    for (let round = 1; round <= Number(opt.repeat); round += 1) {
        for (const offset of offsets) {
            await session('POST', '/url', { url: opt.url });
            let found = false;
            for (let i = 0; i < 40 && !found; i += 1) {
                found = await exec('return !!document.querySelector(arguments[0])', [opt.selector]);
                if (!found) await sleep(250);
            }
            if (!found) throw new Error(`selector가 10초 안에 나타나지 않음: ${opt.selector}`);
            await sleep(waitMs);

            const box = await exec(INSTALL_LOGGER, [opt.selector]);
            const x = Math.round(box.x);
            const y = Math.round(box.y + offset);
            const isTap = dx === 0 && dy === 0;
            const steps = isTap
                ? [{ type: 'pointerMove', duration: 0, x, y, origin: 'viewport' }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 60 }, { type: 'pointerUp', button: 0 }]
                : [
                      { type: 'pointerMove', duration: 0, x, y, origin: 'viewport' },
                      { type: 'pointerDown', button: 0 },
                      { type: 'pause', duration: 80 },
                      { type: 'pointerMove', duration: moveMs, x: x + dx, y: y + dy, origin: 'viewport' },
                      { type: 'pointerUp', button: 0 },
                  ];
            await session('POST', '/actions', { actions: [{ type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' }, actions: steps }] });
            await session('DELETE', '/actions');
            await sleep(400);

            const out = await exec(`return { log: window.__touchLog || [], result: (${opt.result}) }`);
            rows.push({ round, offset, start: `${x},${y}`, result: JSON.stringify(out.result), events: out.log.join(' ') });
        }
    }
} finally {
    if (ownsSession) await request('DELETE', `/session/${sessionId}`).catch(error => console.error(`세션 정리 실패: ${error.message}`));
}

for (const row of rows) {
    console.log(`[${row.round}] offset ${row.offset} start ${row.start} → result ${row.result}\n    ${row.events}`);
}
const tally = rows.reduce((acc, row) => ({ ...acc, [row.result]: (acc[row.result] ?? 0) + 1 }), {});
console.log(`\nresult 집계: ${JSON.stringify(tally)} (총 ${rows.length}회)`);
