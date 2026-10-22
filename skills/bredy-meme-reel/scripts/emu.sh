#!/bin/bash
# SNS 전용 에뮬레이터 bredy_sns(5560). 사용: emu.sh on | off | shot <png> | tap <x> <y> | text "<한글 가능>" | push <mp4>
# 좌표는 1080×2400 기준. 끝나면 반드시 off (CPU — 사용자 요청 10-22).
A=(~/Library/Android/sdk/platform-tools/adb -s emulator-5560)
case $1 in
 on) pgrep -f "avd bredy_sns" >/dev/null || (nohup ~/Library/Android/sdk/emulator/emulator -avd bredy_sns -port 5560 -no-snapshot-save -no-audio >/tmp/bredy_sns.log 2>&1 &)
     "${A[@]}" wait-for-device; until [ "$("${A[@]}" shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 3; done; "${A[@]}" shell ime set com.android.adbkeyboard/.AdbIME >/dev/null;;
 off) "${A[@]}" emu kill;;
 shot) "${A[@]}" exec-out screencap -p > "$2"; sips -Z 600 "$2" >/dev/null;;
 tap) "${A[@]}" shell input tap $2 $3;;
 text) "${A[@]}" shell am broadcast -a ADB_INPUT_B64 --es msg "$(printf '%s' "$2" | base64)" >/dev/null;;
 push) "${A[@]}" shell rm -f /sdcard/Movies/*.mp4; "${A[@]}" push "$2" /sdcard/Movies/today.mp4 >/dev/null; "${A[@]}" shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Movies/today.mp4 >/dev/null;;
esac
