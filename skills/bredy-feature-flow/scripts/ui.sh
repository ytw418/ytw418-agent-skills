#!/bin/bash
# 에뮬레이터 조작 도우미. 사용: ui.sh dump | ui.sh tap "글자" | ui.sh long "글자" | ui.sh shot <경로.png>
A=~/Library/Android/sdk/platform-tools/adb
find_xy() {
  $A shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  $A shell cat /sdcard/ui.xml | python3 -c '
import sys,re
x=sys.stdin.read(); t=sys.argv[1] if len(sys.argv)>1 else None
for m in re.finditer(r"(?:text|content-desc)=\"([^\"]+)\"[^>]*?bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"",x):
    cx=(int(m.group(2))+int(m.group(4)))//2; cy=(int(m.group(3))+int(m.group(5)))//2
    if t is None: print(m.group(1)[:50],cx,cy)
    elif t in m.group(1): print(cx,cy); break
' "$@"
}
case "$1" in
  dump) find_xy ;;
  tap|long)
    xy=$(find_xy "$2"); [ -z "$xy" ] && { echo "NOTFOUND $2 (dump 로 좌표를 보고 adb input tap 을 직접 쓴다)"; exit 1; }
    set -- "$1" $xy
    if [ "$1" = tap ]; then $A shell input tap $2 $3; else $A shell input swipe $2 $3 $(( $2 + 1 )) $(( $3 + 1 )) 2000; fi
    echo "$1 @ $2 $3" ;;
  shot) $A exec-out screencap -p > "$2"; echo "$2" ;;
  *) echo "사용: ui.sh dump | tap 글자 | long 글자 | shot 경로"; exit 1 ;;
esac
