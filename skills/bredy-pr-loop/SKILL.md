---
name: bredy-pr-loop
description: 브리디(breeder_web 웹·서버 + bredy_app 앱) PR 루프 — 기획·시안이 정해진 기능이나 이미 열린 브리디 PR 을 개발→독립 리뷰→수정→e2e(웹 Playwright·앱 에뮬레이터 1대)→수정 반복으로 머지 직전까지 만들고 캡처 한 장과 "머지할까요?"만 묻는다. 사용자가 "PR 루프", "pr루프 돌려", "prworkflowloop", "pr-completion-loop 처럼", "루프 돌려서 머지 직전까지", "리뷰·e2e까지 알아서 반복", "끝까지 처리해", "PR #N 마무리해"라고 하면 쓴다. 브리디가 아닌 회사(allibee) 저장소는 pr-completion-loop 를 쓴다. 기획·시안 단계(bredy-feature-flow·hjjm-prd), 배포만(breeder-web-deploy·bredy-app-deploy), 문구 한 줄 수정에는 쓰지 않는다.
---

# 브리디 PR 루프 (개발 → 리뷰 → 수정 → e2e → 캡처 → 머지)

회사에서 쓰는 `pr-workflow` + `pr-completion-loop` 를 브리디 환경으로 옮긴 것이다(2026-11-26 사용자 요청).
사용자는 **①기획·시안 확정**과 **③캡처 보고 머지 결정** 두 번만 본다. 그 사이(②)는 이 스킬로 혼자 돈다.

```
① 기획·시안 확정 (코디네이터 + 사용자, PRD·시안)  ← 이 스킬의 입력
② 개발 → 정적 검사 → 독립 리뷰 → 수정 → e2e → 수정 … (이 스킬)
   └ 화면이 새로 생기거나 크게 바뀌면 bredy-design-gate 통과
③ 캡처 한 장 + PR 링크 → "머지할까요?" → 사용자 "머지해" → 머지
```

먼저 두 저장소 `AGENTS.md` 를 따른다(DB 안전 · dev 는 로컬에서 검증 · 비용·캐시 · 앱·웹 동시 개발 · 용어 · 스크린샷 · 사용자 손 최소화 · 로컬 CPU 보호). 이 스킬과 다르면 `AGENTS.md` 가 이긴다.

## 0. 입력과 모드

1. **입력 확인**: 이미 열린 PR 이면 그 PR 의 기획·시안 링크와 현재 상태(끝난 게이트)부터 읽고 남은 게이트만 돈다. 새 기능이면 확정된 PRD(`bredy_app/docs/prd/<기능>.md`)와 채택 시안(`design/mockups/<기능>/`, 또는 `/mnt/project-files/<기능>/` 시안 PNG). 둘 다 없으면 이 스킬을 멈추고 ①부터 하자고 한 줄로 말한다. 작은 수정은 사용자 요청 문장이 곧 기획이다.
2. **모드** (말이 없으면 `fast` 로 시작, 아래 조건일 때만 올린다)
   - `fast`: 파일 몇 개, 화면 하나. 독립 리뷰 없이 정적 검사 + e2e 한 시나리오. 목표 20분.
   - `standard`: 웹·앱·서버에 걸친 보통 기능. 독립 리뷰어 1명. 목표 1시간.
   - `deep`: 결제·권한·DB 마이그레이션·채팅/알림 같은 데이터 위험, 또는 사용자가 "밤새", "3시간" 처럼 시간을 준 일. 독립 리뷰어 2명(코드 / 제품 흐름). 30분마다 중간보고(`overnight-loop-reports` 메모리).
   - 시간이 남는다고 범위를 넓히지 않는다. 게이트를 채우면 바로 ③으로 간다.

## 1. 대상 고정

| | 웹·서버 breeder_web | 앱 bredy_app |
|---|---|---|
| 브랜치 | `origin/dev` 에서 새 브랜치(클라우드 스레드는 지정 브랜치) | `origin/master` 에서 새 브랜치 |
| PR | **Draft**, base `dev` | **Draft**, base `master` (루프 동안은 master 직접 푸시 대신 PR로 묶고 ③에서 머지) |
| 맥 작업 위치 | 새 워크트리 `breeder_web-wt/<기능>` (본 체크아웃은 다른 세션이 씀) | 새 워크트리 또는 원본 체크아웃(다른 세션 확인) |
| 짝 | 앱 PR 번호를 본문·트레일러에 | 웹 PR 번호를 본문·트레일러에 |

- 시작할 때 저장소·PR 번호·base·head SHA 를 기록하고, 이후 모든 검증 결과에 SHA 를 붙인다.
- 사용자 변경(dirty)은 보존한다. 다른 스레드가 같은 화면을 만들고 있으면(`list_threads`) 먼저 그 스레드에 알린다.
- PR 은 만들고 나서 바로 `subscribe_pr_activity` 로 따라간다(폴링·sleep 금지).

## 2. 어디서 돌리나 (비용·자원)

| 작업 | 위치 |
|---|---|
| 코드 수정·lint·typecheck·jest·앱 tsc/lint/check:colors·node 테스트 | 클라우드 컨테이너(되면). 안 되면 맥 |
| `next dev` + 웹 e2e·캡처, dev DB `migrate deploy`, 에뮬레이터 | 맥 프로(고장이면 에어), Remote Control |
| 운영 배포·코드푸시 | 이 스킬에서 하지 않는다(사용자 "운영배포해" 때 배포 스킬) |

- 맥에서는 **무거운 작업을 한 번에 하나**(AGENTS 로컬 CPU 보호). 시작 전 `sysctl vm.swapusage`. 띄운 서버·Metro·에뮬레이터는 PID·포트를 적어 두고 ③ 전에 끈다.
- Vercel 프리뷰는 없다(2026-11-14). 프리뷰를 기다리거나 PR 에 적지 않는다. 판정은 항상 로컬이다.

## 3. 개발

- 구현 규칙은 `bredy-feature-flow` 5절(스키마는 추가만·`migrate deploy` 만, 공통 규칙 사본 `libs/shared/*` = `src/lib/*`, 색 토큰, 낙관적 갱신)을 따른다.
- 새 페이지·API 는 처음부터 `docs/ops/cache-policy.md` 대로(공개 응답은 `publicFetcher`/`publicJson`, 상세는 태그 캐시, 폴링은 보일 때만).
- 화면 문구는 용어표(분양·입양, '상품·판매' 금지)와 토스 말투(`design-toss-baseline`, `ux-copy-feedback`).
- 앱다운 동작 우선(끌기·스크롤·키보드 네이티브). 웹을 그대로 베끼지 않는다.
- 화면 코드 커밋에는 `Parity: both — <짝 PR>` 트레일러. 커밋·PR 은 한국어.

## 4. 정적 검사 (바뀐 경로만)

새 SHA 마다 전부 다시 돌리지 않는다. 바뀐 경로가 건드리는 게이트만 다시 돈다.

| 바뀐 경로 | 다시 돌릴 것 |
|---|---|
| 웹 `app/`·`components/`·`hooks/`·`libs/client` | `npm run lint` + `npm run typecheck` + 관련 jest + 웹 e2e·캡처 |
| 웹 `pages/api`·`libs/server` | typecheck + 관련 jest(`__tests__/<기능>*.test.ts`) + API e2e |
| 웹 `prisma/` | `node scripts/check-migration-safety.mjs` + `npm run db:check-migrations` + dev DB 적용(5절) |
| 웹 문구 | `npm run check:i18n` |
| 앱 `src/`·`app/` | `npx tsc --noEmit` + `npm run lint` + `npm run check:colors` + 관련 `node --test scripts/test-*.mjs` + 에뮬레이터 |
| 문서·PR 본문·스킬만 | 앱 검증 없음 |

- 실패는 `CHANGE`(내 변경) · `BASELINE`(원래 깨져 있음) · `ENVIRONMENT`(맥·네트워크) · `EXTERNAL`(CI 결제 한도·봇)으로 나눈다. `CHANGE` 만 고친다. 나머지는 보고에 한 줄.
- 웹 `next dev` 를 띄운 채 typecheck 하지 않는다(`.next/dev/types` 오류) — 서버를 내리고 돌린다.
- ③ 직전에 웹은 `npm run verify:ci` 를 **한 번** 통째로 돌린다(그 뒤 코드가 안 바뀌면 다시 안 돌린다).

## 5. DB 마이그레이션이 있으면 (deep)

AGENTS 'dev 는 로컬에서 검증' 그대로: 맥에서 `npm run db:backup -- dev` → `node scripts/check-migration-safety.mjs` → `npx prisma migrate deploy` → `npx prisma migrate status` up to date. PR 본문에 `dev DB 마이그레이션 적용 — <이름들>`. **중간에 실패하면 멈추고 보고**(다시 돌리거나 resolve 하지 않는다). 지우는 마이그레이션은 사용자 확인이 먼저다.

## 6. 독립 리뷰 (standard·deep)

- 리뷰어는 만든 쪽과 다른 하위 에이전트(Agent, read-only). **내 결론이 아니라 diff·PRD·시안 경로만** 준다. 프롬프트는 `references/review-prompt.md`.
- `standard` 1명(코드 + 브리디 규칙), `deep` 2명(코드 / 제품 흐름·빠진 시나리오). 같은 diff 재리뷰는 막는 수정이 있었을 때만.
- 판정은 실제로 재현되는가·사용자 영향 기준이다. 리뷰어의 Critical/High 표시는 명령이 아니다.
  - 바로 고침: 정상 사용에서 재현되는 기능 실패, 다른 사람 데이터가 CDN·응답으로 새는 것, 데이터 손상, 필수 검사 실패, 규칙 위반(DB 안전·캐시·용어·색 토큰·Parity).
  - 근거 한 줄 남기고 패스: 취향, 이론적 경합, 이미 테스트된 경로의 중복 방어.
- `standard` 는 리뷰-수정 한 바퀴가 원칙. 그 뒤엔 새로 확인된 막는 문제만 고친다.
- GitHub 쪽: 봇 리뷰(Gemini·Codex·review-loop-gate)는 **기다리지 않는다**. ③ 직전에 이미 달린 코멘트만 한 번에 판정한다. 필수 CI(`db-safety` 등)는 이벤트로 받는다. CI 가 결제 한도로 안 돌면 `EXTERNAL` 로 적고 로컬 결과로 대신한다.

## 7. e2e

화면을 실제로 눌러 본다. 어서션(글자·역할·상태)으로 먼저 판정하고, 캡처는 마지막 증빙용으로만 찍는다.

**웹** (맥, 워크트리)
- `npx next dev -p 3010` 을 백그라운드로 띄우고 ③까지 유지한다(캡처마다 껐다 켜지 않는다).
- 기존 스펙이 맞으면 `npx playwright test e2e/<관련>.spec.ts --trace off`. 새 흐름은 `bredy-feature-flow/assets/web-e2e-template.mjs` 를 `.tmp-<기능>-e2e.mjs` 로 복사해 채운다(테스트 계정 토큰, 실행마다 꼬리표 TAG). 끝나면 임시 파일을 지운다.
- 모바일 뷰포트 390×844. 색을 바꿨으면 다크도.
- 오래 남을 흐름이면 임시 스크립트 대신 `e2e/<기능>.spec.ts` 로 남긴다.

**앱** (맥, **에뮬레이터 한 대만**)
- 스왑 20GB 미만이면 낮에도 띄운다. 넘으면 띄우지 않고 `ENVIRONMENT` 로 보고한다.
- 다른 세션이 쓰는 에뮬레이터는 건드리지 않는다. 준비·조작은 `bredy-feature-flow/references/emulator.md`(bredy_qa, Metro 8097, 로컬 웹 3010 연결, 딥링크로 화면 열기)와 `bredy-smoke-test` 의 `droid.py`(라벨로 탭).
- 쓰고 나면 Metro 를 내리고 `adb emu kill`.

**테스트 데이터**: 공유 dev DB 다. 내가 만든 행만 id 로 지우고, id 는 보고에 적는다.

## 8. 수정 루프와 멈춤

1. 리뷰·e2e 에서 나온 `CHANGE` 를 최소 범위로 고친다 → 4절 표대로 영향받은 게이트만 다시 → 커밋·푸시.
2. **같은 원인으로 세 번 연속 실패하면 멈춘다.** 시도한 것·로그·필요한 결정을 정리해 차단으로 보고한다.
3. 제품 결정이 필요하면(정책·문구 방향) 추측으로 정하지 않는다. 다른 게이트는 계속 돌리고 그 결정만 `request_decision` 한 장으로 묻는다.
4. 화면 출력이 안 바뀐 커밋(리팩터·주석·테스트)은 다시 찍지 않는다. 보고에 "캡처 SHA ≠ head, 렌더링 같음" 한 줄.

## 9. 디자인 게이트 → 최종 캡처

- 새 화면·개편·큰 섹션 추가면 **`bredy-design-gate` 를 통과해야 ③으로 간다**(기준 앱 실제 캡처와 나란히, 별도 심사자 블라인드 판정, 최대 3번 고침). 그 스킬의 `final.png` 를 최종 캡처로 쓴다. 문구·버그·작은 색 수정은 건너뛴다.
- 캡처 이름: `web-0N-<화면>-light.png`, `app-0N-<화면>.png`. 찍은 파일은 직접 열어 의도한 화면인지 본다.
- 올리기: `scripts/pr-screenshots.sh <파일...>` (공개 `ytw418/pr-assets`). 다른 사용자 개인정보가 보이면 테스트 계정으로 다시 찍는다. 이미지를 저장소에 커밋하지 않는다.
- 사용자에게는 **최종본만**. 라운드·점수는 보내지 않는다.

## 10. PR 본문 (웹 PR 하나에 앱 캡처까지)

맨 위에 프로젝트 귀속 두 줄(세션이 준 것)을 두고, 아래 순서로 채운다. 템플릿은 `references/pr-body.md`.

- `## 개요` 왜 필요한가 · `## 주요 변경` · `## 테스트`(실행한 검사·e2e 시나리오·결과·SHA)
- `## 스크린샷` 표: 화면 | 앱 | 웹 (`<img>` 줄). 화면 변화가 없으면 `스크린샷 없음 — <이유>`
- 새 페이지·API 면 `## 캐시·폴링`, 마이그레이션이면 `dev DB 마이그레이션 적용 — …`
- 짝 PR 링크, `Parity:` 줄
- 훅 `pr-guard.py`·`dev-local-guard.py` 가 막으면 본문을 고친다(우회 금지).

## 11. 완료 게이트 (전부 만족해야 ③)

- [ ] head SHA = 마지막 검증 SHA
- [ ] 웹 `verify:ci` 통과(또는 `BASELINE` 실패만, 근거 있음), 앱 tsc·lint·check:colors 통과
- [ ] e2e 시나리오 통과(웹, 앱 해당 시), 캡처가 마지막 화면 변경 이후 것
- [ ] 디자인 게이트 통과(해당 시)
- [ ] 막는 리뷰 코멘트 0개, 필수 CI 성공(또는 `EXTERNAL` 근거)
- [ ] mergeable, base 최신(필요하면 `git merge origin/dev` — 공유 브랜치는 rebase·force push 금지)
- [ ] PR 본문에 스크린샷·테스트·(해당 시) 캐시·폴링·dev DB 줄
- [ ] 띄운 서버·Metro·에뮬레이터 종료 확인

## 12. ③ 보고와 머지

1. 체크리스트를 끝 상태로 맞추고 **한 번만** 보고한다(80단어 안팎, 한국어):
   - 무엇이 됐는지 한 줄 + 최종 캡처 `![캡션](URL)` + 웹·앱 PR 링크
   - 고친 문제 수(리뷰 n건·e2e n건), 남은 것(있으면)
   - 끝 문장: "머지할까요?"
2. 사용자가 "머지해"라고 하면 그 말이 승인이다. 웹 PR(→dev)·앱 PR(→master)을 저장소 관례대로 머지하고(최근 dev 는 merge commit) 결과를 한 줄로 알린다. 머지 승인 없이 머지하지 않는다.
3. 운영 배포·앱 코드푸시는 이 스킬이 아니다. 사용자가 "운영배포해" 하면 배포 스킬로 넘어간다(웹이 운영에 나가기 전 앱 OTA 금지).
4. 기능 결정·PR·dev 테스트 데이터 id 는 프로젝트 메모리에, 새로 겪은 함정은 기존 메모리에 덧붙인다.

## 13. 하지 않는 것

- 실제 DB 를 비우거나 구조를 직접 바꾸는 명령(AGENTS DB 안전 규칙 전부). 훅이 막으면 보고.
- 승인 없는 머지, 운영 배포, 코드푸시, Vercel 설정 변경.
- 테스트를 끄거나 건너뛰어 초록 만들기, 남의 브랜치 force push, 빈 커밋으로 CI 다시 돌리기.
- 사용자에게 클릭·입력 부탁(비밀번호·인증번호·결제만 예외).
