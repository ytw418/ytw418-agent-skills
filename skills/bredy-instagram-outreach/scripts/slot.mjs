#!/usr/bin/env node
// 인스타 영업 한 슬롯을 명령 하나로 돌린다(2026-10-21). 에이전트가 손으로 하던 정해진 단계를 묶었다.
//   남은 자리·오늘 누계 → 새 메시지 발송(앞 묶음 → 몇 분 뒤 1명 다시 열어 확인 → 나머지 묶음) → 후보 수·보충 필요 여부 → 안 읽은 답장 목록 → 로그 기록
// 에이전트는 이 JSON 의 unread(답장)를 templates.md 표에 맞춰 답하거나 '사람에게 넘길 것'에 적고, 보고만 한다.
//
//   node slot.mjs [--n 10] [--probe-after 9] [--refill-below 60] [--dry] [--wait 570] [--new] [--status]
//   환경: IG_ACCOUNT(기본 bredy_breeder) · OUTREACH_DAILY_LIMIT(하루 한도, 기본 outreach.mjs 의 30) · IG_FIELD · IG_TEMPLATE · IG_TEMPLATE2 — ig.mjs send 에 그대로 넘어간다.
//
// 오래 걸린다(묶음당 45초 간격 → 27명이면 25분 안팎). 그래서 스스로 떨어져 나가는 작업 프로세스(--worker)를 띄우고, 이 명령은 최대 --wait 초(기본 570)까지만 기다린다.
//   끝났으면 결과 JSON 을 내고 끝(종료 코드 0 정상 / 2 사람이 해야 함 / 3 안전 규칙으로 발송 중단 / 1 오류).
//   아직 도는 중이면 {"status":"running"} 을 내고 종료 코드 10 — 같은 명령을 다시 실행하면 새로 시작하지 않고 이어서 기다린다.
//   (Bash 를 백그라운드로 돌리고 '알림을 기다리겠다'고 답하면 일정 세션이 거기서 끝난다 — 10-20·10-21 로봇천국 일정이 그렇게 끝났다. 포그라운드로 이 명령을 반복 호출한다.)
// --dry: 후보 1명의 입력 확인까지만(전송 안 함) + 안 읽은 목록은 열지 않고 줄만(--peek). 로그도 안 남긴다.
// 상태·진행 로그: <OUTREACH_DIR>/slot-state/<계정>.json · .log

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.OUTREACH_DIR || path.join(os.homedir(), "Documents", "bredy-outreach");
const IG = process.env.SLOT_IG || path.join(HERE, "ig.mjs");        // SLOT_IG·SLOT_OUT·SLOT_RETRY_SEC 는 시험용 대체(가짜 ig.mjs 로 흐름 검사)
const OUT = process.env.SLOT_OUT || path.join(HERE, "outreach.mjs");
const ACCOUNT = process.env.IG_ACCOUNT || "bredy_breeder";
const STATE_DIR = path.join(DIR, "slot-state");
const STATE = path.join(STATE_DIR, `${ACCOUNT}.json`);
const LOGF = path.join(STATE_DIR, `${ACCOUNT}.log`);

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const N = Number(opt("--n", 10));
const PROBE_AFTER = Number(opt("--probe-after", 9));
const REFILL_BELOW = Number(opt("--refill-below", 60));
const WAIT_SEC = Number(opt("--wait", 570));
const DRY = flags.has("--dry");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const kstHour = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hour12: false }).format(new Date())) % 24;
const kstDate = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
const kstHM = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return null; } };
const writeState = (patch) => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ ...(readState() || {}), ...patch }, null, 2));
};
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// ───────────── 클라이언트: 작업 프로세스를 띄우거나 이어서 기다린다 ─────────────
async function client() {
  let st = readState();
  if (st?.status === "running" && !pidAlive(st.pid)) { writeState({ status: "failed", finished: now(), result: { ok: false, stage: "worker", message: "작업 프로세스가 중간에 사라졌다(맥 재시작·강제 종료?) — 로그: " + LOGF, code: 1 } }); st = readState(); }
  if (flags.has("--status")) { console.log(JSON.stringify(st ?? { status: "none" }, null, 2)); return process.exit(0); }
  const running = st?.status === "running";
  if (running && st.dry !== DRY) { console.log(JSON.stringify({ ok: false, message: `다른 모드(${st.dry ? "dry" : "실제"})의 작업이 도는 중이다 — 끝난 뒤 다시`, status: "running" })); return process.exit(1); }
  const fresh = st && ["done", "stopped"].includes(st.status) && st.dry === DRY && Date.now() - Date.parse(st.finished) < 30 * 60e3 && !flags.has("--new");
  if (fresh) return finish(st.result);   // 같은 슬롯에서 같은 명령을 다시 불렀을 때 이미 끝난 결과를 돌려준다
  if (!running) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(LOGF, `===== ${now()} start n=${N} dry=${DRY}\n`, { flag: "a" });
    const fd = fs.openSync(LOGF, "a");
    const fwd = argv.filter((a, i) => !["--wait", "--new", "--status"].includes(a) && !(argv[i - 1] === "--wait"));
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--worker", ...fwd], { detached: true, stdio: ["ignore", fd, fd], env: process.env });
    child.unref();
    fs.writeFileSync(STATE, JSON.stringify({ status: "running", pid: child.pid, started: now(), dry: DRY, n: N, phase: "시작", account: ACCOUNT }, null, 2));
    console.error(`작업 시작(pid ${child.pid}) — 로그 ${LOGF}`);
  } else console.error(`이미 도는 작업(pid ${st.pid}, ${st.phase})에 이어서 붙는다`);
  const t0 = Date.now();
  let lastPhase = "";
  while (Date.now() - t0 < WAIT_SEC * 1000) {
    await sleep(3000);
    st = readState();
    if (st?.status && st.status !== "running") return finish(st.result);
    if (st?.status === "running" && !pidAlive(st.pid)) return finish({ ok: false, stage: "worker", message: "작업 프로세스가 중간에 사라졌다 — 로그: " + LOGF, code: 1 });
    if (st?.phase !== lastPhase) { lastPhase = st.phase; console.error(`[${Math.round((Date.now() - t0) / 1000)}s] ${st.phase}${st.sent != null ? ` (보냄 ${st.sent})` : ""}`); }
  }
  console.log(JSON.stringify({ status: "running", ok: null, phase: st?.phase, sent_so_far: st?.sent ?? 0, started: st?.started, hint: "아직 도는 중이다. 같은 명령(node slot.mjs …)을 다시 실행하면 새로 시작하지 않고 이어서 기다린다. 끝나기 전에 보고하지 않는다.", code: 10 }, null, 2));
  process.exit(10);
}

function finish(result) {
  result ??= { ok: false, code: 1, stage: "state", message: "결과가 없다 — " + STATE };
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.code ?? 0);
}

// ───────────── 작업 프로세스 ─────────────
function run(file, args, { env = {}, timeoutMs = 60e3, onLine } = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [file, ...args], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", buf = "";
    const timer = setTimeout(() => { stderr += "\n(시간 초과 — 중단)"; p.kill("SIGKILL"); }, timeoutMs);
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => {
      stderr += d;
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); fs.appendFileSync(LOGF, line + "\n"); onLine?.(line); }
    });
    p.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }); });
  });
}
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
const lastErr = (r) => (r.stderr.split("\n").filter(Boolean).pop() || "").replace(/^실패: /, "");
const needsLogin = (r) => /로그인 안 됨|login|checkpoint|challenge/.test(r.stderr);

async function worker() {
  await sleep(600); // 클라이언트가 상태 파일(pid)을 먼저 쓰게 한다
  const res = { ok: false, stage: "start", code: 1, dry: DRY, account: ACCOUNT, started: now(), message: "", needs_human: false, notes: [] };
  const sent = [], buckets = { existing: [], blocked: [], noThread: [], failed: [] };
  let loggedIn = null;
  const phase = (p, extra = {}) => { writeState({ phase: p, ...extra }); fs.appendFileSync(LOGF, `-- ${p}\n`); };
  const fail = (stage, message, code = 1, extra = {}) => Object.assign(res, { stage, message, code, ...extra });
  try {
    // 1) 남은 자리·오늘 누계
    phase("남은 자리·누계 확인");
    const slotsR = await run(OUT, ["slots"], { timeoutMs: 30e3 });
    res.slots_left = /^\d+$/.test(slotsR.stdout) ? Number(slotsR.stdout) : null; // slots 는 stdout 에 남은 자리 숫자만 낸다
    const stats0 = json((await run(OUT, ["stats"], { timeoutMs: 30e3 })).stdout);
    if (!stats0) throw new Error("outreach.mjs stats 를 못 읽었다(targets.csv?)");
    res.daily = { limit: stats0.dailyLimit, sent_before: stats0.sentToday, room: Math.max(0, stats0.dailyLimit - stats0.sentToday) };

    // 2) 새 메시지
    const h = kstHour();
    let want = DRY ? 1 : Math.min(N, res.daily.room);
    res.send = { want, skipped: null, batches: [] };
    if (h >= 21 || h < 8) res.send.skipped = "밤 9시~아침 8시엔 새 영업 메시지를 보내지 않는다(정보통신망법 50조 3항)";
    else if (want <= 0) res.send.skipped = `오늘 한도를 다 썼다(${stats0.sentToday}/${stats0.dailyLimit})`;
    let sample = null, stoppedBy = null;
    if (!res.send.skipped) {
      const batch = async (count, label) => {
        phase(`${label}: ${count}명 발송${DRY ? "(dry)" : ""}`, { sent: sent.length });
        const r = await run(IG, ["send", String(count), ...(DRY ? ["--dry"] : [])], {
          timeoutMs: 80 * 60e3,
          onLine: (l) => { const m = l.match(/^보냄 (\d+)\/(\d+): /); if (m) writeState({ sent: sent.length + Number(m[1]) }); },
        });
        const out = json(r.stdout);
        if (!out) {
          if (needsLogin(r)) { loggedIn = false; stoppedBy = "로그인"; return fail("login", "인스타 로그인이 풀렸다 — 사람이 로그인해야 한다: " + lastErr(r), 2, { needs_human: true }); }
          // 한도 소진(want=0)은 ig.mjs 가 JSON 없이 로그만 남기고 끝난다
          if (/오늘 한도를 다 썼다/.test(r.stderr)) { res.send.skipped = "오늘 한도를 다 썼다"; return null; }
          stoppedBy = "오류"; return fail("send", "발송 실패: " + lastErr(r));
        }
        loggedIn = true;
        sent.push(...out.sent);
        for (const k of Object.keys(buckets)) buckets[k].push(...(out[k] ?? []));
        if (!sample && out.sample) sample = out.sample;
        res.send.batches.push({ asked: count, sent: out.sent.length, stopped: out.stopped ?? null });
        if (out.stopped) stoppedBy = out.stopped;
        return out;
      };

      const first = want > PROBE_AFTER && !DRY ? PROBE_AFTER : want;
      const b1 = await batch(first, "앞 묶음");
      if (res.code === 2) return done();   // 로그인 필요
      if (res.stage === "send") return done();
      // 3) 1명 다시 열어 보낸 글이 남아 있는지(말풍선만 보고 ok 판단 금지 — 10-15 하루 220명 뒤 인스타가 새 대화·링크 DM 을 막았다)
      const verify = async () => {
        if (DRY || !sample) return null;
        phase(`재확인: ${sample.handle} 대화방 다시 열기`, { sent: sent.length });
        const lines = sample.text.split("\n");
        const probeLine = lines[1] ?? lines[0];
        const before = probeLine.split(/\p{Extended_Pictographic}/u)[0].trim();
        const probe = (before || probeLine.replace(/\p{Extended_Pictographic}|️/gu, "").trim()).slice(0, 10);
        for (let tryNo = 0; tryNo < 2; tryNo++) {
          const r = await run(IG, ["read", sample.handle], { timeoutMs: 5 * 60e3 });
          const o = json(r.stdout);
          const text = (o?.messages ?? []).join("\n").replace(/ /g, " ");
          if (o && text.includes(probe)) return { handle: sample.handle, ok: true, detail: "보낸 글이 남아 있다" };
          if (tryNo === 0) await sleep(Number(process.env.SLOT_RETRY_SEC ?? 60) * 1000);
          else return { handle: sample.handle, ok: false, detail: o ? "보낸 글이 대화방에 없다(막혔거나 사라짐)" : "대화방을 못 열었다: " + lastErr(r) };
        }
      };
      let rc = await verify();
      if (rc && !rc.ok) { stoppedBy = "재확인 실패"; res.send.skipped_rest = "재확인 실패 — 남은 신규 발송을 멈췄다"; }
      // 4) 나머지 묶음
      const rest = want - sent.length;
      if (!stoppedBy && b1 && want > first && rest > 0) {
        await batch(rest, "나머지 묶음");
        if (res.code === 2 || res.stage === "send") return done();
        if (!DRY) { const rc2 = await verify(); if (rc2 && (!rc || !rc2.ok)) rc = rc2; if (rc2 && !rc2.ok) stoppedBy = "재확인 실패"; }
      }
      res.recheck = rc;
      res.send = { ...res.send, sent, ...buckets, stopped: stoppedBy };
    } else res.send = { ...res.send, sent: [], stopped: null };

    // 5) 후보 수·보충 필요 여부
    phase("후보 수 확인");
    const stats1 = json((await run(OUT, ["stats"], { timeoutMs: 30e3 })).stdout) ?? stats0;
    const next = (await run(OUT, ["next", "500"], { env: { OUTREACH_DAILY_LIMIT: "100000" }, timeoutMs: 30e3 })).stdout.split("\n").filter(Boolean);
    const byField = {};
    for (const r of next) { const f = r.split("\t")[2] || "?"; byField[f] = (byField[f] || 0) + 1; }
    res.daily.sent_after = stats1.sentToday;
    res.candidates = { left: stats1.byStatus?.["후보"] ?? next.length, by_field: byField, refill_below: REFILL_BELOW };
    res.candidates.need_refill = res.candidates.left < REFILL_BELOW;

    // 6) 안 읽은 답장
    phase("안 읽은 답장 목록");
    const ib = await run(IG, ["inbox", ...(DRY ? ["--peek"] : [])], { timeoutMs: 15 * 60e3 });
    const unread = json(ib.stdout);
    if (!unread) {
      if (needsLogin(ib) || loggedIn === false) return done(fail("login", "인스타 로그인이 풀렸다 — 사람이 로그인해야 한다: " + lastErr(ib), 2, { needs_human: true }));
      res.unread_error = lastErr(ib);
      res.unread = [];
    } else {
      loggedIn = true;
      // 토큰을 아끼려고 대화마다 마지막 6개·글 하나 300자까지만 싣는다(전체는 ig.mjs read <handle>)
      res.unread = unread.map((u) => ({ ...u, messages: u.messages?.slice(-6).map((m) => (m.length > 300 ? m.slice(0, 300) + "…" : m)) }));
    }
    res.unread_count = res.unread.length;

    // 7) 결과·기록
    res.logged_in = loggedIn;
    res.code = res.send.stopped && /재확인 실패|제한 문구|줄바꿈 빠짐|연속 전송 실패|로그아웃/.test(res.send.stopped) ? 3 : 0;
    res.ok = res.code === 0;
    res.stage = "done";
    const parts = [
      `새 메시지 ${sent.length}명${res.send.skipped ? `(건너뜀: ${res.send.skipped})` : ""}${res.send.stopped ? ` · 멈춤: ${res.send.stopped}` : ""}`,
      `오늘 누계 ${res.daily.sent_after}/${res.daily.limit}`,
      res.recheck ? `재확인 ${res.recheck.handle} ${res.recheck.ok ? "OK" : "실패"}` : null,
      `안 읽은 답장 ${res.unread_count}건`,
      `후보 ${res.candidates.left}명${res.candidates.need_refill ? "(보충 필요)" : ""}`,
      res.slots_left != null ? `남은 창립 자리 ${res.slots_left}` : null,
    ].filter(Boolean);
    res.summary = parts.join(" · ");
    res.message = res.summary;
    if (!DRY) appendLog(res, sent);
    return done();
  } catch (e) {
    fail("error", String(e?.message ?? e));
    return done();
  }

  function done() {
    res.finished = now();
    res.elapsed_sec = Math.round((Date.parse(res.finished) - Date.parse(res.started)) / 1000);
    res.log_file = LOGF;
    writeState({ status: res.code === 0 ? "done" : res.code === 2 ? "needs_human" : res.code === 3 ? "stopped" : "failed", finished: res.finished, result: res, phase: "끝" });
    fs.appendFileSync(LOGF, `===== ${res.finished} end code=${res.code} ${res.message}\n`);
    process.exit(0);
  }
}

function appendLog(res, sent) {
  const f = path.join(DIR, "log", `${kstDate()}.md`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const lines = [
    `\n## ${kstHM()} 슬롯 (slot.mjs 자동 기록 · ${ACCOUNT})`,
    `- 새 메시지: ${sent.length}명${res.send.skipped ? ` — 건너뜀: ${res.send.skipped}` : ""}${res.send.stopped ? ` — 멈춤: ${res.send.stopped}` : ""} · 오늘 누계 ${res.daily.sent_after}/${res.daily.limit}`,
    res.recheck ? `- 다시 열어 확인: ${res.recheck.handle} — ${res.recheck.detail}` : null,
    `- 후보 ${res.candidates.left}명 ${JSON.stringify(res.candidates.by_field)}${res.candidates.need_refill ? ` — ${res.candidates.refill_below}명 아래라 보충 필요` : ""}`,
    `- 안 읽은 답장 ${res.unread_count}건: ${res.unread.map((u) => u.handle || u.name).join(", ") || "없음"} (처리·사람에게 넘길 것은 아래에 이어 적는다)`,
  ].filter(Boolean);
  fs.appendFileSync(f, lines.join("\n") + "\n");
}

if (flags.has("--worker")) worker().catch((e) => { try { writeState({ status: "failed", finished: now(), result: { ok: false, code: 1, stage: "worker", message: String(e?.message ?? e) } }); } catch {} process.exit(1); });
else client();
