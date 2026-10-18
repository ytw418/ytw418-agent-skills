// usage: node anon-check.mjs <글번호> <제목 일부>  — 로그인하지 않은 방문자 화면에서 글이 보이는지 확인
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const root = execSync('ls -d ~/.npm/_npx/*/node_modules/playwright-core | head -1', { shell: '/bin/zsh' }).toString().trim();
const { chromium } = require(root);
const [id, expect] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
await page.goto(`https://cafe.naver.com/ca-fe/cafes/16729678/articles/${id}`); await page.waitForTimeout(6000);
const txt = await page.evaluate(() => document.body.innerText);
const ok = txt.includes(expect) && !/멤버만 볼 수|가입 후 이용/.test(txt);
console.log(ok ? '비로그인 확인: 보임' : '비로그인 확인: 안 보임');
await browser.close(); process.exit(ok ? 0 : 1);
