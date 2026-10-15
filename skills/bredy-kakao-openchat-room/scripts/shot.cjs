/**
 * /admin/kakao-digest 캡처. breeder_web 워크트리 루트에서 실행한다(node_modules/playwright 사용).
 *   node <skill>/scripts/shot.cjs <응답 json> <출력 png> [port=3010]
 * 관리자 로그인은 /api/users/me 를 관리자로 가로채고, 소식 API 는 넘긴 json 으로 대신한다
 * (json 은 dev DB 에서 buildAllKakaoDigests 로 만든 실제 결과나 '예시 데이터'로 밝힌 것만 쓴다).
 */
const { chromium } = require(process.cwd() + "/node_modules/playwright");
const fs = require("fs");
const [jsonPath, outPath, port = "3010"] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const s = document.createElement("style");
    s.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
  });
  await page.route("**/api/users/me**", (r) => r.fulfill({ json: { success: true, isAdmin: true, profile: { id: 1, name: "운영자" } } }));
  await page.route("**/api/admin/kakao-digest**", (r) => r.fulfill({ json: JSON.parse(fs.readFileSync(jsonPath, "utf8")) }));
  await page.goto(`http://localhost:${port}/admin/kakao-digest`);
  await page.locator("pre").first().waitFor({ timeout: 90000 });
  await page.mouse.move(1, 1);
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
