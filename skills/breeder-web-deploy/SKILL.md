---
name: breeder-web-deploy
description: 브리디 웹(breeder_web, Next.js)을 운영에 배포한다. dev → main PR을 만들고 포함된 변경 목록과 릴리스 버전을 적은 뒤, CI(품질 게이트·Vercel 체크)가 통과하면 main에 머지한다. main에 머지되면 Vercel이 운영에 자동 배포한다. 사용자가 '브리더 웹 배포해줘', '브리디 웹 배포', '웹 배포해줘', 'breeder_web 배포', 'dev main에 올려줘', '웹 릴리스' 등을 요청할 때 사용한다. 앱(bredy_app) 빌드·스토어 제출에는 쓰지 않는다.
---

# 브리디 웹 배포 (dev → main)

- 레포: `/Users/yoonseongjun/Desktop/pro/breeder_web` (`ytw418/breeder_web`)
- 배포 = `dev` → `main` PR을 **머지 커밋**으로 머지. Vercel이 main을 운영에 자동 배포한다.
- `dev` 브랜치는 절대 지우지 않는다(`--delete-branch` 금지).
- 로컬 작업 트리는 건드리지 않는다. 모든 조회는 `origin/*` 기준, PR·머지는 `gh`로 한다.

## 1. 배포할 변경 확인

```bash
cd /Users/yoonseongjun/Desktop/pro/breeder_web
git fetch -q origin --tags
git log --oneline origin/main..origin/dev
```

- 출력이 없으면 "dev와 main이 같아서 배포할 변경이 없다"고 알리고 끝낸다.
- 이미 열린 dev → main PR이 있으면 새로 만들지 않고 그 PR을 갱신해서 쓴다:
  `gh pr list --base main --head dev --state open --json number,title`

## 2. 변경 내용 정리

```bash
git log --format='%s' origin/main..origin/dev | grep -oE '#[0-9]+' | sort -u
gh pr view <번호> --json number,title,body   # PR마다
```

- 머지된 PR 단위로 한 줄씩 적는다: `- #162 운영자 숨김·삭제 API와 게시글·댓글·경매 숨김`. PR 제목을 그대로 베끼기보다 사용자가 체감하는 변화로 한국어 한 줄로 쓴다.
- PR 번호 없이 dev에 직접 들어간 커밋은 커밋 제목으로 한 줄씩 적는다.
- DB 마이그레이션(`prisma/` 변경), 환경 변수 추가, API 계약 변경이 있으면 `## 배포 시 주의`에 따로 적는다:
  `git diff --stat origin/main origin/dev -- prisma/ .env.example`

## 3. 버전 정하기

버전은 git 태그 `web-vMAJOR.MINOR.PATCH`로 관리한다.

```bash
git tag -l 'web-v*' --sort=-v:refname | head -1
```

- 태그가 없으면 첫 버전은 `web-v1.0.0`.
- 있으면 포함 변경으로 올린다: 새 기능(`feat`)이 하나라도 있으면 MINOR +1(PATCH 0), 수정·문구·CI만이면 PATCH +1. 호환이 깨지는 변경(구버전 앱이 깨지는 API 변경 등)은 MAJOR를 올릴지 사용자에게 먼저 묻는다.

## 4. PR 생성

제목: `릴리스 vX.Y.Z: <핵심 변경 2~3개 요약>` (72자 이내)

본문:

```markdown
## 버전
vX.Y.Z (이전: vA.B.C)

## 포함 변경 (dev → main)
- #161 ...
- #162 ...

## 배포 시 주의
- (없으면 "없음")

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

```bash
gh pr create --base main --head dev --title "<제목>" --body-file /tmp/release-body.md
```

## 5. CI 대기

`Dev to Main Quality Gate` 워크플로우가 `quality`(npm run verify:ci) → `wait_vercel`(Vercel 프리뷰 체크) 순으로 돈다. 최대 30분 정도 걸린다.

```bash
gh pr checks <PR번호> --watch --fail-fast
```

- 실패하면 머지하지 않는다. 실패한 잡 로그(`gh run view <run-id> --log-failed`)에서 원인을 요약해 보고하고 멈춘다. 고칠지 사용자에게 묻는다.
- `notify_slack`은 `continue-on-error`라 실패해도 머지를 막지 않는다.

## 6. 머지와 태그

```bash
gh pr merge <PR번호> --merge          # 머지 커밋. squash/rebase 금지, --delete-branch 금지
git fetch -q origin
MERGE_SHA=$(gh pr view <PR번호> --json mergeCommit -q .mergeCommit.oid)
git tag -a web-vX.Y.Z "$MERGE_SHA" -m "릴리스 vX.Y.Z"
git push origin web-vX.Y.Z
```

## 7. 배포 확인과 보고

- Vercel 운영 배포가 main 머지 커밋으로 `READY`가 됐는지 확인한다(Vercel MCP `list_deployments` 또는 `gh api repos/ytw418/breeder_web/commits/$MERGE_SHA/status`). 빌드 중이면 진행 중이라고 그대로 알린다 — 완료라고 하지 않는다.
- 사용자에게 한국어로 보고한다: 버전, PR 링크, 포함 변경 목록, 배포 상태, 주의 사항.
