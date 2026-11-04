// node jira-embed.mjs <티켓> — 본문의 ![](파일.png)·!파일.png! 를 첨부 이미지로 박고 원본 크기를 넣는다.
// 회사 크롬(9224) 기본 컨텍스트의 Jira 로그인 쿠키로 REST 를 부르고, 자기 탭만 닫는다(토큰 안 씀).
const { chromium } = await import(process.env.PW_MJS || `${process.env.HOME}/Desktop/bhsn/allibee-frontend/node_modules/playwright/index.mjs`);
const issue = process.argv[2];
const browser = await chromium.connectOverCDP('http://127.0.0.1:9224');
const page = await browser.contexts()[0].newPage();
try {
  await page.goto('https://bhsn.atlassian.net/rest/api/2/myself', { waitUntil: 'domcontentloaded' });
  console.log(await page.evaluate(async (issue) => {
    const H = { 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check' };
    const api = (p, o) => fetch(p, o);
    // 1) wiki 본문에서 마크다운 이미지 글자를 !파일|width=! 로 바꿔 저장(v2 가 첨부와 연결한다)
    const v2 = await (await api(`/rest/api/2/issue/${issue}?fields=description,attachment`)).json();
    let wiki = v2.fields.description || '';
    const fixed = wiki.replace(/!\\?\[\\?\]\\?\(([^)\s]+?\.(?:png|jpe?g|gif))\\?\)/gi, '!$1!')
      // Jira MCP 저장 때 옛 본문의 이미지가 끝에 다시 붙는다 — 마지막 글 뒤 이미지만 있는 줄을 지운다
      .replace(/(\n\s*![^!\n]+!\s*)+$/, '\n');
    if (fixed !== wiki) {
      const r = await api(`/rest/api/2/issue/${issue}`, { method: 'PUT', headers: H, body: JSON.stringify({ fields: { description: fixed } }) });
      if (r.status !== 204) return `v2 PUT ${r.status} ${await r.text()}`;
      wiki = fixed;
    }
    const names = [...wiki.matchAll(/!([^!|\n]+?\.(?:png|jpe?g|gif))(?:\|[^!\n]*)?!/gi)].map((m) => m[1]);
    // 2) 첨부 원본 크기를 재서 ADF media 노드(본문 순서 = names 순서)에 넣는다
    const att = Object.fromEntries(v2.fields.attachment.map((a) => [a.filename, a.id]));
    const dims = [];
    for (const n of names) {
      if (!att[n]) { dims.push(null); continue; }
      const blob = await (await api(`/rest/api/2/attachment/content/${att[n]}`)).blob();
      const bmp = await createImageBitmap(blob);
      dims.push([bmp.width, bmp.height]);
    }
    const v3 = await (await api(`/rest/api/3/issue/${issue}?fields=description`)).json();
    const doc = v3.fields.description;
    let i = 0;
    const walk = (node) => {
      if (node.type === 'mediaSingle') {
        const media = node.content?.find((c) => c.type === 'media');
        const d = dims[i++];
        if (media && d) {
          media.attrs.width = d[0]; media.attrs.height = d[1];
          node.attrs = { layout: 'center', width: Math.min(d[0], 1800), widthType: 'pixel' };
        }
      }
      (node.content || []).forEach(walk);
    };
    walk(doc);
    const r3 = await api(`/rest/api/3/issue/${issue}`, { method: 'PUT', headers: H, body: JSON.stringify({ fields: { description: doc } }) });
    return `names=${names.length} media=${i} missing=${names.filter((n) => !att[n]).join(',') || '-'} v3 PUT ${r3.status} ${r3.status === 204 ? '' : await r3.text()}`;
  }, issue));
} finally { await page.close(); }
process.exit(0);
