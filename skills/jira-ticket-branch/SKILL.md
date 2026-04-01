---
name: jira-ticket-branch
description: BHSN Jira 티켓 번호로 작업 브랜치를 생성하거나 기존 브랜치를 찾아 체크아웃한다. 사용자가 `BA-1234 브랜치 만들어줘`, `GEN-557로 브랜치 파줘`, `지라 티켓 기반 브랜치 생성`, `feature 브랜치 만들어줘`처럼 요청할 때 사용한다. 브랜치 기본 규칙은 `feature/<JIRA-TICKET>` 이다.
---

# Jira Ticket Branch

BHSN 레포에서 Jira 티켓 기준 작업 브랜치를 안전하게 만들거나 재사용한다.

## 사용 시점

- 사용자가 Jira 티켓 번호를 주고 브랜치 생성을 요청할 때
- 사용자가 "티켓 브랜치", "feature 브랜치", "작업 브랜치" 생성을 요청할 때
- 현재 브랜치명을 Jira 티켓 규칙에 맞게 바꿔야 할 때

## 브랜치 규칙

1. 기본 브랜치명은 `feature/<JIRA-TICKET>` 이다.
2. 이 레포에서는 `feature/GEN-557`, `feature/BA-1987-followup-refactor` 같이 `feature/` 접두사를 사용한다.
3. 사용자가 별도 suffix를 명시하지 않았으면 `feature/<JIRA-TICKET>`만 사용한다.
4. 브랜치 생성 기준 base는 항상 `origin/develop` 이다.
5. `main`, `master`, 현재 작업 브랜치 기준으로 새 브랜치를 만들지 않는다.

## 실행 절차

1. Jira 티켓 식별
   - 사용자 입력이나 현재 브랜치명에서 `BA-1234`, `GEN-557`, `FEND-214` 같은 티켓 코드를 추출한다.
   - 티켓 코드가 없으면 사용자에게 Jira 티켓 번호를 먼저 요청한다.
2. 현재 상태 확인
   - `git branch --show-current`
   - `git status --short --branch`
   - `git branch --list "feature/<TICKET>*"`
   - `git branch -r --list "origin/feature/<TICKET>*"`
3. 브랜치 선택
   - 로컬에 `feature/<TICKET>` 또는 동일 티켓 브랜치가 있으면 우선 checkout 한다.
   - 로컬에 없고 remote에 있으면 tracking branch로 checkout 한다.
   - 둘 다 없으면 `origin/develop` 기준으로 `feature/<TICKET>`을 새로 만든다.
4. 예외 처리
   - 워킹트리가 dirty이면 브랜치 전환 전 사용자에게 확인한다.
   - 현재 브랜치 rename 요청이면 `git branch -m feature/<TICKET>`를 우선 고려한다.
   - 이미 올바른 브랜치명에 있으면 새 브랜치를 만들지 않는다.

## 기본 명령

기존 브랜치 탐색:

```bash
git branch --list "feature/GEN-557*"
git branch -r --list "origin/feature/GEN-557*"
```

remote 브랜치 재사용:

```bash
git fetch origin
git checkout -b feature/GEN-557 --track origin/feature/GEN-557
```

새 브랜치 생성:

```bash
git fetch origin
git checkout -b feature/GEN-557 origin/develop
```

현재 브랜치 rename:

```bash
git branch -m feature/GEN-557
```

## 응답 원칙

- 브랜치를 만들기 전에 어떤 티켓 코드와 어떤 최종 브랜치명을 쓸지 한 줄로 분명히 말한다.
- dirty worktree 때문에 바로 checkout/rename이 위험하면 이유를 짧게 설명하고 사용자 확인을 받는다.
- 작업 후에는 현재 브랜치명과 base 기준이 `develop`이었는지 함께 알려준다.
- 이 작업이 브랜치 생성에 그치지 않고 Jira 조회, PR 생성, 상태 전환까지 이어지면 `jira-bhsn` 워크플로우를 함께 적용한다.
