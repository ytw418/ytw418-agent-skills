#!/usr/bin/env bash
# 에뮬레이터 화면 조작 도우미. 메모리가 빠듯하면 uiautomator·screencap 이 수십 초 멈추므로 모두 시간 제한을 둔다.
#
# 사용: emu_ui.sh <serial> <명령> [인자]
#   texts                    화면의 text/content-desc 를 위에서부터 찍는다
#   has <글자>               화면에 글자가 있으면 0, 없으면 1
#   wait <글자> [초=30]      글자가 보일 때까지 기다린다(없으면 1)
#   tap <content-desc>       content-desc 가 정확히 같은 노드의 가운데를 누른다(RN accessibilityLabel)
#   open <딥링크>            예: bredy://settings/region
#   shot <파일.png>          화면을 캡처한다
set -euo pipefail
export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"

S=${1:?serial}; CMD=${2:?command}; ARG=${3:-}
XML=/tmp/emu-ui-$S.xml

limit() { perl -e 'alarm shift; exec @ARGV' "$@"; }

dump() {
  limit 45 adb -s "$S" shell uiautomator dump /sdcard/emu-ui.xml >/dev/null 2>&1 || true
  limit 20 adb -s "$S" shell cat /sdcard/emu-ui.xml > "$XML" 2>/dev/null || : > "$XML"
}

case "$CMD" in
  texts)
    dump
    grep -oE '(text|content-desc)="[^"]+"' "$XML" | awk '!seen[$0]++'
    ;;
  has)
    dump
    grep -q -- "$ARG" "$XML"
    ;;
  wait)
    end=$(( $(date +%s) + ${4:-30} ))
    while [ "$(date +%s)" -lt "$end" ]; do
      dump
      grep -q -- "$ARG" "$XML" && exit 0
      sleep 2
    done
    echo "안 보임: $ARG" >&2
    exit 1
    ;;
  tap)
    dump
    xy=$(python3 - "$XML" "$ARG" <<'PY'
import re, sys
xml, label = open(sys.argv[1], encoding="utf-8").read(), sys.argv[2]
for node in re.findall(r"<node [^>]*>", xml):
    m = re.search(r'content-desc="([^"]*)"', node)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
    if m and b and m.group(1) == label:
        x1, y1, x2, y2 = map(int, b.groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
PY
)
    [ -n "$xy" ] || { echo "노드 없음: $ARG" >&2; exit 1; }
    # shellcheck disable=SC2086
    adb -s "$S" shell input tap $xy
    echo "tap $ARG @ $xy"
    ;;
  open)
    adb -s "$S" shell am start -a android.intent.action.VIEW -d "$ARG" app.bredy.mobile >/dev/null
    ;;
  shot)
    limit 90 adb -s "$S" exec-out screencap -p > "$ARG" || true
    if [ ! -s "$ARG" ]; then
      limit 90 adb -s "$S" shell screencap -p /sdcard/emu-shot.png && adb -s "$S" pull /sdcard/emu-shot.png "$ARG" >/dev/null
    fi
    ls -la "$ARG"
    ;;
  *)
    echo "모르는 명령: $CMD" >&2
    exit 2
    ;;
esac
