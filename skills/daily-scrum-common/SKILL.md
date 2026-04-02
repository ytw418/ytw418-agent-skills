---
name: daily-scrum-common
description: 공통 Unit 데일리 스크럼 자동 작성. Jira(GEN 프로젝트), GitHub, Confluence, Slack에서 작업 이력을 수집하여 날짜별 스크럼 파일을 ~/daily_scrum/results/common_unit/에 생성하고 Slack 채널(03_unit_common)에 게시한다. '공통 스크럼', '공통 유닛 스크럼', 'common scrum', '공통 데일리' 등을 요청할 때 사용한다.
arguments:
  - name: target
    required: false
    description: "대상 지정 (예: '윤성준', '팀', '전체'). 미지정 시 사용자에게 선택을 요청한다."
---

# Daily Scrum — 공통 Unit

공통 Unit(GEN 프로젝트) 전용 데일리 스크럼 자동화 스킬.

## 전체 흐름

0. Config 로드 및 대상 결정
1. 사용자 정보 파악
2. 날짜 범위 결정
3. 휴가 확인 (데이터 수집 전 선행)
4. 데이터 수집 (Jira, GitHub, Confluence, Slack) — 병렬 실행
5. 날짜별 작업 분류 및 그룹핑
6. 파일 생성
7. 멀티 유저 실행 (팀 전체 대상 시)
8. Slack 스레드 탐지 및 게시

---

## 0. Config 로드 및 대상 결정

### Config 파일

경로: 이 스킬의 `assets/config.yaml`

Config에는 팀 정보와 설정이 포함:
- `settings.workday_start_hour`: Done/Todo 경계 시간 (기본 7시)
- `settings.jira_project`: GEN (allibee 공통 프로젝트)
- `teams.common_unit.members`: 멤버 리스트

### Slack 유저 데이터

경로: `~/.claude/skills/daily-scrum/assets/slack_users.json` (기존 daily-scrum 스킬과 공유)

없으면 `~/.claude/skills/daily-scrum/scripts/update_slack_users.py`로 갱신.

### 대상 결정 로직

**우선순위 1: Skill argument (`target`)**

- `/daily-scrum-common 팀` 또는 `/daily-scrum-common 전체` → 팀 전체 스크럼
- `/daily-scrum-common 윤성준` → 해당 멤버 개인 스크럼

**우선순위 2: 사용자 요청 텍스트**

| 요청 패턴 | 대상 | 처리 |
|---|---|---|
| "내 스크럼" / "오늘 스크럼" | currentUser | `assignee = currentUser()` |
| "{이름} 스크럼" | 단일 멤버 | config에서 name 매칭 |
| "공통 팀 스크럼" / "전체 스크럼" | 팀 전체 | config 멤버 전원 순회 |

**우선순위 3: 미지정 시 `AskUserQuestion`**

```
question: "어떤 스크럼을 작성할까요?"
header: "Scrum target"
options:
  - label: "내 스크럼 (개인)"
    description: "현재 사용자의 개인 스크럼"
  - label: "공통 Unit 전체"
    description: "팀 전체 멤버 스크럼"
```

### 시간 범위 오버라이드

"이번 주", "2/10~2/14", "밀린 스크럼" 등 명시적 범위 지정 시 해당 범위 사용.

---

## 1. 사용자 정보 파악

### config 기반 (기본)

1. config에서 멤버의 `jira_display_name` 확인
2. Jira 조회 시 `assignee = "{jira_display_name}"` 사용
3. 디렉토리명에 `name` 필드 사용

### currentUser

1. `jira_search`로 `assignee = currentUser()` 조회
2. display_name에서 접미사 제거 (예: `윤성준` 그대로 사용)

---

## 2. 날짜 범위 결정

- 기본: 오늘 1일치
- "밀린 스크럼": 가장 최근 파일 날짜 ~ 오늘
- 주말/공휴일도 건너뛰지 않음

### Done 범위 시작점 (연속성 보장)

1. 멤버 출력 디렉토리에서 직전 파일 찾기
   - 개인: `~/daily_scrum/results/personal/{이름}/` 내 최근 `YYMMDD.md`
   - 팀: `~/daily_scrum/results/common_unit/*/` 내 해당 `{이름}.md` 중 최근 것
2. 직전 파일 있으면: 해당 날짜 07:00 ~ 오늘 06:59
3. 직전 파일 없으면: 어제 07:00 ~ 오늘 06:59
4. Done/Todo 경계: **오늘 07:00 AM**

---

## 3. 휴가 확인

`01_vacation` 채널(C04G8QTRF6C)에서 대상 멤버 휴가 확인.

### 조회 방법

Slack API로 직접 호출 (과거 30일):
```python
# oldest = 현재 - 30일, latest = 현재
```

### 메시지 패턴 (flex 봇)

| 패턴 | 의미 |
|---|---|
| 🌴 `[이름] - M월 D일 하루종일 휴가입니다.` | 종일 휴가 |
| 🌴 `[이름] - M월 D일 ~ M월 D일 휴가입니다.` | 연속 휴가 |
| 🌴 `[이름] - M월 D일 시간 ~ 시간 휴가입니다.` | 반차 |
| ❗ `[이름] - M월 D일 ... 취소되었습니다.` | 휴가 취소 |

파싱: 시간순 정렬 → 멤버 name 매칭 → 등록/취소 반복 시 마지막 상태가 최종.

### 스크럼 반영

- **종일 휴가**: Done은 정상 수집, Todo를 `🌴 휴가`로 대체
- **반차**: Done/Todo 정상 + 반차 정보 추가

---

## 4. 데이터 수집

**핵심 개선: GEN 프로젝트 기반 JQL 조회 (board 기반이 아닌 project 기반)**

GEN은 next-gen 프로젝트라 별도 board가 없다. `project = GEN` JQL로 직접 조회한다.

### 4-1. Jira (GEN 프로젝트)

**Done 데이터**: changelog 기반 status transition 이력을 날짜별 분류.

```
project = GEN AND assignee = "{jira_display_name}" AND updated >= "{start_date}" ORDER BY updated DESC
```

currentUser 사용 시:
```
project = GEN AND assignee = currentUser() AND updated >= "{start_date}" ORDER BY updated DESC
```

`jira_batch_get_changelogs`로 각 transition의 `created` 타임스탬프 기준 날짜 배정. 같은 날 여러 transition은 최종 상태만 반영.

**Todo 데이터**:

```
project = GEN AND assignee = "{jira_display_name}" AND status in ('In Progress', 'ICEBOX', 'IN QA', 'In Review', '진행 중', '검토 중', '해야 할 일') ORDER BY priority DESC
```

- 오늘 07:00 이후 transition된 티켓 → Todo의 "진행중/완료" 항목
- 현재 진행/대기 상태 티켓 → Todo의 TODO 항목

### 4-2. GitHub (bhsn-ai org)

`github_username`이 비어있으면 GitHub 수집을 건너뛴다.

**수집 방법 (Sub-agent 패턴 — 필수):**

```bash
python {SKILL_DIR}/scripts/fetch_github_activity.py \
    --username {github_username} \
    --start {start_date} \
    --end {end_date} \
    --output ~/daily_scrum/.cache/{date}_{member}_github.json
```

**GEN 프로젝트 필터링:**
1. Jira에서 수집된 GEN 티켓 key 목록 추출
2. PR 제목/커밋 메시지에서 `[A-Z]+-\d+` 패턴 매칭
3. GEN 티켓 매칭되면 포함, 아니면 제외
4. 티켓 번호 없는 PR/커밋은 팀 스크럼 시 제외, 개인 스크럼 시 포함

### 4-3. Confluence

```
contributor = "{jira_display_name}" AND lastModified >= "{start_date}"
```

- type이 `page`인 것만 포함
- Jira 티켓과 연관된 문서는 해당 티켓 항목과 묶기

### 4-4. Slack 메시지 수집

**수집 대상 채널:** `03_unit_common` (C0A520V6KE1)

Slack API 응답이 context를 소모하므로 **스크립트를 Sub-agent로 실행**:

```bash
python {SKILL_DIR}/scripts/fetch_slack_messages.py \
    --channel C0A520V6KE1 \
    --user {slack_id} \
    --oldest {oldest_ts} \
    --latest {latest_ts} \
    --output ~/daily_scrum/.cache/{date}_{member}_slack_common.json \
    --slack-users ~/.claude/skills/daily-scrum/assets/slack_users.json
```

**중복 제거:**
1. Jira 티켓 번호 패턴(`GEN-\d+` 등) 추출 → 이미 수집된 Jira 티켓과 대조
2. GitHub PR URL/제목 중복 제거
3. Confluence 문서 제목 중복 제거

**노이즈 필터링:**
- 제외: 단답형("넵", "확인", "👍" 등 10자 이하), bot 메시지, 리액션성 스레드 답글
- 포함: 기술 논의, 진행 상황 공유, 미팅 정리, 이슈 대응, 리뷰 요청

**스크럼 항목 변환:**
- 핵심 내용 1줄 요약
- Slack 유래 항목에 출처 스레드 링크 필수: `[{summary}]({thread_url})`

### 4-5. 이전 스크럼 파일 참조

직전 파일의 "Todo" 항목을 참고하되, 실제 데이터 기반으로 보정.

### 4-6. 병렬 수집 (개선 사항)

데이터 소스 간 의존성이 없으므로, 가능한 한 병렬로 수집:
- Jira Done/Todo 조회와 GitHub/Confluence/Slack 수집을 동시에 시작
- GitHub, Slack 스크립트는 각각 별도 Bash sub-agent로 실행
- 모든 수집 완료 후 중복 제거 및 필터링 수행

---

## 5. 작업 분류 및 그룹핑

### 그룹핑 기준

- 같은 Jira Epic 소속 티켓
- 제목에 공통 키워드 (예: "크레딧", "SSO", "MTM", "라이선스")
- 같은 레포 유사 작업

### 포맷 규칙

- 섹션 헤더: `**✅ Done**` / `**📌 Todo**` + 괄호 안 날짜 범위
- Done/Todo 경계: **오늘 07:00 AM**
- 날짜 형식: `M/D HH:MM`
- 1-depth: `    - ` (space 4칸 + 대시)
- 2-depth: `        - ` (space 8칸 + 대시)
- 최대 2-depth
- 3개 이상 세부 항목이면 그룹핑, 1-2개면 독립 나열

### 작성 원칙

- PR/티켓 번호는 텍스트로 명시하지 않음
- 간결하고 팀원이 이해할 수 있는 수준
- "무엇을 했는지"에 초점

### 원본 소스 링크 (마크다운)

- Jira: `https://bhsn.atlassian.net/browse/{ticket_key}`
- GitHub PR: 스크립트 출력 `url` 필드
- Confluence: MCP 응답 `url` 필드
- Slack: 스크립트 출력 `url` 필드

예시:
```markdown
**✅ Done** (4/1 07:00 ~ 4/2 06:59)
    - [CLM only 플랜 페이지 노출 케이스 수정](https://bhsn.atlassian.net/browse/GEN-576)
    - 크레딧 관련 기능 개선
        - [크레딧 분할 지급 배치 구현](https://bhsn.atlassian.net/browse/GEN-564)
        - [크레딧 사용량 대시보드 API](https://bhsn.atlassian.net/browse/GEN-555)
    - [SSO 리다이렉트 오류 수정](https://bhsn.atlassian.net/browse/GEN-535)

**📌 Todo** (4/2 07:00 ~)
    - [구성원 초대 시 라이선스 잔여 검증](https://bhsn.atlassian.net/browse/GEN-577) (진행중)
    - [MTM external API POST 변경 후속 작업](https://bhsn.atlassian.net/browse/GEN-550)
```

---

## 6. 파일 생성

### 개인 스크럼

```
~/daily_scrum/results/personal/{이름}/YYMMDD.md
```

### 팀 스크럼

```
~/daily_scrum/results/common_unit/YYMMDD/{이름}.md
```

디렉토리 자동 생성 (`mkdir -p`).

---

## 7. 멀티 유저 실행 — 독립 트랜잭션

팀 전체 대상 시 config 멤버 리스트를 **멤버별 독립 트랜잭션**으로 처리.

### 처리 순서

1. 휴가 정보 일괄 조회 (1회, 재활용)
2. 멤버별 독립 트랜잭션 반복

### 멤버별 트랜잭션

```
=== TRANSACTION START: {멤버.name} ===
1. 컨텍스트 설정 (jira_display_name)
2. 날짜 범위 결정 (직전 파일 기준)
3. 데이터 수집 (Jira/GitHub/Confluence/Slack 병렬)
4. 귀속 검증 (작성자-증거 일치)
5. 작업 분류 및 그룹핑
6. 파일 생성
=== TRANSACTION END: {멤버.name} ===
```

### 귀속 검증

| 소스 | 검증 필드 | 기대값 |
|---|---|---|
| Jira | assignee | jira_display_name |
| GitHub | author | github_username |
| Slack | user | slack_id |
| Confluence | contributor | jira_display_name |

불일치 → 제외 + 경고.

### 에러 격리

한 멤버 실패해도 나머지 계속 진행. 부분 실패 시 성공 소스만으로 파일 생성.

---

## 8. Slack 스레드 탐지 및 게시

**대상 채널:** `03_unit_common` (C0A520V6KE1) — 스크럼 게시와 논의가 같은 채널

### 8-1. 스레드 탐지

`slack_get_channel_history(limit=20)`으로 최근 메시지 조회 후, **요청 날짜(`target_date`)**가 포함된 스크럼 스레드를 찾는다.

키워드 패턴:
- `Daily 스크럼`
- `어제 한 일`
- `오늘 할 일`
- `스크럼 전 티켓 현행화`

탐지 기준:
- 키워드 매칭 + `target_date` 포함 조건 동시 충족
- 가장 최근 매칭 메시지의 `ts`를 `thread_ts`로 사용

### 8-2. 스레드 없으면 신규 생성

```
slack_post_message:
  channel: C0A520V6KE1
  text: "YYYY-MM-DD Daily 스크럼"
```

응답 `ts`를 `thread_ts`로 사용.

### 8-3. 멤버별 스크럼 게시 (Reply)

config 멤버 순서대로 `slack_reply_to_thread` 호출.

**메시지 형식:**

```
<@{slack_id}> *{name}*

✅ *Done ({done_range})*
    • 항목 1
        ◦ 세부 항목
    • 항목 2
-
📌 *Todo ({todo_range})*
    • 항목 A
    • 항목 B
-
```

규칙:
- 첫 줄: `<@{slack_id}> *{name}*` 멘션 + 이름 볼드
- 링크: Slack 형식 `<URL|텍스트>` (마크다운 아님)
- 휴가 멤버: Todo에 `🌴 *휴가*`
- `slack_id` 없으면 `*{name}*`만 표기
- 개인 스크럼은 Slack 게시하지 않음

**예시:**
```
<@U092LHJH732> *윤성준*

✅ *Done (4/1 07:00 ~ 4/2 06:59)*
    • <https://bhsn.atlassian.net/browse/GEN-576|CLM only 플랜 페이지 노출 케이스 수정>
    • <https://bhsn.atlassian.net/browse/GEN-577|구성원 초대 시 라이선스 잔여 검증>
-
📌 *Todo (4/2 07:00 ~)*
    • <https://bhsn.atlassian.net/browse/GEN-580|플랜 변경 시 UI 업데이트> (진행중)
-
```

### 8-4. 게시 후 확인

게시 완료 후 사용자에게 Slack 채널 링크와 함께 결과 요약:
- 생성된 파일 수
- 게시 성공/실패 멤버
- 휴가 멤버 안내
