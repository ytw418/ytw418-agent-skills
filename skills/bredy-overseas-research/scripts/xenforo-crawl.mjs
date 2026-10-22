// 해외 XenForo 포럼(TheCatSite·dogforum 등) 게시판의 스레드 첫 글 제목·본문·사진 수집. 터미널은 봇 차단이라 자동화 크롬(9222) 탭으로.
//   node xenforo-crawl.mjs <게시판 주소> <저장 이름> [글 수=200]
//   예) node xenforo-crawl.mjs https://thecatsite.com/forums/cat-behavior.5/ thecatsite-behavior 100
// 결과: bredy-marketing/research/overseas/<저장 이름>/ articles.jsonl·images/·summary.csv (cafe-report.py 형식)
// 작성자 이름은 저장하지 않는다. 내부 분석용 — 재게시 금지. 글 사이 2~4초.
import fs from "node:fs";
import path from "node:path";
import { withTab } from "/Users/yoonseongjun/Desktop/pro/bredy-marketing/scripts/bchrome.mjs";

const [forum, name, nArg = "200"] = process.argv.slice(2);
if (!forum || !name) { console.error("사용법: node xenforo-crawl.mjs <게시판 주소> <저장 이름> [글 수]"); process.exit(1); }
const N = Number(nArg);
const dir = path.join("/Users/yoonseongjun/Desktop/pro/bredy-marketing/research/overseas", name);
const imgDir = path.join(dir, "images");
fs.mkdirSync(imgDir, { recursive: true });
const out = path.join(dir, "articles.jsonl");
const done = new Set(fs.existsSync(out) ? fs.readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).articleId) : []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = forum.replace(/\/?$/, "/");

await withTab(new URL(forum).hostname, async (page) => {
  // 1) 스레드 목록(고정글 제외)
  const threads = new Map();
  for (let p = 1; threads.size < N && p <= 30; p++) {
    await page.goto(p === 1 ? base : `${base}page-${p}`, { waitUntil: "domcontentloaded", timeout: 45e3 });
    await page.waitForSelector(".structItem--thread", { timeout: 20e3 }).catch(() => {});
    const rows = await page.evaluate(() => [...document.querySelectorAll(".structItem--thread")]
      .filter((el) => !el.closest(".structItemContainer-group--sticky"))
      .map((el) => {
        const a = el.querySelector(".structItem-title a[href*='/threads/']:last-of-type") || el.querySelector("a[href*='/threads/']");
        const dd = [...el.querySelectorAll(".structItem-cell--meta dd")].map((d) => d.innerText.trim());
        return { href: a?.href, title: a?.innerText.trim(), prefix: el.querySelector(".label")?.innerText.trim() || "", replies: dd[0] || "0", views: dd[1] || "0" };
      }).filter((r) => r.href));
    if (!rows.length) break;
    for (const r of rows) threads.set(r.href.replace(/(\/threads\/[^/]+\/).*/, "$1"), r);
    await sleep(2000);
  }
  const num = (s) => { const m = String(s).replace(/,/g, "").match(/([\d.]+)\s*([KkMm])?/); return m ? Math.round(Number(m[1]) * (m[2] ? (/k/i.test(m[2]) ? 1e3 : 1e6) : 1)) : 0; };
  const todo = [...threads].slice(0, N).filter(([u]) => !done.has(u.match(/\.(\d+)\/$/)?.[1] || u));
  console.log(`${name} 목록 ${threads.size}개 중 새로 받을 글 ${todo.length}개 (이미 ${done.size}개)`);

  // 2) 스레드 첫 글
  for (const [i, [url, t]] of todo.entries()) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45e3 });
      await page.waitForSelector(".message-body .bbWrapper", { timeout: 15e3 }).catch(() => {});
      const d = await page.evaluate(() => {
        const first = document.querySelector("article.message--post");
        const body = first?.querySelector(".message-body .bbWrapper");
        const imgs = body ? [...body.querySelectorAll("img")].map((im) => im.closest("a.js-lbImage")?.href || im.dataset.url || im.src)
          .filter((s) => s && !/smilies|emoji|avatar|data:image/i.test(s)) : [];
        const att = first ? [...first.querySelectorAll(".attachmentList a.file-preview, .attachment a")].map((a) => a.href) : [];
        return { body: (body?.innerText || "").replace(/\n{3,}/g, "\n\n").trim(), images: [...new Set([...imgs, ...att])], date: first?.querySelector("time")?.getAttribute("datetime") || "", likes: Number((first?.querySelector(".reactionsBar-link")?.innerText.match(/(\d+) others/) || [])[1] || 0) };
      });
      const id = url.match(/\.(\d+)\/$/)?.[1] || url;
      const files = [];
      for (const [k, src] of d.images.slice(0, 10).entries()) {
        const r = await page.request.get(src, { headers: { referer: url } }).catch(() => null);
        const type = r?.headers()["content-type"] || "";
        if (r?.ok() && type.startsWith("image/")) {
          const f = `${id}_${k + 1}.${type.split("/")[1].replace("jpeg", "jpg").split(";")[0]}`;
          fs.writeFileSync(path.join(imgDir, f), await r.body()); files.push(f);
        }
      }
      const row = {
        articleId: id, menu: t.prefix || "(no prefix)", date: d.date ? new Date(d.date).toISOString() : "",
        views: num(t.views), comments: num(t.replies), likes: d.likes, memberLevel: null,
        market: /for sale|rehom|adopt|selling/i.test(t.title + " " + t.prefix), cost: null,
        title: t.title, body: d.body, images: files, locked: !d.body, url,
      };
      fs.appendFileSync(out, JSON.stringify(row) + "\n");
      if ((i + 1) % 20 === 0 || i === todo.length - 1) console.log(`${i + 1}/${todo.length} 사진 누적 ${fs.readdirSync(imgDir).length}`);
    } catch (e) {
      console.log(`${i + 1}/${todo.length} 실패 ${url}: ${String(e).slice(0, 80)}`);
    }
    await sleep(2000 + Math.random() * 2000);
  }
});

const rows = fs.readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
fs.writeFileSync(path.join(dir, "summary.csv"), "﻿" + ["id,date,prefix,title,views,replies,images,market,body_200,url",
  ...rows.map((r) => [r.articleId, r.date, r.menu, r.title, r.views, r.comments, r.images.length, r.market, r.body.slice(0, 200), r.url].map(esc).join(","))].join("\n"));
console.log(`끝: ${rows.length}개 → ${dir}`);
