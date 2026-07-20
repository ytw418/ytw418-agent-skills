---
name: jira-bhsn
description: "BHSN Jira 티켓 기반 개발 워크플로우. Jira 티켓 조회/생성/업데이트, 스프린트 컨텍스트 조회, 브랜치 생성, PR 생성, Confluence 문서화까지의 전체 개발 사이클을 관리한다. 사용자가 티켓 번호(BA-XXXX, AT-XXXX)를 언급하거나, 'Jira 티켓', '스프린트', '브랜치 생성', 'PR 만들어줘', 'draft PR', '티켓 상태 변경' 등을 요청할 때 이 스킬을 사용한다."
---

# BHSN Jira 개발 워크플로우

Jira 티켓 기반으로 브랜치 생성 → 개발 → PR → 리뷰까지의 전체 사이클을 관리한다.

> **Jira 댓글 작성 금지 (MANDATORY):** 어떤 단계에서도 Jira 티켓에 댓글(comment)을 작성하지 않는다 (`jira_add_comment`, `addCommentToJiraIssue` 등 사용 금지). 진행 상황 공유는 티켓 상태 전환과 PR로만 한다.

## 1. 티켓 식별 (작업 시작 전 필수)

**코드를 작성하기 전에 반드시 Jira 티켓을 식별한다.**

1. **사용자가 티켓 코드를 명시** (e.g. `BA-2031`, `AT-150`):
   - `jira_get_issue`로 summary, description, acceptance criteria, status를 조회.
2. **브랜치명에 티켓 코드 포함** (e.g. `feat/BA-2031-some-feature`):
   - 브랜치명에서 티켓 코드를 추출하여 `jira_get_issue`로 조회.
3. **사용자가 티켓 코드 없이 작업을 설명**:
   - 사용자에게 해당 Jira 티켓을 질의. 티켓 없이 진행하지 않는다.
   - 사용자가 모르면 `jira_search`로 검색.
   - **보드 선택 기준:** (섹션 8의 보드 레퍼런스 참조)
     - 레포 `CLAUDE.md`에 Primary Board가 명시되어 있으면 그것을 우선 참조.
     - **보드가 불분명한 경우**, `jira_search`에 `assignee = currentUser() ORDER BY updated DESC`로 사용자 할당 티켓을 조회하여 프로젝트 키 분포를 분석하고, 결과를 사용자에게 제시하여 확인받는다.
   - 매칭 티켓이 없으면 생성 여부를 사용자에게 확인.
   - **티켓 생성 시** `assignee`를 현재 사용자로 설정 (`jira_get_user_profile`로 확인).
   - **티켓 생성 시** 적절한 상위 이슈(Epic/Story) 검색 후 `parent` 필드로 연결. 적절한 상위 이슈가 없으면 생략.
4. 컨텍스트가 불분명하면 `jira_search`로 관련 이슈 탐색.

## 2. 스프린트 컨텍스트 조회

1. `jira_get_agile_boards`로 관련 보드(BA 또는 AT) 조회.
2. `jira_get_sprints_from_board` (state="active")로 현재 스프린트 조회.
3. `jira_get_sprint_issues`로 스프린트 이슈 목록 조회.
4. Confluence에서 스프린트 계획 문서 검색.
5. 스프린트 컨텍스트를 찾을 수 없으면 사용자에게 질의.
6. Jira 티켓과 스프린트 계획을 교차 확인.

## 3. 브랜치 생성

1. 해당 티켓의 feature branch가 이미 있으면 checkout.
2. 없으면 **`develop`** 에서 생성:
   ```bash
   git fetch origin
   git checkout -b feat/BA-XXXX-short-description origin/develop
   ```
3. `main`/`master`에서 브랜치하지 않는다 — 항상 `develop` 기반.
4. `develop`에서 직접 코딩하지 않는다 — 항상 feature branch 사용.

## 4. 작업 중

- `jira_get_transitions` + `jira_transition_issue`로 티켓 상태 변경 (e.g. "To Do" → "In Progress").
- Jira 댓글은 작성하지 않는다.

## 5. PR 워크플로우

1. **첫 커밋 push 후** 즉시 **draft PR** 생성 (타겟: `develop`):
   ```bash
   gh pr create --base develop --draft --title "BA-XXXX Short description" --body "..."
   ```
2. 추가 커밋은 같은 브랜치에 push — draft PR이 자동 업데이트.
3. **작업 완료 후** (테스트/스타일 통과) ready for review로 전환:
   ```bash
   gh pr ready
   ```
4. PR 오픈 후 Jira 티켓을 "In Review"로 전환한다. PR 링크를 Jira 댓글로 추가하지 않는다.

**단일 커밋 변경이라도 draft → ready 단계를 생략하지 않는다.**

## 6. 완료 후

- 사용자 확인 후 티켓 상태 전환 (e.g. "In Review" 또는 "Done").
- 작업 내용 요약은 사용자에게 직접 전달한다 — Jira 댓글로 남기지 않는다.

## 7. 문서화 (선택)

PR 오픈 + Jira 업데이트 완료 후 사용자에게 문서화 여부를 질의.

**Confluence 문서 작성 시:**

문서화 대상:
- API 인터페이스 변경, 새 기능, 작업 상태, 주요 결정 사항, 마이그레이션 안내

포맷 규칙:
- 제목/본문 **한국어** 작성 — e.g. `BA-2031 파일 파싱 실패 시 INTERRUPT 필드 추가`
- `jira_create_remote_issue_link`로 Confluence 문서를 Jira 티켓에 연결.
- 기존 스프린트/기능 페이지가 있으면 중복 생성 대신 업데이트.

**Content size limitation (CRITICAL):**

Atlassian MCP (`create_confluence_page`, `update_confluence_page`)는 ~3,000~5,000자 이상의 페이로드에서 무한 대기한다.

- 단일 호출은 ~3,000자 이하로 유지.
- 대형 문서는 부모 페이지(요약+목차) + 자식 페이지(`parentId` 사용)로 분할.
- 크기 초과 실패 시 동일 페이로드 재시도 금지 — 줄인 후 재시도.

## 8. 레포별 Jira 보드 설정

- 이 영역의 내용은 `bhsn-claude-code` repo 내부에서는 고려하지 않습니다.
- 레포 루트 `CLAUDE.md`에 Primary Board가 명시되어 있으면 그것을 우선 참조.
- **Primary Board가 불분명한 경우**, 아래 순서로 보드를 확인한다:
  1. `jira_get_user_profile`로 현재 사용자 계정을 확인한다.
  2. `jira_search`에 `assignee = currentUser() ORDER BY updated DESC` 쿼리를 사용하여 사용자에게 할당된 최근 티켓 목록을 조회한다.
  3. 조회된 티켓들의 프로젝트 키(BA, AT 등) 분포를 분석하여 주로 사용하는 보드를 파악한다.
  4. 분석 결과를 사용자에게 제시하고, 아래 보드 레퍼런스를 참고하여 올바른 보드를 확인받는다:
     - e.g. "최근 할당된 티켓 10건 중 BA 7건, AT 3건입니다. 이 레포의 Primary Board를 BA로 설정할까요?"
  5. 사용자 확인 후 레포 `CLAUDE.md`에 기록:
     ```markdown
     ## Jira Board
     - **Primary Board:** BA
     ```
  6. 분석으로도 판단이 어려운 경우(티켓이 없거나 분포가 균등한 경우), 사용자에게 직접 질의한다.

### 보드 레퍼런스 (활성 보드 목록)

작업 내용에 따라 적절한 보드를 선택하기 위한 참조 테이블이다.

| 프로젝트 코드 | 보드명 | Board ID | 영역 |
|---|---|---|---|
| **BA** | Business Agent | 25 | 법률 AI 제품 — 문서 검수, AI 플레이북, 법령 뷰어, 법률전문가 인증, AI 모델 버전 관리 |
| **AT** | AI Team | 261 | AI 기술 R&D — 다국어 플래닝, VLLM, OCR, 딥리서치, 인프라 구축 |
| **VB2026** | VB2026 | 526 | 2026 신규 AI — AI extraction, 계약서 항목 추출, JSON schema extract |
| **GEN** | allibee 공통 | 228 | 공통 기능 — SSO, 회원가입, 구독/결제, 약관, 인증/인가 |
| **DO** | DO board | 560 | DevOps/인프라 — 보안 강화, 인프라 구조, 카카오클라우드, Datadog |
| **YC** | 율촌 | 135 | 율촌 전용 — 법규/판례 검색, 법령 검색 성능, 멀티턴 대화 |
| **NQA** | QA 보드 | 195 | QA/Hotfix — 긴급 수정, 회원가입 UX, 모델 변경 |
| **CLMELM** | CLMELM | 162 | CLM/전자서명 — 체결본, AIReview/AISentinel, eSign, 템플릿 |
| **PDT** | PDT 보드 | 493 | 제품 디자인/UX — UX 기획, Toast Message, 슈퍼어드민 UX |
| **FEND** | FRONTEND | 17 | 프론트엔드 공통 — 컴포넌트, 스타일, 아이콘 |
| **CRV2026** | CRV2026 | 593 | 크레이버 2026 — 전자결재, 인감사용신청서 |
| **CCM** | CCM 보드 | 426 | CJ 계약관리 — SSO, DRM, 파일 관리 |
| **LISS** | LISS 보드 | 8 | 한화S 온프레미스 — 법률 시스템, 개인정보 점검 |

**보드 선택 가이드:**
- **Business Agent 제품 기능/비즈니스 로직** → BA (기본)
- **AI Team 기술/연구/인프라** → AT (기본)
- **특정 고객사 전용** → YC(율촌), CCM(CJ), LISS(한화S), CRV2026(크레이버)
- **공통 플랫폼 기능** → GEN(인증/인가/구독), FEND(프론트엔드 공통)
- **운영/인프라** → DO(DevOps/보안)
- **QA/긴급 수정** → NQA
- **2026 신규 프로젝트** → VB2026(AI extraction)
