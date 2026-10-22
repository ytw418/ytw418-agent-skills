#!/bin/zsh
# usage: release-login.sh  — ensure-login.sh 로 연 자기 탭을 닫고 자동화 크롬에서 떼고 네이버 잠금을 푼다. 작업 끝(성공·실패 모두)에 부른다.
source ${0:A:h}/env.sh
pwc tab-close >/dev/null 2>&1
pwc detach >/dev/null 2>&1
[ "$(cat "$NC_LOCK/owner" 2>/dev/null)" = "$NC_SESSION" ] && rm -rf "$NC_LOCK"
echo "자동화 크롬 탭 닫음·잠금 해제"
