> **Audience:** This document is written for AI coding assistants
> working on BHSN GitHub repositories and the user's personal projects (브리디 등).

Its purpose is to give you enough structured context to:
- Understand the development workflow quickly
- Make changes safely following team conventions
- Use the correct entrypoints, dependencies, and project conventions

---

## 적용 범위 — 회사(BHSN) / 개인 (MANDATORY, 2026-10-18)

작업 전에 현재 저장소가 어느 쪽인지 먼저 판단한다.

- **회사(BHSN) 저장소**: `origin` 이 `github.com/bhsn-ai/*` 이거나 경로가 `~/Desktop/bhsn/` 아래(개인 저장소 `ytw418-agent-skills`·`nextneonews` 제외).
- **개인 저장소**: 그 밖의 전부. 예) `~/Desktop/pro/*`(브리디 `bredy_app`·`breeder_web`·`bredy-marketing` 등), `github.com/ytw418/*`, 저장소가 아닌 폴더.

| 섹션 | 회사 | 개인 |
|---|---|---|
| §0 보고 언어, §4 개발 지침(§4.5.1 포함), §8 모델 분업 | 적용 | 적용 |
| §1 Atlassian MCP·`/init-bhsn` 사전 점검 | 적용 | 하지 않는다 |
| §3 Jira 티켓 식별·`/jira-bhsn` | 적용 | 하지 않는다 — 티켓 없이 작업한다 |
| §5 Pre-commit gate | 적용 | 저장소 자체 규칙(AGENTS.md 등)을 따른다 |
| §6 `[XX-XXXX]` 커밋 접두사 | 적용 | 쓰지 않는다 — 저장소의 기존 커밋 형식(`git log`, 예: `feat(ads): …`)을 따른다 |
| §7 스킬 커밋 위치 | 팀 공용 스킬은 `bhsn-claude-code` | `ytw418-agent-skills` 에 커밋한다(`bhsn-claude-code` 는 archived) |
| §9 브라우저 자동화 | 회사 자동화 크롬(9224) | 브리디 자동화 크롬(9222) |

개인 저장소에 BHSN 규칙(티켓 요구, 회사 Confluence 문서화, 회사 Slack 공지 등)을 끌어오지 않고, 회사 저장소에 브리디 규칙을 끌어오지 않는다. 저장소의 CLAUDE.md·AGENTS.md 가 이 표와 다르면 저장소 규칙이 우선한다.

---

## 0. 보고 언어 (MANDATORY)

사용자에게 보내는 모든 글(중간 보고·최종 보고·질문·설명)은 **한국어**로 쓴다. 코드·명령어·파일 경로·고유명사·에러 원문만 원문 그대로 둔다.

- 2026-10-18 로봇천국 카페 작업에서 보고를 영어로 써서 사용자가 읽지 못했다. 이 규칙은 훅으로도 강제된다.
- `~/.claude/settings.json` 의 `"language": "korean"` + `~/.claude/hooks/korean-report.py`(UserPromptSubmit 리마인더, 영어 보고면 Stop 훅이 막고 다시 쓰게 함).

---

## 1. Prerequisites (Initial Setup)

이 문서는 초기 환경 셋업(Atlassian MCP, GitHub CLI, Perplexity MCP)이 **완료된 상태**를 전제합니다.

Atlassian MCP 또는 GitHub CLI가 동작하지 않으면, **`/init-bhsn` 스킬을 실행하여 환경을 셋업**하세요.

필수 도구:
- **Atlassian MCP** — Jira/Confluence 연동 (`jira_get_user_profile` 호출로 확인)
- **GitHub CLI** — `gh auth status` 로 확인
- **Perplexity MCP** — 웹 검색 (`mcp__perplexity__perplexity_search_web` 호출로 확인). 이미 설정되어 있어야 함.

### 웹 검색 (Perplexity MCP)

외부 정보가 필요한 경우 (라이브러리 문서, API 레퍼런스, 최신 릴리스 정보, 에러 해결 방법 등) **Perplexity MCP를 사용하여 웹 검색**을 수행한다.

- **MCP 도구:** `mcp__perplexity__perplexity_search_web`
- **사용 시점:** 코드베이스만으로 해결할 수 없는 외부 정보가 필요할 때
- **예시:** 라이브러리 최신 버전 확인, API 문서 조회, 에러 메시지 검색, 기술 스택 비교

> 웹 검색 결과를 참고할 때는 출처를 함께 안내한다.

---

## 2. CLAUDE.md 계층 구조 (Multi-Level Configuration)

이 문서는 **글로벌 워크스페이스 가이드라인** (`~/.claude/CLAUDE.md`)입니다.
Claude Code는 작업 시 **여러 레벨의 CLAUDE.md를 동시에 참조**합니다:

```
~/.claude/CLAUDE.md          ← 글로벌 (이 파일): 모든 레포에 공통 적용
<repo-root>/CLAUDE.md        ← 레포별: 해당 레포에만 적용되는 규칙
<repo-root>/subdir/CLAUDE.md ← 디렉토리별: 특정 하위 경로에만 적용 (선택)
```

---

## 3. Jira 연동 → `/jira-bhsn` 스킬 사용

BHSN은 모든 작업을 **Jira 티켓 기반**으로 관리한다.

사용자가 티켓 번호(e.g. `BA-2031`, `AT-150`)를 언급하거나, 브랜치명에 티켓 코드가 포함되어 있으면 **`/jira-bhsn` 스킬을 사용**하여 전체 워크플로우를 따른다.

`/jira-bhsn` 스킬이 담당하는 영역:
- 티켓 식별/조회/생성
- 스프린트 컨텍스트 조회
- 브랜치 생성 (`git branch`로 기존 브랜치 네이밍 컨벤션 참고)
- 작업 중 티켓 상태 업데이트
- Draft PR 생성 → Ready for review
- 완료 후 문서화 (Confluence)

> **(회사 저장소) 코드를 작성하기 전에 반드시 Jira 티켓을 식별해야 한다.** 티켓 없이 작업을 진행하지 않는다. 개인 저장소에는 적용하지 않는다(맨 위 '적용 범위').

---

## 4. Development Guidelines

When making changes in any BHSN repository:

### 4.1. Respect Existing Patterns

- Follow folder-level conventions established in the repository.
- Reuse existing abstract base classes, factories, and utilities.
- Read the project's own `README.md` or architecture documentation before making structural changes.

### 4.2. Type Safety & Validation

- Use pydantic models (or the project's chosen schema library) for request/response schemas.
- Avoid raw `dict`/`Any` where structured models exist.

### 4.3. Configuration

- Do not hard-code secrets or environment-specific values.
- Read configuration via the project's established config module (e.g. environment variables, config files).

### 4.4. Logging & Errors

- Use the project's logging module — avoid `print()` statements.
- Follow established error handling patterns.

### 4.5. Tests (TDD — Test-Driven Development)

프로젝트에 테스트 환경이 구성되어 있는 경우(e.g. `tests/` 디렉토리, `pytest`, `jest` 등이 존재), **test-first** 워크플로우를 권장한다:

1.  **Write a failing test first** — 기능 구현이나 버그 수정 전에 기대 동작을 검증하는 테스트를 작성하고, **실패(red)** 를 확인한다.
2.  **Implement the minimal code** to make the test pass (green).
3.  **Refactor** if needed while keeping all tests green.

Additional rules:
- Add unit tests mirroring the source path.
- Tests must be self-contained — use mocks/patches for external dependencies.
- 커밋 전 테스트 실행이 가능한 프로젝트라면, 전체 테스트 스위트를 실행하여 통과를 확인한다.

> **Note:** 테스트 환경이 없는 프로젝트(Makefile에 `test` 타겟이 없거나, 테스트 디렉토리가 없는 경우)에서는 TDD를 강제하지 않는다. 해당 프로젝트의 관행을 따른다.

#### 4.5.1. 테스트를 늘리지 않는다 (개인 규칙 — 레포의 TDD 규칙보다 우선)

테스트가 많으면 읽기 어렵고 유지 비용만 커진다. 레포 규칙이 "수정 전 테스트 먼저 작성"이라고 해도 아래 기준으로 판단한다.

- **쓰는 경우:** 분기·상태 전이가 있는 로직, 사용자 흐름, 버그 수정(재발 방지용 1개)
- **쓰지 않는 경우:** 문구·스타일·마크업 변경, 상수·타입, 단순 prop 전달, 구현 세부(호출 횟수·내부 state·className), 라이브러리·BE 동작 재확인
- 수정 전에는 **기존 테스트를 돌려** 현재 동작을 고정한다. 그 동작을 확인하는 기존 테스트가 없을 때만 새로 쓴다.
- 새 파일·새 케이스를 추가하기 전에 기존 케이스를 고쳐서 해결할 수 있는지 먼저 본다.
- 동작이 바뀌어 의미가 없어진 테스트는 같은 변경에서 지운다.
- 추가하는 케이스는 핵심 시나리오만 최소로 쓴다. 같은 동작을 입력만 바꿔 여러 번 확인하지 않는다.
- 테스트를 추가·생략했으면 보고할 때 이유를 한 줄로 밝힌다.

### 4.6. Code Style

- Follow the project's linting and formatting tools (e.g. `ruff`, `eslint`, `prettier`).
- 프로젝트에 스타일 검사 도구가 있으면 커밋 전 실행을 권장한다:
  ```bash
  make style   # or the project's equivalent
  ```

---

## 5. Pre-Commit Gate

커밋 전에 프로젝트의 스타일 검사와 테스트를 실행하는 것을 권장한다.

**먼저 프로젝트 환경을 확인한다:**
1. `Makefile`이 존재하는지, `style`/`test` 타겟이 있는지 확인한다.
2. 또는 `package.json`의 `lint`/`test` 스크립트 등 프로젝트별 동등한 명령을 확인한다.
3. 해당 명령이 존재하면 커밋 전에 실행한다:

```bash
# 예시 (프로젝트에 맞는 명령을 사용)
make style && make test
```

- `make style` — auto-formats code and checks for lint errors.
- `make test` — runs the full test suite.

실패 시 문제를 해결하고 재실행한 뒤 커밋한다. 개발 중에는 관련 테스트만 실행하되, 최종 커밋 전에는 전체 스위트 실행을 권장한다.

> **Note:** 프로젝트에 `Makefile`이나 스타일/테스트 명령이 없는 경우, 이 단계는 생략한다. 프로젝트의 기존 관행을 따른다.

---

## 6. Commit Message Format (MANDATORY)

**회사(BHSN) 저장소에만 적용한다.** 개인 저장소는 그 저장소의 기존 커밋 형식을 따른다(맨 위 '적용 범위').

Every commit message **MUST** start with the Jira ticket code in brackets.

### Format

```
[XX-XXXX] Short imperative description of the change
```

### Rules

1.  **Extract the ticket code** from the branch name (e.g. `feat/BA-2016-restrict-num-search-queries` → `BA-2016`) or from the user's instructions.
2.  The ticket code prefix is **not optional** — never create a commit without it.
3.  Use imperative mood (e.g. "Add", "Fix", "Refactor", not "Added", "Fixes", "Refactoring").
4.  Keep the subject line under 72 characters.

### Examples

```
[BA-2031] Send file parse failure details as separate INTERRUPT field
[AT-150] Add retry logic to HTTP client
[BA-1999] Fix null pointer when no files uploaded
[AT-45] Refactor logging module for structured output
```

### Bad examples (DO NOT use)

```
fix: handle file parse error          # Missing ticket code
Updated the search node                # Missing ticket code, past tense
[BA-2031]                              # No description
```

---

## 7. 반복 작업의 스킬화 (Skill Creation)

작업 완료 후, 해당 작업이 **추후 반복될 가능성**이 있다고 판단되면 사용자에게 스킬화를 제안한다.

### 판단 기준

다음 중 하나 이상에 해당하면 스킬화 대상이다:
- 여러 단계로 구성된 워크플로우 (예: 특정 타입의 API 엔드포인트 추가, DB 마이그레이션 절차)
- 프로젝트/팀 고유의 패턴이 있는 작업 (예: 특정 코드 구조에 따른 모듈 생성)
- 동일한 작업을 다른 대상에 반복 적용할 가능성 (예: 다국어 지원 추가, 테스트 픽스처 생성)
- 외부 시스템 연동이 포함된 정형화된 절차 (예: 배포, 모니터링 설정)

### 제안 방법

작업 완료 후 사용자에게 다음과 같이 안내한다:

```
이 작업은 추후 반복될 수 있어 보입니다.
`/skill-creator` 를 사용하여 스킬로 만들어 두면,
다음번에는 한 번의 명령으로 동일한 작업을 수행할 수 있습니다.

스킬로 만들까요?
```

### 스킬 생성 후 커밋 (MANDATORY)

> **개인 스킬(브리디 등)과 새 스킬은 `~/Desktop/bhsn/ytw418-agent-skills` 의 `skills/` 에 커밋한다.** `bhsn-claude-code` 는 archived(read-only)라 푸시가 안 된다. 아래는 팀 공용 스킬을 BHSN 레포에 올릴 때의 옛 절차다.

스킬이 생성되면 **`bhsn-claude-code` 레포에 커밋해야 한다.** `~/.claude/skills/`는 `bhsn-claude-code` 레포의 `skills/` 폴더에 대한 심볼릭 링크이므로, 스킬을 생성하거나 수정하면 해당 레포의 로컬 작업 내역에 자동으로 반영된다.

스킬 생성 완료 후 `bhsn-claude-code` 레포에서 커밋 & 푸시한다:

```bash
cd some/path/to/bhsn-claude-code

# 기존 브랜치 네이밍 컨벤션을 확인하여 유사하게 생성
git branch          # 로컬 브랜치 목록으로 네이밍 패턴 참고
git checkout -b <convention에 맞는 브랜치명>

git add skills/<new-skill-name>
git commit -m "Add <new-skill-name> skill"
git push origin <current branch name>
```

다른 팀원은 `bhsn-claude-code` 레포를 pull 하면 자동으로 적용된다.

> **주의:** 스킬 제안은 강제가 아니라 권유이다. 사용자가 거부하면 그대로 넘어간다.

---

## 8. 모델 분업 · 토큰 절약

기본 모델은 Opus다(`~/.claude/settings.json`의 `model`). Fable은 주간 한도가 따로 있고 가장 빨리 차므로 설계 판단에만 쓴다. 도구를 한 번 쓸 때마다 그때까지의 대화 전체가 다시 읽히므로, 메인 대화에 쌓이는 양과 왕복 횟수가 곧 비용이다.

### 버그 수정은 Opus가 하고, 판단이 막히면 Fable을 부른다

- 기본은 메인(Opus)이 원인 분석부터 수정·테스트까지 한다.
- 아래처럼 판단이 막히면 그 판단만 `Agent`를 `model: "fable"`로 불러 맡긴다.
  - 원인 가설이 둘 이상인데 실데이터·테스트로도 갈리지 않을 때
  - 원인이 여러 모듈에 걸쳐 어디를 고쳐야 할지 판단이 어려울 때
  - 수정이 공통 컴포넌트·API 계약·데이터 흐름을 바꿔야 할 때
- 부를 때는 처음부터 다시 조사시키지 않는다. 지금까지 확인한 사실·배제한 가설·관련 파일 경로를 넘기고 질문을 좁힌다(예: "A와 B 중 무엇이 원인인지 근거와 함께"). 결과를 기다리고(`run_in_background`로 보내지 않는다), 기다리는 동안 같은 조사를 하지 않으며, 받은 판단을 처음부터 다시 검증하지 않는다.
- 세션 모델이 Fable이면 직접 한다.
- 원인 가설은 코드만 읽고 확정하지 않는다. 판별 기준으로 쓸 값(상태 코드, 플래그 등)이 실제로 어떻게 내려오는지 dev API 응답이나 기존 테스트 픽스처로 확인한 뒤 고친다.

### Fable 설계 위임은 구현이 큰 기능 작업에만

- 메인이 Opus이고, 구현이 큰 기능 작업(여러 파일·모듈에 걸친 신규 기능, 공통 컴포넌트·API 계약 변경)일 때만 `Agent`를 `model: "fable"`로 불러 **설계만** 받는다.
- 넘길 것: 이미 확인한 사실, 관련 파일 경로. 받을 것: 바꿀 파일·함수와 이유, 검증할 테스트. 코드 수정은 시키지 않는다.
- 설계를 맡기면 결과를 기다린다(`run_in_background`로 보내지 않는다). 기다리는 동안 같은 조사를 메인이 하지 않고, 받은 설계를 처음부터 다시 검증하지 않는다 — 구현하다 어긋나는 지점만 확인한다.
- 구현·테스트·리뷰 대응·PR은 메인이 직접 한다.
- 사용자가 세션 모델로 Fable을 직접 고른 경우에는 설계를 직접 한다(Fable 서브에이전트를 또 부르지 않는다).

### 찾기·읽기는 싼 모델에 맡긴다

- 위치를 모르는 채로 파일 3개 이상을 훑어야 하면(Read든 터미널 grep·cat·sed든 마찬가지다) 직접 읽지 말고 `Agent(subagent_type: "Explore", model: "haiku")`에 질문 하나로 맡겨 결론(파일 경로·라인·요지)만 받는다. 판단이 필요한 조사면 `model: "sonnet"`.
- 위치를 이미 아는 파일 1~2개는 직접 읽는다 — 위임 왕복이 더 비싸다.
- 서브에이전트를 부를 때 `model`을 비워 두지 않는다. 비우면 메인 모델(Fable일 수도 있다)을 그대로 물려받는다.
- 요청 범위를 벗어난 탐색(관련 없는 리팩터링 후보 찾기, 저장소 전체 훑기)은 하지 않는다.

---

## 9. 브라우저 자동화 (2026-10-18, 사용자 결정)

운영 계정(SNS·네이버·구글 등)으로 하는 브라우저 작업은 **'브리디 자동화 크롬' 하나**에서만 한다. 상세·예외는 `~/Desktop/pro/bredy-marketing/docs/browser-automation.md`.

- 평소 크롬과 별개 프로필(`~/.bredy-chrome`), CDP `127.0.0.1:9222`. 켜기: `~/.local/bin/bredy-chrome`(맥 로그인 때 자동).
- 새 브라우저를 띄우지 말고 붙는다: 셸 `source …/bredy-marketing/scripts/bpw.sh <사이트>`, 파이썬 `bpw.start()`, 노드 `bchrome.mjs withTab()`. 작업마다 **자기 탭**을 열고 닫는다 — `tab-select`·탭 번호 금지.
- 같은 사이트는 한 번에 한 작업(사이트 잠금), 다른 사이트끼리는 병렬. 프로필 복사 금지. 로그인이 풀리면 사용자에게 알리고 로그인 탭을 열어 둔다.
- 예외: 두 계정 양방향 테스트(채팅 등)는 Playwright 일회용 격리 컨텍스트 2개(테스트 계정)·에뮬레이터 2대 / 같은 사이트 두 번째 운영 계정은 자동화 크롬 2호(`~/.bredy-chrome-2`, 9223) / 개인 계정 콘솔은 사용자가 "내 크롬에서"라고 할 때만 사용자 크롬 / Paseo 브라우저는 보기용.

### 회사(BHSN) 자동화 크롬 (2026-10-18, 사용자 결정)

회사 저장소 작업의 브라우저 일(allibee dev·demo 확인, Jira·Confluence·Slack 웹, 회사 구글 계정)은 **'회사 자동화 크롬' 하나**에서만 한다. 세션마다 새 브라우저를 띄워 로그인을 다시 하게 만들지 않는다.

- 프로필 `~/.bhsn-chrome`, CDP `127.0.0.1:9224`. 켜기: `~/.local/bin/bhsn-chrome`(맥 로그인 때 자동, LaunchAgent `com.bhsn.automation-chrome`).
- 붙기: 셸 `source ~/.local/bin/bhsn-pw.sh <사이트>; trap hpw_end EXIT` 뒤 `hpw <playwright-cli 명령…>`. 자기 탭을 열고 닫으며 같은 사이트는 잠금(`/tmp/bhsn-chrome-locks`)으로 차례대로 돈다. 다른 도구는 `--cdp http://127.0.0.1:9224` 로 붙는다. `tab-select`·탭 번호 금지.
- 브리디 자동화 크롬(9222)과 섞지 않는다 — 회사 계정은 9224, 브리디·개인 운영 계정은 9222. 로그인(SSO·비밀번호)은 사용자가 직접 하고, 풀려 있으면 알리고 로그인 탭을 열어 둔다.

## 11. 개인 할 일 목록 (2026-10-18, 사용자 결정)

사용자가 **직접** 해야 하는 일(결제·본인 인증·개인정보·서명·사용자 결정·폰에서 할 일)을 남기면, 보고와 함께 `~/Desktop/pro/personal-todo/todo.md` '할 일' 절에 한 줄 추가한다(형식은 그 파일 머리말). 사용자가 "○○ 했어"라고 하면 해당 항목을 '완료' 절로 옮긴다. 매일 08:00 KST Paseo 일정 '개인 할 일 아침 브리핑'이 이 목록과 지난 세션을 훑어 브리핑한다(절차 `~/Desktop/pro/personal-todo/CLAUDE.md`). 회사·개인 저장소 모두 적용한다.

## 10. Quick Reference

If you are an AI coding assistant:
- **회사/개인 먼저 판단** — `bhsn-ai` 저장소만 Jira·`[XX-XXXX]`·`/init-bhsn` 을 적용하고, 개인 저장소(`~/Desktop/pro/*`, `ytw418/*`)는 저장소 자체 규칙을 따른다(맨 위 '적용 범위').
- **브라우저** — 회사 작업은 회사 자동화 크롬(9224, `bhsn-pw.sh`), 브리디·운영 계정은 브리디 자동화 크롬(9222)에 붙는다. 새 브라우저를 띄우지 않는다(§9).
- **보고는 한국어** — 사용자에게 보내는 모든 글은 한국어로 쓴다(§0). 코드·명령어·경로만 원문.
- **Check prerequisites first** — Atlassian MCP 또는 GitHub CLI가 동작하지 않으면 `/init-bhsn` 스킬을 실행하세요.
- **웹 검색** — 외부 정보가 필요하면 `mcp__perplexity__perplexity_search_web`을 사용하세요.
- **Jira 워크플로우** — 티켓 번호(BA-XXXX, AT-XXXX)가 주어지면 `/jira-bhsn` 스킬을 사용하세요.
- **브랜치 생성** — `git branch`로 기존 로컬 브랜치 네이밍 컨벤션을 확인하고, 유사한 패턴으로 생성한다.
- **TDD** — 프로젝트에 테스트 환경이 있으면 test-first를 권장. 없으면 프로젝트 관행을 따른다. 테스트는 §4.5.1 기준으로 최소한만 추가한다.
- **Pre-commit gate** — 프로젝트에 `make style`/`make test` (또는 동등한 명령)이 있으면 커밋 전 실행을 권장한다.
- **(회사 저장소) Prefix every commit message** with `[XX-XXXX]`.
- **반복 가능한 작업** — 작업 완료 후 반복 가능성이 있으면 `/skill-creator`로 스킬화를 제안하고, 생성된 스킬은 반드시 커밋한다.
- **모델 분업** — 기본 Opus. 버그 수정은 Opus가 하고 판단이 막히면 그 판단만 Fable에(결과를 기다린다), Fable 설계 위임은 구현이 큰 기능 작업에만(결과를 기다린다). 파일 3개 이상 훑기는 `Explore`(haiku/sonnet). 서브에이전트 `model`은 항상 명시한다.
