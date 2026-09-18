> **Audience:** This document is written for AI coding assistants
> working on BHSN GitHub repositories.

Its purpose is to give you enough structured context to:
- Understand the development workflow quickly
- Make changes safely following team conventions
- Use the correct entrypoints, dependencies, and project conventions

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

> **코드를 작성하기 전에 반드시 Jira 티켓을 식별해야 한다.** 티켓 없이 작업을 진행하지 않는다.

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

### 설계만 Fable에 맡긴다

- 메인이 Opus일 때 아래 경우에만 `Agent`를 `model: "fable"`로 불러 **설계만** 받는다.
  - 원인이 확정되지 않은 버그의 원인 분석
  - 여러 모듈·앱에 걸친 구조 결정, 공통 컴포넌트·API 계약 변경
- 넘길 것: 이미 확인한 사실, 관련 파일 경로. 받을 것: 원인, 바꿀 파일·함수와 이유, 검증할 테스트. 코드 수정은 시키지 않는다.
- 구현·테스트·리뷰 대응·PR은 메인이 직접 한다.
- 문구·스타일·피그마 정합, 원인이 이미 확정된 수정, 반복 작업에는 Fable을 부르지 않는다.
- 사용자가 세션 모델로 Fable을 직접 고른 경우에는 설계를 직접 한다(Fable 서브에이전트를 또 부르지 않는다).

### 찾기·읽기는 싼 모델에 맡긴다

- 파일 위치 찾기, 코드베이스 훑기, 긴 문서·로그 읽기처럼 결론만 필요한 일은 `Agent(subagent_type: "Explore", model: "haiku")`로, 판단이 좀 필요하면 `model: "sonnet"`으로 넘기고 요약만 받는다. 원문을 메인 대화에 쌓지 않는다.
- 이미 아는 파일의 특정 부분은 직접 읽는다 — 위임 왕복이 더 비싸다.
- 서브에이전트를 부를 때 `model`을 비워 두지 않는다. 비우면 메인 모델(Fable일 수도 있다)을 그대로 물려받는다.
- 요청 범위를 벗어난 탐색(관련 없는 리팩터링 후보 찾기, 저장소 전체 훑기)은 하지 않는다.

---

## 9. Quick Reference

If you are an AI coding assistant:
- **Check prerequisites first** — Atlassian MCP 또는 GitHub CLI가 동작하지 않으면 `/init-bhsn` 스킬을 실행하세요.
- **웹 검색** — 외부 정보가 필요하면 `mcp__perplexity__perplexity_search_web`을 사용하세요.
- **Jira 워크플로우** — 티켓 번호(BA-XXXX, AT-XXXX)가 주어지면 `/jira-bhsn` 스킬을 사용하세요.
- **브랜치 생성** — `git branch`로 기존 로컬 브랜치 네이밍 컨벤션을 확인하고, 유사한 패턴으로 생성한다.
- **TDD** — 프로젝트에 테스트 환경이 있으면 test-first를 권장. 없으면 프로젝트 관행을 따른다.
- **Pre-commit gate** — 프로젝트에 `make style`/`make test` (또는 동등한 명령)이 있으면 커밋 전 실행을 권장한다.
- **Prefix every commit message** with `[XX-XXXX]`.
- **반복 가능한 작업** — 작업 완료 후 반복 가능성이 있으면 `/skill-creator`로 스킬화를 제안하고, 생성된 스킬은 반드시 커밋한다.
- **모델 분업** — 기본 Opus. 설계만 `Agent(model: "fable")`, 찾기·읽기는 `Explore`(haiku/sonnet). 서브에이전트 `model`은 항상 명시한다.
