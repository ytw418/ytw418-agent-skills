#!/usr/bin/env bash
# Paseo Supervisor 가 지금 로그인 세션보다 먼저 떴으면 내리고 앱을 다시 띄운다.
# WindowServer 가 멈춰 GUI 세션이 강제로 끝나도 Supervisor 는 살아남아 죽은 세션에 묶이고,
# 그 Supervisor 와 워커는 DNS·키체인을 못 쓴다(SKILL.md 장애 A).
# LaunchAgent(install-guard.sh)가 로그인할 때와 10분마다 실행한다.
# 사용: bash stale-guard.sh [--dry-run]
#   GUARD_LOGIN_EPOCH=<초> 로 로그인 시각을 덮어써 판정을 시험할 수 있다.
set -u
export LC_ALL=C

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

log() { echo "$(date '+%F %T') $*"; }

# ps lstart("Fri Oct  9 22:20:27 2026") → epoch 초
start_epoch() {
  local s
  s="$(ps -o lstart= -p "$1" 2>/dev/null | sed 's/ *$//')"
  [ -n "$s" ] || return 1
  date -j -f '%a %b %d %T %Y' "$s" +%s 2>/dev/null
}

LOGIN_PID="$(pgrep -x loginwindow | head -1)"
LOGIN_EPOCH="${GUARD_LOGIN_EPOCH:-$( [ -n "$LOGIN_PID" ] && start_epoch "$LOGIN_PID")}"
if [ -z "$LOGIN_EPOCH" ]; then
  log "loginwindow 시작 시각을 못 읽음 — 건너뜀"
  exit 0
fi

STALE=""
for pid in $(pgrep -f '^Paseo Supervisor'); do
  sup_epoch="$(start_epoch "$pid")" || continue
  if [ "$sup_epoch" -lt "$LOGIN_EPOCH" ]; then
    STALE="$STALE $pid"
  fi
done

if [ -z "$STALE" ]; then
  [ "$DRY" -eq 1 ] && log "정상: Supervisor 가 현재 로그인 이후에 떴다"
  exit 0
fi

CHILDREN=""
for pid in $STALE; do
  CHILDREN="$CHILDREN $(pgrep -P "$pid" | tr '\n' ' ')"
done
log "낡은 Supervisor 발견:$STALE (자식:$CHILDREN) — 로그인 $(date -r "$LOGIN_EPOCH" '+%F %T') 이전에 시작됨"

if [ "$DRY" -eq 1 ]; then
  log "--dry-run: 재시작하지 않음"
  exit 0
fi

osascript -e 'quit app "Paseo"' >/dev/null 2>&1
sleep 3
kill $STALE $CHILDREN 2>/dev/null
sleep 3
pkill -f 'Paseo Helper' 2>/dev/null
for pid in $STALE $CHILDREN; do kill -9 "$pid" 2>/dev/null; done
sleep 2
open -a Paseo
log "Paseo 다시 띄움"
