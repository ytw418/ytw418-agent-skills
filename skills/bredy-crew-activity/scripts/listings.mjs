// 크루 계정으로 분양글·경매글 등록 (2026-10-12 사용자 예외 결정). 사용: node .crew/listings.mjs <plan.json> [--dry-run]
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.CREW_BASE_URL || "").replace(/\/+$/, "");
const REFRESH = process.env.CREW_ADMIN_REFRESH_TOKEN;
if (!BASE || !REFRESH) throw new Error("CREW_BASE_URL / CREW_ADMIN_REFRESH_TOKEN 필요");
const [planFile, ...flags] = process.argv.slice(2);
const dry = flags.includes("--dry-run");
const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
const roster = JSON.parse(fs.readFileSync(".crew/roster.json", "utf8")).members;
const byKey = Object.fromEntries(roster.map((m) => [m.key, m]));
const logFile = `.crew/log/listings-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, p, { token, body, form } = {}) {
  const res = await fetch(p.startsWith("http") ? p : BASE + p, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form ? form : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.success === false) throw new Error(`${method} ${p} → ${res.status} ${data?.error || data?.message || ""}`);
  return data;
}

let admin;
const crewTok = {};
async function tokenFor(key) {
  const m = byKey[key];
  if (!m) throw new Error(`크루 없음: ${key}`);
  if (crewTok[key]) return crewTok[key];
  admin ||= (await api("POST", "/api/auth/refresh", { body: { refreshToken: REFRESH } })).accessToken;
  const d = await api("POST", "/api/users/test-accounts", { token: admin, body: { action: "switch", userId: m.userId } });
  return (crewTok[key] = d.accessToken);
}

async function upload(token, file) {
  const { id, uploadURL } = await api("GET", "/api/files", { token });
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(file)], { type: "image/jpeg" }), path.basename(file));
  const r = await api("POST", uploadURL, { form });
  return r.result?.id || id;
}

// 검사
const errors = [];
for (const p of plan.products || []) {
  if (!byKey[p.crew]) errors.push(`product ${p.name}: 크루 ${p.crew} 없음`);
  if (!fs.existsSync(p.photo)) errors.push(`product ${p.name}: 사진 없음 ${p.photo}`);
  if (p.name.trim().length < 2 || p.name.trim().length > 60) errors.push(`product ${p.name}: 이름 길이`);
  if (p.description.trim().length < 10) errors.push(`product ${p.name}: 설명 짧음`);
  if (!/\(iNaturalist, CC BY\)|CC0|no rights/.test(p.description) && !p.cc0) errors.push(`product ${p.name}: 출처 줄 없음(CC0 면 "cc0": true)`);
}
for (const a of plan.auctions || []) {
  if (!byKey[a.crew]) errors.push(`auction ${a.title}: 크루 ${a.crew} 없음`);
  if (!fs.existsSync(a.photo)) errors.push(`auction ${a.title}: 사진 없음`);
  if (a.startPrice < 1000) errors.push(`auction ${a.title}: 시작가`);
  if (a.hours < 1 || a.hours > 72) errors.push(`auction ${a.title}: 기간 1~72h`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`계획: 분양글 ${plan.products?.length ?? 0} · 경매 ${plan.auctions?.length ?? 0}`);
if (dry) { console.log("검사 통과 (dry-run)"); process.exit(0); }

fs.mkdirSync(".crew/log", { recursive: true });
let ok = 0, fail = 0;
for (const p of plan.products || []) {
  try {
    const t = await tokenFor(p.crew);
    const photo = await upload(t, p.photo);
    const body = { name: p.name, price: p.price, description: p.description, photos: [photo], category: p.category, productType: p.productType, dealType: p.dealType };
    const r = await api("POST", "/api/products", { token: t, body });
    const id = r.product?.id;
    fs.appendFileSync(logFile, JSON.stringify({ type: "product", crew: p.crew, id, photo, name: p.name }) + "\n");
    console.log(`✔ product ${byKey[p.crew].name} → #${id} ${p.name}`); ok++;
  } catch (e) { console.log(`✖ product ${p.name}: ${e.message}`); fail++; }
  await sleep(4000 + Math.random() * 6000);
}
for (const a of plan.auctions || []) {
  try {
    const t = await tokenFor(a.crew);
    const photo = await upload(t, a.photo);
    const endAt = new Date(Date.now() + a.hours * 3600 * 1000).toISOString();
    const body = { title: a.title, description: a.description, photos: [photo], category: a.category, startPrice: a.startPrice, minBidIncrement: a.minBidIncrement, endAt };
    const r = await api("POST", "/api/auctions", { token: t, body });
    const id = r.auction?.id;
    fs.appendFileSync(logFile, JSON.stringify({ type: "auction", crew: a.crew, id, photo, title: a.title }) + "\n");
    console.log(`✔ auction ${byKey[a.crew].name} → #${id} ${a.title}`); ok++;
  } catch (e) { console.log(`✖ auction ${a.title}: ${e.message}`); fail++; }
  await sleep(4000 + Math.random() * 6000);
}
console.log(`끝: 성공 ${ok} · 실패 ${fail} · 기록 ${logFile}`);
