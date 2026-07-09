---
name: rebase-develop
description: 현재 브랜치와 그 위에 스택된(연관된) 브랜치들을 develop(또는 지정한 base 브랜치) 최신 커밋 기준으로 순서대로 리베이스하여 최신화한다. 사용자가 '리베이스 최신화', 'develop 최신화', '브랜치 최신화', 'rebase 해줘', '연관 브랜치까지 리베이스', 'develop 기준으로 리베이스' 등을 요청할 때 사용한다.
---

# Rebase Develop

develop 최신 커밋 기준으로 현재 브랜치를 리베이스하고, 현재 브랜치 위에 쌓인(스택된) 브랜치들까지 체인 순서대로 함께 최신화한다.

기본 base는 `origin/develop`. 사용자가 다른 base를 지정하면("main 기준으로" 등) 그 브랜치를 사용한다.

## Pre-flight Checks

### 1. 로컬 변경사항 확인

```bash
git status --porcelain
```

커밋 안 된 변경이 있으면 사용자에게 확인:
> "커밋 안 된 변경사항이 있습니다. stash 후 진행하고 끝나면 복원할까요?"

동의하면 `git stash push -u -m "rebase-develop 임시 stash"` 하고, 전체 작업 완료 후 원래 브랜치에서 `git stash pop` 한다.

### 2. fetch 및 base 확인

```bash
git fetch origin --prune
git rev-parse --verify origin/develop
```

`origin/develop`이 없으면 `origin/main` → `origin/master` 순으로 대체하고 사용자에게 알린다.

### 3. 현재 브랜치 확인

```bash
git branch --show-current
```

현재 브랜치가 `develop`/`main`/`master`/`stage`이면 리베이스 대상이 아니다. `git pull --ff-only`만 안내하고 종료한다.

## Step 1: 리베이스 체인 식별

보호 브랜치(`develop`, `main`, `master`, `stage`)는 체인에서 항상 제외한다.

**하위(부모) 브랜치** — 현재 브랜치가 다른 feature 브랜치 위에 스택된 경우:

```bash
CUR=$(git branch --show-current)
for b in $(git branch --format='%(refname:short)'); do
  [ "$b" = "$CUR" ] && continue
  if git merge-base --is-ancestor "$b" "$CUR" && \
     ! git merge-base --is-ancestor "$b" origin/develop; then
    echo "parent: $b"
  fi
done
```

**상위(자식) 브랜치** — 현재 브랜치 위에 스택된 브랜치:

```bash
git branch --format='%(refname:short)' --contains "$CUR" | grep -vx "$CUR"
```

체인 정렬: `git merge-base --is-ancestor A B`가 참이면 A가 B보다 아래(먼저 리베이스). base에서 가까운 순서로 나열한다.

식별된 체인을 사용자에게 보여주고 확인받는다:
> "리베이스 체인: develop ← feature/A ← feature/A-part2. 이 순서로 리베이스할까요?"

체인에 다른 팀원이 함께 쓰는 브랜치가 섞여 있으면(예: PR에 다른 작성자의 커밋이 있음) 반드시 경고한다 — 리베이스 후 force push는 공유 브랜치를 깨뜨릴 수 있다.

## Step 2: 리베이스 전 원본 커밋 기록 (필수)

`--onto` 기준점과 실패 시 복구를 위해, **리베이스를 시작하기 전에** 체인의 모든 브랜치의 현재 커밋을 기록한다:

```bash
for b in <체인 브랜치들>; do echo "$b $(git rev-parse "$b")"; done
```

이 값들을 대화에 그대로 남겨둔다(뒤 단계에서 사용).

## Step 3: 체인 순서대로 리베이스

사용자의 메인 체크아웃을 방해하지 않도록 **현재 브랜치가 아닌 브랜치는 임시 worktree에서 리베이스한다.** `git rebase <base> <branch>`는 해당 브랜치를 checkout하므로 메인 체크아웃에서 실행하면 작업 중인 브랜치가 바뀐다.

```bash
WT="${TMPDIR:-/tmp}/rebase-develop-$$"
git worktree add --detach "$WT"
```

**최하단 브랜치** (develop 바로 위):

```bash
git rebase origin/develop                          # 현재 브랜치인 경우 (메인 체크아웃, 그 자체가 사용자의 작업)
git -C "$WT" rebase origin/develop <bottom-branch> # 현재 브랜치가 아닌 경우 (worktree)
```

**그 위의 각 브랜치** (아래에서 위로, 순서 엄수) — 현재 브랜치가 아니면 항상 `git -C "$WT"`:

```bash
git -C "$WT" rebase --onto <parent-branch> <parent의_리베이스_전_커밋> <child-branch>
```

`--onto`의 두 번째 인자는 반드시 Step 2에서 기록한 **부모의 리베이스 전 커밋**이어야 한다. 부모의 현재(리베이스 후) 커밋을 쓰면 자식의 커밋이 중복되거나 유실된다.

이미 최신인 경우(`git merge-base --is-ancestor origin/develop <branch>`가 참) 해당 브랜치는 건너뛰고 알린다.

### 충돌 발생 시

worktree에서 리베이스 중이었다면 아래 명령을 모두 worktree(`git -C "$WT"`, 파일 수정은 `$WT` 안의 파일) 기준으로 수행한다. 메인 체크아웃은 영향받지 않는다.

1. `git status`와 `git diff`로 충돌 내용을 파악해 해결을 시도한다.
2. 의미가 불확실한 충돌(양쪽 다 유효한 로직 변경)은 임의로 해결하지 말고 사용자에게 양쪽 내용을 보여주고 선택받는다.
3. 해결 후 `git add <files> && git rebase --continue` (커밋 메시지 편집기가 뜨지 않게 `GIT_EDITOR=true` 사용 가능).
4. 포기할 경우 `git rebase --abort` 후, 이미 리베이스된 하위 브랜치들도 Step 2의 기록으로 복구할지 확인:

```bash
git branch -f <branch> <리베이스_전_커밋>   # 현재 브랜치가 아닌 경우
git reset --hard <리베이스_전_커밋>          # 현재 브랜치인 경우
```

## Step 4: 마무리 및 push

1. worktree 정리: `git worktree remove "$WT"` (리베이스 중단 상태로 남았으면 `--force`). stash 했다면 `git stash pop`.
2. 결과 요약: 브랜치별 리베이스 성공/스킵/실패 여부.
3. push는 사용자 확인 후에만:

> "리베이스된 브랜치들을 force push할까요? (--force-with-lease 사용)"

```bash
git push --force-with-lease origin <branch>
```

`--force`는 절대 쓰지 않는다. `--force-with-lease`가 거부되면 원격에 새 커밋이 있다는 뜻이므로 중단하고 사용자에게 알린다.

## Error Handling

- rebase 도중 예상치 못한 상태가 되면 `git rebase --abort`가 항상 첫 번째 복구 수단이다.
- 어떤 브랜치가 어디까지 진행됐는지 헷갈리면 Step 2의 기록과 `git reflog`로 원상복구할 수 있다.
- 원격 추적 브랜치가 없는 로컬 전용 브랜치는 push 단계에서 제외한다.
