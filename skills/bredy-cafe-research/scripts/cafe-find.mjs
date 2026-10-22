// 검색어별 네이버 카페 후보(이름·회원 수·clubid). node scripts/cafe-find.mjs 검색어1 검색어2 ...
import { withTab } from "/Users/yoonseongjun/Desktop/pro/bredy-marketing/scripts/bchrome.mjs";
await withTab("naver", async (page) => {
  for (const q of process.argv.slice(2)) {
    await page.goto(`https://section.cafe.naver.com/ca-fe/home/search/cafes?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle" });
    const names = await page.evaluate(() => [...new Set([...document.querySelectorAll("a[href^='https://cafe.naver.com/']")].map(a => a.href.split("/")[3]).filter(Boolean))].slice(0, 6));
    const rows = [];
    for (const n of names) {
      const g = await page.evaluate(async (n) => (await (await fetch(`https://apis.naver.com/cafe-web/cafe2/CafeGateInfo.json?cluburl=${n}`, { credentials: "include" })).json()).message?.result, n).catch(() => null);
      const c = g?.cafeInfoView || {};
      rows.push(`${n} id=${c.cafeId} 회원=${c.memberCount} ${c.cafeName} 가입=${g?.memberInfo?.cafeMember ?? g?.cafeMember ?? "?"}`);
    }
    console.log("##", q, "\n " + rows.join("\n "));
  }
}, { lock: false });
