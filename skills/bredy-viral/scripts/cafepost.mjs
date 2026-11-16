// node cafepost.mjs <cafeId> <게시판 이름 일부> <글파일: 첫 줄 제목> <사진> [go]
import { withTab } from "/Users/yoonseongjun/Desktop/pro/bredy-marketing/scripts/bchrome.mjs";
import fs from "fs";
const [cid, board, file, img, go] = process.argv.slice(2);
const [title, ...body] = fs.readFileSync(file, "utf8").trim().split("\n");
await withTab("naver-cafe", async (p) => {
  p.on("dialog", d => { console.log("dialog:", d.message().slice(0,100)); d.accept().catch(()=>{}); });
  await p.goto(`https://cafe.naver.com/ca-fe/cafes/${cid}/articles/write?boardType=L`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(8000);
  await p.locator(".FormSelectBox button").first().click(); await p.waitForTimeout(1500);
  const all = (await p.locator(".FormSelectBox li").allInnerTexts()).map(s=>s.trim());
  const opt = p.locator(".FormSelectBox li").filter({ hasText: board }).first();
  if (!(await opt.count())) { console.log("NO_BOARD; 있는 게시판:", all.join(" , ")); return; }
  await opt.click(); await p.waitForTimeout(2000);
  await p.locator(".textarea_input").first().fill(title);
  await p.locator(".se-text-paragraph").first().click();
  for (const l of body) { if (l) await p.keyboard.type(l, { delay: 10 }); await p.keyboard.press("Enter"); }
  if (img) {
    const [fc] = await Promise.all([p.waitForEvent("filechooser", { timeout: 15000 }), p.locator("button.se-image-toolbar-button, button[data-name=image]").first().click()]);
    await fc.setFiles(img); await p.waitForTimeout(6000);
  }
  console.log("imgs in editor:", await p.locator(".se-image-resource, .se-module-image img").count());
  await p.screenshot({ path: `/tmp/band/cw_${cid}.png` });
  if (go === "go") {
    await p.locator("a.BaseButton, button").filter({ hasText: /^등록$/ }).first().click(); await p.waitForTimeout(8000);
    console.log("URL:", p.url());
  }
});
