// usage: node render.mjs <design.html 경로> <selector=out.png>...  — 디자인 HTML 의 요소를 PNG 로 캡처 (예: "#banner=banner.png")
import { createRequire } from 'module';
import { readdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
const require = createRequire(import.meta.url);
const findCore = () => {   // npx 캐시에 있는 playwright-core 를 쓴다 (@playwright/cli 가 깔아 둔 것)
  try { return require('playwright-core'); } catch {}
  const base = `${homedir()}/.npm/_npx`;
  for (const d of readdirSync(base)) { const p = `${base}/${d}/node_modules/playwright-core`; if (existsSync(p)) return require(p); }
  throw new Error('playwright-core 없음 — npx --yes --package @playwright/cli playwright-cli --version 을 한 번 실행');
};
const { chromium } = findCore();
const [file, ...pairs] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto('file://' + resolve(file)); await page.evaluate(() => document.fonts.ready);
for (const p of pairs) { const [sel, out] = p.split('='); await page.locator(sel).screenshot({ path: out }); console.log('saved', out); }
await browser.close();
