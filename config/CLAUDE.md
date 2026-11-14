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
- **코드 구조 질문은 graphify 그래프부터 (2026-11-03)**: 여러 파일에 걸친 흐름·관계를 찾을 때는 `graphify query "<질문>"`·`graphify explain "<이름>"`·`graphify path "A" "B"` 로 먼저 좁힌다. 그래프(`graphify-out/`, 전역 gitignore)가 없으면 `graphify update .` 로 만든다(코드만, LLM 없음, 수 초). 그래프가 있으면 PreToolUse 훅이 알려 준다. 고칠 파일 1~2개를 이미 알면 만들지 않는다. `/graphify` 스킬(문서·이미지 의미 추출)은 서브에이전트로 토큰을 많이 쓰니 사용자가 요청할 때만 쓴다.

---

## 9. 브라우저 자동화 (2026-10-18, 사용자 결정)

운영 계정(SNS·네이버·구글 등)으로 하는 브라우저 작업은 **'브리디 자동화 크롬' 하나**에서만 한다. 상세·예외는 `~/Desktop/pro/bredy-marketing/docs/browser-automation.md`.

- 평소 크롬과 별개 프로필(`~/.bredy-chrome`), CDP `127.0.0.1:9222`. 켜기: `~/.local/bin/bredy-chrome`(맥 로그인 때 자동).
- 새 브라우저를 띄우지 말고 붙는다: 셸 `source …/bredy-marketing/scripts/bpw.sh <사이트>`, 파이썬 `bpw.start()`, 노드 `bchrome.mjs withTab()`. 작업마다 **자기 탭**을 열고 닫는다 — `tab-select`·탭 번호 금지.
- 같은 사이트는 한 번에 한 작업(사이트 잠금), 다른 사이트끼리는 병렬. 프로필 복사 금지. 로그인이 풀리면 사용자에게 알리고 로그인 탭을 열어 둔다.
- 예외: 두 계정 양방향 테스트(채팅 등)는 Playwright 일회용 격리 컨텍스트 2개(테스트 계정)·에뮬레이터 2대 / 같은 사이트 두 번째 운영 계정은 자동화 크롬 2호(`~/.bredy-chrome-2`, 9223) / 개인 계정 콘솔은 사용자가 "내 크롬에서"라고 할 때만 사용자 크롬 / Paseo 브라우저는 보기용.

### 9.1 로그인·본인인증은 Claude 가 끝까지 (MANDATORY, 2026-11-13 사용자 결정)

"니가 내 개인정보 넣어서 간편인증 해라. 앞으로 따로 말 안 해도 항상 이렇게." (정부24 통신판매업 신고)

- 사용자에게 클릭·입력을 부탁하지 않는다. 이름·생년월일·휴대폰·주소·사업자 정보는 다시 묻지 말고 메모(`bredy-business-info` → bredy-private)에서 찾아 직접 넣는다.
- 간편인증(카카오·네이버·PASS 등)은 Claude 가 인증 수단 선택·칸 채우기·필수 동의·'인증 요청'까지 누르고, 사용자에게는 "폰에서 승인해 주세요"만 요청한 뒤 '인증 완료'도 Claude 가 누른다.
- 로그인은 자동화 크롬(9222) 프로필에 남겨 다음 작업에서 다시 쓴다.
- 비밀번호·인증번호(OTP·문자 코드)를 받아 로그인 칸에 입력하는 것만은 Claude 의 고정 보안 규칙이라 하지 않는다. 사용자가 직접 넣거나 비밀번호 관리자를 쓰게 하고, 이유를 한 줄로 말한다.
- 최종 제출·결제는 사용자가 그 일을 지시했을 때만 누른다.
- 훅 `~/.claude/hooks/browser-auth-rule.py`(UserPromptSubmit) 가 로그인·인증·신청 같은 말이 있는 프롬프트마다 이 규칙을 넣는다.

### 회사(BHSN) 자동화 크롬 (2026-10-18, 사용자 결정)

회사 저장소 작업의 브라우저 일(allibee dev·demo 확인, Jira·Confluence·Slack 웹, 회사 구글 계정)은 **'회사 자동화 크롬' 하나**에서만 한다. 세션마다 새 브라우저를 띄워 로그인을 다시 하게 만들지 않는다.

- 프로필 `~/.bhsn-chrome`, CDP `127.0.0.1:9224`. 켜기: `~/.local/bin/bhsn-chrome`(맥 로그인 때 자동, LaunchAgent `com.bhsn.automation-chrome`).
- 붙기: 셸 `source ~/.local/bin/bhsn-pw.sh <사이트>; trap hpw_end EXIT` 뒤 `hpw <playwright-cli 명령…>`. 자기 탭을 열고 닫으며 같은 사이트는 잠금(`/tmp/bhsn-chrome-locks`)으로 차례대로 돈다. 다른 도구는 `--cdp http://127.0.0.1:9224` 로 붙는다. `tab-select`·탭 번호 금지.
- 브리디 자동화 크롬(9222)과 섞지 않는다 — 회사 계정은 9224, 브리디·개인 운영 계정은 9222. 로그인(SSO·비밀번호)은 사용자가 직접 하고, 풀려 있으면 알리고 로그인 탭을 열어 둔다.
- Slack 웹은 읽기만 한다. 글쓰기·답장·반응·캔버스 수정은 Slack MCP 도구로만 하고, 보낼 곳과 글을 사용자가 승인 카드로 고른 뒤에만 보낸다. Claude가 썼다는 흔적은 남기지 않는다(2026-10-20, 훅 `~/.claude/hooks/slack-send-guard.py`가 막는다. 브라우저로 쓰는 것은 훅이 못 막는다). 개인 기록·브리핑은 회사 슬랙(본인 DM 포함)으로 보내지 않고 애플 메모로 올린다(`~/Desktop/pro/personal-todo/note_post.py`, 2026-10-22 사용자 결정 — 회사가 볼 수 있음).

## 11. 개인 할 일 목록 (2026-10-18, 사용자 결정)

사용자가 **직접** 해야 하는 일(결제·본인 인증·개인정보·서명·사용자 결정·폰에서 할 일)을 남기면, 보고와 함께 `~/Desktop/pro/personal-todo/todo.md` '할 일' 절에 한 줄 추가한다(형식은 그 파일 머리말). 사용자가 "○○ 했어"라고 하면 해당 항목을 '완료' 절로 옮긴다. 목록을 고치면 `python3 -I ~/Desktop/pro/personal-todo/sync_notes.py ~/Desktop/pro/personal-todo/briefing.md` 로 애플 메모 '📋 개인 할 일'(사용자가 보는 곳)도 갱신한다. 매일 08:00 KST Paseo 일정 '개인 할 일 아침 브리핑'이 이 목록과 지난 세션을 훑어 브리핑한다(절차 `~/Desktop/pro/personal-todo/CLAUDE.md`). 회사·개인 저장소 모두 적용한다.

## 12. 사용량 예산 (MANDATORY, 2026-10-21 사용자 결정, 2026-10-28 20%로 올림)

언니노트 기획 한 건에 주간 사용량 10% 이상을 썼다("너무 많이 쓴 거야"). **질문(명령) 하나에 주간 한도 20% 이하**로 쓴다(2026-10-28 사용자 "지금 너무 타이트하다" — 5%에서 20%로 올림. 처음 5%는 2026-10-21 "언니노트 기획 때의 절반까지" 기준). 회사·개인 저장소 모두 적용한다.

- **모델·사고 모드 권유**: 쉬운 작업(문구·설정 한 줄, 단순 조회, 정해진 절차 실행)이나 반복 작업이면 답변 첫 줄에 "이 작업은 `/model sonnet` 또는 `/effort low` 로 충분합니다"라고 알린다. 모델은 사용자가 바꾸는 것이라 알리고 그대로 진행한다.
- **반복 작업은 스크립트로**: 이미 해 본 작업(같은 명령 묶음·같은 조회·같은 변환)을 또 하게 되면 스크립트로 만들어 쓰거나(작으면 바로 만든다), 크면 "스크립트로 바꾸자"고 제안한다. 여러 단계 절차는 스킬화(§7)도 함께 제안한다.
- **큰 작업은 시작 전에 점검**: 기획·조사·여러 화면 구현처럼 20%를 넘길 것 같으면 시작 전에 범위·예상 사용량을 말하고 줄이는 방법(범위를 나눠 질문 여러 번, sonnet·low, 서브에이전트 haiku, 웹 검색 횟수 제한)을 제안해 고르게 한다.
- **훅이 강제한다**: `~/.claude/hooks/usage-budget.py`(UserPromptSubmit·PreToolUse). 질문 시작 뒤 쓴 토큰(서브에이전트 포함)을 주간 % 로 환산해 예산의 2/3 근처에서 점검하라고 알리고, 예산(`usage-budget.json` 의 `budget_pct`, 지금 20%)을 넘으면 도구 호출을 막는다. 막히면 우회하지 말고 ① 한 것 ② 남은 일 ③ 줄일 방법을 보고하고 멈춘다. 사용자가 프롬프트에 `예산 N%`(예: `계속 예산 10%`)를 쓰면 그 질문만 예산이 N%다.
- 환산 기준은 `~/.claude/hooks/usage-budget.json`(없으면 기본값: 1% = 가중 57만 토큰, 언니노트 기획 세션 기준)으로 고친다. 세션 재기: `python3 ~/.claude/hooks/usage-budget.py --measure <transcript.jsonl>`.
- **긴 세션은 compact (2026-11-03 사용자 요청)**: `~/.claude/settings.json` 의 `autoCompactWindow: 400000` 이 컨텍스트 약 40만 토큰 근처에서 자동으로 압축하고(2026-11-06 200000→400000: 압축 직후에도 기본 지침 등으로 약 10만 토큰이라 200000 이면 약 17만에서 두세 턴마다 압축돼 너무 느렸다), 100K 토큰이 넘는 세션을 오래 비웠다 돌아오면 idle compaction 이 압축한다(`CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS=100000`). Claude 는 `/compact` 를 직접 실행할 수 없으므로, 큰 작업 하나를 끝냈는데 대화가 길고 다음 요청이 다른 일이면 보고 끝에 `/compact <이어갈 핵심>`(이어서 할 때) 또는 `/clear`(새 일)를 권한다.
- **headroom 은 설치만 하고 꺼 둔다 (2026-11-03 실측)**: 상시 프록시로 31요청을 돌려 보니 절감은 전체 전송량의 0.23%, 요청마다 평균 0.4초 지연이 붙었다. 켜면 `/rc` 가 사라지고 프록시가 죽으면 모든 세션이 끊긴다. 사용자가 켜 달라고 할 때만 이 수치를 알린 뒤 `headroom deploy --no-docker --providers manual --target claude --scope provider --no-telemetry` 로 켠다(끄기 `headroom install remove`).

## 13. 운영 배포는 지시·허락이 있을 때만 (MANDATORY, 2026-10-25 사용자 결정)

"운영에 배포하는 건 내가 시킬 때만 하는 거야. 아니면 나한테 허락을 받거나." 2026-10-25 게시글 전체 화면 작업에서 지시 없이 앱 코드푸시와 웹 운영 릴리스(v1.48.0)를 내보냈다. 회사·개인 저장소 모두 적용한다.

- 운영 배포 = main(production) 대상 PR 머지·main 푸시, Vercel 운영 배포·재배포·승격·롤백, 앱 코드푸시(`ota:update`·`eas update`·롤백), 스토어 제출·운영 빌드, Play 출시·App Store 심사 제출, 운영 배포 워크플로 실행.
- 사용자가 **그 메시지에서** 배포를 직접 지시했을 때만 한다("배포해", "코드푸시해", "운영까지 반영"). 이전 메시지의 지시·"다 승인할게"는 다음 작업으로 이어지지 않는다. 아니면 dev·브랜치까지만 하고, 무엇을 운영에 낼지(포함 변경·버전·되돌리는 법)를 보여 주고 허락을 묻는다.
- 범위(2026-11-10 사용자 결정): 개인(브리디·언니노트)은 "배포해"만으로 prod 까지 낸다. 브리디는 "운영배포해"면 웹 운영 반영과 앱 코드푸시를 항상 함께 한다(2026-11-11 사용자 "운영 배포하라고하면 항상 코드푸쉬도 같이하는거야"). 회사(앨리비·큐)는 "demo 배포해"면 demo 까지만, prod 는 그 메시지에 "prod 배포해"처럼 prod·운영을 직접 써야 낸다. 회사 prod 를 내기 전에는 나갈 커밋의 티켓이 모두 QA 완료(`done`)인지 Jira 로 확인하고, 아닌 티켓이 섞여 있으면 올리지 않고 표로 보여 준다(deploy-allibee-frontend 스킬).
- 훅 `~/.claude/hooks/prod-deploy-guard.py`(UserPromptSubmit 이 그 메시지의 허락을 기록, PreToolUse 가 운영 배포 명령을 막음)가 강제한다. 막히면 우회하지 말고 허락을 받는다. 규칙을 바꾸면 `python3 ~/.claude/hooks/prod-deploy-guard_test.py` 를 돌린다.

## 14. 개발은 ponytail 스킬로 (MANDATORY, 2026-10-25 사용자 결정)

코드를 쓰거나 고치는 작업(기능·버그 수정·리팩터링)은 회사·개인 저장소 모두 **ponytail 플러그인 스킬**(`ponytail@ponytail`, DietrichGebert/ponytail)을 먼저 불러 그 지침대로 한다 — 기존 코드·표준 라이브러리·플랫폼 기본 기능을 먼저 쓰고 새 코드는 최소로.

## 15. 앨리비 작업 대상은 큐 + 리액트 MFE (MANDATORY, 2026-10-26 사용자 결정)

"이제 contract는 안 쓰고 리액트 프로젝트도 mfe 쪽만 쓴다." 2026-10-26 ALLIBEE-1411(Drag & Ask)을 `apps/contract` 의 business-agent 에 구현했다가 되돌렸다 — 사용자는 큐와 리액트 큐 작업을 시킨 것이었다.

- `allibee-frontend` 에서는 `apps/cue` 만 작업한다. `apps/contract`(business-agent 포함)는 사용자가 이름을 콕 집어 시키지 않으면 고치지 않는다.
- BA(Business agent·Agent) 화면 작업은 `allibee-frontend-react` 에서 한다. 큐 안에 뜨는 MFE 경로(`packages/allibee-react` 등 MFE 빌드에 들어가는 코드)만 대상이고, React 단독 앱 전용 화면은 손대지 않는다.
- 피그마·티켓에 앱 이름이 없으면 위 기준으로 정한다. contract 쪽 코드가 같은 기능을 갖고 있어도 따라 고치지 않는다.

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
- **사용량 예산** — 질문 하나 주간 20% 이하. 쉬운·반복 작업은 sonnet·`/effort low` 권유, 반복은 스크립트화, 훅이 넘으면 막는다(§12).
- **운영 배포** — 사용자가 그 메시지에서 지시했을 때만. 아니면 허락을 묻는다. 훅 prod-deploy-guard 가 막는다(§13).
- **모델 분업** — 기본 Opus. 버그 수정은 Opus가 하고 판단이 막히면 그 판단만 Fable에(결과를 기다린다), Fable 설계 위임은 구현이 큰 기능 작업에만(결과를 기다린다). 파일 3개 이상 훑기는 `Explore`(haiku/sonnet). 서브에이전트 `model`은 항상 명시한다.

## 로컬 CPU·메모리 보호 규칙 (MANDATORY — 2026-10-26, 모든 저장소)

배너 크기 변경 중 여러 저장소의 검증·개발 서버·Metro가 겹쳤고, 오래 남은 자동화 프로세스 약 7GB와 기존 에뮬레이터·보안 프로그램까지 더해 16GB Mac의 스왑 사용량이 약 25GB에 도달했다. 작은 UI 변경도 아래 규칙을 따른다. DB 안전 규칙은 항상 우선한다.

- **시작 전 확인**: 빌드·전체 테스트·typecheck·개발 서버·Metro·에뮬레이터를 시작하기 전에 `memory_pressure -Q`, `sysctl vm.swapusage`, `ps -axo pid,ppid,%cpu,rss,etime,comm -r | head -20`, 필요한 포트의 `lsof`를 확인한다. 기존 서버의 포트·작업 경로·소유 작업을 확인해 재사용한다. 작은 RSS만 보고 안전하다고 판단하지 않는다. 압축·스왑 메모리는 `top -l 1 -o mem -n 15 -stats pid,command,mem,cmprs`로 확인한다.
- **무거운 작업은 컴퓨터 전체에서 한 번에 하나**: 전체 테스트·전체 lint/typecheck·프로덕션 빌드·Next 첫 컴파일·Metro 번들링·네이티브 빌드를 동시에 실행하지 않는다. 서로 다른 저장소도 순서대로 한다. 도구가 session ID를 반환해도 완료된 것이 아니다. 그 프로세스가 끝난 것을 확인한 뒤 다음 무거운 작업을 시작한다. 독립적인 가벼운 읽기만 병렬로 허용한다. 앱·웹 동시 개발은 같은 세션에 둘 다 완성하라는 뜻이며 무거운 프로세스 동시 실행 허가가 아니다.
- **메모리 부족·렉이면 안 쓰는 것부터 끈다** (2026-10-29 사용자 결정 — 스왑·memory_pressure 숫자 기준은 없앴고, 측정은 참고용으로만 보고한다): 메모리가 부족하거나 사용자가 렉(버벅임)을 알리면 작업을 멈추지 말고, 지금 안 쓰는 에뮬레이터·브라우저(남은 탭·창, 끝난 Playwright·헤드리스 크롬)·개발 서버·Metro를 종료해 자원을 확보한 뒤 다시 측정하고 이어 간다. '안 쓰는'은 CPU가 거의 0이고 연결된 작업(개발 서버·테스트·adb 세션·자동화 연결)이 없는 것이다. 보안 프로그램, 사용자가 지금 보고 있는 앱, 다른 세션이 쓰는 중인 프로세스는 끄지 않는다. 자동화 크롬(9222·9224)은 일정 작업이 붙어 쓰므로 프로세스는 두고 남은 탭만 닫는다. 정리해도 부족하면 무엇을 더 끌지 사용자에게 묻거나 CI·원격 검증을 쓰고, 실행하지 못한 검증과 이유를 보고한다. 종료한 것은 보고한다.
- **검증 범위·워커 제한**: 작은 UI/광고/문구 변경은 관련 파일 lint·관련 테스트·화면 확인부터 한다. Jest 전체 실행이 필요하면 `--runInBand`, Vitest는 지원되는 worker 1 설정, Metro는 `--max-workers 2`를 쓴다. 필수 전체 검증은 생략하지 않되 여유 자원에서 순차 실행하거나 CI에서 한다. 같은 검증을 원인 확인 없이 반복하지 않는다. 캐시 삭제·재설치·전체 홈 디렉터리 재귀 검색을 기본 해결책으로 쓰지 않는다.
- **DB와 UI 검증 분리**: 배너 크기·스타일·문구만 바꾸는 작업에서 DB 연결·쿼리·마이그레이션·시드·DB 동기화를 실행하지 않는다. `prisma generate`는 로컬 코드 생성이지만 습관적으로 실행하지 않는다. 생성 코드 누락이 확인된 경우에만 package script의 실제 동작을 읽고 DB 변경이 없는 생성 명령만 실행하며 이유를 설명한다. 생성 코드 문제를 마이그레이션으로 해결하지 않는다.
- **프로세스 수명 관리**: 띄운 서버·브라우저 세션·번들러의 PID, 포트, 경로, 목적을 기록한다. 검증 후·작업 종료/중단 시 본인 작업에서 만든 것을 정상 종료하고 해당 PID/포트가 사라졌는지 확인한다. CDP 자동화는 연결 세션만 닫고 사용자의 기존 Chrome은 유지한다. `pkill node`, `killall`, 포트만 보고 무조건 kill, 보안 프로그램·사용자가 쓰고 있는 앱 종료는 금지한다. 다른 작업의 에뮬레이터·브라우저는 위 '안 쓰는' 기준에 맞을 때만 끈다. 쓰는 중인지 불분명하면 끄지 말고 보고한다.
- **완료 보고**: 자원 문제를 정리했으면 전후 측정값·종료한 프로세스·남은 큰 점유원을 구분해 보고한다. 명령만 종료하고 렉이 완전히 해결됐다고 단정하지 않는다. 이 규칙은 에이전트 실행 지침이며 OS 수준 자동 차단 장치라고 설명하지 않는다.



## Claude · Codex 공통 사용자 맥락 (2026-10-30 사용자 요청)

새 작업을 시작할 때 `/Users/yoonseongjun/Desktop/bhsn/ytw418-agent-skills/config/USER_CONTEXT.md`를 먼저 읽고, 필요한 프로젝트 메모만 따라 읽는다. 사용자 선호와 결정의 공통 요약은 이 파일을 기준으로 공유한다. 현재 사용자 지시·적용 저장소 규칙과 충돌하면 우선순위를 확인한다. 제공자별 도구·인증·훅·내부 대화가 자동 공유된다고 가정하지 않는다.
