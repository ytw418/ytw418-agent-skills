#!/usr/bin/env node
/**
 * 브레디 크루(운영 계정) 활동 스크립트. `.claude/skills/crew-activity/SKILL.md` 가 쓴다.
 *
 * - 모든 동작은 공개 API 로만 한다. DB 에 직접 붙지 않는다.
 * - 계정은 기존 테스트 계정 API(`/api/users/test-accounts`, role=FAKE_USER)로 만들고 토큰을 받는다.
 * - 크루는 이름 뒤 '·크루', 소개 앞 '브레디 크루 🐾' 로 운영 계정임을 밝힌다(바꾸지 않는다).
 * - 상태·기록은 `.crew/`(gitignore)에 둔다. 토큰은 파일에 남기지 않는다.
 *
 * 환경 변수
 *   CREW_BASE_URL            대상 서버(예: https://bredy.app). 필수.
 *   CREW_ADMIN_TOKEN         관리자 access 토큰. 또는
 *   CREW_ADMIN_REFRESH_TOKEN 관리자 refresh 토큰(access 토큰을 여기서 받는다).
 *
 * 명령
 *   setup   [--count 50] [--dry-run]           크루 계정 생성 + 이름·소개·동네 설정
 *   list                                       크루 목록
 *   snapshot [--pages 5]                       최근 게시글·댓글을 .crew/snapshot.json 으로
 *   apply   <plan.json> [--dry-run] [--min-delay 4] [--max-delay 12]
 *   cleanup <log.jsonl> [--dry-run]            그 실행에서 만든 글·댓글만 지운다
 *   profile <profile.json> [--dry-run]         크루 닉네임·프로필 사진·동네 노출을 바꾼다
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(ROOT, ".crew");
const LOG_DIR = path.join(STATE_DIR, "log");
const ROSTER_FILE = path.join(STATE_DIR, "roster.json");
const HISTORY_FILE = path.join(STATE_DIR, "history.jsonl");
const SNAPSHOT_FILE = path.join(STATE_DIR, "snapshot.json");
/**
 * 페르소나 파일: CREW_PERSONAS → 스킬 저장소 배치(skills/<스킬>/scripts/crew.mjs 옆 ../personas.json)
 * → breeder_web 배치(.claude/skills/crew-activity/personas.json) 순서로 찾는다.
 */
const PERSONAS_FILE =
  [
    process.env.CREW_PERSONAS && path.resolve(ROOT, process.env.CREW_PERSONAS),
    path.join(SCRIPT_DIR, "..", "personas.json"),
    path.join(ROOT, ".claude/skills/crew-activity/personas.json"),
  ].find((file) => file && fs.existsSync(file)) ??
  path.join(ROOT, ".claude/skills/crew-activity/personas.json");

/** 서버 규칙과 같은 값(libs/shared/nickname.ts, post-body.ts, comment.ts, profile.ts, bloodline-names.ts). */
const NICKNAME_MAX = 10;
const POST_BODY_MIN = 10;
const POST_BODY_MAX = 2000;
const COMMENT_MAX = 1000;
const BIO_MAX = 300;
const BLOODLINE_NAME_PATTERN = /^[A-Za-z0-9가-힣 ]{2,40}$/;
/** 공지는 운영 공지 전용, 후기는 거래 후기로 읽히므로 크루가 쓰지 않는다. */
const CREW_POST_CATEGORIES = ["동네", "자유", "질문", "정보", "자랑", "사진", "변이"];
/** 한 번 실행에 너무 많이 쏟아지지 않게 막는 상한. */
const RUN_LIMITS = { post: 15, comment: 60, like: 120, follow: 60, bloodline: 5 };
const CREATE_BATCH_MAX = 20;
/** 크루는 거래하지 않으므로 가게·판매자처럼 보이는 닉네임을 쓰지 않는다. */
const SELLER_LIKE_NICK = /샵|shop|스토어|store|분양|판매|매장|마켓/i;

/* ------------------------------------------------------------------ */
/* 공통                                                               */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i += 1;
      }
    } else positional.push(arg);
  }
  return { positional, flags };
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function appendJsonl(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`);
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clip = (text, max) => {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
};
/** 중복 판단용: 공백·기호를 지운 소문자. */
const titleKey = (title) => String(title ?? "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");

function baseUrl() {
  const url = process.env.CREW_BASE_URL;
  if (!url) fail("CREW_BASE_URL 이 필요합니다(예: https://bredy.app).");
  return url.replace(/\/+$/, "");
}

async function api(method, pathname, { token, body } = {}) {
  const res = await fetch(`${baseUrl()}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.success === false) {
    const message = data?.error || data?.message || `HTTP ${res.status}`;
    const error = new Error(`${method} ${pathname} → ${message}`);
    error.status = res.status;
    error.code = data?.errorCode;
    throw error;
  }
  return data;
}

let adminTokenCache = null;
async function adminToken() {
  if (adminTokenCache) return adminTokenCache;
  if (process.env.CREW_ADMIN_TOKEN) {
    adminTokenCache = process.env.CREW_ADMIN_TOKEN;
  } else if (process.env.CREW_ADMIN_REFRESH_TOKEN) {
    const data = await api("POST", "/api/auth/refresh", {
      body: { refreshToken: process.env.CREW_ADMIN_REFRESH_TOKEN },
    });
    adminTokenCache = data.accessToken;
  } else {
    fail("CREW_ADMIN_TOKEN 또는 CREW_ADMIN_REFRESH_TOKEN 이 필요합니다(관리자 계정).");
  }
  return adminTokenCache;
}

const crewTokens = new Map();
async function crewToken(member) {
  if (crewTokens.has(member.userId)) return crewTokens.get(member.userId);
  const data = await api("POST", "/api/users/test-accounts", {
    token: await adminToken(),
    body: { action: "switch", userId: member.userId },
  });
  crewTokens.set(member.userId, data.accessToken);
  return data.accessToken;
}

function loadPersonas() {
  const file = readJson(PERSONAS_FILE, null);
  if (!file) fail(`페르소나 파일이 없습니다: ${PERSONAS_FILE}`);
  return file;
}

function loadRoster() {
  return readJson(ROSTER_FILE, { members: [] });
}

/** 크루 이름: 닉네임 + '·크루'. 10자를 넘으면 닉네임을 줄인다. 겹치면 숫자를 붙인다. */
function crewName(nick, suffix, attempt) {
  const tail = attempt > 0 ? String(attempt + 1) : "";
  const room = NICKNAME_MAX - suffix.length - tail.length;
  return `${nick.slice(0, room)}${tail}${suffix}`;
}

/* ------------------------------------------------------------------ */
/* setup                                                              */
/* ------------------------------------------------------------------ */

async function setup(flags) {
  const { personas, nameSuffix, bioPrefix } = loadPersonas();
  const roster = loadRoster();
  const done = new Set(roster.members.map((m) => m.key));
  const count = Number(flags.count ?? personas.length);
  const todo = personas.filter((p) => !done.has(p.key)).slice(0, Math.max(0, count - done.size));
  const dryRun = Boolean(flags["dry-run"]);

  console.log(`크루 ${roster.members.length}명 있음 → 새로 ${todo.length}명 만든다${dryRun ? " (dry-run)" : ""}`);
  if (!todo.length) return;
  if (dryRun) {
    for (const p of todo) {
      console.log(`  ${p.key} ${crewName(p.nick, nameSuffix, 0)} · ${p.region.join(" ")} · ${p.species.join(", ")}`);
    }
    return;
  }

  const token = await adminToken();
  const before = await api("GET", "/api/users/test-accounts", { token });
  const knownIds = new Set(before.users.map((u) => u.id));

  for (let left = todo.length; left > 0; left -= CREATE_BATCH_MAX) {
    await api("POST", "/api/users/test-accounts", {
      token,
      body: { action: "create", count: Math.min(left, CREATE_BATCH_MAX), namePrefix: "crew" },
    });
  }

  const after = await api("GET", "/api/users/test-accounts", { token });
  const fresh = after.users
    .filter((u) => !knownIds.has(u.id) && u.name.startsWith("crew"))
    .sort((a, b) => a.id - b.id);
  if (fresh.length < todo.length) {
    fail(`새 계정이 ${fresh.length}개만 보입니다(기대 ${todo.length}). roster 는 바꾸지 않았습니다.`);
  }

  for (let i = 0; i < todo.length; i += 1) {
    const persona = todo[i];
    const member = { key: persona.key, userId: fresh[i].id, name: fresh[i].name };
    const bio = `${bioPrefix} ${persona.bio}`.slice(0, BIO_MAX);
    const [regionSido, regionSigungu] = persona.region;
    const userToken = await crewToken(member);

    let saved = null;
    for (let attempt = 0; attempt < 5 && !saved; attempt += 1) {
      const name = crewName(persona.nick, nameSuffix, attempt);
      try {
        // regionVisible=true: 동네 브리더 목록·홈 동네 섹션에 크루도 보인다(2026-10-10 사용자 결정).
        await api("POST", "/api/users/me", {
          token: userToken,
          body: { name, bio, regionSido, regionSigungu, regionVisible: true, categoryOnboarded: true },
        });
        saved = name;
      } catch (error) {
        if (!/닉네임/.test(error.message)) throw error;
      }
    }
    if (!saved) fail(`${persona.key} 이름을 정하지 못했습니다.`);
    member.name = saved;
    roster.members.push(member);
    writeJson(ROSTER_FILE, roster);
    console.log(`  ✔ ${persona.key} #${member.userId} ${saved} · ${regionSido} ${regionSigungu}`);
  }
}

function list() {
  const { personas } = loadPersonas();
  const byKey = new Map(personas.map((p) => [p.key, p]));
  const roster = loadRoster();
  if (!roster.members.length) return console.log("크루가 없습니다. setup 을 먼저 실행하세요.");
  for (const m of roster.members) {
    const p = byKey.get(m.key);
    console.log(`${m.key}\t#${m.userId}\t${m.name}\t${p?.species.join(", ") ?? ""}\t${p?.tone ?? ""}`);
  }
}

/* ------------------------------------------------------------------ */
/* snapshot                                                           */
/* ------------------------------------------------------------------ */

async function snapshot(flags) {
  const pages = Number(flags.pages ?? 5);
  const roster = loadRoster();
  const crewIds = new Set(roster.members.map((m) => m.userId));
  const posts = [];

  for (let page = 1; page <= pages; page += 1) {
    const data = await api("GET", `/api/posts?page=${page}&sort=latest`);
    for (const post of data.posts) {
      const detail = await api("GET", `/api/posts/${post.id}`);
      const d = detail.post;
      posts.push({
        id: d.id,
        createdAt: d.createdAt,
        category: d.category,
        species: d.type,
        title: d.title,
        description: clip(d.description, 600),
        imageCount: (d.images ?? []).length,
        likes: d._count?.Likes ?? 0,
        author: { id: d.user.id, name: d.user.name, isCrew: crewIds.has(d.user.id) },
        comments: d.comments
          .filter((c) => !c.deletedAt)
          .map((c) => ({
            id: c.id,
            parentId: c.parentId,
            author: { id: c.user.id, name: c.user.name, isCrew: crewIds.has(c.user.id) },
            comment: clip(c.comment, 200),
          })),
      });
    }
    if (page >= data.pages) break;
  }

  const recentCrewTitles = readJsonl(HISTORY_FILE)
    .filter((h) => h.type === "post")
    .slice(-200)
    .map((h) => ({ crew: h.crew, title: h.title, at: h.at }));

  writeJson(SNAPSHOT_FILE, { takenAt: new Date().toISOString(), posts, recentCrewTitles });
  const real = posts.filter((p) => !p.author.isCrew).length;
  console.log(`게시글 ${posts.length}개(크루 아닌 글 ${real}개) → ${path.relative(ROOT, SNAPSHOT_FILE)}`);
}

/* ------------------------------------------------------------------ */
/* apply                                                              */
/* ------------------------------------------------------------------ */

function validatePlan(plan, roster) {
  const members = new Map(roster.members.map((m) => [m.key, m]));
  const crewIds = new Set(roster.members.map((m) => m.userId));
  const knownTitles = new Set(readJsonl(HISTORY_FILE).filter((h) => h.type === "post").map((h) => titleKey(h.title)));
  const snapshotTitles = new Set((readJson(SNAPSHOT_FILE, { posts: [] }).posts ?? []).map((p) => titleKey(p.title)));
  const counts = {};
  const errors = [];

  (plan.actions ?? []).forEach((action, index) => {
    const at = `#${index} ${action.type}`;
    counts[action.type] = (counts[action.type] ?? 0) + 1;
    if (!members.has(action.crew)) errors.push(`${at}: 모르는 크루 ${action.crew}`);

    switch (action.type) {
      case "post": {
        const len = String(action.description ?? "").trim().length;
        if (!String(action.title ?? "").trim()) errors.push(`${at}: 제목이 없습니다`);
        if (len < POST_BODY_MIN || len > POST_BODY_MAX) errors.push(`${at}: 본문 ${len}자(${POST_BODY_MIN}~${POST_BODY_MAX})`);
        if (!CREW_POST_CATEGORIES.includes(action.category)) errors.push(`${at}: 카테고리 ${action.category} 불가`);
        const key = titleKey(action.title);
        if (knownTitles.has(key) || snapshotTitles.has(key)) errors.push(`${at}: 이미 있는 제목 "${action.title}"`);
        knownTitles.add(key);
        break;
      }
      case "comment": {
        const len = String(action.comment ?? "").trim().length;
        if (!Number.isInteger(action.postId)) errors.push(`${at}: postId 가 없습니다`);
        if (!len || len > COMMENT_MAX) errors.push(`${at}: 댓글 ${len}자(1~${COMMENT_MAX})`);
        break;
      }
      case "like":
        if (!Number.isInteger(action.postId)) errors.push(`${at}: postId 가 없습니다`);
        break;
      case "follow":
        if (!Number.isInteger(action.userId)) errors.push(`${at}: userId 가 없습니다`);
        if (members.get(action.crew)?.userId === action.userId) errors.push(`${at}: 자기 자신`);
        break;
      case "bloodline":
        if (!BLOODLINE_NAME_PATTERN.test(String(action.name ?? "").trim())) errors.push(`${at}: 혈통 이름 규칙(한글·영문·숫자·띄어쓰기 2~40자)`);
        if (!action.speciesType) errors.push(`${at}: speciesType 이 없습니다`);
        if (!action.imagePath || !fs.existsSync(path.resolve(ROOT, action.imagePath))) errors.push(`${at}: 사진 파일이 없습니다 ${action.imagePath}`);
        break;
      default:
        errors.push(`${at}: 모르는 동작`);
    }
  });

  for (const [type, limit] of Object.entries(RUN_LIMITS)) {
    if ((counts[type] ?? 0) > limit) errors.push(`${type} ${counts[type]}개 — 한 번에 ${limit}개까지`);
  }
  return { errors, counts, members, crewIds };
}

async function uploadImage(token, file) {
  const { uploadURL, id } = await api("GET", "/api/files", { token });
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(file)]), path.basename(file));
  const res = await fetch(uploadURL, { method: "POST", body: form });
  if (!res.ok) throw new Error(`사진 업로드 실패 HTTP ${res.status}`);
  return id;
}

async function runAction(action, member) {
  const token = await crewToken(member);
  switch (action.type) {
    case "post": {
      const { post } = await api("POST", "/api/posts", {
        token,
        body: {
          title: action.title.trim(),
          description: action.description.trim(),
          category: action.category,
          species: action.species ?? null,
          images: [],
        },
      });
      appendJsonl(HISTORY_FILE, { type: "post", crew: member.key, id: post.id, title: post.title, at: new Date().toISOString() });
      return { id: post.id };
    }
    case "comment": {
      const { post } = await api("GET", `/api/posts/${action.postId}`, { token });
      if (post.comments.some((c) => c.user.id === member.userId && !c.deletedAt && c.parentId === (action.parentId ?? null))) {
        return { skipped: "이 크루가 이미 같은 자리에 댓글을 달았습니다" };
      }
      const { answer } = await api("POST", `/api/posts/${action.postId}/answers`, {
        token,
        body: { comment: action.comment.trim(), ...(action.parentId ? { parentId: action.parentId } : {}) },
      });
      return { id: answer.id, postId: action.postId };
    }
    case "like": {
      // 좋아요 API 는 누를 때마다 켜고 끈다. 이미 눌렀으면 건너뛴다.
      const { isLiked } = await api("GET", `/api/posts/${action.postId}`, { token });
      if (isLiked) return { skipped: "이미 좋아요" };
      await api("POST", `/api/posts/${action.postId}/wonder`, { token });
      return { postId: action.postId };
    }
    case "follow": {
      // 팔로우 API 도 토글이다. 이미 팔로우 중이면 건너뛴다.
      const { isFollowing } = await api("GET", `/api/users/${action.userId}`, { token });
      if (isFollowing) return { skipped: "이미 팔로우" };
      await api("POST", `/api/users/${action.userId}/follow`, { token });
      return { userId: action.userId };
    }
    case "bloodline": {
      const image = await uploadImage(token, path.resolve(ROOT, action.imagePath));
      const data = await api("POST", "/api/bloodline-cards", {
        token,
        body: {
          name: action.name.trim(),
          speciesType: action.speciesType,
          image,
          description: action.description ?? null,
          originSido: action.originSido ?? null,
          originSigungu: action.originSigungu ?? null,
        },
      });
      return { id: data.myBloodlines?.[0]?.id };
    }
    default:
      throw new Error("모르는 동작");
  }
}

async function apply(positional, flags) {
  const planFile = positional[0];
  if (!planFile) fail("계획 파일이 필요합니다: apply <plan.json>");
  const plan = readJson(path.resolve(ROOT, planFile), null);
  if (!plan) fail(`계획 파일을 읽지 못했습니다: ${planFile}`);
  const roster = loadRoster();
  const { errors, counts, members } = validatePlan(plan, roster);
  const dryRun = Boolean(flags["dry-run"]);

  console.log(`계획: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · ") || "비어 있음"}`);
  if (errors.length) {
    errors.forEach((e) => console.error(`  ✖ ${e}`));
    fail(`계획에 문제가 ${errors.length}개 있습니다. 아무것도 실행하지 않았습니다.`);
  }
  if (dryRun) return console.log("검사 통과 (dry-run — 실행하지 않음)");

  const minDelay = Number(flags["min-delay"] ?? 4) * 1000;
  const maxDelay = Number(flags["max-delay"] ?? 12) * 1000;
  const logFile = path.join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, action] of plan.actions.entries()) {
    const member = members.get(action.crew);
    try {
      const result = await runAction(action, member);
      appendJsonl(logFile, { index, type: action.type, crew: action.crew, ok: true, ...result });
      if (result.skipped) {
        skipped += 1;
        console.log(`  – #${index} ${action.type} ${member.name}: ${result.skipped}`);
      } else {
        ok += 1;
        console.log(`  ✔ #${index} ${action.type} ${member.name}${result.id ? ` → ${result.id}` : ""}`);
      }
    } catch (error) {
      failed += 1;
      appendJsonl(logFile, { index, type: action.type, crew: action.crew, ok: false, error: error.message });
      console.error(`  ✖ #${index} ${action.type} ${member.name}: ${error.message}`);
      // 권한·토큰 문제는 이어 가도 같은 결과라 멈춘다.
      if (error.status === 401 || error.status === 403) break;
    }
    if (index < plan.actions.length - 1) {
      await sleep(minDelay + Math.random() * Math.max(0, maxDelay - minDelay));
    }
  }

  console.log(`완료: 성공 ${ok} · 건너뜀 ${skipped} · 실패 ${failed}`);
  console.log(`기록: ${path.relative(ROOT, logFile)} (cleanup 에 쓴다)`);
}

/* ------------------------------------------------------------------ */
/* cleanup                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* profile                                                            */
/* ------------------------------------------------------------------ */

/**
 * 프로필 파일 형식: { "members": [{ "crew": "c01", "nick": "크레곤듀", "avatarPath": ".crew/avatars/c01.jpg", "regionVisible": true }] }
 * 세 값 모두 넣은 것만 바꾼다. nick 에는 '·크루' 를 빼고 쓴다(스크립트가 붙인다).
 */
function validateProfiles(plan, roster, nameSuffix) {
  const members = new Map(roster.members.map((m) => [m.key, m]));
  const room = NICKNAME_MAX - nameSuffix.length;
  const seen = new Set();
  const nicks = new Set();
  const errors = [];

  (plan.members ?? []).forEach((entry, index) => {
    const at = `#${index} ${entry.crew}`;
    if (!members.has(entry.crew)) errors.push(`${at}: 모르는 크루`);
    if (seen.has(entry.crew)) errors.push(`${at}: 같은 크루가 두 번 있습니다`);
    seen.add(entry.crew);
    if (entry.nick !== undefined) {
      const nick = String(entry.nick).trim();
      if (!nick || nick.length > room) errors.push(`${at}: 닉네임 ${nick.length}자(1~${room}자, 뒤에 '${nameSuffix}' 가 붙는다)`);
      if (nick.includes(nameSuffix.replace(/^·/, ""))) errors.push(`${at}: 닉네임에 '${nameSuffix}' 를 넣지 마세요(스크립트가 붙인다)`);
      if (SELLER_LIKE_NICK.test(nick)) errors.push(`${at}: 판매자처럼 보이는 닉네임 "${nick}"`);
      if (nicks.has(nick)) errors.push(`${at}: 닉네임 "${nick}" 이 겹칩니다`);
      nicks.add(nick);
    }
    if (entry.avatarPath !== undefined && !fs.existsSync(path.resolve(ROOT, String(entry.avatarPath)))) {
      errors.push(`${at}: 사진 파일이 없습니다 ${entry.avatarPath}`);
    }
    if (entry.regionVisible !== undefined && typeof entry.regionVisible !== "boolean") {
      errors.push(`${at}: regionVisible 은 true/false 입니다`);
    }
  });
  return { errors, members };
}

async function profile(positional, flags) {
  const file = positional[0];
  if (!file) fail("프로필 파일이 필요합니다: profile <profile.json>");
  const plan = readJson(path.resolve(ROOT, file), null);
  if (!plan) fail(`프로필 파일을 읽지 못했습니다: ${file}`);
  const { nameSuffix } = loadPersonas();
  const roster = loadRoster();
  const { errors, members } = validateProfiles(plan, roster, nameSuffix);
  const dryRun = Boolean(flags["dry-run"]);

  console.log(`프로필 ${plan.members?.length ?? 0}명${dryRun ? " (dry-run)" : ""}`);
  if (errors.length) {
    errors.forEach((e) => console.error(`  ✖ ${e}`));
    fail(`프로필 파일에 문제가 ${errors.length}개 있습니다. 아무것도 바꾸지 않았습니다.`);
  }
  const describe = (entry) =>
    [
      entry.nick ? crewName(String(entry.nick).trim(), nameSuffix, 0) : null,
      entry.avatarPath ? "사진" : null,
      typeof entry.regionVisible === "boolean" ? `동네 노출 ${entry.regionVisible ? "켬" : "끔"}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  if (dryRun) {
    for (const entry of plan.members) console.log(`  ${entry.crew} ${members.get(entry.crew).name} → ${describe(entry)}`);
    return console.log("검사 통과 (dry-run — 바꾸지 않음)");
  }

  let ok = 0;
  let failed = 0;
  for (const entry of plan.members) {
    const member = members.get(entry.crew);
    try {
      const token = await crewToken(member);
      const body = {};
      if (entry.avatarPath) body.avatarId = await uploadImage(token, path.resolve(ROOT, entry.avatarPath));
      if (typeof entry.regionVisible === "boolean") body.regionVisible = entry.regionVisible;
      let saved = member.name;
      if (entry.nick) {
        saved = null;
        for (let attempt = 0; attempt < 5 && !saved; attempt += 1) {
          const name = crewName(String(entry.nick).trim(), nameSuffix, attempt);
          try {
            await api("POST", "/api/users/me", { token, body: { ...body, name } });
            saved = name;
          } catch (error) {
            if (!/닉네임/.test(error.message)) throw error;
          }
        }
        if (!saved) throw new Error("닉네임을 정하지 못했습니다(겹침)");
      } else {
        await api("POST", "/api/users/me", { token, body });
      }
      member.name = saved;
      writeJson(ROSTER_FILE, roster);
      ok += 1;
      console.log(`  ✔ ${entry.crew} #${member.userId} ${saved} · ${describe({ ...entry, nick: undefined }) || "이름만"}`);
    } catch (error) {
      failed += 1;
      console.error(`  ✖ ${entry.crew} ${member.name}: ${error.message}`);
      if (error.status === 401 || error.status === 403) break;
    }
  }
  console.log(`완료: 성공 ${ok} · 실패 ${failed}`);
}

async function cleanup(positional, flags) {
  const logFile = positional[0];
  if (!logFile) fail("기록 파일이 필요합니다: cleanup <log.jsonl>");
  const entries = readJsonl(path.resolve(ROOT, logFile)).filter((e) => e.ok && !e.skipped && e.id);
  const members = new Map(loadRoster().members.map((m) => [m.key, m]));
  const dryRun = Boolean(flags["dry-run"]);

  for (const entry of entries) {
    const member = members.get(entry.crew);
    if (!member) continue;
    const label = `${entry.type} ${entry.id} (${member.name})`;
    if (entry.type === "bloodline") {
      console.log(`  – ${label}: 혈통은 관리자 화면에서 회수하세요`);
      continue;
    }
    if (dryRun) {
      console.log(`  · ${label} 지울 예정`);
      continue;
    }
    try {
      const token = await crewToken(member);
      if (entry.type === "post") {
        await api("POST", `/api/posts/${entry.id}`, { token, body: { action: "delete" } });
      } else if (entry.type === "comment") {
        await api("DELETE", `/api/posts/${entry.postId}/comments/${entry.id}`, { token });
      } else continue;
      console.log(`  ✔ ${label} 지움`);
    } catch (error) {
      console.error(`  ✖ ${label}: ${error.message}`);
    }
  }
}

/* ------------------------------------------------------------------ */

const [command, ...rest] = process.argv.slice(2);
const { positional, flags } = parseArgs(rest);
const commands = {
  setup: () => setup(flags),
  list: () => list(),
  snapshot: () => snapshot(flags),
  apply: () => apply(positional, flags),
  cleanup: () => cleanup(positional, flags),
  profile: () => profile(positional, flags),
};

if (!commands[command]) {
  console.log("사용법: node scripts/crew/crew.mjs <setup|list|snapshot|apply|cleanup|profile> …");
  process.exit(command ? 1 : 0);
}
Promise.resolve()
  .then(commands[command])
  .catch((error) => fail(error.message));
