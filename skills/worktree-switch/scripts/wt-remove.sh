#!/usr/bin/env bash
# 워크트리를 안전한 순서로 제거한다: 가드 검사 → 자동 stash → remove → prune.
# 사용법: wt-remove.sh <worktree-path|이름조각> [--delete-branch] [--force]
#
# 설계 원칙: 프로세스를 죽이지 않는다. 실행 중인 서버가 있으면 "거부하고"
# 정확한 kill 명령을 출력한다 — 죽이는 행위는 호출자가 의도적으로 해야 한다.
#
# macOS 기본 bash 3.2 호환: mapfile 및 빈 배열 확장(set -u 하에서 unbound)을
# 쓰지 않고 개행 구분 문자열 + while read 로 처리한다.
set -uo pipefail

TARGET_ARG="${1:-}"
DELETE_BRANCH=0
FORCE=0
shift 2>/dev/null || true
for a in "$@"; do
    case "$a" in
        --delete-branch) DELETE_BRANCH=1 ;;
        --force) FORCE=1 ;;
        *) echo "ERROR: 알 수 없는 옵션: $a" >&2; exit 2 ;;
    esac
done
if [ -z "$TARGET_ARG" ]; then
    echo "사용법: wt-remove.sh <worktree-path|이름조각> [--delete-branch] [--force]" >&2
    exit 2
fi

MAIN=$(git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2; exit}')
if [ -z "$MAIN" ]; then
    echo "ERROR: git 레포 안에서 실행하세요." >&2
    exit 1
fi
PATHS=$(git worktree list --porcelain | awk '/^worktree /{print $2}')

# --- 타깃 해석: 정확한 경로 우선, 없으면 이름 조각으로 유일 매칭 ----------
TARGET=""
while IFS= read -r p; do
    [ "$p" = "$TARGET_ARG" ] && TARGET="$p"
done <<EOF
$PATHS
EOF

if [ -z "$TARGET" ]; then
    MATCHES=$(printf '%s\n' "$PATHS" | grep -F -- "$TARGET_ARG" || true)
    n=$(printf '%s' "$MATCHES" | grep -c . || true)
    if [ "$n" -eq 1 ]; then
        TARGET="$MATCHES"
    elif [ "$n" -gt 1 ]; then
        echo "ERROR: '$TARGET_ARG' 가 여러 워크트리에 매칭됩니다:" >&2
        printf '  %s\n' "$MATCHES" >&2
        exit 1
    else
        echo "ERROR: '$TARGET_ARG' 에 해당하는 워크트리 없음. 현재 목록:" >&2
        printf '%s\n' "$PATHS" | sed 's/^/  /' >&2
        exit 1
    fi
fi

BRANCH=$(git -C "$TARGET" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
echo "TARGET: $TARGET  (branch=$BRANCH)"

# --- 가드 1: 메인 워크트리는 삭제 불가 -----------------------------------
if [ "$TARGET" = "$MAIN" ]; then
    echo "REFUSED: 메인 워크트리($MAIN)는 제거할 수 없습니다." >&2
    exit 1
fi

# --- 가드 2: 지금 서 있는 워크트리는 삭제 불가 ---------------------------
case "$PWD" in
    "$TARGET"|"$TARGET"/*)
        echo "REFUSED: 현재 이 워크트리 안에 있습니다. 먼저 밖으로 이동하세요:" >&2
        echo "  cd $MAIN && wt-remove.sh $TARGET_ARG" >&2
        exit 1
        ;;
esac

# --- 가드 3: 이 워크트리에 묶인 실행 중 프로세스 --------------------------
# 최장 일치로 귀속시킨다. 워크트리가 메인 하위(.claude/worktrees/<name>)에
# 중첩되므로 첫 일치를 쓰면 모든 프로세스가 메인 소유로 오탐된다.
busy=0
while read -r pid port; do
    [ -z "$pid" ] && continue
    d=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | awk '/^n/{print substr($0,2); exit}')
    [ -z "$d" ] && continue
    best=""
    while IFS= read -r p; do
        [ -z "$p" ] && continue
        case "$d" in
            "$p"|"$p"/*) [ ${#p} -gt ${#best} ] && best="$p" ;;
        esac
    done <<EOF
$PATHS
EOF
    if [ "$best" = "$TARGET" ]; then
        [ $busy -eq 0 ] && echo "REFUSED: 이 워크트리에서 실행 중인 서버가 있습니다:" >&2
        echo "  pid=$pid  $port   →  kill $pid" >&2
        busy=1
    fi
done < <(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2, $9}' | sort -u)
if [ $busy -eq 1 ]; then
    echo "위 프로세스를 먼저 종료한 뒤 다시 실행하세요 (kill → 2초 후 미종료 시 kill -9)." >&2
    exit 1
fi

# --- 미커밋 변경: 자동 stash --------------------------------------------
STASHED=0
STASH_MSG=""
if [ -d "$TARGET" ]; then
    dirty=$(git -C "$TARGET" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [ "$dirty" -gt 0 ]; then
        STASH_MSG="wt-remove: $BRANCH $(date '+%Y-%m-%d %H:%M:%S')"
        echo "미커밋 변경 $dirty 건 → stash 로 대피 중..."
        if git -C "$TARGET" stash push -u -m "$STASH_MSG" >/dev/null 2>&1; then
            STASHED=1
            echo "  stashed: \"$STASH_MSG\""
        else
            echo "ERROR: stash 실패. 수동 확인 필요:" >&2
            git -C "$TARGET" status --short >&2
            exit 1
        fi
    fi
fi

# --- 제거 + prune -------------------------------------------------------
if [ $FORCE -eq 1 ]; then
    git worktree remove --force "$TARGET" 2>/tmp/wt-remove.err
else
    git worktree remove "$TARGET" 2>/tmp/wt-remove.err
fi
if [ $? -ne 0 ]; then
    echo "ERROR: git worktree remove 실패:" >&2
    cat /tmp/wt-remove.err >&2
    echo "  → 잔여 파일이 원인이면 --force 로 재시도하세요." >&2
    [ $STASHED -eq 1 ] && echo "  (변경분은 이미 stash 에 대피됨: \"$STASH_MSG\")" >&2
    exit 1
fi
echo "removed: $TARGET"
git worktree prune
echo "pruned."

# --- 브랜치 처리 --------------------------------------------------------
if [ "$BRANCH" != "?" ] && [ "$BRANCH" != "HEAD" ]; then
    if up=$(git rev-parse --abbrev-ref "$BRANCH@{u}" 2>/dev/null); then
        unpushed=$(git rev-list --count "$up..$BRANCH" 2>/dev/null || echo "?")
    else
        up="(없음)"
        unpushed="?"
    fi
    echo "branch: $BRANCH  upstream=$up  unpushed=$unpushed"
    if [ $DELETE_BRANCH -eq 1 ]; then
        # -d(안전 삭제)만 쓴다. 병합 안 된 브랜치는 git이 거부하게 두고,
        # -D 강제 삭제는 호출자가 직접 판단해서 실행해야 한다.
        if git branch -d "$BRANCH" 2>/tmp/wt-branch.err; then
            echo "branch deleted: $BRANCH"
        else
            echo "branch 삭제 보류 (병합 안 됨):" >&2
            cat /tmp/wt-branch.err >&2
            echo "  확실하다면: git branch -D $BRANCH" >&2
        fi
    else
        echo "  (브랜치는 유지됨. 삭제하려면: git branch -d $BRANCH)"
    fi
fi

# --- 복구 안내 ----------------------------------------------------------
if [ $STASHED -eq 1 ]; then
    cat <<EOF

⚠️  대피시킨 변경이 stash 에 있습니다. stash 는 워크트리가 아니라 레포에
    저장되므로, 워크트리를 지운 뒤에도 아래 명령으로 복구할 수 있습니다:

      git stash list
      git stash apply stash@{0}     # 적용 (stash 유지)
      git stash pop stash@{0}       # 적용 후 stash 제거

    브랜치 $BRANCH 를 살려뒀다면 그 브랜치를 체크아웃한 뒤 apply 하세요.
EOF
fi
exit 0
