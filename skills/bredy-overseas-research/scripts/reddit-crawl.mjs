// 해외(Reddit) 시장조사 수집(제목·본문·사진). 터미널 요청은 403 이라 자동화 크롬(9222) 탭 안에서 공개 JSON 을 읽는다.
//   node reddit-crawl.mjs <서브레딧> [글 수=200] [new|hot|top]
// 결과: bredy-marketing/research/overseas/reddit-<서브레딧>/ articles.jsonl·images/·summary.csv — 카페와 같은 형식(cafe-report.py 로 집계)
// 작성자 이름은 저장하지 않는다. 내부 분석용 — 재게시 금지.
import fs from "node:fs";
import path from "node:path";
import { withTab } from "/Users/yoonseongjun/Desktop/pro/bredy-marketing/scripts/bchrome.mjs";

const [sub, nArg = "200", sort = "new"] = process.argv.slice(2);
if (!sub) { console.error("사용법: node reddit-crawl.mjs <서브레딧> [글 수] [new|hot|top]"); process.exit(1); }
const N = Number(nArg);
const dir = path.join("/Users/yoonseongjun/Desktop/pro/bredy-marketing/research/overseas", `reddit-${sub}`);
const imgDir = path.join(dir, "images");
fs.mkdirSync(imgDir, { recursive: true });
const out = path.join(dir, "articles.jsonl");
const done = new Set(fs.existsSync(out) ? fs.readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).articleId) : []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function imagesOf(d) {
  if (d.is_gallery && d.media_metadata) {
    return (d.gallery_data?.items || []).map((it) => d.media_metadata[it.media_id]?.s?.u).filter(Boolean);
  }
  if (d.post_hint === "image" && d.url) return [d.url];
  const p = d.preview?.images?.[0]?.source?.url; // 영상·링크 글은 미리보기 1장
  return p && !d.is_video ? [p] : [];
}

await withTab("reddit", async (page) => {
  await page.goto(`https://www.reddit.com/r/${sub}/`, { waitUntil: "domcontentloaded" });
  const posts = [];
  let after = "";
  while (posts.length < N) {
    const j = await page.evaluate(async (u) => { const r = await fetch(u); return r.ok ? r.json() : { error: r.status }; },
      `/r/${sub}/${sort}.json?limit=100&raw_json=1${sort === "top" ? "&t=month" : ""}${after ? `&after=${after}` : ""}`);
    if (j.error) { console.log(`목록 오류 ${j.error}`); break; }
    posts.push(...j.data.children.map((c) => c.data).filter((d) => !d.stickied));
    after = j.data.after;
    if (!after) break;
    await sleep(2000);
  }
  const todo = posts.slice(0, N).filter((d) => !done.has(d.id));
  console.log(`r/${sub} 목록 ${posts.length}개 중 새로 받을 글 ${todo.length}개 (이미 ${done.size}개)`);
  for (const [i, d] of todo.entries()) {
    const files = [];
    for (const [k, url] of imagesOf(d).slice(0, 10).entries()) {
      const ext = (url.match(/\.(jpe?g|png|webp|gif)/i)?.[1] || "jpg").toLowerCase();
      const f = `${d.id}_${k + 1}.${ext}`;
      const r = await page.request.get(url).catch(() => null);
      if (r?.ok()) { fs.writeFileSync(path.join(imgDir, f), await r.body()); files.push(f); }
      await sleep(400);
    }
    const row = {
      articleId: d.id, menu: d.link_flair_text || "(no flair)", date: new Date(d.created_utc * 1000).toISOString(),
      views: 0, comments: d.num_comments, likes: d.score, memberLevel: null,
      market: /for sale|rehom|adopt|selling|wtb|wts/i.test(d.title + " " + (d.link_flair_text || "")), cost: null,
      title: d.title, body: (d.selftext || "").trim(), images: files, locked: false,
      url: `https://www.reddit.com${d.permalink}`,
    };
    fs.appendFileSync(out, JSON.stringify(row) + "\n");
    if ((i + 1) % 20 === 0 || i === todo.length - 1) console.log(`${i + 1}/${todo.length} 사진 누적 ${fs.readdirSync(imgDir).length}`);
    await sleep(600);
  }
}, { lock: true });

const rows = fs.readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
fs.writeFileSync(path.join(dir, "summary.csv"), "﻿" + ["id,date,flair,title,score,comments,images,market,body_200,url",
  ...rows.map((r) => [r.articleId, r.date, r.menu, r.title, r.likes, r.comments, r.images.length, r.market, r.body.slice(0, 200), r.url].map(esc).join(","))].join("\n"));
console.log(`끝: ${rows.length}개 → ${dir}`);
