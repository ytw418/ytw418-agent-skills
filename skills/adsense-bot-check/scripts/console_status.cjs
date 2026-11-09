// 애드센스 콘솔 '사이트' 목록과 사이트별 상세(검토 단계)를 읽는다. 자동화 크롬(CDP)에 붙어 자기 탭만 열고 닫는다.
// 사용: node console_status.cjs [--port 9222] [--pub pub-8957945516038764] [--site bredy.app]
// playwright 는 PLAYWRIGHT 환경 변수(모듈 경로) 또는 breeder_web node_modules 의 것을 쓴다.
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const { chromium } = require(process.env.PLAYWRIGHT || `${process.env.HOME}/Desktop/pro/breeder_web/node_modules/playwright`);
const port = arg("port", "9222");
const pub = arg("pub", "pub-8957945516038764");
const site = arg("site", "");

(async () => {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = await browser.contexts()[0].newPage();
  try {
    await page.goto(`https://adsense.google.com/adsense/u/0/${pub}/sites/list`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=사이트 URL", { timeout: 30000 });
    await page.waitForTimeout(3000);
    const rows = await page.$$eval("tr, [role=row]", (els) =>
      els.map((el) => el.innerText.replace(/\s*\n\s*/g, " | ").trim()).filter((t) => /\.\w+/.test(t) && !t.startsWith("사이트 URL"))
    );
    console.log("[사이트 목록] URL | 승인 상태 | 상태 세부정보 | Ads.txt | 최종 업데이트");
    rows.forEach((r) => console.log("  " + r.replace(/ \| delete$/, "")));
    if (site) {
      await page.getByText(site, { exact: true }).first().click();
      await page.waitForTimeout(5000);
      // 상세는 목록 위 패널로 뜬다: '사이트 삭제' 버튼 뒤 ~ 목록 머리말 앞이 그 사이트의 검토 단계다.
      const detail = await page.evaluate(() => {
        const t = document.body.innerText;
        const start = t.indexOf("사이트 삭제");
        const end = t.indexOf("내 사이트를 관리합니다");
        return start >= 0 && end > start ? t.slice(start + "사이트 삭제".length, end) : t.slice(0, 1500);
      });
      console.log(`[${site} 상세]`);
      console.log(detail.replace(/\b(check_circle_filled|expand_less|expand_more|close|delete)\b/g, "").replace(/\n{2,}/g, "\n").trim());
      console.log("\n'리뷰가 요청됨'이면 검토 중이라 재요청 버튼이 없다. 사이트를 지웠다 다시 넣으면 대기 순서가 처음으로 돌아간다.");
    }
  } finally {
    await page.close();
    await browser.close().catch(() => {});
  }
})();
