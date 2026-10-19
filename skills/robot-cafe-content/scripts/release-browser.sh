#!/bin/zsh
# usage: release-browser.sh  — ensure-browser.sh 로 연 자기 탭을 닫고 자동화 크롬에서 떼고 네이버 잠금을 푼다. 실행 끝(성공·실패 모두)에 부른다.
D=${0:A:h}; source $D/env.sh
pwc tab-close >/dev/null 2>&1
pwc detach >/dev/null 2>&1
[ "$(cat "$RC_LOCK/owner" 2>/dev/null)" = "$RC_SESSION" ] && rm -rf "$RC_LOCK"
echo "자동화 크롬 탭 닫음·잠금 해제"
