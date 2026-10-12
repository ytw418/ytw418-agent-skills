---
name: bredy-posthog-event
description: 브리디 앱(bredy_app)·웹(breeder_web)에 PostHog 이벤트를 추가·수정한다. 서버 이벤트(captureServerEvent + platform), 웹 클라이언트 이벤트(trackEvent·ANALYTICS_EVENTS), 앱 이벤트(captureAppEvent)를 고르고, 이벤트 이름 등록 → 호출 → jest 목 정리 → 기준표 docs/current/posthog-events.md 갱신 → 웹 PR·앱 master 커밋(Parity 트레일러) → 배포 뒤 PostHog MCP 로 수신 확인·인사이트까지 한다. 사용자가 '포스트호그 이벤트 추가', '이벤트 심어줘', 'PostHog 트래킹', '사용률 보게 해줘', '가입률·전환율·이탈률 측정', '이 기능 몇 명 쓰는지 보고 싶어', '분석 이벤트 넣어줘' 등을 요청하거나 새 기능에 계측을 붙일 때 사용한다. 이미 쌓인 데이터를 분석만 할 때는 PostHog MCP 를 바로 쓰고 이 스킬은 쓰지 않는다.
---

# 브리디 PostHog 이벤트 추가

한 PostHog 프로젝트(311757, us.posthog.com, UTC)에 서버·웹·앱이 보낸다. 사람은 DB 사용자 id(`distinct_id`)로 묶인다. 기준표는 breeder_web `docs/current/posthog-events.md` — 작업 전에 읽고 끝나면 고친다.

## 1. 어디서 찍을지 고른다

| 무엇 | 어디서 | 이유 |
|---|---|---|
| 저장이 일어나는 행동(가입·작성·입찰·채팅·팔로우·탈퇴 등) | **서버** | 앱·웹이 같은 API 를 거쳐 한 번에 빠짐없이 센다. 앱 구버전도 잡힌다 |
| 저장 없는 클릭·탭·필터·노출(웹) | 웹 `trackEvent` | 서버가 모른다 |
| 저장 없는 탭·화면 안 동작(앱) | 앱 `captureAppEvent` | 서버가 모른다. 앱 이벤트는 스토어 운영 빌드부터 쌓인다 |

앱·웹이 같은 행동을 찍으면 **이름을 같게** 한다(`login_started` 처럼). 화면 진입은 이미 웹 `$pageview`, 앱 `$screen` 으로 자동 수집되므로 따로 넣지 않는다.

## 2. 서버 이벤트 (breeder_web)

워크트리에서 한다: `git worktree add -b feat/<이름> ../breeder_web-wt/<이름> origin/dev`, `cp -cR ../../breeder_web/node_modules ./node_modules && npx prisma generate`.

1. `libs/server/analytics.ts` `ServerAnalyticsEvent` 유니언에 이름 추가.
2. 라우트에서 성공 응답 **직전**에:
   ```ts
   import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";
   await captureServerEvent(user.id, "xxx_created", { xxx_id: x.id, platform: resolveClientPlatform(req) });
   ```
   - `await` 한다(Vercel 서버리스는 응답 뒤 작업을 보장하지 않는다. 1.5초 상한·실패 무시).
   - `$transaction` 콜백 안에서 부르지 않는다.
   - 토글은 켜질 때만(좋아요·찜·팔로우), 기존 행 반환 분기(이미 있는 채팅방 등)는 제외.
   - 연락처·이메일·채팅 내용·주소 같은 개인정보는 넣지 않는다. 자유 입력은 잘라서(`slice(0,100)`).
   - 사람 속성이 필요하면 `$set_once`/`$set` 를 properties 에 넣는다(예: `withSignupPersonProperties`).
3. `platform` 판정: 앱은 `X-Bredy-Client: app` 헤더(앱 `src/lib/api/client.ts`), 옛 앱은 okhttp·CFNetwork UA. 새 판정 규칙은 `__tests__/serverAnalytics.test.ts` 에 테스트 추가.

### jest 함정
- 라우트 테스트가 `jest.mock("@libs/server/analytics", () => ({ captureServerEvent: ... }))` 처럼 일부만 목이면 `resolveClientPlatform` 이 undefined 로 500 이 난다 → `...jest.requireActual("@libs/server/analytics")` 를 펼친다.
- `mockCapture` 호출 횟수를 세던 테스트는 새 이벤트 때문에 깨진다 → `mockCapture.mock.calls.filter(c => c[1] === "<이벤트>")` 로 그 이벤트만 센다.
- 목 `req` 에 `headers` 가 없을 수 있다(`resolveClientPlatform` 은 이미 `req.headers ?? {}` 처리).
- `updateMany` 결과(`.count`)를 쓰게 바꾸면 목이 undefined 를 돌려줘 깨진다 → `mockResolvedValueOnce({ count: 1 })`.
- Bash 로 `updateMany`·`truncate` 가 든 코드를 고치면 db-guard 훅이 오탐으로 막는다 → Edit 도구로 고친다.
- 계측 자체를 검증하는 테스트를 하나 넣는다(예: `__tests__/loginApi.test.ts` '가입·로그인 계측').

## 3. 웹 클라이언트 이벤트

`libs/client/analytics.ts` `ANALYTICS_EVENTS` 에 키 추가 → `trackEvent(ANALYTICS_EVENTS.xxx, {...})`. `app_area: "web"`, `platform: "web"` 은 자동으로 붙는다. 페이지를 떠나는 직전(카카오 authorize 등)에 찍어도 posthog-js 가 unload 때 보낸다.

## 4. 앱 이벤트 (bredy_app, master 에서 직접)

`import { captureAppEvent } from "@/lib/analytics"; captureAppEvent("xxx", {...})`.
- SDK 없이 `/batch/` 로 보낸다(`src/lib/analytics.ts`, 규칙은 `src/lib/analytics-core.ts` + `npm run test:analytics`).
- 키는 `eas.json` production 프로필에만 있고 `__DEV__` 는 보내지 않는다 → 에뮬레이터 dev 빌드로는 수신을 확인할 수 없다. 규칙 함수는 node 테스트로 확인한다.
- `platform: "app"`, `$session_id`, `$app_version` 은 자동.

## 5. 문서·검증·커밋

1. `docs/current/posthog-events.md` 표에 이벤트·보내는 곳·속성 추가.
2. 웹: `npx jest`(전체), `npx tsc --noEmit`, `git diff --name-only | xargs npx eslint`.
   앱: `npx tsc --noEmit`, 변경 파일 `npx eslint`, 관련 `npm run test:*`, `npm run check:colors`.
3. 웹 커밋 → `feat/<이름>` 푸시 → dev 대상 PR. 본문에 `## 스크린샷` + `스크린샷 없음 — 화면 변화 없이 분석 이벤트만 바뀜`(pr-guard 훅). PR 본문 파일은 `/tmp/<작업이름>-pr-body.md` 처럼 전용 경로.
4. 앱 커밋은 내 파일만 `git add` 하고 `Parity: both — breeder_web PR #N` 트레일러(화면 파일을 건드렸으면 필수). 푸시가 거절되면 `git pull --rebase` → package.json 스크립트 충돌은 양쪽 줄을 다 남긴다 → tsc 후 푸시.
5. 서버·웹 이벤트는 웹 **운영 배포 뒤**, 앱 이벤트는 **스토어 운영 빌드 뒤**부터 쌓인다고 보고에 적는다.

## 6. 배포 뒤 수신 확인·인사이트 (PostHog MCP `mcp__claude_ai_PostHog__exec`)

1. `learn -s "<키워드>"` 먼저, 그다음 `info read-data-schema` → `call read-data-schema {"query":{"kind":"events"}}` 로 새 이벤트가 보이는지 확인. 없으면 쿼리하지 말고 보고한다.
2. `call read-data-schema {"query":{"kind":"event_property_values","event_name":"<이벤트>","property_name":"platform"}}` 로 app/web 값 확인.
3. 사용자가 원하면 `query-funnel`(예: `$pageview` → `login_started` → `signup_completed` → `category_onboarding_completed`), `query-retention`(시작 `signup_completed`), `query-trends`(이벤트별 고유 사용자, `platform` 분해)로 인사이트를 만들고 대시보드에 묶는다. 시간은 UTC 저장 → 보고는 KST 로 바꾼다. 운영팀(`/admin` 방문자)·미국 Play 검수(`$geoip_country_code != 'KR'`)는 빼고 본다.

## 보고

새 이벤트 목록(이름·보내는 곳·속성), PR·커밋 링크, 테스트 결과, 데이터가 쌓이기 시작하는 시점(배포·스토어 출시 조건), 수신을 직접 확인했는지 여부를 적는다.
