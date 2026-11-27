// dev 슈퍼어드민(dev-admin.one.bhsn.it)에 회사 크롬(9224) 탭으로 로그인한다. 비밀번호는 사용자가 키체인에 넣어 둔 값을 읽고 출력하지 않는다.
// 키체인 등록(사용자가 한 번): security add-generic-password -a super_admin@bhsn.ai -s bhsn-dev-super-admin -U -w
// node dev-admin-login.mjs <탭 id>  → {"login":200,"myInfo":200}
import { execFileSync } from 'node:child_process';
import { connect } from './cdp.mjs';

const [tabId] = process.argv.slice(2);
const loginId = 'super_admin@bhsn.ai';
const password = execFileSync('security', ['find-generic-password', '-a', loginId, '-s', 'bhsn-dev-super-admin', '-w'], { encoding: 'utf8' }).trim();

const c = await connect(tabId);
const origin = await c.evaluate('location.origin');
if (origin !== 'https://dev-admin.one.bhsn.it') throw new Error(`dev 슈퍼어드민 화면이 아니다: ${origin}`);
const body = JSON.stringify({ loginId, password });
const login = await c.evaluate(
    `fetch('/api/cue-app/login/super-admin/v1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ${JSON.stringify(body)} }).then(r => r.status)`
);
// 앱은 쿠키만으로는 로그인으로 보지 않는다 — lastLoginTime 이 있어야 my-info 를 부른다
await c.evaluate(`localStorage.setItem('auth.timeInfo', JSON.stringify({ lastLoginTime: Date.now(), lastTokenRefreshTime: Date.now() }))`);
const myInfo = await c.evaluate(`fetch('/api/cue-app/my-info/v1').then(r => r.status)`);
c.close();
console.log(JSON.stringify({ login, myInfo }));
process.exit(0);
