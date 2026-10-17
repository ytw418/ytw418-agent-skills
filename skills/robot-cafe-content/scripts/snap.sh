#!/bin/zsh
# usage: snap.sh [grep 패턴] [최대 줄]  — 현재 화면 스냅샷을 /tmp/rc_snap.yml 에 저장하고 패턴 줄만 출력
source "${0:A:h}/env.sh"
pwc snapshot > /tmp/rc_snap.yml
if [ -n "$1" ]; then grep -nE "$1" /tmp/rc_snap.yml | grep -v -- "- /url" | head -${2:-120}; fi
