#!/usr/bin/env bash
# Paseo 앱·Supervisor·데몬·Helper 를 모두 내리고 앱을 다시 띄운다.
# 실행 중인 에이전트(이 스크립트를 부른 세션 포함)가 끊긴다. 사용자 확인 뒤에만 --yes 로 실행한다.
# 사용: bash relaunch.sh --yes
set -u

if [ "${1:-}" != "--yes" ]; then
  echo "실행 중인 에이전트가 모두 끊긴다. 사용자 확인 뒤 --yes 를 붙여 실행한다."
  exit 1
fi

PASEO_BIN="$(command -v paseo || echo /Applications/Paseo.app/Contents/Resources/bin/paseo)"
PIDS="$("$PASEO_BIN" daemon status --json 2>/dev/null | python3 -I -c "
import json,sys
d=json.load(sys.stdin);print(d.get('pid',''),d.get('workerPid',''))" 2>/dev/null)"

# Paseo 안에서 돌면 이 셸도 같이 죽으므로 분리해서 실행한다.
nohup bash -c "
  osascript -e 'quit app \"Paseo\"'
  sleep 3
  kill $PIDS 2>/dev/null
  sleep 3
  pkill -f 'Paseo Helper' 2>/dev/null
  pkill -f 'Paseo Supervisor' 2>/dev/null
  sleep 2
  open -a Paseo
" >/tmp/paseo-relaunch.log 2>&1 &

echo "재시작 예약됨 (이전 Supervisor/워커: $PIDS). 로그: /tmp/paseo-relaunch.log"
