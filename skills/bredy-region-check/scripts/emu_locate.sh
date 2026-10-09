#!/usr/bin/env bash
# 에뮬레이터 위치와 앱 언어를 맞춘다. '현재 위치로 찾기'를 누르기 전에 쓴다.
#
# 사용: emu_locate.sh <serial> <장소|lng lat> [ko|reset|keep]
#   장소: gangnam(서울 강남구) guro(서울 구로구) bundang(경기 성남시) haeundae(부산 해운대구) sejong(세종)
#   ko    : 앱만 한국어(ko-KR)로 — 에뮬레이터는 en-US 라 역지오코딩이 "Seoul / Gangnam District" 영어로 온다
#   reset : 앱 언어 설정을 지운다(시스템 언어를 따름)
#   keep  : 언어는 그대로(기본)
# 앱 언어를 바꾸면 액티비티가 다시 만들어져 화면이 처음 상태로 돌아간다. 다른 세션이 쓰는 중이면 바꾸지 않는다.
set -euo pipefail
export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"

S=${1:?serial}
shift
case "${1:-}" in
  gangnam)  LNG=127.0276; LAT=37.4979; shift ;;
  guro)     LNG=126.8874; LAT=37.4954; shift ;;
  bundang)  LNG=127.1086; LAT=37.3595; shift ;;
  haeundae) LNG=129.1604; LAT=35.1631; shift ;;
  sejong)   LNG=127.2890; LAT=36.4800; shift ;;
  *)        LNG=${1:?lng}; LAT=${2:?lat}; shift 2 ;;
esac
LOCALE=${1:-keep}

adb -s "$S" emu geo fix "$LNG" "$LAT" >/dev/null
echo "geo fix $LNG $LAT (location_mode=$(adb -s "$S" shell settings get secure location_mode))"
adb -s "$S" shell dumpsys package app.bredy.mobile | grep -E "ACCESS_(FINE|COARSE)_LOCATION: granted" | sed 's/^ */  /' || echo "  위치 권한 아직 없음(버튼을 누르면 묻는다)"

case "$LOCALE" in
  ko)    adb -s "$S" shell cmd locale set-app-locales app.bredy.mobile --locales ko-KR ;;
  reset) adb -s "$S" shell cmd locale set-app-locales app.bredy.mobile --locales "" ;;
  keep)  ;;
  *)     echo "언어 인자는 ko|reset|keep" >&2; exit 2 ;;
esac
adb -s "$S" shell cmd locale get-app-locales app.bredy.mobile
