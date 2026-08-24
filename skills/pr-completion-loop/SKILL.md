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

작업 크기와 사용자의 시간 예산으로 모드를 고른다.

- `fast`: 한두 파일, 명확한 수정, 짧은 검증. 병렬화 준비 비용이 더 크므로 루트 에이전트가 바로 끝낸다.
- `standard`: 코드 리뷰, 테스트, 브라우저 검증 중 둘 이상이 필요하다. 독립 검증을 병렬 실행한다.
- `deadline`: 사용자가 2시간·3시간처럼 종료 시각이나 작업 시간을 정했다. 마감 전까지 루프를 지속하고 마지막 10분은 상태 정리와 안전한 handoff에 사용한다.

시간 예산은 작업 범위를 넓히는 권한이 아니다. 단순 작업을 예산만큼 늘리지 말고 게이트가 충족되면 즉시 종료한다.

## 1. 대상과 권한 고정

1. 저장소, PR 번호, base, head, 현재 head SHA, 브랜치와 worktree를 기록한다.
2. dirty worktree의 사용자 변경을 보존하고 PR 대상이 아닌 파일은 건드리지 않는다.
3. 사용자가 PR 생성만 요청했다면 `pr-workflow`까지만 수행하고 이 루프를 시작하지 않는다.
4. shared base(`develop`, `cueAi`, `stage`, `main`)는 리베이스하거나 force push하지 않는다.
5. 우리가 만든 feature PR에는 `gh pr merge`, auto-merge 활성화, merge queue 등록을 실행하지 않는다. 사용자가 나중에 feature PR 머지를 요청해도 이 스킬에서는 사용자가 직접 머지하도록 안내한다. Draft 해제도 사용자 요청이 있을 때만 한다.
6. 자동 merge 대상은 이번 루프가 실행한 i18n·type 생성 PR로 제한한다.

## 2. 병렬 역할 분리

`standard`와 `deadline`에서만 병렬화한다.

- 루트 에이전트: 계획, git write, 커밋, push, PR 코멘트, 최종 판정
- Codex 검증자: 테스트·정적 분석·변경 영향 검토
- Claude 검증자: 독립 코드 리뷰·제품 흐름·누락 시나리오 검토
- 브라우저 검증자: 실제 Chrome·Figma·스크린샷 검증

Codex와 Claude 런타임이 모두 연결되어 있으면 복잡 작업에서 각각 최소 한 번 독립 검토를 받는다. 한쪽이 없으면 가능한 검증자로 계속 진행하고 사용할 수 없었다고 보고한다. 사용하지 않은 에이전트를 사용했다고 주장하지 않는다.

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
3. 커밋·push 후 Draft PR을 만들고 변경 앱의 preview 댓글만 등록한다.
4. 원격 head SHA를 다시 조회한다. 이후 모든 검증 결과에 SHA를 연결한다.
5. 정적 검사, 관련 단위 테스트, 앱 빌드 또는 타입 검사를 실행한다. baseline 실패와 변경으로 생긴 실패를 분리한다.
6. UI 변경이면 실제 Chrome의 인증된 route에서 상호작용과 스크린샷을 검증한다.

## 4. 브라우저·Figma 판정

1. 정확한 Figma node, route, viewport, data state를 고정한다.
2. 실제 Chrome을 우선 사용해 reference와 actual을 비교한다.
3. raw i18n key가 보이면 Dev Tools의 `실시간 시트 연동`을 켜고 같은 상태를 재검증한다.
   - 정상 문구가 나오면 구현은 통과시키고 생성 locale 미반영으로 분류한다.
   - 시트 연동 후에도 잘못되면 구현 실패로 분류해 수정한다.
4. 구현 수정 후 같은 조건으로 final screenshot을 새로 만든다.
5. Figma node나 데이터가 없으면 `BLOCKED_SPEC` 또는 `BLOCKED_DATA`로 기록하고 추측으로 통과시키지 않는다.

## 5. 검증-수정 루프

head SHA가 바뀔 때마다 다음을 반복한다.

1. 로컬 검증을 실행한다.
2. 실패를 `CHANGE`, `BASELINE`, `ENVIRONMENT`, `EXTERNAL`로 분류한다.
3. `CHANGE`만 최소 범위로 수정하고 회귀 테스트를 보강한다.
4. diff를 다시 리뷰하고 커밋·push한다.
5. 새 SHA에서 로컬·브라우저 검증을 다시 수행한다.

같은 원인의 수정이 세 번 연속 실패하면 무한 반복하지 말고 로그, 시도, 필요한 외부 결정을 정리해 차단 상태로 보고한다.

## 6. 리뷰와 CI 대응 루프

1. review, unresolved thread, issue comment, PR check를 모두 조회한다.
2. 코드 결함·테스트 누락·보안 문제는 수정한다.
3. 질문에는 근거를 들어 한국어로 답변한다.
4. 자동 생성 안내·중복·이미 해결된 코멘트는 근거를 남기고 resolve 가능한 thread만 resolve한다.
5. 제품 결정이나 외부 시스템이 필요하면 임의로 결정하지 않는다.
6. Actions 실패는 로그의 최초 실제 오류를 찾아 같은 PR 범위에서 수정한다. 외부 CI는 URL과 상태만 기록한다.
7. push 후 모든 검증을 새 SHA에서 반복한다.
8. checks가 진행 중이면 약 30초 간격으로 poll하고 60초 이내에 사용자에게 상태를 갱신한다.

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
- 같은 SHA에서 30초 이상 간격의 두 번의 조회가 모두 clean이다.

게이트를 통과해도 feature PR은 머지하지 않는다. 스크린샷과 결과를 PR에 남기고 사용자가 확인해 머지할 수 있도록 URL과 상태를 전달한다.

## 11. deadline 종료

1. 마감 10분 전 새 대규모 수정을 시작하지 않는다.
2. 실행 중인 안전한 검증을 마무리하고 worktree를 일관된 상태로 둔다.
3. 완료 게이트를 못 채웠으면 남은 실패, 마지막 clean SHA, 실행 중인 checks, 다음 행동을 남긴다.
4. 사용자가 자리를 비운 동안 질문이 필요한 제품 결정이 생기면 가능한 다른 검증을 계속하고 그 결정만 차단 항목으로 남긴다.

## 12. 최종 handoff

다음을 보고하고 feature PR은 열린 상태로 둔다.

- feature PR과 자동 merge한 생성 PR URL
- 최종 head SHA
- 실행한 검증과 리뷰 대응
- Figma node, route, viewport, final screenshot 경로
- i18n·type Action 결과
- baseline·환경·외부 차단 사항
- `Ready to merge` 또는 남은 작업
