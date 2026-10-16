#!/bin/bash
# 실행 중인 모든 크롬 인스턴스와 창·탭을 보여 준다. 사용자 크롬(=--user-data-dir 없는 인스턴스)에 [USER] 표시.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
CJ="$("$DIR/build.sh")" || exit 1
for pid in $(pgrep -x "Google Chrome"); do
  cmd=$(ps -o command= -p "$pid")
  prof=$(echo "$cmd" | grep -o -- '--user-data-dir=[^ ]*' | sed 's/--user-data-dir=//')
  tag="[USER]"; [ -n "$prof" ] && tag="[automation: $prof]"
  echo "== pid $pid $tag"
  "$CJ" "$pid" tabs 2>/dev/null | sed 's/^/   /'
done
