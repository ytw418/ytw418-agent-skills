#!/usr/bin/env node
// 브리디 인스타 DM 영업 — 대상 목록(targets.csv)·남은 창립 브리더 자리·일일 한도를 관리한다.
// 의존성 없음(Node 18+). 데이터 폴더: OUTREACH_DIR (기본 ~/Documents/bredy-outreach)
//
//   node outreach.mjs slots                       남은 창립 브리더 자리
//   node outreach.mjs stats                       상태별 수 + 오늘 보낸 수
//   node outreach.mjs next [n]                    다음에 보낼 후보 n명(기본 7, 오늘 한도 안에서)
//   node outreach.mjs add <handle> <닉네임> <분야> <유형> <출처> [메모]
//   node outreach.mjs mark <handle> <상태> [메모]   상태: 후보|보냄|답장|관심|가입|거절|무응답|확인필요|제외|보류
//   node outreach.mjs has <handle>                목록에 있으면 상태를 출력(종료 코드 0), 없으면 1

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = process.env.OUTREACH_DIR || path.join(os.homedir(), "Documents", "bredy-outreach");
const FILE = path.join(DIR, "targets.csv");
const DAILY_LIMIT = Number(process.env.OUTREACH_DAILY_LIMIT || 20);
const COLUMNS = ["handle", "닉네임", "분야", "유형", "출처", "보낸날", "상태", "메모"];
const STATUSES = ["후보", "보냄", "답장", "관심", "가입", "거절", "무응답", "확인필요", "제외", "보류"];
const SENT_STATUSES = new Set(["보냄", "답장", "관심", "가입", "거절", "무응답"]);

const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const esc = (v = "") => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

function load() {
  if (!fs.existsSync(FILE)) return [];
  const [header, ...rows] = parseCsv(fs.readFileSync(FILE, "utf8"));
  if (header.join(",") !== COLUMNS.join(",")) {
    throw new Error(`targets.csv 머리줄이 다르다: ${header.join(",")}\n기대: ${COLUMNS.join(",")}`);
  }
  return rows.map((r) => Object.fromEntries(COLUMNS.map((c, i) => [c, r[i] ?? ""])));
}

function save(list) {
  fs.mkdirSync(DIR, { recursive: true });
  const body = [COLUMNS.join(","), ...list.map((t) => COLUMNS.map((c) => esc(t[c])).join(","))];
  fs.writeFileSync(FILE, body.join("\n") + "\n");
}

const norm = (h) => h.replace(/^@/, "").trim().toLowerCase();
const sentToday = (list) => list.filter((t) => t["보낸날"] === today() && SENT_STATUSES.has(t["상태"])).length;

async function slots() {
  const res = await fetch("https://bredy.app/content/breeder-program");
  const m = (await res.text()).match(/(\d+)\/100/);
  if (!m) throw new Error("창립 브리더 수를 페이지에서 찾지 못했다");
  return { taken: Number(m[1]), left: 100 - Number(m[1]) };
}

const [cmd, ...args] = process.argv.slice(2);
const list = load();

switch (cmd) {
  case "slots": {
    const s = await slots();
    console.log(`${s.left}`);
    console.error(`창립 브리더 ${s.taken}/100 — 남은 자리 ${s.left}`);
    break;
  }
  case "stats": {
    const by = {};
    for (const t of list) by[t["상태"]] = (by[t["상태"]] || 0) + 1;
    console.log(JSON.stringify({ total: list.length, sentToday: sentToday(list), dailyLimit: DAILY_LIMIT, byStatus: by }, null, 2));
    break;
  }
  case "next": {
    const want = Number(args[0] || 7);
    const room = Math.max(0, DAILY_LIMIT - sentToday(list));
    const pick = list.filter((t) => t["상태"] === "후보").slice(0, Math.min(want, room));
    if (!room) console.error(`오늘 한도(${DAILY_LIMIT}명)를 다 썼다. 내일 보낸다.`);
    for (const t of pick) console.log([t.handle, t["닉네임"], t["분야"], t["유형"]].join("\t"));
    break;
  }
  case "add": {
    const [handle, nick = "", field = "", kind = "", source = "", memo = ""] = args;
    if (!handle) throw new Error("handle 이 필요하다");
    const h = norm(handle);
    const found = list.find((t) => norm(t.handle) === h);
    if (found) { console.log(`이미 있음: ${found.handle} (${found["상태"]})`); break; }
    list.push({ handle: h, "닉네임": nick, "분야": field, "유형": kind, "출처": source, "보낸날": "", "상태": "후보", "메모": memo });
    save(list);
    console.log(`추가: ${h}`);
    break;
  }
  case "mark": {
    const [handle, status, memo] = args;
    if (!STATUSES.includes(status)) throw new Error(`상태는 ${STATUSES.join("|")} 중 하나`);
    const t = list.find((x) => norm(x.handle) === norm(handle || ""));
    if (!t) throw new Error(`목록에 없다: ${handle} — 먼저 add`);
    t["상태"] = status;
    if (status === "보냄" && !t["보낸날"]) t["보낸날"] = today();
    if (memo) t["메모"] = t["메모"] ? `${t["메모"]} / ${memo}` : memo;
    save(list);
    console.log(`${t.handle}: ${status}`);
    break;
  }
  case "has": {
    const t = list.find((x) => norm(x.handle) === norm(args[0] || ""));
    if (!t) process.exit(1);
    console.log(t["상태"]);
    break;
  }
  default:
    console.log("usage: outreach.mjs slots|stats|next [n]|add|mark|has  (파일 맨 위 주석 참고)");
}
