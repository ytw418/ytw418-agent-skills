#!/usr/bin/env node
/**
 * dev 서버 테스트 계정의 '내 동네' 값을 보고, 검증 중 바꾼 값을 되돌린다.
 * 테스트 계정 로그인(/api/users/test-accounts POST)으로 토큰을 받아 /api/users/me 를 부른다. 토큰은 찍지 않는다.
 *
 * 사용:
 *   node test_account_region.cjs find                 테스트 계정마다 동네·노출·regionUpdatedAt (최근 것 위)
 *   node test_account_region.cjs get <userId>
 *   node test_account_region.cjs set <userId> <시도|null> <시군구|null> [true|false]
 *       ↑ dev DB 쓰기. 내가 검증하며 바꾼 테스트 계정을 원래 값으로 되돌릴 때만 쓴다(find 로 먼저 원래 값 기록).
 * 환경: BASE=https://breeder-web-git-dev-holicreacts-projects.vercel.app (기본, 앱 dev build 가 붙는 서버)
 */
const BASE = process.env.BASE || "https://breeder-web-git-dev-holicreacts-projects.vercel.app";

async function json(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function tokenFor(userId) {
  const res = await fetch(`${BASE}/api/users/test-accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: Number(userId) }),
  });
  const data = await json(res);
  if (!data.accessToken) throw new Error(`테스트 계정 ${userId} 로그인 실패: ${res.status} ${data.error ?? ""}`);
  return data.accessToken;
}

async function profile(token) {
  const data = await json(await fetch(`${BASE}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }));
  return data.profile ?? {};
}

const line = (id, name, p) =>
  `${id}\t${name ?? p.name ?? ""}\t${p.regionSido ?? "-"} ${p.regionSigungu ?? "-"}\tvisible=${Boolean(p.regionVisible)}\t${p.regionUpdatedAt ?? "-"}`;

async function main() {
  const [cmd, id, sido, sigungu, visible] = process.argv.slice(2);
  if (cmd === "find") {
    const list = await json(await fetch(`${BASE}/api/users/test-accounts`));
    if (!list.users) throw new Error(`테스트 계정 목록 실패(BASE=${BASE})`);
    const rows = [];
    for (const u of list.users) {
      try {
        rows.push({ u, p: await profile(await tokenFor(u.id)) });
      } catch (error) {
        console.log(`${u.id}\t${u.name}\t(조회 실패: ${error.message})`);
      }
    }
    rows.sort((a, b) => String(b.p.regionUpdatedAt ?? "").localeCompare(String(a.p.regionUpdatedAt ?? "")));
    for (const { u, p } of rows) console.log(line(u.id, u.name, p));
    return;
  }
  if (cmd === "get" && id) {
    console.log(line(id, null, await profile(await tokenFor(id))));
    return;
  }
  if (cmd === "set" && id && sido && sigungu) {
    const token = await tokenFor(id);
    const clear = sido === "null" && sigungu === "null";
    const body = clear ? { regionSido: null, regionSigungu: null } : { regionSido: sido, regionSigungu: sigungu };
    if (!clear && visible) body.regionVisible = visible === "true";
    const res = await fetch(`${BASE}/api/users/me`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await json(res);
    console.log(`set ${res.status} success=${data.success} ${data.error ?? ""}`);
    console.log(line(id, null, await profile(token)));
    return;
  }
  console.log("사용: find | get <userId> | set <userId> <시도|null> <시군구|null> [true|false]");
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
