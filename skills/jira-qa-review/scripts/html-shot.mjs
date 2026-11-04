// node html-shot.mjs <in.html> <out.png> — HTML(예: xlsx2html.py 결과)을 회사 크롬(9224) 격리 컨텍스트에서 전체 화면으로 찍고 그 컨텍스트만 닫는다
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PW_MJS || `${process.env.HOME}/Desktop/bhsn/allibee-frontend/node_modules/playwright/index.mjs`);
const [input, out] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9224');
const context = await browser.newContext({ viewport: { width: 1600, height: 300 } });
try {
  const page = await context.newPage();
  await page.setContent(readFileSync(input, 'utf8'));
  await page.screenshot({ path: out, fullPage: true });
} finally { await context.close(); }
process.exit(0);
