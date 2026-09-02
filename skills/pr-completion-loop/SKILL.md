---
name: pr-completion-loop
description: BHSN allibee-frontend PR을 생성한 뒤 검증, 수정, 리뷰·CI 대응, i18n·타입 생성 Action, 브랜치 최신화, 최종 스크린샷까지 반복해 사용자가 머지할 수 있는 상태로 만든다. 사용자가 "PR 끝까지 처리", "리뷰와 CI 대응", "이상 없을 때까지 반복", "i18n·타입 생성까지", "2시간 동안 알아서 진행"처럼 PR 완주나 시간 예산을 명시할 때 사용한다. PR 생성만 요청한 경우에는 사용하지 않는다.
---

# PR Completion Loop

PR을 사용자가 직접 머지할 수 있는 상태까지 반복해서 완성한다. 우리가 만든 feature PR은 절대 머지하지 않는다. 자동 머지는 이 작업이 실행한 i18n·type GitHub Action의 생성 PR에만 허용한다.

## 선행 스킬

상황에 맞게 다음 스킬을 읽고 적용한다.

- PR 생성: `pr-workflow`
- 코드 품질: `code-review-and-quality`
- 브라우저·Figma: `figma-browser-verification`
- 번역 키: `i18n`
- Actions 실패: `gh-fix-ci`
- 최신화·스택 브랜치: `rebase-develop`

사용자의 명시적 완주 요청은 같은 feature PR 범위의 수정, 커밋, push, 리뷰 답변, 관련 생성 Action 실행을 승인한다. 다른 제품 변경이나 다른 사람의 feature PR 수정으로 범위를 넓히지 않는다.

## 0. 실행 모드 결정

작업 크기, 위험도, 사용자의 시간 예산으로 모드를 고른다. 명시가 없으면 `fast`로 시작하고 아래 승격 조건이 있을 때만 상위 모드로 올린다.

- `fast`(기본): 한두 파일의 명확한 수정, 관련 테스트와 단일 브라우저 시나리오로 판정 가능한 작업. 루트 에이전트가 바로 끝낸다.
- `standard`: 여러 모듈에 걸치거나 코드 리뷰·테스트·브라우저 검증 중 둘 이상에 독립 판단이 필요한 일반 기능 작업. 독립 검증자는 한 명만 사용한다.
- `deep`: 인증·결제·권한·데이터 손상 위험, 대규모 교차 앱 변경, 또는 사용자가 2시간·3시간처럼 장기 작업 예산을 지정한 작업. 이 모드에서만 Codex와 Claude의 병렬 독립 리뷰를 기본으로 한다.

시간 예산은 작업 범위를 넓히는 권한이 아니다. 단순 작업을 예산만큼 늘리지 말고 게이트가 충족되면 즉시 종료한다.
`fast`는 10분 안팎, `standard`는 30분 안팎을 기본 목표로 삼는다. 첫 수정 라운드 뒤 필수 게이트가 충족되면 추가 hardening을 시작하지 않는다.
리뷰어가 많거나 시간이 남았다는 이유만으로 `deep`으로 승격하지 않는다.

## 1. 대상과 권한 고정

1. 저장소, PR 번호, base, head, 현재 head SHA, 브랜치와 worktree를 기록한다.
2. dirty worktree의 사용자 변경을 보존하고 PR 대상이 아닌 파일은 건드리지 않는다.
3. 사용자가 PR 생성만 요청했다면 `pr-workflow`까지만 수행하고 이 루프를 시작하지 않는다.
4. shared base(`develop`, `cueAi`, `stage`, `main`)는 리베이스하거나 force push하지 않는다.
5. 우리가 만든 feature PR에는 `gh pr merge`, auto-merge 활성화, merge queue 등록을 실행하지 않는다. 사용자가 나중에 feature PR 머지를 요청해도 이 스킬에서는 사용자가 직접 머지하도록 안내한다. Draft 해제도 사용자 요청이 있을 때만 한다.
6. 자동 merge 대상은 이번 루프가 실행한 i18n·type 생성 PR로 제한한다.

## 2. 병렬 역할 분리

`standard`와 `deep`에서만 병렬화한다.

- 루트 에이전트: 계획, git write, 커밋, push, PR 코멘트, 최종 판정
- `standard` 독립 검증자 한 명: 정적 분석·변경 영향 또는 제품 흐름 중 작업에 더 중요한 축을 검토
- `deep` Codex 검증자: 테스트·정적 분석·변경 영향 검토
- `deep` Claude 검증자: 독립 코드 리뷰·제품 흐름·누락 시나리오 검토
- 브라우저 검증자: 실제 Chrome·Figma·스크린샷 검증

`standard`에서는 Codex와 Claude를 동시에 부르지 않는다. `deep`에서 두 런타임이 모두 연결되어 있으면 각각 최대 한 번 독립 검토를 받고, 같은 diff의 재리뷰는 blocking 수정이 있었을 때만 요청한다. 한쪽이 없으면 가능한 검증자로 계속 진행하고 사용할 수 없었다고 보고한다. 사용하지 않은 에이전트를 사용했다고 주장하지 않는다.

오케스트레이터가 profile·provider·model 조회를 지원하면 실행 전에 실제 사용 가능한 Codex와 Claude를 조회한다. 저장된 profile이 없으면 provider와 model을 조회해 선택하며 model ID를 추측하지 않는다.

병렬 작업 규칙:

1. 기본적으로 하위 에이전트는 read-only다.
2. 쓰기는 루트만 수행한다. 꼭 위임해야 하면 파일 소유 범위를 겹치지 않게 지정한다.
3. 같은 테스트, 같은 브라우저 시나리오, 같은 리뷰를 중복 실행하지 않는다.
4. 단순 작업에는 committee나 다중 리뷰를 만들지 않는다.
5. 각 작업이 60초 이상 걸리면 진행 상태를 갱신한다.
6. 가능하면 background 실행과 완료 알림을 사용하고 상태 확인용 busy polling을 만들지 않는다.

## 3. PR 생성과 초기 검증

1. `pr-workflow`로 변경 범위, 비밀정보, 컨벤션, 테스트를 점검한다.
2. 저장소 `AGENTS.md`의 브랜치, 제목, 본문, i18n 정책을 우선한다.
3. 커밋·push 후 Draft PR을 만들고 변경 앱의 preview 댓글(`preview:<앱>` 예: `preview:cue` — `[PREVIEW]UNIFIED` 워크플로우 트리거)만 등록한다.
4. 원격 head SHA를 다시 조회한다. 이후 모든 검증 결과에 SHA를 연결한다.
5. 정적 검사, 관련 단위 테스트, 앱 빌드 또는 타입 검사를 실행한다. baseline 실패와 변경으로 생긴 실패를 분리한다.
6. UI 변경이면 인증된 route에서 상호작용을 검증한다. 수정 루프에서는 격리된 Playwright를 사용하고, 완료 직전 실제 Chrome에서 최종 스크린샷을 한 번 남긴다.

## 4. 브라우저·Figma 판정

1. 정확한 Figma node, route, viewport, data state를 고정한다.
2. 반복 비교는 격리된 Playwright로 수행하고, 최종 reference와 actual 비교는 실제 Chrome에서 확인한다.
3. raw i18n key가 보이면 Dev Tools의 `실시간 시트 연동`을 켜고 같은 상태를 재검증한다.
   - 정상 문구가 나오면 구현은 통과시키고 생성 locale 미반영으로 분류한다.
   - 시트 연동 후에도 잘못되면 구현 실패로 분류해 수정한다.
4. 구현 수정 후 같은 조건으로 final screenshot을 새로 만든다.
5. PR 증빙용 스크린샷 바이너리를 `.github/pr-assets`, `pr-assets`, `screenshots` 같은 경로에 커밋하지 않는다. GitHub PR 편집창이나 댓글에 업로드해 `https://github.com/user-attachments/assets/...` URL만 본문 또는 댓글에 남긴다.
   - user-attachments 업로드는 GitHub 웹 세션(브라우저 쿠키)으로만 가능하다. 자동화 브라우저에 GitHub 로그인 세션이 없으면 사용자에게 미루지 말고 **전용 assets 레포 fallback을 반드시 실행**한다. gh 토큰만으로 동작하므로 스크린샷 첨부를 생략할 이유가 없다:

     ```bash
     base64 -i <스크린샷.png> -o /tmp/shot.b64
     gh api --method PUT /repos/ytw418/pr-assets/contents/<대상레포명>/pr-<번호>/<파일명>.png \
       -f message="Add <티켓> PR#<번호> screenshot" -f content="$(cat /tmp/shot.b64)" \
       --jq '.content.download_url'
     ```

     반환된 `raw.githubusercontent.com` URL을 `![...](URL)`로 PR 본문 또는 댓글에 삽입한다.
6. 스크린샷을 PR에 반영한 뒤 다음 하네스로 base 이후 전체 커밋과 PR 본문·댓글을 검사한다. 하네스는 diff에 UI 파일(`.svelte`, `.tsx`, `.css` 등)이 있으면 **플래그 없이도 첨부를 자동 요구**한다(assets 레포 raw URL도 첨부로 인정). `--require-attachment`는 강제, `--skip-attachment`는 시각 변화가 정말 없는 UI 파일 변경(타입만 수정 등)에만 사유와 함께 사용한다.

   ```bash
   node ~/.codex/skills/pr-completion-loop/scripts/check-pr-screenshot-storage.js \
     --pr <PR 번호> --repo bhsn-ai/allibee-frontend
   ```

7. 하네스가 저장소 이미지 경로를 발견하면 삭제 커밋만 추가하지 말고, feature 브랜치의 해당 커밋을 다시 작성해 base 이후 히스토리에서도 바이너리를 제거한다. 공개 feature 브랜치는 원격 SHA를 고정한 `--force-with-lease`로만 갱신한다.
8. Figma node나 데이터가 없으면 `BLOCKED_SPEC` 또는 `BLOCKED_DATA`로 기록하고 추측으로 통과시키지 않는다.

## 5. 검증-수정 루프

head SHA가 바뀌어도 모든 검증을 다시 시작하지 않는다. 먼저 [verification-optimization.md](references/verification-optimization.md)의 변경 경로별 게이트와 로컬 캐시를 적용해 영향받은 검증만 반복한다.

1. base...head 변경 경로를 분류하고 필요한 게이트를 계산한다.
2. 동일한 base, 관련 파일 내용, 실행 명령, 환경 조건에서 이미 통과한 게이트는 캐시 결과를 재사용한다.
3. 캐시 miss인 로컬 검증만 실행한다.
4. 실패를 `CHANGE`, `BASELINE`, `ENVIRONMENT`, `EXTERNAL`로 분류한다.
5. `CHANGE`만 최소 범위로 수정하고 회귀 테스트를 보강한다.
6. diff를 다시 리뷰하고 커밋·push한다.
7. 새 SHA에서 무효화된 로컬·브라우저 게이트만 다시 수행한다.
8. 앱 코드 커밋을 push했거나 작업 완료·검증 결과 코멘트를 남길 때는 변경 앱의 프리뷰 갱신 코멘트(`preview:<앱>`)를 다시 등록해 리뷰어가 최신 head 기준 프리뷰를 보게 한다. 문서·스킬만 바뀐 push에는 생략한다.

문서·PR 본문·스킬만 바뀐 커밋 때문에 앱 브라우저 검증을 반복하지 않는다. 실제 Chrome은 최종 사용자 증빙에 한 번 사용하고, 수정 루프의 재현·회귀 검증은 격리된 Playwright를 우선한다. UI에 영향을 주는 코드가 마지막 Chrome 증빙 뒤 바뀌었을 때만 Chrome을 다시 사용한다.

같은 원인의 수정이 세 번 연속 실패하면 무한 반복하지 말고 로그, 시도, 필요한 외부 결정을 정리해 차단 상태로 보고한다.

## 6. 리뷰와 CI 대응 루프

1. review, unresolved thread, issue comment, PR check를 모두 조회한다.
2. 리뷰 label보다 실제 재현 가능성, 제품 영향, 운영 환경의 threat model을 기준으로 판정한다.
   - 즉시 수정: 정상 사용에서 재현되는 기능 실패, 실제 자격 증명 노출, 데이터 손상, 필수 CI 실패, 높은 확률의 회귀.
   - 근거를 남기고 패스: Info·Low hardening, 스타일 선호, 이미 테스트된 경로의 중복 방어, 악성 로컬 서버·사용자 PC 장악을 전제로 한 이론적 race.
   - dev-only 하네스에는 prod 서비스 수준의 공격 모델을 강제하지 않는다. 단, dev 자격 증명이 외부 origin으로 실제 전송되는 정상 경로가 있으면 수정한다.
3. reviewer의 `Critical`·`High` 표시는 자동 수정 명령이 아니다. 루트 에이전트가 현실적 공격·실패 경로를 확인하고 과잉 방어면 한국어 근거와 함께 패스한다.
4. `standard`는 원칙적으로 한 번의 리뷰-수정 라운드만 수행한다. 이후에는 새로 확인된 blocking 항목만 수정하고, 이론적 새 hardening 때문에 SHA를 계속 바꾸지 않는다.
5. 질문에는 근거를 들어 한국어로 답변한다.
6. 자동 생성 안내·중복·이미 해결된 코멘트는 근거를 남기고 resolve 가능한 thread만 resolve한다.
7. 제품 결정이나 외부 시스템이 필요하면 임의로 결정하지 않는다.
8. Actions 실패는 로그의 최초 실제 오류를 찾아 같은 PR 범위에서 수정한다. 외부 CI는 URL과 상태만 기록한다.
9. push 후 변경 영향에 필요한 검증만 새 SHA에서 반복한다.
10. checks가 진행 중이면 상태 변화가 예상되는 간격으로 poll하고 60초 이내에 사용자에게 상태를 갱신한다. 동일 SHA의 동일 결과를 반복 출력하지 않는다.

## 7. i18n 처리

1. 신규·변경 키를 `i18n` 스킬의 앱별 포맷으로 정리한다.
2. generated locale 파일을 직접 수정하지 않는다.
3. `AGENTS.md`가 시트 자동 입력을 금지하면 복사 가능한 행을 사용자에게 전달하고 시트 반영 확인을 기다린다. 이 단계는 생략하거나 우회하지 않는다.
4. 시트 반영 확인 후 관련 i18n workflow를 실행하고 완료를 기다린다. [allibee-actions.md](references/allibee-actions.md)를 따른다.
5. 생성 PR diff가 허용된 locale 경로에만 있는지 확인하고 checks 통과 후 생성 PR만 merge한다.
6. 생성 결과가 없으면 대상 시트와 workflow 로그를 확인한다. generated 파일을 수동 생성하지 않는다.

## 8. 타입 생성 처리

1. BE schema가 바뀌었거나 사용자가 타입 생성을 명시한 경우 대상 앱의 type workflow를 실행한다.
2. 실행 전 같은 고정 생성 브랜치의 open PR과 stale remote branch를 확인한다.
3. stale branch의 소유권이 불명확하면 삭제하거나 덮어쓰지 않는다.
4. workflow run ID를 고정해 완료를 기다린다.
5. 생성 PR diff가 허용된 API generated 경로에만 있는지 확인하고 build와 checks 통과 후 생성 PR만 merge한다.
6. 생성 PR이 없으면 `no changes`와 실패를 로그로 구분한다.

## 9. 생성 Action과 최신화

1. workflow는 `develop` 최신 SHA에서 실행한다.
2. 고정 생성 브랜치 workflow는 동시에 여러 번 실행하지 않는다.
3. 생성 PR merge 후 `git fetch origin --prune`으로 base SHA를 갱신한다.
4. feature PR base가 `cueAi`이면 `develop`을 shared `cueAi`에 저장소 방식으로 반영한다. `cueAi`를 리베이스하거나 force push하지 않는다.
5. 생성 PR commit을 feature branch에 cherry-pick하지 말고 최신 base를 반영한다.
6. 공개 feature branch를 rebase해야 하면 원본 SHA를 기록하고 `--force-with-lease`만 사용한다.
7. 최신화 후 검증·리뷰·CI 루프로 돌아간다.

## 10. 완료 게이트

다음 조건을 모두 만족해야 완료로 판정한다.

- head SHA가 마지막 검증 SHA와 같다.
- 필수 checks가 모두 성공했다.
- unresolved actionable review thread가 없다.
- mergeable 상태이며 base 최신화가 끝났다.
- 관련 i18n·type 생성 PR이 merge됐다.
- 마지막 코드 변경 후 동일 조건의 final screenshot이 있다.
- **완료 보고 직전에 `check-pr-screenshot-storage.js`를 실행해 성공했다.** 이 스크립트 실행은 모드·작업 크기와 무관하게 생략할 수 없는 마지막 게이트다. UI 변경 여부를 스스로 판단해 건너뛰지 않는다 — 스크립트가 diff에서 자동 판정한다. 성공 출력 한 줄(`uiChange=`, `attachmentRequired=`, `attachment=` 포함)을 최종 handoff에 그대로 인용한다. 이 출력이 없는 완료 보고는 완료가 아니다.
- 위 스크립트 기준으로 PR 증빙용 스크린샷이 base 이후 Git 히스토리에 없고, PR 본문 또는 댓글에는 GitHub `user-attachments` URL(웹 세션 없으면 `ytw418/pr-assets` raw URL fallback)로 첨부됐다.
- `deep` 장기 실행이나 직전에 상태가 변한 CI·리뷰가 있으면 같은 SHA에서 30초 이상 간격의 두 번의 조회가 모두 clean이다. 일반 `fast`·`standard`는 마지막 단일 clean 조회로 충분하다.

게이트를 통과해도 feature PR은 머지하지 않는다. 스크린샷과 결과를 PR에 남기고 사용자가 확인해 머지할 수 있도록 URL과 상태를 전달한다.

## 11. deep 시간 예산 종료

1. 마감 10분 전 새 대규모 수정을 시작하지 않는다.
2. 실행 중인 안전한 검증을 마무리하고 worktree를 일관된 상태로 둔다.
3. 완료 게이트를 못 채웠으면 남은 실패, 마지막 clean SHA, 실행 중인 checks, 다음 행동을 남긴다.
4. 사용자가 자리를 비운 동안 질문이 필요한 제품 결정이 생기면 가능한 다른 검증을 계속하고 그 결정만 차단 항목으로 남긴다.

## 12. 최종 handoff

다음을 보고하고 feature PR은 열린 상태로 둔다.

- feature PR과 자동 merge한 생성 PR URL
- 최종 head SHA
- 실행한 검증과 리뷰 대응
- `check-pr-screenshot-storage.js` 성공 출력 한 줄
- Figma node, route, viewport, final screenshot 경로
- i18n·type Action 결과
- baseline·환경·외부 차단 사항
- `Ready to merge` 또는 남은 작업
