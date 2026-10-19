// usage: node anon-check.mjs <카페 주소> [글 주소...]  — 로그인하지 않은 일회용 브라우저로 카페 홈·글을 열어 보이는지 확인하고 /tmp/nc_anon_*.png 로 캡처
import { createRequire } from 'module';
import { readdirSync, existsSync } from 'fs';
import { homedir } from 'os';
const require = createRequire(import.meta.url);
const findCore = () => { try { return require('playwright-core'); } catch {} const base = `${homedir()}/.npm/_npx`; for (const d of readdirSync(base)) { const p = `${base}/${d}/node_modules/playwright-core`; if (existsSync(p)) return require(p); } throw new Error('playwright-core 없음'); };
const { chromium } = findCore();
const [home, ...posts] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } });
await page.goto(home); await page.waitForTimeout(7000);
await page.screenshot({ path: '/tmp/nc_anon_home.png' });
console.log('home:', (await page.evaluate(() => document.body.innerText)).replace(/\s*\n+\s*/g, ' | ').slice(0, 700));
let i = 0;
for (const u of posts) {
  await page.goto(u); await page.waitForTimeout(6000); i++;
  const t = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: `/tmp/nc_anon_post${i}.png` });
  console.log(`post${i}:`, 'login-wall', /로그인 후|멤버만|가입 후/.test(t.slice(0, 800)), '|', t.replace(/\s*\n+\s*/g, ' | ').slice(0, 200));
}
await browser.close();
