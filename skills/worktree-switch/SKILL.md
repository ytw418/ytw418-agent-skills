---
name: worktree-switch
description: git 워크트리를 안전하게 전환·정리한다. 워크트리에 묶인 dev 서버를 찾아 종료하고(포트 충돌 / 엉뚱한 워크트리를 서빙하는 문제), "already checked out" 브랜치 충돌을 해소하며, 미커밋 변경을 자동 stash 한 뒤 워크트리를 제거한다. 사용자가 '워크트리 전환', '워크트리 삭제', '워크트리 정리', 'worktree remove 안 됨', 'worktree 찌꺼기', '포트 충돌', '포트 이미 사용 중', 'EADDRINUSE', '서버 다 종료', '변경한 게 반영이 안 됨', 'already checked out at', '브랜치 체크아웃 안 됨', 'worktree prune', '워크트리 stash' 등을 언급할 때 사용한다. 새 워크트리의 .env 복사 등 최초 초기화는 worktree-setup 스킬 담당.
---

# Worktree Switch (전환 · 정리 · 삭제)

Claude Code는 `<repo>/.claude/worktrees/<name>` 에 워크트리를, `claude/<name>` 브랜치로 만든다. 이게 쌓이면 세 가지가 터진다: **포트 충돌**, **브랜치 체크아웃 충돌**, **삭제 실패**. 이 스킬은 그 셋을 순서대로 해결한다.

> 최초 초기화(`.env` 복사, vite `fs.allow` 패치)는 **worktree-setup** 스킬 담당이다. 이 스킬은 그 다음 단계 — 이미 있는 워크트리 사이를 오가고 치우는 일만 다룬다.

## 0. 항상 진단부터

무엇을 하든 먼저 실행한다. 읽기 전용이라 부작용이 없다.

```bash
bash scripts/wt-doctor.sh [repo-path]
```

출력: 워크트리별 `branch / dirty / unpushed / 플래그(MAIN, PRUNABLE, LOCKED, MISSING_DIR, <-YOU_ARE_HERE)`, 그리고 **각 워크트리에 묶인 실행 중 프로세스**(LISTEN 포트 + PID + cmd).

이 진단 없이 kill 하거나 지우지 않는다. 특히 `dirty` 와 `unpushed` 를 보기 전에 삭제를 시작하지 않는다.

## 1. 서버 / 프로세스 종료

### 진짜 위험한 증상

포트가 안 뜨는 것(`EADDRINUSE`)은 눈에 보이니 차라리 안전하다. **더 위험한 건 서버가 멀쩡히 떠 있는데 그게 다른 워크트리의 코드를 서빙하는 경우다.** 내 수정이 화면에 반영되지 않고, 코드를 의심하며 시간을 태우게 된다.

그래서 "포트가 열려 있나"가 아니라 **"이 포트의 프로세스 cwd가 어느 워크트리인가"** 를 확인해야 한다. `wt-doctor.sh` 의 `PROCESSES` 섹션이 그 매핑이다. 수동으로 볼 때는:

```bash
lsof -nP -iTCP -sTCP:LISTEN            # 포트 → PID
lsof -a -p <PID> -d cwd -Fn            # PID → cwd (n 으로 시작하는 줄)
```

> 귀속은 반드시 **최장 일치**로 판단한다. 워크트리가 메인 레포 하위(`.claude/worktrees/<name>`)에 중첩되므로, 접두사 첫 일치를 쓰면 모든 프로세스가 메인 레포 소유로 오탐된다.

### 종료 절차

```bash
kill <PID>          # SIGTERM — dev 서버가 포트를 정상 반납할 기회를 준다
sleep 2
kill -9 <PID>       # 위가 안 먹힐 때만
```

- **`pkill -f node` / `killall node` 금지.** 사용자의 다른 프로젝트, 에디터 LSP, MCP 서버까지 같이 죽는다. 항상 PID를 특정해서 죽인다.
- 종료 후 `wt-doctor.sh` 를 다시 돌려 해당 PID가 사라졌는지 확인한다. 사용자에게 "종료됐나요?"라고 묻지 말고 직접 확인한다.

### 이 스킬 밖에 있는 서버들

`lsof` 로 안 잡히거나 따로 다뤄야 하는 것들:

- **Claude Preview MCP**: `preview_list` 로 `serverId` 확인 → `preview_stop`. 워크트리를 지우기 전에 반드시 stop 한다(지운 디렉토리를 붙잡고 있으면 이후 preview가 깨진다).
- **백그라운드 Bash 태스크**: 이 세션에서 `run_in_background` 로 띄운 게 있으면 함께 정리한다.

## 2. 브랜치 체크아웃 충돌

```
fatal: 'claude/foo' is already checked out at '.../.claude/worktrees/foo'
```

git은 같은 브랜치를 두 곳에서 체크아웃하지 못하게 막는다. 정상 동작이므로 우회보다 **의도를 먼저 정한다.**

> ⚠️ **가장 흔한 함정:** 브랜치를 체크아웃해도 그 워크트리의 **미커밋 변경은 따라오지 않는다.** `wt-doctor.sh` 에서 `dirty > 0` 이면, 체크아웃해서 보는 코드는 사용자가 보던 코드가 아니다. 이 경우 먼저 커밋하거나 stash 하고, 그 사실을 사용자에게 알린다.

| 목적 | 방법 |
|---|---|
| 코드를 읽기만 하면 됨 | **체크아웃하지 말고** 그 워크트리 경로를 직접 읽는다. 대부분 이게 정답이다. |
| 그 커밋 상태를 잠깐 확인 | `git checkout --detach <branch>` — detached는 중복 체크아웃이 허용된다 |
| 그 위에서 새로 작업 | `git switch -c local/<name> <branch>` — 새 브랜치라 충돌 없음 |
| 작업이 끝나 워크트리가 불필요 | 워크트리를 먼저 제거(§3) → 그 다음 체크아웃 |

**사용자의 메인 체크아웃을 건드리지 않는다.** 메인에서 `checkout`/`rebase` 를 하면 열려 있는 에디터·실행 중인 dev 서버·미커밋 변경을 망친다. 작업이 필요하면 새 워크트리를 만들어서 한다.

## 3. 워크트리 삭제

**순서가 중요하다: §1 서버 종료 → §3 삭제.** 서버가 워크트리 디렉토리를 붙잡은 채로 지우면 remove가 실패하거나, 성공해도 죽은 경로를 물고 있는 좀비 프로세스가 남는다.

```bash
bash scripts/wt-remove.sh <worktree-path|이름조각> [--delete-branch] [--force]
```

스크립트가 하는 일 — 가드 3종 검사 → 미커밋 변경 자동 stash → `worktree remove` → `worktree prune` → 브랜치 상태 보고.

**거부(REFUSED)하는 경우** — 모두 의도된 안전장치다. 강제 통과시키지 말고 원인을 먼저 해소한다:

- 메인 워크트리를 지정했을 때
- 지금 그 워크트리 안에 서 있을 때 → 밖으로 이동 후 재실행
- 그 워크트리에서 서버가 돌고 있을 때 → 출력된 `kill <PID>` 실행 후 재실행

**미커밋 변경은 자동으로 stash 된다** (`-u` 라서 untracked 파일도 포함). stash는 워크트리가 아니라 **레포**에 저장되므로 워크트리를 지운 뒤에도 살아남는다. 스크립트가 출력하는 복구 명령을 **반드시 사용자에게 그대로 전달한다** — 안 그러면 사용자는 변경이 사라진 줄 안다.

```bash
git stash list
git stash apply stash@{0}
```

**브랜치는 기본적으로 유지된다.** `--delete-branch` 를 줘도 `git branch -d`(안전 삭제)만 시도하며, 병합 안 된 브랜치는 git이 거부한다. `git branch -D` 강제 삭제는 PR이 머지됐거나 푸시된 게 확인될 때만, 사용자 확인을 받고 실행한다.

### 실패 유형별 대응

| 증상 | 원인 | 대응 |
|---|---|---|
| `contains modified or untracked files` | 미커밋 변경 | 스크립트가 자동 stash — 그래도 남으면 `--force` |
| `is locked` | 워크트리 lock | `git worktree unlock <path>` 후 재실행 |
| 목록에는 있는데 디렉토리가 없음 (`PRUNABLE` / `MISSING_DIR`) | 디렉토리를 수동으로 지움 | `git worktree prune` |
| `.claude/worktrees/` 에 빈 디렉토리만 남음 | remove 후 잔여 | `git worktree prune` 후 빈 디렉토리 삭제 |

## 4. 결과 보고

```
워크트리 정리 완료 (repo: <경로>)
- 종료한 서버: :5173 (pid 12345, ./.claude/worktrees/foo)
- 제거: ./.claude/worktrees/foo
- 미커밋 변경 3건 → stash 대피: "wt-remove: claude/foo 2026-08-20 16:47"
  복구: git stash apply stash@{0}
- 브랜치 claude/foo 는 유지됨 (unpushed 2 커밋)
- 남은 워크트리: 2개
```

`unpushed > 0` 이거나 stash가 생겼으면 **반드시 명시한다.** 이 두 가지가 유일한 데이터 손실 경로다.

## 절대 하지 말 것

- `pkill -f node`, `killall node` — 무관한 프로세스까지 죽인다
- `rm -rf <worktree>` — git 메타데이터가 남아 목록이 깨진다. 반드시 `git worktree remove`
- 진단 없이 `--force` 먼저 쓰기 — `--force`는 미커밋 변경을 그대로 날린다
- `dirty`/`unpushed` 확인 전에 삭제 시작하기
- 사용자의 메인 체크아웃에서 `checkout`/`rebase` 하기
