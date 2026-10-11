#!/usr/bin/env node
// 브리디 인스타 DM — Paseo 브라우저와 따로 쓰는 '영업 전용 크롬 창'으로 보낸다.
// Paseo 브라우저는 사용자와 같이 써서 탭이 화면에 없으면 Enter 가 안 먹고, 사용자 타이핑이 섞인다(10-11).
// 이 스크립트는 자기 크롬 프로필(OUTREACH_DIR/chrome-profile)로 띄운 창에서 실제 키 입력으로 보낸다.
//
// 준비(한 번): cd $OUTREACH_DIR/runner && npm i playwright-core   (Google Chrome 이 설치돼 있어야 한다)
//
//   node ig.mjs login                크롬 창을 띄운다 → 사용자가 bredy_breeder 로 직접 로그인(비밀번호는 스크립트가 보지 않음)
//   node ig.mjs check                로그인 상태 확인
//   node ig.mjs send [n]             후보(targets.csv '후보')에게 첫 메시지 — 실제 보냄 n명(기본 7)이 될 때까지
//   node ig.mjs inbox                읽지 않은 대화를 열어 handle·최근 메시지를 JSON 으로
//   node ig.mjs read <handle>        그 사람 대화 최근 메시지 JSON
//   node ig.mjs reply <handle> <글>  답장(여러 줄은 글 안의 \n)
// 옵션: --headless(창 안 띄움 — 읽기용. 보낼 땐 쓰지 않는다: 10-11 headless 로 6분에 28명 보낸 뒤 로그아웃) --dry(입력·검사까지만, 전송 안 함) --ignore-limit(하루 한도 무시, 사용자 승인 때만)
// 밤 9시~아침 8시(KST)엔 send 를 거부한다(정보통신망법 50조 3항). 보낸 뒤 다음 사람까지 IG_GAP_SEC(기본 45초) 쉰다.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = process.env.OUTREACH_DIR || path.join(os.homedir(), "Documents", "bredy-outreach");
const PROFILE = path.join(DIR, "chrome-profile");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "outreach.mjs");
const TEMPLATES = path.join(HERE, "..", "references", "templates.md");

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const [cmd, ...args] = argv.filter((a) => !a.startsWith("--"));
const HEADLESS = flags.has("--headless");
const DRY = flags.has("--dry");
const GAP_MS = Number(process.env.IG_GAP_SEC || 45) * 1000; // 보낸 뒤 다음 사람까지 쉬는 시간

const LIMIT_TEXT = /나중에 다시 시도|활동이 제한|Try Again Later|We restrict certain activity/;
const BLOCKED_TEXT = /메시지를 받을 수 없습니다|보낼 수 있는 사람이 제한|메시지 요청을 허용하지 않|Not everyone can message/;

let chromium;
try {
  ({ chromium } = createRequire(path.join(DIR, "runner", "package.json"))("playwright-core"));
} catch {
  console.error(`playwright-core 가 없다 → cd ${path.join(DIR, "runner")} && npm i playwright-core`);
  process.exit(2);
}

const log = (...a) => console.error(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outreach = (...a) =>
  execFileSync("node", [OUT, ...a], { encoding: "utf8", env: { ...process.env, OUTREACH_DAILY_LIMIT: "100000" } });

function kstHour() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hour12: false }).format(new Date())) % 24;
}

// templates.md 의 '### <제목>' 아래 첫 코드 블록 = 첫 메시지 틀(문구를 한 곳에서만 고치려고 파일에서 읽는다)
function template(kind) {
  const md = fs.readFileSync(TEMPLATES, "utf8");
  const heading = kind === "샵" ? "### 샵" : kind === "행사" ? "### 행사" : "### 브리더";
  const at = md.indexOf(heading);
  if (at < 0) throw new Error(`templates.md 에 '${heading}' 이 없다`);
  const m = md.slice(at).match(/```\n([\s\S]*?)\n```/);
  if (!m) throw new Error(`templates.md '${heading}' 아래 코드 블록이 없다`);
  return m[1];
}

function firstMessage(nick, kind, left) {
  let text = template(kind).replaceAll("{남은자리}", String(left));
  text = nick ? text.replaceAll("{닉네임}", nick) : text.replace(/ ?\{닉네임\}(님| 운영진님)?/, "");
  return text.split("\n");
}

async function slotsLeft() {
  const res = await fetch("https://bredy.app/content/breeder-program");
  const m = (await res.text()).match(/(\d+)\/100/);
  if (!m) throw new Error("창립 브리더 수를 못 찾았다");
  return 100 - Number(m[1]);
}

async function openBrowser() {
  fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: "chrome",
    headless: HEADLESS,
    viewport: { width: 1280, height: 900 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  return { ctx, page };
}

async function loggedIn(page) {
  await page.goto("https://www.instagram.com/direct/inbox/", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  if (page.url().includes("/accounts/login") || page.url().includes("/challenge")) return false;
  return (await page.getByText("bredy_breeder").count()) > 0;
}

async function limitHit(page) {
  return (await page.getByText(LIMIT_TEXT).count()) > 0;
}

function composerOf(page) {
  return page.locator('div[role="textbox"][contenteditable="true"]').last();
}

// 대화방을 연다. 입력창이 안 나오면 null(ig.me 가 없는 페이지로 가거나 DM 을 못 받는 계정)
class LoggedOut extends Error {}

async function openThread(page, handle) {
  await page.goto(`https://ig.me/m/${handle}`, { waitUntil: "domcontentloaded" });
  const composer = composerOf(page);
  try {
    await composer.waitFor({ timeout: 15000 });
  } catch {
    // 로그아웃·보안 확인으로 튕긴 것을 'DM 못 받는 계정'으로 잘못 기록하지 않는다(10-11: 28명 뒤 로그아웃 → 10명 오기록)
    if (/\/accounts\/login|\/challenge|\/checkpoint/.test(page.url())) throw new LoggedOut(page.url());
    return null;
  }
  await sleep(2500); // 이전 대화가 그려질 시간
  return composer;
}

const norm = (s) => s.replace(/ /g, " ").replace(/\n+/g, "\n").trim();

// 실제 키 입력으로 넣고(줄 사이 Shift+Enter) 입력창 내용이 정확히 같은지 확인한다
async function typeExact(page, composer, lines) {
  await composer.click();
  await sleep(200);
  if (norm(await composer.innerText())) {
    await page.keyboard.press("Meta+A");
    await page.keyboard.press("Backspace");
    await sleep(400); // 지운 직후 바로 넣으면 첫 줄이 사라진다(10-11 확인)
  }
  for (let i = 0; i < lines.length; i++) {
    if (i) await page.keyboard.press("Shift+Enter");
    await page.keyboard.insertText(lines[i]);
  }
  await sleep(300);
  return norm(await composer.innerText()) === norm(lines.join("\n"));
}

// Enter 로 보내고, 그 글이 담긴 말풍선이 생겼는지 본다
async function sendAndVerify(page, composer, lines, probe) {
  await page.keyboard.press("Enter");
  const bubble = page.getByRole("article").filter({ hasText: probe }).last();
  try {
    await bubble.waitFor({ timeout: 12000 });
  } catch {
    return { ok: false };
  }
  const text = norm(await bubble.innerText());
  return { ok: true, lineBreaks: text.split("\n").length >= Math.min(lines.length, 3) };
}

function candidates(n) {
  const rows = outreach("next", "500").trim().split("\n").filter(Boolean);
  return rows.slice(0, n).map((r) => {
    const [handle, nick = "", field = "", kind = ""] = r.split("\t");
    return { handle, nick, field, kind };
  });
}

function roomToday() {
  const s = JSON.parse(execFileSync("node", [OUT, "stats"], { encoding: "utf8" }));
  return Math.max(0, s.dailyLimit - s.sentToday);
}

async function cmdSend(want) {
  const h = kstHour();
  if (h >= 21 || h < 8) throw new Error("밤 9시~아침 8시엔 영업 메시지를 보내지 않는다(정보통신망법 50조 3항)");
  if (!flags.has("--ignore-limit")) want = Math.min(want, roomToday());
  if (!want) return log("오늘 한도를 다 썼다(--ignore-limit 은 사용자 승인 때만).");
  const left = await slotsLeft();
  const { ctx, page } = await openBrowser();
  const result = { sent: [], existing: [], blocked: [], noThread: [], failed: [], stopped: null };
  try {
    if (!(await loggedIn(page))) throw new Error("로그인 안 됨 → node ig.mjs login");
    for (const t of candidates(want * 4)) {
      if (result.sent.length >= want) break;
      let composer;
      try {
        composer = await openThread(page, t.handle);
      } catch (e) {
        if (!(e instanceof LoggedOut)) throw e;
        result.stopped = "로그아웃됨 → node ig.mjs login 후 다시(보낸 속도를 줄일 것)";
        break;
      }
      if (await limitHit(page)) { result.stopped = "제한 문구"; break; }
      if (!composer) {
        outreach("mark", t.handle, "보류", "ig.me 실패(크롬)");
        result.noThread.push(t.handle);
        continue;
      }
      if ((await page.getByRole("article").count()) > 0) {
        outreach("mark", t.handle, "제외", "기존 대화");
        result.existing.push(t.handle);
        continue;
      }
      const lines = firstMessage(t.nick, t.kind, left);
      if (!(await typeExact(page, composer, lines)) && !(await typeExact(page, composer, lines))) {
        if (!DRY) outreach("mark", t.handle, "확인필요", "입력 불일치(크롬)");
        result.failed.push(t.handle);
        continue;
      }
      if (DRY) { log(`[dry] ${t.handle}: 입력 확인까지 OK`); result.sent.push(t.handle); continue; }
      const r = await sendAndVerify(page, composer, lines, lines[1]);
      if (!r.ok) {
        outreach("mark", t.handle, "확인필요", "전송 확인 실패(크롬)");
        result.failed.push(t.handle);
        if (result.failed.length >= 2 && result.sent.length === 0) { result.stopped = "연속 전송 실패"; break; }
        continue;
      }
      if (!r.lineBreaks) { result.stopped = `줄바꿈 빠짐(${t.handle})`; outreach("mark", t.handle, "보냄", "v4 크롬, 줄바꿈 빠짐"); break; }
      await sleep(3000);
      if ((await page.getByRole("article").filter({ hasText: BLOCKED_TEXT }).count()) > 0) {
        outreach("mark", t.handle, "제외", "DM 막힘");
        result.blocked.push(t.handle);
        continue;
      }
      outreach("mark", t.handle, "보냄", "v4 크롬");
      result.sent.push(t.handle);
      log(`보냄 ${result.sent.length}/${want}: ${t.handle}`);
      if (await limitHit(page)) { result.stopped = "제한 문구"; break; }
      await sleep(GAP_MS); // 몰아서 보내면 로그아웃된다(10-11: 6분에 28명 → 세션 끊김)
    }
  } finally {
    await ctx.close();
  }
  console.log(JSON.stringify(result, null, 2));
}

async function threadMessages(page, n = 12) {
  const arts = page.getByRole("article");
  const count = await arts.count();
  const out = [];
  for (let i = Math.max(0, count - n); i < count; i++) out.push(norm(await arts.nth(i).innerText()));
  return out;
}

async function cmdInbox() {
  const { ctx, page } = await openBrowser();
  const items = [];
  try {
    if (!(await loggedIn(page))) throw new Error("로그인 안 됨 → node ig.mjs login");
    const unread = page.getByRole("button").filter({ hasText: "Unread" });
    const n = await unread.count();
    const names = [];
    for (let i = 0; i < n; i++) names.push(norm(await unread.nth(i).innerText()).split("\n")[0]);
    for (const name of names) {
      await page.goto("https://www.instagram.com/direct/inbox/", { waitUntil: "domcontentloaded" });
      await sleep(2500);
      await page.getByRole("button").filter({ hasText: name }).filter({ hasText: "Unread" }).first().click();
      await sleep(3000);
      const link = page.locator('a[aria-label^="Open the profile page of"]').first();
      const label = (await link.getAttribute("aria-label").catch(() => "")) || "";
      items.push({ name, handle: label.replace("Open the profile page of ", ""), messages: await threadMessages(page) });
    }
  } finally {
    await ctx.close();
  }
  console.log(JSON.stringify(items, null, 2));
}

async function cmdRead(handle) {
  const { ctx, page } = await openBrowser();
  try {
    if (!(await openThread(page, handle))) throw new Error("대화방을 못 열었다");
    console.log(JSON.stringify({ handle, messages: await threadMessages(page) }, null, 2));
  } finally {
    await ctx.close();
  }
}

async function cmdReply(handle, text) {
  const lines = text.replaceAll("\\n", "\n").split("\n");
  const { ctx, page } = await openBrowser();
  try {
    const composer = await openThread(page, handle);
    if (!composer) throw new Error("대화방을 못 열었다");
    if (!(await typeExact(page, composer, lines))) throw new Error("입력 불일치 — 보내지 않았다");
    if (DRY) return log("[dry] 입력 확인까지 OK");
    const r = await sendAndVerify(page, composer, lines, lines[0].slice(0, 12));
    console.log(JSON.stringify({ handle, ...r }));
  } finally {
    await ctx.close();
  }
}

async function cmdLogin() {
  if (HEADLESS) throw new Error("login 은 창을 띄워야 한다(--headless 빼기)");
  const { ctx, page } = await openBrowser();
  try {
    if (await loggedIn(page)) return log("이미 bredy_breeder 로 로그인돼 있다.");
    await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "domcontentloaded" });
    log("크롬 창에서 bredy_breeder 로 로그인해 주세요(최대 15분 기다림). 로그인 정보 저장 질문엔 '저장'을 누르면 다음부터 편하다.");
    for (let i = 0; i < 300; i++) {
      await sleep(3000);
      const cookies = await ctx.cookies("https://www.instagram.com");
      if (cookies.some((c) => c.name === "sessionid" && c.value)) {
        await sleep(4000);
        const ok = await loggedIn(page);
        return log(ok ? "로그인 확인 — bredy_breeder" : "로그인은 됐지만 bredy_breeder 화면이 아니다. 계정을 확인해 주세요.");
      }
    }
    log("15분 안에 로그인이 확인되지 않았다.");
  } finally {
    await ctx.close();
  }
}

const main = {
  login: cmdLogin,
  check: async () => {
    const { ctx, page } = await openBrowser();
    try { console.log((await loggedIn(page)) ? "로그인됨" : "로그인 안 됨"); } finally { await ctx.close(); }
  },
  send: () => cmdSend(Number(args[0] || 7)),
  inbox: cmdInbox,
  read: () => cmdRead(args[0]),
  reply: () => cmdReply(args[0], args.slice(1).join(" ")),
}[cmd];

if (!main) {
  console.log("usage: ig.mjs login|check|send [n]|inbox|read <handle>|reply <handle> <글>  [--headless --dry --ignore-limit]");
  process.exit(1);
}
main().catch((e) => {
  console.error(`실패: ${e.message}`);
  process.exit(1);
});
