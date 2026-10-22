// 네이버 카페 시장조사용 수집(제목·본문·사진). 자동화 크롬(9222)의 자기 탭, 글 사이 3~5초.
//   node scripts/cafe-crawl.mjs <카페주소이름> <clubid> [글 수=200] [menuId]
// 결과: research/cafe/<카페>/articles.jsonl(글당 한 줄), images/<articleId>_<n>.jpg, summary.csv
// 작성자 닉네임·ID 는 저장하지 않는다(시장조사엔 필요 없음). 수집물은 내부 분석용 — 재게시 금지.
import fs from "node:fs";
import path from "node:path";
import { withTab } from "/Users/yoonseongjun/Desktop/pro/bredy-marketing/scripts/bchrome.mjs";

const [cafe, clubid, nArg = "200", menuId] = process.argv.slice(2);
if (!cafe || !clubid) { console.error("사용법: node scripts/cafe-crawl.mjs <카페> <clubid> [글 수] [menuId]"); process.exit(1); }
const N = Number(nArg);
const dir = path.join("/Users/yoonseongjun/Desktop/pro/bredy-marketing/research/cafe", cafe);
const imgDir = path.join(dir, "images");
fs.mkdirSync(imgDir, { recursive: true });
const out = path.join(dir, "articles.jsonl");
const done = new Set(fs.existsSync(out) ? fs.readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).articleId) : []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await withTab("naver", async (page) => {
  await page.goto(`https://m.cafe.naver.com/${cafe}`, { waitUntil: "domcontentloaded" });
  // 1) 목록(API, 50개씩)
  const list = [];
  for (let p = 1; list.length < N && p <= 40; p++) {
    const q = `search.clubid=${clubid}&search.queryType=lastArticle&search.page=${p}&search.perPage=50` + (menuId ? `&search.menuid=${menuId}` : "");
    const res = await page.evaluate(async (q) => (await (await fetch(`https://apis.naver.com/cafe-web/cafe2/ArticleListV3dot1.json?${q}`, { credentials: "include" })).json()).message?.result, q);
    const items = (res?.articleList || []).filter((a) => a.articleId && !a.blindArticle);
    list.push(...items);
    if (!res?.hasNext || !items.length) break;
    await sleep(1500);
  }
  const todo = list.slice(0, N).filter((a) => !done.has(a.articleId));
  console.log(`목록 ${list.length}개 중 새로 받을 글 ${todo.length}개 (이미 ${done.size}개)`);

  // 2) 글마다 본문·사진
  for (const [i, a] of todo.entries()) {
    try {
      await page.goto(`https://m.cafe.naver.com/ca-fe/web/cafes/${clubid}/articles/${a.articleId}`, { waitUntil: "domcontentloaded", timeout: 30e3 });
      await page.waitForSelector("h2.tit", { timeout: 10e3 }).catch(() => {});
      const d = await page.evaluate(() => {
        const box = document.querySelector(".se-main-container") || document.querySelector("#postContent") || document.querySelector("#tbody");
        const locked = /등급 이상의 멤버만|멤버만 볼 수|가입 후 이용|멤버에게만 공개|카페에 가입하면 바로/.test(document.body.innerText.slice(0, 2000));
        return {
          title: document.querySelector("h2.tit")?.innerText.trim() || "",
          body: (box?.innerText || "").replace(/\n{3,}/g, "\n\n").trim(),
          images: box ? [...new Set([...box.querySelectorAll("img")].map((im) => im.src).filter((s) => /phinf|pstatic/.test(s) && !/sticker|static\/img|default/.test(s)))] : [],
          locked,
        };
      });
      const files = [];
      for (const [k, url] of d.images.entries()) {
        const f = `${a.articleId}_${k + 1}.jpg`;
        const r = await page.request.get(url, { headers: { referer: "https://m.cafe.naver.com/" } }).catch(() => null);
        if (r?.ok()) { fs.writeFileSync(path.join(imgDir, f), await r.body()); files.push(f); }
      }
      const row = {
        articleId: a.articleId, menu: a.menuName, date: new Date(a.writeDateTimestamp).toISOString(),
        views: a.readCount, comments: a.commentCount, likes: a.likeItCount, memberLevel: a.memberLevel,
        market: a.marketArticle || a.productSale?.saleStatus !== "NONE", cost: a.cost || null,
        title: d.title || a.subject, body: d.body, images: files, locked: d.locked,
        url: `https://cafe.naver.com/${cafe}/${a.articleId}`,
      };
      fs.appendFileSync(out, JSON.stringify(row) + "\n");
      console.log(`${i + 1}/${todo.length} #${a.articleId} [${a.menuName}] 사진 ${files.length} | ${row.title.slice(0, 30)}`);
    } catch (e) {
      console.log(`${i + 1}/${todo.length} #${a.articleId} 실패: ${String(e).slice(0, 80)}`);
    }
    await sleep(3000 + Math.random() * 2000);
  }
});

// 3) 요약 CSV(엑셀용)
const rows = fs.readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
fs.writeFileSync(path.join(dir, "summary.csv"), "﻿" + ["articleId,date,menu,title,views,comments,likes,images,market,cost,body_200,url",
  ...rows.map((r) => [r.articleId, r.date, r.menu, r.title, r.views, r.comments, r.likes, r.images.length, r.market, r.cost, r.body.slice(0, 200), r.url].map(esc).join(","))].join("\n"));
console.log(`끝: ${rows.length}개 → ${dir}`);
