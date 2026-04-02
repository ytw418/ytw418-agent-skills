---
name: qa-testcase-gen
description: "PRD(Confluence) 또는 Figma 디자인을 분석하여 QA 테스트 케이스를 자동 생성한다. 사용자가 'TC 만들어줘', '테스트 케이스 생성', 'QA 테스트', 'PRD 기반 TC', 'Figma TC', '테케 작성', 'test case' 등을 요청하거나, Confluence PRD URL 또는 Figma URL과 함께 테스트 케이스를 요청할 때 사용한다."
---

# QA Test Case Generator

PRD(Confluence) 또는 Figma 디자인에서 요구사항을 추출하고 구조화된 QA 테스트 케이스를 생성한다.

## 입력 소스

| 소스 | 수집 방법 |
|---|---|
| Confluence PRD | `mcp__claude_ai_Atlassian_Rovo__getConfluencePage` (cloudId: `bhsn.atlassian.net`) |
| Figma 디자인 | `mcp__claude_ai_Figma__get_design_context` + `get_screenshot` |
| Jira 티켓 | `mcp__claude_ai_Atlassian_Rovo__getJiraIssue` (연결된 티켓 정보) |

둘 이상 동시 입력 시 병렬 수집 후 교차 검증.

## 워크플로우

### Step 1: 소스 수집

**Confluence PRD:**
1. 페이지 ID 또는 URL에서 pageId 추출
2. `getConfluencePage`로 본문 조회 (markdown 포맷)
3. 본문에서 Jira 티켓 키, Figma URL 자동 추출 → 추가 수집

**Figma 디자인:**
1. URL에서 fileKey, nodeId 추출
2. `get_design_context`로 구조 + 스크린샷 조회
3. UI 요소별 상태(default, hover, disabled, error) 식별

**Jira 티켓:**
1. PRD 내 언급된 티켓 키 수집
2. 각 티켓의 summary, description, acceptance criteria 조회

### Step 2: 요구사항 분석

PRD에서 다음을 추출:

1. **기능 요구사항** — "~해야 한다", "~할 수 있다" 문장
2. **조건 분기** — if/else, 매트릭스 테이블, 케이스 분류표
3. **접근 권한** — 역할별(최고관리자/일반사용자) 허용/차단 페이지
4. **수치 제한** — 횟수, 용량, 기간 등 경계값
5. **UI 상태** — 팝업, 배너, disabled, 에러 메시지
6. **예외/특이사항** — 🚨, TBD, 참고사항 블록

Figma에서 다음을 추출:

1. **화면 상태** — 각 프레임이 나타내는 상태(정상/에러/빈값/로딩)
2. **인터랙션** — 버튼, 링크, 팝업 트리거
3. **텍스트 콘텐츠** — 안내 문구, 에러 메시지, CTA 텍스트

### Step 3: 테스트 케이스 생성

카테고리별로 테스트 케이스를 생성한다. 상세 포맷은 [references/tc-template.md](references/tc-template.md) 참조.

**카테고리:**

| 카테고리 | 설명 | 추출 기준 |
|---|---|---|
| 기능 | 핵심 비즈니스 로직 동작 | 기능 요구사항 문장 |
| 권한/접근 | 역할별 페이지 접근 허용/차단 | 접근 권한 매트릭스 |
| 경계값 | 수치 제한의 경계 조건 | 수치 제한 (N-1, N, N+1) |
| UI/UX | 화면 표시, 팝업, 메시지 일치 | Figma 디자인 + PRD 문구 |
| 엣지케이스 | 예외 상황, 동시 조건 충돌 | 특이사항 + 조건 조합 |

**생성 규칙:**
- 조건 분기표의 각 셀 → 최소 1개 TC
- 경계값 → N-1, N, N+1 각각 TC
- Figma 화면 상태 → 화면별 1개 TC
- 접근 권한 매트릭스 → 역할 x 페이지 조합별 TC

### Step 4: 출력

사용자에게 출력 방식 확인:

| 옵션 | 설명 |
|---|---|
| **Confluence 페이지** | PRD 하위 페이지로 TC 문서 생성 |
| **Jira 하위 Task** | 부모 티켓에 TC별 하위 Task 등록 |
| **로컬 파일** | `~/qa_testcases/{ticket_key}_TC.md` 저장 |

Confluence 페이지 생성 시:
```
mcp__claude_ai_Atlassian_Rovo__createConfluencePage
  cloudId: bhsn.atlassian.net
  spaceKey: PD (또는 PRD가 속한 space)
  parentPageId: {PRD pageId}
  title: "[QA] {PRD 제목} 테스트 케이스"
```

## 예시

입력: Guest Mode PRD + Figma

생성되는 TC 요약:

```
## 기능 (7건)
TC-001 | Guest 계정 하루 3건 대화 허용
TC-002 | 4번째 대화 시도 시 구독 유도 팝업 노출
TC-003 | multi-turn 대화도 1회로 카운트
TC-004 | 사용자 임의 중단 시에도 1회 카운트
TC-005 | 워크플로우 선택 시 구독 유도 팝업
TC-006 | 답변 응답 실패 시 대화 횟수 미집계
TC-007 | 하루 경과 후 대화 횟수 초기화

## 권한/접근 (5건)
TC-008 | Agent 메인홈 접근 허용
TC-009 | 검색 페이지 접근 시 구독 유도 팝업
TC-010 | 계약서 리뷰 접근 시 구독 유도 팝업
TC-011 | 드라이브 접근 시 구독 유도 팝업
TC-012 | 답변 결과에서 드라이브 이동 시 구독 유도

## 구독 유도 케이스 (3건)
TC-013 | [A] 최고관리자 + 100원 혜택 → 결제 페이지
TC-014 | [B] 최고관리자 + 혜택 없음 → 일반 결제 안내
TC-015 | [C] 일반사용자 → 관리자에게 문의 안내

## 로그인 노출 페이지 (4건)
TC-016 | CLM/ELM only → 기본 CLM 페이지
TC-017 | Agent only → 기본 Agent 페이지
TC-018 | 전체 라이선스 + Agent 이력 → Agent 페이지
TC-019 | 전체 라이선스 + CLM 이력 → CLM 페이지

## UI/UX (3건)
TC-020 | 구독 유도 팝업 문구/디자인 Figma 일치
TC-021 | 100원 프로모션 배너 노출 조건
TC-022 | 입력창 disabled 상태 표시
```
