#!/usr/bin/env node
// 노션 페이지를 하위 페이지·DB 까지 노션 자체 내보내기(Markdown & CSV)로 받아 <저장 폴더>에 푼다.
// 회사 자동화 크롬(CDP 9224)에 로그인된 노션 세션을 쓴다. 자기 탭을 열고 끝나면 닫는다.
// 사용: node notion-export.mjs <노션 페이지 URL> <저장 폴더>
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CDP = 'http://127.0.0.1:9224';
const [pageUrl, outDir] = process.argv.slice(2);
const hex = pageUrl && new URL(pageUrl).pathname.match(/[0-9a-f]{32}$/)?.[0];
if (!hex || !outDir) {
  console.error('사용: node notion-export.mjs <노션 페이지 URL> <저장 폴더>');
  process.exit(1);
}
const pageId = hex.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// bhsn-pw.sh 와 같은 사이트 잠금: 노션 자동화는 한 번에 하나, 30분 넘은 잠금은 버린다.
const LOCK = '/tmp/bhsn-chrome-locks/notion';
await mkdir('/tmp/bhsn-chrome-locks', { recursive: true });
while (await mkdir(LOCK).then(() => false, () => true)) {
  const { mtimeMs } = await stat(LOCK).catch(() => ({ mtimeMs: Date.now() }));
  if (Date.now() - mtimeMs > 30 * 60e3) await rm(LOCK, { recursive: true, force: true });
  else await sleep(2000);
}

const tab = await (await fetch(`${CDP}/json/new?${pageUrl}`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let seq = 0;
const waiting = new Map();
ws.onmessage = ({ data }) => {
  const m = JSON.parse(data);
  const w = waiting.get(m.id);
  if (!w) return;
  waiting.delete(m.id);
  m.error ? w.fail(new Error(m.error.message)) : w.ok(m.result);
};
const send = (method, params = {}) =>
  new Promise((ok, fail) => {
    const id = ++seq;
    waiting.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params }));
  });
const run = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

try {
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = fail;
  });
  for (let i = 0; ; i++) {
    const ready = await run(`/notion\\.(so|com)$/.test(location.hostname) && document.readyState`).catch(() => '');
    if (ready === 'complete') break;
    if (i > 60) throw new Error('노션 페이지가 열리지 않는다');
    await sleep(500);
  }

  // 노션 웹앱이 '내보내기' 메뉴에서 쓰는 내부 API(enqueueTask → getTasks). 로그인이 풀려 있으면 401 로 멈춘다.
  // 공간·사용자 헤더가 없으면 내보내기 작업이 처리되지 않는 큐로 가서 not_started 에 머문다.
  await run(`window.__notionApi = async (path, body) => {
    const uid = document.cookie.match(/notion_user_id=([^;]+)/)?.[1];
    const headers = { 'content-type': 'application/json',
      ...(window.__notionSpaceId && { 'x-notion-space-id': window.__notionSpaceId }),
      ...(uid && { 'x-notion-active-user-header': uid }) };
    const r = await fetch('/api/v3/' + path, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + (await r.text()).slice(0, 300));
    return r.json();
  }`);
  const id = JSON.stringify(pageId);
  const spaceId = await run(`__notionApi('loadPageChunk', { pageId: ${id}, limit: 1, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false })
    .then((c) => { const b = c.recordMap.block[${id}].value; return (window.__notionSpaceId = (b.value ?? b).space_id); })`);
  const taskId = await run(`__notionApi('enqueueTask', { task: { eventName: 'exportBlock', request: {
    block: { id: ${id}, spaceId: ${JSON.stringify(spaceId)} }, recursive: true,
    exportOptions: { exportType: 'markdown', timeZone: 'Asia/Seoul', locale: 'ko' } } } }).then((r) => r.taskId)`);
  let exportUrl;
  for (let i = 1; !exportUrl; i++) {
    await sleep(3000);
    const t = await run(`__notionApi('getTasks', { taskIds: [${JSON.stringify(taskId)}] }).then((r) => r.results[0])`);
    if (t.state === 'failure') throw new Error('내보내기 실패: ' + JSON.stringify(t.error));
    if (t.state === 'success') exportUrl = t.status.exportURL;
    else if (i % 10 === 0) console.error(`진행 ${i * 3}초: ${t.state} ${JSON.stringify(t.status ?? {})}`);
    if (i > 600) throw new Error('내보내기가 30분 안에 끝나지 않았다');
  }

  // 내려받기 링크는 file_token 쿠키가 있어야 열린다.
  const { cookies } = await send('Network.getCookies', { urls: [exportUrl] });
  const res = await fetch(exportUrl, { headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') } });
  if (!res.ok) throw new Error(`내려받기 실패 ${res.status}`);
  const tmp = await mkdtemp(join(tmpdir(), 'notion-export-'));
  const zip = join(tmp, 'export.zip');
  await writeFile(zip, Buffer.from(await res.arrayBuffer()));

  // shortcut: 덮어쓰기만 해서 노션에서 지우거나 이름을 바꾼 페이지의 옛 파일은 남는다. 정확히 맞추려면 저장 폴더를 지우고 다시 받는다.
  await mkdir(outDir, { recursive: true });
  execFileSync('ditto', ['-x', '-k', zip, outDir]);
  // 큰 내보내기는 바깥 zip 안에 Export-…-Part-N.zip 으로 나뉘어 온다.
  for (const f of (await readdir(outDir)).filter((f) => /^Export-.*\.zip$/.test(f))) {
    execFileSync('ditto', ['-x', '-k', join(outDir, f), outDir]);
    await rm(join(outDir, f));
  }
  await rm(tmp, { recursive: true });
  console.log('저장:', outDir);
} finally {
  ws.close();
  await fetch(`${CDP}/json/close/${tab.id}`).catch(() => {});
  await rm(LOCK, { recursive: true, force: true });
}
