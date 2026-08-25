# Verification optimization

새 head SHA가 생겼다는 이유만으로 전체 검증을 반복하지 않는다. 변경 경로가 영향을 주는 게이트만 실행하고, 같은 조건에서 이미 통과한 게이트는 worktree 로컬 캐시를 재사용한다.

## 변경 경로별 기본 게이트

| 변경 경로 | 무효화할 게이트 |
| --- | --- |
| `apps/**/src/**/*.{svelte,tsx,jsx,css,scss}` | `focused-test`, `browser-scenario`, `screenshot` |
| `apps/**/src/**/*.{ts,js,mjs,cjs}` | `focused-test`, `static-check`, `browser-scenario` |
| `scripts/browser/**`, `**/e2e/**`, Playwright 설정 | `harness-test`, `playwright-capture` |
| `*.test.*`, `*.spec.*`, `__tests__/**` | `affected-test` |
| package·빌드·CI 설정 | `static-check` |
| Markdown·PR 본문·문서·스킬만 변경 | 앱 검증 없음 |

분류하기 어려운 실행 코드에는 `focused-test`와 `static-check`를 적용한다. 경로 분류는 최소 검증의 출발점이며, 호출 관계상 실제 영향이 더 크다는 근거가 있으면 필요한 게이트만 추가한다.

브라우저 하네스 변경은 격리된 Playwright 캡처를 무효화하지만, 앱 UI 코드가 그대로라면 실제 Chrome 최종 증빙은 무효화하지 않는다. 앱 UI나 UI에 연결된 로직이 바뀌면 `browser-scenario`를 다시 수행하고, 시각 결과가 바뀔 수 있을 때만 `screenshot`을 갱신한다.

## 어서션 우선, 이미지 판정은 조건부

`browser-scenario`를 실행할 때 role·label·text·CSS 값 기반 `expect` 등 어서션으로 먼저 판정할 수 있으면 그것으로 게이트 결과를 확정한다. 어서션이 이미 pass/fail을 가렸으면 그 결과를 기록하고, 스크린샷은 최종 사용자 증빙 1장으로만 남긴다 — 매 recheck 라운드마다 새로 찍지 않는다.

시각적 비교가 필요해 `figma-browser-verification`을 호출했다면 해당 스킬의 `compare-visuals.sh`가 `comparison.txt`에 쓰는 `ssim_score`/`verdict`를 먼저 읽는다. recheck 라운드에서 `verdict=PASS_SKIP_IMAGES`면 side-by-side·overlay·diff 이미지를 열지 않는다. 최초 비교 라운드에는 이 게이트를 적용하지 않는다(작은 누락 요소가 전체 점수를 가릴 수 있음).

## 로컬 캐시 하네스

상태 파일은 기본적으로 `git rev-parse --git-path pr-completion-loop/verification-state.json`에 저장된다. linked worktree에서도 Git 내부 경로이므로 저장소에 커밋되지 않는다.

필요한 게이트를 계산한다.

```bash
node ~/.codex/skills/pr-completion-loop/scripts/verification-cache.js plan \
  --base origin/develop --head HEAD
```

게이트 실행 전에 캐시를 확인한다. `HIT` 또는 `SKIP`이면 종료 코드가 0이고, `MISS`이면 1이다.

```bash
node ~/.codex/skills/pr-completion-loop/scripts/verification-cache.js check \
  --base origin/develop \
  --gate focused-test \
  --command "npm run test:visual:cue" \
  --environment "cue-local"
```

실행 결과를 기록한다.

```bash
node ~/.codex/skills/pr-completion-loop/scripts/verification-cache.js record \
  --base origin/develop \
  --gate focused-test \
  --command "npm run test:visual:cue" \
  --environment "cue-local" \
  --status passed
```

`--command`에는 실제 실행 명령을 사용하되 자격 증명 값을 넣지 않는다. 브라우저 게이트는 route, viewport, 데이터 상태를 비밀값 없는 명령 인자나 `--environment` 식별자에 포함해 조건이 달라지면 cache miss가 되게 한다.

캐시 fingerprint에는 base SHA, 해당 게이트를 무효화하는 파일의 blob, 명령 hash, 환경 식별자 hash가 포함된다. 문서만 추가된 새 SHA는 기존 브라우저 결과를 재사용하지만 base 최신화, 관련 코드, 명령, 환경 조건 중 하나가 바뀌면 다시 검증한다.
