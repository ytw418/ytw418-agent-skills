// node jira-embed.mjs <티켓> — 본문의 ![](파일.png)·!파일.png! 를 첨부 이미지로 박고 원본 크기를 넣는다.
// Jira MCP 는 마크다운 이미지를 본문 이미지로 연결하지 못해 글자로 남는다. 이 스크립트가 그 뒤처리를 한다.
// 인증은 Atlassian MCP 설정(~/.claude.json mcpServers.atlassian.env 의 JIRA_URL·JIRA_USERNAME·JIRA_API_TOKEN)을 그대로 쓴다.
// 브라우저 쿠키 방식은 9224 로그인 풀림·Playwright CDP 거부로 깨져서(2026-11-24) 버렸다.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const issue = process.argv[2];
if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(issue || '')) { console.error('사용법: node jira-embed.mjs <티켓 키>'); process.exit(2); }

const env = { ...JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8')).mcpServers?.atlassian?.env, ...process.env };
const { JIRA_URL: base, JIRA_USERNAME: user, JIRA_API_TOKEN: token } = env;
if (!base || !user || !token) { console.error('Jira 인증 정보 없음(~/.claude.json mcpServers.atlassian.env)'); process.exit(2); }
const H = { Authorization: `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`, Accept: 'application/json', 'Content-Type': 'application/json' };
const api = async (p, o = {}) => {
  const r = await fetch(`${base.replace(/\/$/, '')}${p}`, { ...o, headers: { ...H, ...o.headers } });
  if (!r.ok) throw new Error(`${o.method || 'GET'} ${p} ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r;
};

// 이미지 원본 크기. PNG 는 헤더에서, 그 밖은 macOS sips 로 잰다.
function size(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  const dir = mkdtempSync(join(tmpdir(), 'jira-embed-'));
  try {
    const f = join(dir, 'img');
    writeFileSync(f, buf);
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', f], { encoding: 'utf8' });
    return [+out.match(/pixelWidth: (\d+)/)[1], +out.match(/pixelHeight: (\d+)/)[1]];
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// 1) wiki 본문에서 마크다운 이미지 글자를 !파일! 로 바꿔 저장(v2 가 첨부와 연결한다)
const v2 = await (await api(`/rest/api/2/issue/${issue}?fields=description,attachment`)).json();
let wiki = v2.fields.description || '';
const fixed = wiki.replace(/!\\?\[\\?\]\\?\(([^)\s]+?\.(?:png|jpe?g|gif))\\?\)/gi, '!$1!')
  // Jira MCP 저장 때 옛 본문의 이미지가 끝에 다시 붙는다 — 마지막 글 뒤 이미지만 있는 줄을 지운다
  .replace(/(\n\s*![^!\n]+!\s*)+$/, '\n');
if (fixed !== wiki) {
  await api(`/rest/api/2/issue/${issue}`, { method: 'PUT', body: JSON.stringify({ fields: { description: fixed } }) });
  wiki = fixed;
}
const names = [...wiki.matchAll(/!([^!|\n]+?\.(?:png|jpe?g|gif))(?:\|[^!\n]*)?!/gi)].map((m) => m[1]);

// 2) 첨부 원본 크기를 재서 ADF media 노드(본문 순서 = names 순서)에 넣는다. 크기가 없으면 작은 카드로만 보인다.
const att = Object.fromEntries(v2.fields.attachment.map((a) => [a.filename, a.id]));
const dims = [];
for (const n of names) {
  if (!att[n]) { dims.push(null); continue; }
  dims.push(size(Buffer.from(await (await api(`/rest/api/2/attachment/content/${att[n]}`, { headers: { Accept: '*/*' } })).arrayBuffer())));
}
const doc = (await (await api(`/rest/api/3/issue/${issue}?fields=description`)).json()).fields.description;
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
if (doc) walk(doc);
if (names.length) await api(`/rest/api/3/issue/${issue}`, { method: 'PUT', body: JSON.stringify({ fields: { description: doc } }) });

// 3) 확인: 본문에 아직 마크다운 이미지 글자가 남았는지
const left = ((await (await api(`/rest/api/2/issue/${issue}?fields=description`)).json()).fields.description || '').match(/!\\?\[\\?\]\\?\(/g)?.length || 0;
const missing = names.filter((n) => !att[n]);
console.log(`names=${names.length} media=${i} missing=${missing.join(',') || '-'} left-markdown=${left}`);
process.exit(missing.length || left || i < names.length ? 1 : 0);
