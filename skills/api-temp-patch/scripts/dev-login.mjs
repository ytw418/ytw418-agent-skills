// dev 로그인(회사 크롬의 localhost 개발 서버 탭). Google 이 비밀번호를 물어도 사용자에게 부탁하지 않고 이것으로 들어간다.
// 웍스 설정(paseo.json)의 슈퍼어드민으로 로그인 → 그 사용자로 대리 로그인(dev 감사 로그가 남는다) → 앱 로그인과 같은 auth.timeInfo 를 넣고 첫 화면으로 간다.
// apps/cue/.env 가 dev API(dev.one.bhsn.it)일 때만 쓴다. 탭은 개발 서버 화면(로그인 화면 등)이어야 한다 — API 주소를 연 탭은 401 오류 페이지라 요청이 안 나간다.
// node dev-login.mjs <탭 id> [대리 로그인 아이디=sjyoon@bhsn.ai]  → {"admin":200,"impersonated":200,"email":…,"workspaces":[…]} (비밀번호·토큰은 출력하지 않는다)
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { connect } from './cdp.mjs';

const [tabId, target = 'sjyoon@bhsn.ai'] = process.argv.slice(2);
const PASEO = process.env.PASEO_JSON ?? `${homedir()}/Desktop/bhsn/allibee-frontend/paseo.json`;
const line = JSON.parse(readFileSync(PASEO, 'utf8')).worktree?.teardown?.find(l => l.includes('super_admin@bhsn.ai'));
if (!line) throw new Error(`${PASEO} 에 super_admin@bhsn.ai 줄이 없다`);
const password = line.trim().split(/\s+/).at(-1);

const c = await connect(tabId);
const origin = await c.evaluate('location.origin');
if (!origin.startsWith('https://localhost')) throw new Error(`개발 서버 화면이 아니다: ${origin}`);
// 만료된 토큰 쿠키가 남아 있으면 대리 로그인 요청이 그 쿠키로 판정될 수 있어 먼저 지운다
const clear = names => Promise.all(names.map(name => c.send('Network.deleteCookies', { name, domain: 'localhost' })));
const post = (path, body) =>
    c.evaluate(`fetch('/api/cue-app${path}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ${JSON.stringify(JSON.stringify(body))} }).then(r => r.status)`);
await clear(['cue_act', 'cue_rft', 'cue_admin_act', 'cue_admin_rft']);
const admin = await post('/login/super-admin/v1', { loginId: 'super_admin@bhsn.ai', password });
const impersonated = admin === 200 ? await post('/login/impersonated/v1', { loginId: target }) : null;
await clear(['cue_admin_act', 'cue_admin_rft']);
const me = await c.evaluate(
    `fetch('/api/cue-app/my-info/v1').then(r => r.json()).then(j => ({ email: j.data?.userInfo?.email, workspaces: (j.data?.workspaceInfos ?? []).map(w => w.tenantId + '-' + w.id) }))`
);
if (impersonated === 200) {
    // 앱은 쿠키만으로는 로그인으로 보지 않는다 — stores/auth.ts login() 처럼 lastLoginTime 을 넣어야 my-info 를 부른다
    await c.evaluate(`localStorage.setItem('auth.timeInfo', JSON.stringify({ lastLoginTime: Date.now(), lastTokenRefreshTime: Date.now() }))`);
    await c.send('Page.navigate', { url: `${origin}/` });
}
c.close();
console.log(JSON.stringify({ admin, impersonated, ...me }));
