#!/usr/bin/env bash
# Paseo 데몬 상태를 읽기 전용으로 점검한다. 아무것도 재시작·수정하지 않는다.
# 사용: bash diagnose.sh
set -u

PASEO_BIN="$(command -v paseo || echo /Applications/Paseo.app/Contents/Resources/bin/paseo)"
PLIST=/Applications/Paseo.app/Contents/Info.plist

echo "== 버전"
APP_VER="$(defaults read "$PLIST" CFBundleShortVersionString 2>/dev/null || echo '?')"
CLI_VER="$("$PASEO_BIN" --version 2>/dev/null || echo '?')"
STATUS="$("$PASEO_BIN" daemon status --json 2>/dev/null)"
if [ -z "$STATUS" ]; then
  echo "데몬 상태를 읽지 못함 — 데몬이 꺼졌거나 CLI 가 다른 PASEO_HOME 을 본다"
  exit 1
fi
field() { printf '%s' "$STATUS" | python3 -I -c "import json,sys;d=json.load(sys.stdin);print(d.get('$1',''))"; }
DAEMON_VER="$(field daemonVersion)"
SUP_PID="$(field pid)"
WORKER_PID="$(field workerPid)"
LOG="$(field logPath)"
echo "앱 $APP_VER / CLI $CLI_VER / 데몬 $DAEMON_VER"

echo "== 프로세스"
ps -o pid,lstart,etime,command -p "$SUP_PID","$WORKER_PID" 2>/dev/null | cut -c1-140

echo "== 이 셸의 DNS·키체인 (데몬이 아니라 이 프로세스 기준)"
python3 -I -c "import socket;socket.getaddrinfo('github.com',443);print('getaddrinfo ok')" 2>&1 | tail -1
security list-keychains >/dev/null 2>&1 && echo "keychain ok" || echo "keychain FAIL"

echo "== 현재 워커($WORKER_PID) 로그 오류 수 (최근 3000줄)"
RECENT="$(tail -n 3000 "$LOG" 2>/dev/null | grep "\"pid\":$WORKER_PID,")"
count() { printf '%s\n' "$RECENT" | grep -c "$1"; }
DNS_ERR=$(count "Could not resolve host")
GH_ERR=$(count "GitHubCommandError")
TRANSPORT_ERR=$(count "ProcessTransport is not ready")
echo "Could not resolve host: $DNS_ERR"
echo "GitHubCommandError: $GH_ERR"
echo "ProcessTransport is not ready: $TRANSPORT_ERR"

echo "== 프로바이더"
printf '%s' "$STATUS" | python3 -I -c "
import json,sys
for p in json.load(sys.stdin).get('providers',[]):
    print(f\"{p['provider']}: available={p['available']} error={p.get('error')}\")"

echo "== 판정"
PROBLEM=0
if [ "$DAEMON_VER" != "$APP_VER" ]; then
  echo "- 버전 불일치: 앱은 $APP_VER 인데 데몬은 $DAEMON_VER. 앱 업데이트 뒤 데몬이 재시작되지 않았다."
  PROBLEM=1
fi
LOGIN_PID="$(pgrep -x loginwindow | head -1)"
to_epoch() { LC_ALL=C date -j -f '%a %b %d %T %Y' "$(ps -o lstart= -p "$1" 2>/dev/null | sed 's/ *$//')" +%s 2>/dev/null; }
if [ -n "$LOGIN_PID" ] && [ -n "$SUP_PID" ] && [ "$(to_epoch "$SUP_PID")" -lt "$(to_epoch "$LOGIN_PID")" ] 2>/dev/null; then
  echo "- Supervisor 가 지금 로그인 세션보다 먼저 떴다(로그인 $(ps -o lstart= -p "$LOGIN_PID")). 강제 로그아웃(WindowServer 멈춤) 뒤 살아남아 DNS·키체인과 끊겼다. relaunch.sh 로 고친다."
  PROBLEM=1
fi
if [ "$DNS_ERR" -gt 0 ]; then
  echo "- 데몬이 DNS 를 못 쓴다(Could not resolve host). Supervisor 가 GUI 세션 서비스(DNS·키체인)와 끊긴 상태일 가능성이 크다."
  PROBLEM=1
fi
if [ "$PROBLEM" -eq 0 ]; then
  echo "- 데몬 쪽 이상 징후 없음"
fi
