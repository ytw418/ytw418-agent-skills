#!/usr/bin/env bash
# 웹 '현재 위치로 찾기'가 쓰는 카카오 좌표→행정구역 API(coord2RegionCode)가 웹 JS 키로 열려 있는지 본다.
# 꺼져 있으면 웹에서 현재 위치는 항상 "현재 위치를 찾지 못했습니다"가 된다(코드 문제 아님).
#
# 사용: kakao_map_check.sh [breeder_web 경로] [origin]
#   기본: /Users/yoonseongjun/Desktop/pro/breeder_web, https://bredy.app
# 종료 코드: 0 켜짐, 1 꺼짐/거절, 2 키 없음
set -euo pipefail

WEB=${1:-/Users/yoonseongjun/Desktop/pro/breeder_web}
ORIGIN=${2:-https://bredy.app}

KEY=$(grep -hE '^NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=' "$WEB"/.env* 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)
[ -n "$KEY" ] || { echo "NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY 를 $WEB/.env* 에서 못 찾았다" >&2; exit 2; }

ENC_ORIGIN=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$ORIGIN")
# 강남역 좌표(사용자 위치 아님). 키는 출력하지 않는다.
RES=$(curl -s \
  -H "Authorization: KakaoAK $KEY" \
  -H "Origin: $ORIGIN" \
  -H "Referer: $ORIGIN/settings/region" \
  -H "KA: sdk/4.4.19 os/javascript lang/ko-KR origin/$ENC_ORIGIN" \
  "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=127.0276&y=37.4979")

echo "$RES" | head -c 300
echo
if echo "$RES" | grep -q '"region_1depth_name"'; then
  echo "OK: 카카오맵 켜짐($ORIGIN)"
  exit 0
fi
if echo "$RES" | grep -q 'OPEN_MAP_AND_LOCAL'; then
  echo "FAIL: 카카오 개발자 콘솔 > 내 애플리케이션 > 브리더 > 카카오맵 '사용 설정'이 꺼져 있다. 사용자에게 켜 달라고 한다."
  exit 1
fi
echo "FAIL: 위 응답을 본다. 도메인 문제면 콘솔 > 플랫폼 > Web 에 $ORIGIN 를 등록해야 한다."
exit 1
