---
name: deploy-allibee-frontend
description: allibee-frontend 레포의 앨리비(contract)/큐(cue) 앱을 dev·demo·prod 환경에 배포한다. 배포 브랜치(develop, master, production, cue/master, cue/production)를 리베이스로 최신화하고 환경별 GitHub Actions 워크플로우를 실행한다. 사용자가 '앨리비 배포', '큐 배포', 'dev2 배포', '데모 배포', '프로드 배포', 'cue 배포', 'contract 배포', 'deploy allibee', 'deploy cue' 등을 요청할 때 사용한다.
---

# Deploy Allibee Frontend

allibee-frontend 레포(`~/Desktop/bhsn/allibee-frontend`)의 배포 프로세스. 배포 브랜치를 소스 브랜치 기준으로 리베이스해 최신화하고, 해당 브랜치에서 GitHub Actions 워크플로우를 `gh workflow run`으로 실행한다.

## 배포 매핑 (앱 × 환경)

앨리비(contract)와 큐(cue)는 **브랜치와 액션이 완전히 분리**되어 있다. 절대 섞지 않는다.

| 앱 | 환경 | 배포 브랜치 | 소스(리베이스 기준) | 워크플로우 파일 | 액션 이름 |
|---|---|---|---|---|---|
| 앨리비(contract) | dev2 | `develop` | (pull만) | `contract-gcp-develop-deploy.yml` | `[CONTRACT]GCP DEV2 DEPLOY` |
| 앨리비(contract) | demo | `master` | `develop` | `contract-gcp-demo-deploy.yml` | `[CONTRACT]GCP DEMO DEPLOY` |
| 앨리비(contract) | prod | `production` | `master` | `contract-gcp-prod-deploy.yml` | `[CONTRACT]GCP PROD DEPLOY` |
| 큐(cue) | dev | `develop` | (pull만) | `cue-gcp-dev-deploy.yml` | `[CUE] GCP DEV DEPLOY` |
| 큐(cue) | demo | `cue/master` | `develop` | `cue-gcp-demo-deploy.yml` | `[CUE] GCP DEMO DEPLOY` |
| 큐(cue) | prod | `cue/production` | `cue/master` | `cue-gcp-prod-deploy.yml` | `[CUE] GCP PROD DEPLOY` |

## Step 0: 배포 대상 확인

사용자 요청에서 앱과 환경이 명확하지 않으면 먼저 묻는다:
> "어떤 앱(앨리비/큐)을 어떤 환경(dev/demo/prod)까지 배포할까요?"

여러 환경을 연속 배포하는 경우 순서는 항상 dev → demo → prod.

## Pre-flight Checks

**메인 체크아웃(`~/Desktop/bhsn/allibee-frontend`)은 절대 건드리지 않는다** — 사용자가 작업 중일 수 있다. checkout/rebase 등 모든 브랜치 작업은 배포 전용 worktree에서 한다.

```bash
REPO=~/Desktop/bhsn/allibee-frontend
git -C "$REPO" fetch origin --prune
gh auth status   # 실패 시 gh auth login 안내

# 배포 전용 worktree (없으면 생성, 이후 재사용)
WT=~/Desktop/bhsn/allibee-frontend-deploy
[ -d "$WT" ] || git -C "$REPO" worktree add "$WT" master
```

worktree 생성이 "already checked out" 오류로 실패하면 해당 브랜치가 메인 체크아웃에 열려 있는 것이므로 다른 배포 브랜치로 생성하거나 사용자에게 알린다.

## Step 1: 배포 브랜치 최신화

### dev 환경 (develop)

**로컬 브랜치 작업 불필요.** `workflow_dispatch`는 원격 develop을 그대로 체크아웃하므로 바로 Step 2로 간다. 배포될 커밋만 확인해서 알린다:

```bash
git -C "$REPO" log --oneline -1 origin/develop
```

### demo / prod 환경

배포 매핑 표의 **소스 브랜치** 기준으로 worktree에서 리베이스:

```bash
git -C "$WT" checkout <배포브랜치>
git -C "$WT" pull --ff-only origin <배포브랜치>
git -C "$WT" rebase origin/<소스브랜치>
git -C "$WT" push origin <배포브랜치>
```

- `checkout`이 "already checked out" 오류면 그 브랜치가 메인 체크아웃에 열려 있는 것 — 사용자에게 알리고 진행 방법을 확인한다.
- 리베이스 충돌 시: worktree 안에서 해결을 시도하되, 불확실하면 사용자에게 양쪽 내용을 보여주고 선택받는다. 포기하면 `git -C "$WT" rebase --abort` (메인 체크아웃은 영향 없음).
- push가 non-fast-forward로 거부되면(배포 브랜치에 고유 커밋이 있었던 경우) 사용자에게 확인 후 `git -C "$WT" push --force-with-lease origin <배포브랜치>`. `--force`는 절대 사용하지 않는다.
- 이미 최신이면(`git merge-base --is-ancestor origin/<소스> <배포브랜치>`가 참) 리베이스/push를 건너뛰고 알린다.

## Step 2: GitHub Actions 실행

**prod 배포는 실행 직전에 반드시 사용자 최종 확인을 받는다:**
> "production 배포 액션을 실행합니다. 진행할까요?"

```bash
gh workflow run <워크플로우파일> --ref <배포브랜치>
```

`--ref`는 반드시 배포 매핑 표의 브랜치와 일치해야 한다 (예: 큐 demo는 `cue/master`, 앨리비 demo는 `master`).

## Step 3: 실행 확인 및 보고

실행 직후 run을 찾아 상태를 확인한다 (등록까지 몇 초 걸릴 수 있음):

```bash
sleep 5
gh run list --workflow=<워크플로우파일> --limit 1 --json databaseId,headBranch,status,url
```

- `headBranch`가 의도한 배포 브랜치인지 확인한다.
- `gh run watch <databaseId> --exit-status`로 완료까지 지켜보거나, 사용자가 원하면 URL만 전달한다.
- 실패 시 `gh run view <databaseId> --log-failed`로 원인을 파악해 보고한다.

완료 후 요약: 앱/환경별로 최신화된 커밋(`git -C "$REPO" log --oneline -1 origin/<배포브랜치>`), 실행한 액션, run URL. 배포 알림은 Slack `dev_deploy`(dev)/`prod_deploy`(prod) 채널에 자동 게시된다.

## 주의사항

- 워크플로우가 전부 `workflow_dispatch`라서 **어느 브랜치(ref)에서 실행하느냐가 곧 배포 내용**이다. ref를 틀리면 다른 코드가 배포된다.
- 앨리비 프로드 브랜치는 `production`, 큐 프로드 브랜치는 `cue/production`이다. 큐 배포에 `master`/`production`을 쓰지 않는다.
- develop이 아직 최신이 아니라고 판단되면(머지 대기 PR 등) 배포 전에 사용자에게 알린다.
