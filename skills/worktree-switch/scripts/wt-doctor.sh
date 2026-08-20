#!/usr/bin/env bash
# 읽기 전용 워크트리 진단. 부작용 없음 — 어떤 것도 죽이거나 지우지 않는다.
# 사용법: wt-doctor.sh [repo-path]   (생략 시 현재 디렉토리 기준)
set -uo pipefail

REPO_ARG="${1:-$PWD}"
if ! MAIN=$(git -C "$REPO_ARG" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2; exit}'); then
    echo "ERROR: '$REPO_ARG' 는 git 레포가 아닙니다." >&2
    exit 1
fi
# CUR_TOP은 반드시 실제 cwd 기준이어야 한다 (REPO_ARG 기준으로 잡으면
# 워크트리 안에서 실행해도 메인 레포를 "여기"로 오인한다).
CUR_TOP=$(git rev-parse --show-toplevel 2>/dev/null || echo "")

echo "MAIN_REPO: $MAIN"
echo "CURRENT:   ${CUR_TOP:-<unknown>}"
echo

# --- 워크트리 목록 ------------------------------------------------------
# porcelain 레코드는 빈 줄로 구분된다. path/branch/flag를 모아 한 줄로 출력.
declare -a WT_PATHS=()
echo "WORKTREES"
while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
        "worktree "*) wt="${line#worktree }" ;;
        "branch "*)   br="${line#branch refs/heads/}" ;;
        "detached")   br="(detached)" ;;
        "locked"*)    flags="${flags} LOCKED" ;;
        "prunable"*)  flags="${flags} PRUNABLE" ;;
        "")
            [[ -z "${wt:-}" ]] && continue
            WT_PATHS+=("$wt")
            marks="${flags:-}"
            [[ "$wt" == "$MAIN" ]] && marks="$marks MAIN"
            [[ -n "$CUR_TOP" && "$wt" == "$CUR_TOP" ]] && marks="$marks <-YOU_ARE_HERE"
            if [[ ! -d "$wt" ]]; then
                marks="$marks MISSING_DIR"
                dirty="?"
            else
                dirty=$(git -C "$wt" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
            fi
            # 푸시 안 된 커밋 수 (upstream 없으면 no-upstream)
            unpushed="-"
            if [[ "${br:-}" != "(detached)" && -d "$wt" ]]; then
                if up=$(git -C "$wt" rev-parse --abbrev-ref '@{u}' 2>/dev/null); then
                    unpushed=$(git -C "$wt" rev-list --count "$up..HEAD" 2>/dev/null || echo "?")
                else
                    unpushed="no-upstream"
                fi
            fi
            # 메인 레포 하위면 상대 경로로 줄여 표시 (전체 경로는 길어서 정렬이 깨진다)
            short="$wt"
            [[ "$wt" == "$MAIN"/* ]] && short="./${wt#$MAIN/}"
            [[ "$wt" == "$MAIN" ]] && short="."
            printf '  %-42s branch=%-38s dirty=%-4s unpushed=%s%s\n' \
                "$short" "${br:-?}" "$dirty" "$unpushed" "${marks:+ [${marks# }]}"
            wt=""; br=""; flags=""
            ;;
    esac
done < <(git -C "$REPO_ARG" worktree list --porcelain; echo)
echo

# --- 워크트리에 묶인 프로세스 -------------------------------------------
# 두 경로로 탐지한다:
#  (1) LISTEN 중인 TCP 소켓의 소유 PID → cwd가 워크트리 내부인지 확인 (dev 서버)
#  (2) 커맨드라인에 워크트리 경로가 박힌 프로세스 (cwd가 다른 워커/빌드 프로세스)
echo "PROCESSES (워크트리에 묶인 것만)"
found=0
REPORTED=""   # 중복 보고 방지용 PID 목록

cwd_of() { lsof -a -p "$1" -d cwd -Fn 2>/dev/null | awk '/^n/{print substr($0,2); exit}'; }
# 반드시 "최장 일치"로 귀속시킨다. 워크트리가 메인 레포 하위
# (.claude/worktrees/<name>)에 중첩되므로, 첫 일치를 쓰면 메인 경로가 항상
# 접두사로 먼저 걸려 모든 프로세스가 메인 소유로 오탐된다.
owner_wt() {
    local d="$1" wt best=""
    for wt in "${WT_PATHS[@]}"; do
        if [[ "$d" == "$wt" || "$d" == "$wt"/* ]]; then
            [[ ${#wt} -gt ${#best} ]] && best="$wt"
        fi
    done
    echo "$best"
}

# (1) LISTEN 소켓
while read -r pid port; do
    [[ -z "$pid" ]] && continue
    d=$(cwd_of "$pid"); [[ -z "$d" ]] && continue
    owner=$(owner_wt "$d"); [[ -z "$owner" ]] && continue
    cmd=$(ps -o command= -p "$pid" 2>/dev/null | cut -c1-70)
    o="$owner"; [[ "$owner" == "$MAIN"/* ]] && o="./${owner#$MAIN/}"; [[ "$owner" == "$MAIN" ]] && o="."
    printf '  LISTEN %-22s pid=%-7s wt=%s\n         cmd=%s\n' "$port" "$pid" "$o" "$cmd"
    REPORTED="$REPORTED $pid"
    found=1
done < <(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2, $9}' | sort -u)

# (2) 커맨드라인 매칭 — 중첩 워크트리에만 적용한다.
# 메인 레포 경로는 node_modules/... 형태로 거의 모든 프로세스의 커맨드라인에
# 등장하므로(turbo 데몬, 에디터, Claude 앱 자신까지) probe 대상에서 제외한다.
# 그러지 않으면 출력 전체가 오탐으로 뒤덮여 진단이 쓸모없어진다.
for wt in "${WT_PATHS[@]}"; do
    [[ "$wt" == "$MAIN" ]] && continue
    while read -r pid; do
        [[ -z "$pid" || "$pid" == "$$" ]] && continue
        case " $REPORTED " in *" $pid "*) continue ;; esac   # LISTEN에서 이미 보고됨
        cmd=$(ps -o command= -p "$pid" 2>/dev/null | cut -c1-70)
        [[ -z "$cmd" ]] && continue
        # 이 스크립트 자신과 Claude Code 세션 프로세스는 노이즈다
        case "$cmd" in
            *wt-doctor.sh*|*Claude.app*|*claude-code*) continue ;;
        esac
        s="$wt"; [[ "$wt" == "$MAIN"/* ]] && s="./${wt#$MAIN/}"
        printf '  CMDLINE %-21s pid=%-7s wt=%s\n          cmd=%s\n' "-" "$pid" "$s" "$cmd"
        REPORTED="$REPORTED $pid"
        found=1
    done < <(pgrep -f "$wt" 2>/dev/null)
done

[[ $found -eq 0 ]] && echo "  (없음 — 워크트리에 묶인 실행 중 프로세스 없음)"
echo

# --- 정리 후보 ----------------------------------------------------------
echo "HINTS"
git -C "$REPO_ARG" worktree list --porcelain | grep -q '^prunable' \
    && echo "  - prunable 항목 있음 → 'git worktree prune' 필요"
stash_n=$(git -C "$REPO_ARG" stash list 2>/dev/null | wc -l | tr -d ' ')
[[ "$stash_n" -gt 0 ]] && echo "  - stash $stash_n 개 존재 → 'git stash list' 로 확인 (워크트리 간 공유됨)"
echo "  - 삭제: scripts/wt-remove.sh <worktree-path>"
exit 0
