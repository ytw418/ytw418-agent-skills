#!/usr/bin/env node
/**
 * 웹 내 동네 흐름을 로컬 next dev + Playwright(iPhone 13)로 돌리고 캡처한다. dev DB 에는 쓰지 않는다.
 * - POST /api/users/me 는 가로채 가짜 성공을 주고 요청 본문을 찍는다.
 * - GET /api/users/me 응답에서 동네 값을 비워 '처음 동네를 정하는 사용자'로 만든다(--keep-region 이면 그대로).
 * 흐름: 테스트 계정 로그인(?next=/posts) → /posts → /settings/region(캡처 01) → 시/도(캡처 02) → 시/군/구 → 내 동네(캡처 03) → 완료 → 돌아간 주소.
 *
 * 사용: node web_region_flow.cjs <breeder_web 경로> <출력 폴더> [--base http://localhost:3021] [--sido 서울특별시] [--sigungu 강남구] [--keep-region]
 * 먼저 그 경로에서 `npx next dev -p 3021` 를 띄운다(다른 세션이 3010·3017 을 쓴다).
 */
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const [WEB, OUT] = args;
if (!WEB || !OUT) {
  console.error("사용: node web_region_flow.cjs <breeder_web 경로> <출력 폴더> [--base URL] [--sido 시도] [--sigungu 시군구] [--keep-region]");
  process.exit(2);
}
const BASE = opt("base", "http://localhost:3021");
const SIDO = opt("sido", "서울특별시");
const SIGUNGU = opt("sigungu", "강남구");
const KEEP = args.includes("--keep-region");
// next dev 는 처음 여는 페이지를 그때 컴파일해 30초를 넘기기도 한다.
const NAV = { waitUntil: "domcontentloaded", timeout: 90000 };

const { chromium, devices } = require(require.resolve("playwright", { paths: [WEB] }));

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["iPhone 13"], locale: "ko-KR" });
  await context.addInitScript(() => {
    const add = () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    };
    if (document.head) add();
    else document.addEventListener("DOMContentLoaded", add);
  });
  const page = await context.newPage();
  // 로그인 직후 '알림을 켜고 소식을 바로 받아보세요' 시트가 떠서 아래 버튼을 가린다. 보이면 닫는다.
  const closeSheets = async () => {
    const later = page.getByRole("button", { name: "나중에" });
    if (await later.isVisible().catch(() => false)) await later.click().catch(() => {});
  };
  const posted = [];
  await page.route("**/api/users/me", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      posted.push(JSON.parse(req.postData() || "{}"));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
    let res;
    try {
      res = await route.fetch();
    } catch {
      return route.abort().catch(() => {});
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
      return route.fulfill({ response: res });
    }
    if (!KEEP && json && json.profile) {
      Object.assign(json.profile, { regionSido: null, regionSigungu: null, regionVisible: false });
    }
    return route.fulfill({ response: res, json });
  });

  // 로그인 뒤 홈(/) 대신 /posts 로 보낸다. next dev 에서 홈 첫 컴파일이 몇 분씩 걸릴 때가 있다.
  await page.goto(`${BASE}/auth/login?next=%2Fposts`, NAV);
  const account = page.locator("p:has-text('테스트 계정') ~ div button").first();
  await account.waitFor({ timeout: 60000 });
  console.log("login as:", (await account.innerText()).replace(/\s+/g, " "));
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/users/me") && r.status() === 200, { timeout: 60000 }),
    account.click(),
  ]);
  await page.waitForURL((u) => u.pathname.startsWith("/posts"), { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/settings/region`, NAV);
  await page.getByText("현재 위치로 찾기").or(page.getByText("설정 안 함")).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  await closeSheets();
  await page.screenshot({ path: `${OUT}/web-01-region.png` });
  console.log("완료 비활성:", await page.getByRole("button", { name: "완료" }).isDisabled());
  console.log("현재 위치 버튼:", (await page.getByText("현재 위치로 찾기").count()) > 0);

  await page.getByRole("link", { name: SIDO }).click();
  await page.getByRole("button", { name: `${SIDO} ${SIGUNGU}` }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  await closeSheets();
  await page.screenshot({ path: `${OUT}/web-02-sigungu.png` });

  await page.getByRole("button", { name: `${SIDO} ${SIGUNGU}` }).click();
  await page.getByText("완료를 누르면 저장돼요").waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  console.log("고른 뒤 주소:", page.url());
  console.log("나를 표시:", await page.getByRole("switch", { name: "동네 브리더에 나를 표시" }).getAttribute("aria-checked"));
  await closeSheets();
  await page.screenshot({ path: `${OUT}/web-03-picked.png` });

  await page.getByRole("button", { name: "완료" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/settings/region"), { timeout: 30000 });
  console.log("저장 요청:", JSON.stringify(posted));
  console.log("완료 뒤 주소:", page.url());
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
