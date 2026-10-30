// 회사 자동화 크롬(CDP 9224)에 자기 탭을 열고 다루는 작은 도구. 새 브라우저는 띄우지 않는다.
// node cdp.mjs open <url>            → 탭 id 출력
// node cdp.mjs eval <id> <js>        → 결과 출력(Promise 면 기다림)
// node cdp.mjs shot <id> <file.png>  → 1440×900 캡처
// node cdp.mjs close <id>
import { writeFileSync } from 'node:fs';

const CDP = 'http://127.0.0.1:9224';
const [cmd, a, b] = process.argv.slice(2);

export async function connect(id) {
    const tabs = await (await fetch(`${CDP}/json/list`)).json();
    const tab = tabs.find(t => t.id === id);
    if (!tab) throw new Error(`탭 없음: ${id}`);
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((ok, ng) => { ws.onopen = ok; ws.onerror = ng; });
    let seq = 0;
    const pending = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); };
    const send = (method, params = {}, ms = 15_000) => new Promise((ok, ng) => {
        const i = ++seq;
        const timer = setTimeout(() => ng(new Error(`${method} ${ms}ms 초과`)), ms);
        pending.set(i, m => { clearTimeout(timer); m.error ? ng(new Error(`${method}: ${m.error.message}`)) : ok(m.result); });
        ws.send(JSON.stringify({ id: i, method, params }));
    });
    const evaluate = async expression => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
        return r.result.value;
    };
    return { ws, send, evaluate, close: () => ws.close() };
}

if (cmd === 'open') {
    const tab = await (await fetch(`${CDP}/json/new?${encodeURI(a)}`, { method: 'PUT' })).json();
    const c = await connect(tab.id);
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.bringToFront');
    c.close();
    console.log(tab.id);
} else if (cmd === 'eval') {
    const c = await connect(a);
    console.log(JSON.stringify(await c.evaluate(b)));
    c.close();
} else if (cmd === 'shot') {
    const c = await connect(a);
    writeFileSync(b, Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    c.close();
    console.log(b);
} else if (cmd === 'close') {
    await fetch(`${CDP}/json/close/${a}`);
    console.log('closed', a);
}
