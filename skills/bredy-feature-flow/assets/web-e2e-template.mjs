// 웹 E2E 틀(로컬 next dev 3010 + dev DB, 테스트 계정 두 개). 웹 워크트리에 .tmp-<기능>-e2e.mjs 로 복사해 채우고, 끝나면 지운다.
//   cd <breeder_web 워크트리> && node ./.tmp-<기능>-e2e.mjs
// 쓰기 요청이 dev DB 에 남는다 — 테스트 계정끼리만 쓰고, 만든 행 id 를 보고에 적는다.
import { chromium, devices } from "playwright";

const BASE = "http://localhost:3010"; // 127.0.0.1 은 Next 16 dev 가 HMR 을 막아 하이드레이션이 안 된다
const OUT = "/tmp/FEATURE-e2e"; // TODO 기능 이름
const TAG = " (" + (Date.now() % 10000) + ")"; // 이전 실행에서 보낸 같은 문구와 겹치지 않게
const results = [];
const log = (...a) => console.log("[e2e]", ...a);
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  log(ok ? "PASS" : "FAIL", name, extra);
};

async function api(path, token, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// 테스트 계정 두 개와 토큰(개발 환경 전용 API)
const accounts = (await api("/api/users/test-accounts")).body?.users ?? [];
const [A, B] = accounts;
const login = async (id) =>
  (await api("/api/users/test-accounts", null, { method: "POST", body: JSON.stringify({ userId: id }) })).body;
const tokA = await login(A.id);
const tokB = await login(B.id);
log("A", A.id, A.name, "B", B.id, B.name);

// TODO 준비 데이터(API 로 만든다, 문구에는 TAG 를 붙인다)

const browser = await chromium.launch();
async function contextFor(tok, dark = false) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], colorScheme: dark ? "dark" : "light" });
  await ctx.addInitScript(
    ([a, r, dk]) => {
      localStorage.setItem("bredy:accessToken", a);
      localStorage.setItem("bredy:refreshToken", r);
      localStorage.setItem("bredy.pushPrompt.welcomeShown", "1"); // 로그인 직후 알림 권유 시트
      const st = document.createElement("style");
      st.textContent = "nextjs-portal{display:none!important}"; // Next 개발 배지
      document.addEventListener("DOMContentLoaded", () => {
        document.head.appendChild(st);
        if (dk) document.documentElement.classList.add("dark");
      });
    },
    [tok.accessToken, tok.refreshToken, dark]
  );
  return ctx;
}
const page = await (await contextFor(tokA)).newPage();
const shot = async (p, name) => {
  await p.mouse.move(195, 1).catch(() => undefined); // hover 배경 지우기
  await p.screenshot({ path: `${OUT}/${name}.png` });
};

// TODO 시나리오: goto → getByRole/getByText 로 조작 → check(...) → shot(page, "web-0N-<화면>")
// 요령:
// - 시트 행 목록: (await page.locator('[role="dialog"] button').allInnerTexts()).filter(Boolean)  (숨은 드로어의 빈 버튼 제외)
// - 숨긴(sr-only) 체크 칸은 check() 대신 라벨 글자를 click()
// - 터치 길게 누르기: el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", clientX, clientY })) → 700ms → pointerup
// - 상대 화면 확인은 tokB 로 API 를 직접 읽는다

// 다크 캡처 1장 이상
// const dpage = await (await contextFor(tokA, true)).newPage();

await browser.close();
const failed = results.filter((r) => !r.ok);
log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
