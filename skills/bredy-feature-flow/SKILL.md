---
name: bredy-feature-flow
description: 브리디(bredy_app 앱 + breeder_web 웹·서버)에 새 기능을 기획부터 출시 직전까지 한 번에 만든다. PRD(docs/prd) → 당근 톤 시안 HTML·PNG(design/mockups) → 지정한 사용자군 페르소나 피드백(서브에이전트) → PRD v2 → 서버·웹·앱 동시 구현(마이그레이션은 migrate deploy 만) → 테스트·웹 E2E·에뮬레이터 캡처 → pr-assets 업로드 → 웹 dev PR + 앱 master 푸시(Parity 트레일러) → 문서·메모리 기록까지 한다. 사용자가 '브리디에 ○○ 기능 추가해줘', 'PRD부터 써주고 기획 디자인하고 만들어줘', '20대 여자(○○ 사용자) 피드백 받아서 만들어', '기획→디자인→구현 다 해줘' 등을 요청할 때 사용한다. 작은 버그 수정·문구 변경, 배포만(bredy-app-deploy·breeder-web-deploy), PRD 문서만(hjjm-prd)에는 쓰지 않는다.
---

# 브리디 기능 개발 흐름 (PRD → 시안 → 페르소나 피드백 → 앱·웹 구현)

먼저 앱 `AGENTS.md`(DB 안전·앱·웹 동시 개발·용어·스크린샷·디자인 기준·색 규칙)를 따른다. 이 스킬은 그 규칙을 한 번에 도는 순서다.
첫 사례: 2026-10-20 채팅방 나가기·알림 끄기(앱 `docs/prd/chat-room-settings.md`, 웹 PR #317, 앱 master 6a3b0e8).

| 경로 | 값 |
|---|---|
| 앱 | `~/Desktop/pro/bredy_app`(paseo 워크트리면 그 워크트리) — 앱은 master 로 바로 푸시 |
| 웹·서버 | `~/Desktop/pro/breeder_web` — 본 체크아웃은 다른 세션이 쓰니 **새 워크트리** `breeder_web-wt/<기능>` 를 `origin/dev` 에서 만든다 |

## 1. 현황 파악 (코드부터)
- 앱·웹·서버에서 이미 있는 것과 빠진 것을 가린다(예: 차단은 이미 있었고 나가기·알림만 없었다). 파일 3개 이상을 훑어야 하면 Explore(haiku/sonnet) 에 맡긴다.
- 서버: `prisma/schema.prisma`, `pages/api/...`, `libs/server/*`. 응답에 다른 사람의 상태(읽음·설정)가 새는지도 본다.

## 2. PRD v1
- `docs/prd/<기능>.md` 에 기존 PRD 형식(0 입력 식별값 · 1 배경·목표·비목표 · 2 기능표 · 3 정책 · 4 화면·상태 · 5 API · 6 오류 · 7 AC · 8 미결 질문)으로 쓴다. 미결 질문은 페르소나에게 물을 선택지로 적는다.

## 3. 시안
- `design/mockups/<기능>/A-karrot.html`: 기존 시안(`design/mockups/chat/A-karrot.html` 등) CSS 를 재사용해 390×800 화면 3~5장 + 정책 요약 메모. `design/mockups/REFERENCE.md` 금지 목록을 지킨다. 시트·확인 창은 기존 컴포넌트 형태(글자만 행, 아래 카드 확인 창)에 맞춘다.
- PNG 렌더: `node scripts/render-mockup.mjs <html> <png>` 를 **breeder_web 디렉터리에서** 실행한다(그 node_modules 의 playwright 사용). 렌더 결과를 Read 로 직접 본다.

## 4. 페르소나 피드백
- `references/persona-prompt.md` 의 틀로 `Agent(model: "opus", run_in_background: false)` 를 부른다. 사용자가 말한 사용자군(예: 20대 여성 분양자)을 구체적 인물로 만들고, PRD·PNG 두 파일만 읽게 한다.
- 받은 '꼭 바꿀 것'은 원칙적으로 모두 반영하고, '있으면 좋은 것'은 보류로 PRD §9 표에 남긴다. PRD 를 v2 로 올리고 시안도 다시 렌더한다. 사용자에게 다시 묻지 않고 진행한다(사용자가 피드백 반영까지 맡겼다).

## 5. 구현 (서버 → 웹 → 앱)
- **스키마**: 널 허용 열·표 추가만. `prisma/migrations/<YYYYMMDD>000000_<이름>/migration.sql`(`ADD COLUMN IF NOT EXISTS`). 로컬 확인 전 `npx prisma migrate status` → 내 것만 미적용이면 `npx prisma migrate deploy`(dev DB). `migrate dev/reset`, `db push`, shadow DB 는 절대 쓰지 않는다.
- **공통 규칙 사본**: 메뉴 순서·문구·판정은 웹 `libs/shared/<이름>.ts` = 앱 `src/lib/<이름>.ts` 사본으로 두고 머리 주석에 서로를 적는다.
- **웹 워크트리**: `cp -cR ~/Desktop/pro/breeder_web/node_modules .` + `.env*` 복사 + `npx prisma generate`.
- **앱**: 색은 `useAppTheme().colors` 토큰만, 위치·색은 inline style. 시트는 `PostActionSheet`(title 지원), 확인 창은 `ConfirmDialog` 톤. 사용자 동작은 react-query 캐시를 바로 바꿔(낙관적 갱신) 지연 없이 보이게 한다. 나가기처럼 화면을 떠나면 `router.dismissTo("/<탭>")`.
- **테스트**: 기존 테스트를 먼저 돌리고, 바뀐 동작의 기대값만 고친다. 새 테스트는 분기 있는 서버 로직에 한 파일·핵심 케이스만(`__tests__/<기능>Api.test.ts`, prisma 목 패턴은 `__tests__/chatBlockGuard.test.ts`).

## 6. 검증
- 웹: `npm run typecheck`·`npm run lint`·`npm test -- --ci`. **`next dev` 를 띄운 채 typecheck 하면 `.next/dev/types` 를 반쯤 읽어 실패한다** — 서버를 내리고 `.next` 를 지운 뒤 돌린다.
- 웹 E2E: `assets/web-e2e-template.mjs` 를 웹 워크트리에 `.tmp-<기능>-e2e.mjs` 로 복사해 시나리오를 채운다(테스트 계정 토큰을 localStorage 에 넣는 방식, 실행마다 메시지 꼬리표 TAG). `npx next dev -p 3010` 을 띄우고 `localhost` 로 연다. 다크 캡처 1장 이상. 끝나면 임시 파일을 지운다.
- 앱: `references/emulator.md`(arm64 빌드·bredy_qa·Metro 8097·로컬 웹 3010 연결·조작 요령).
- 앱: `npx tsc --noEmit && npm run lint && npm run check:colors`.

## 7. 올리기
- 캡처를 `web-0N-<화면>.png`·`app-0N-<화면>.png` 로 모아 앱 `scripts/pr-screenshots.sh <파일...>` → 나온 `<img>` 줄로 PR 본문 `## 스크린샷` 표(화면 | 앱 | 웹). 다른 사용자 개인정보가 보이면 안 된다(테스트 계정만).
- 웹: 커밋(`feat(<영역>): …` + `Parity: both — bredy_app master(…)`) → `feat/<기능>` 푸시 → `gh pr create --base dev --body-file /tmp/<기능>-pr-body.md`(공용 /tmp 고정 이름 금지) → 본문 확인. **머지·운영 배포는 사용자에게 맡긴다.**
- 앱: `git fetch && git rebase origin/master` → tsc 재확인 → 커밋(`Parity: both — breeder_web PR #N`) → `git push origin HEAD:master`. 웹이 운영에 나가기 전에는 앱 OTA 를 하지 않는다고 커밋 메시지·보고에 적는다.

## 8. 기록·보고
- 앱 `AGENTS.md` 디자인 기준표 한 줄 + 디자인 결정 기록 한 항목, `docs/parity/README.md` 한 문단, 기존 관련 PRD 의 미결 질문 정리.
- 메모리: 기능 결정·PR·커밋·dev 테스트 데이터 id 를 project 메모리로, 새로 겪은 함정은 기존 메모리(예: 에뮬레이터 함정)에 덧붙인다.
- 보고(한국어): 무엇을 정했는지(정책) · 페르소나 피드백 반영/보류 · 검증 수치 · dev DB 변경 · 캡처(`![캡션](URL)` + 로컬 경로) · 남은 일(웹 머지·배포 → 앱 OTA).
