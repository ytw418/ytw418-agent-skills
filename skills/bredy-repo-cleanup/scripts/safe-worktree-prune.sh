#!/usr/bin/env bash
# 다 끝난 git 워크트리만 골라 지운다. 기본은 목록만(dry-run), --apply 를 줘야 지운다.
# 사용: safe-worktree-prune.sh <repo> [--apply] [--keep-days N]
# 지우는 조건(모두 만족해야 한다):
#   1. 미커밋·미추적 변경이 0 (git status --porcelain 이 비어 있음)
#   2. HEAD 가 origin/dev·origin/main·origin/master 중 하나에 이미 들어가 있음(머지됨)
#   3. 마지막 커밋이 N일(기본 1일) 안이 아님 — 오늘 만든 워크트리는 다른 세션이 쓰는 중일 수 있다
#   4. 그 워크트리 안에서 도는 프로세스(next dev·metro·jest 등)가 없음
#   5. 원본 체크아웃(메인 작업 트리)은 절대 대상이 아님
# 브랜치는 git branch -d(머지된 것만 지워짐)로 같이 지운다. -D 는 쓰지 않는다.
set -uo pipefail
repo=${1:?repo 경로}; shift
apply=0; keep_days=1
while [ $# -gt 0 ]; do case "$1" in --apply) apply=1;; --keep-days) keep_days=$2; shift;; esac; shift; done
cd "$repo"
main=$(git rev-parse --show-toplevel)
git fetch -q origin 2>/dev/null || true
cutoff=$(date -v-"${keep_days}"d +%s 2>/dev/null || date -d "-${keep_days} day" +%s)
bases=$(for b in origin/dev origin/main origin/master; do git rev-parse -q --verify "$b" >/dev/null && echo "$b"; done)

busy_dirs=$(for p in $(pgrep -f 'node|next|expo|metro|jest|playwright' 2>/dev/null); do lsof -a -p "$p" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'; done | sort -u)

git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r w; do
  [ "$w" = "$main" ] && continue
  [ -d "$w" ] || { echo "SKIP(없음 — prune 대상) $w"; continue; }
  if [ -n "$(git -C "$w" status --porcelain 2>/dev/null)" ]; then echo "KEEP(변경 있음) $w"; continue; fi
  h=$(git -C "$w" rev-parse HEAD)
  merged=0; for b in $bases; do git merge-base --is-ancestor "$h" "$b" && merged=1 && break; done
  [ $merged = 1 ] || { echo "KEEP(머지 안 됨) $w"; continue; }
  [ "$(git -C "$w" log -1 --format=%ct)" -gt "$cutoff" ] && { echo "KEEP(최근 ${keep_days}일 안) $w"; continue; }
  if echo "$busy_dirs" | grep -q -F "$w"; then echo "KEEP(프로세스 실행 중) $w"; continue; fi
  br=$(git -C "$w" rev-parse --abbrev-ref HEAD)
  if [ $apply = 1 ]; then
    git worktree remove "$w" && echo "REMOVED $br $w"
    [ "$br" != HEAD ] && git branch -d "$br" >/dev/null 2>&1
  else
    echo "WOULD-REMOVE $br $(du -sh "$w" 2>/dev/null | cut -f1) $w"
  fi
done
[ $apply = 1 ] && git worktree prune
exit 0
