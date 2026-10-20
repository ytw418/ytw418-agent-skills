// 시안 HTML 을 PNG 한 장으로 렌더한다. breeder_web 디렉터리에서 실행(그 node_modules 의 playwright 사용).
//   cd ~/Desktop/pro/breeder_web && node <스킬>/scripts/render-mockup.mjs <html 절대경로> <png 경로> [폭]
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const { chromium } = require("playwright");

const [html, png, width = "1720"] = process.argv.slice(2);
if (!html || !png) {
  console.error("사용: node render-mockup.mjs <html> <png> [폭]");
  process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
await page.goto("file://" + html);
await page.waitForTimeout(800); // Pretendard 웹폰트
await page.screenshot({ path: png, fullPage: true });
await browser.close();
console.log(png);
