#!/bin/zsh
# usage: ensure-browser.sh  — 브리디 자동화 크롬(CDP 9222)에 붙어 '자기 탭'을 열고 네이버 로그인·카페 관리 권한을 확인한다.
# 2026-10-19: 네이버 계정은 본계정 하나뿐이라(사용자) 전용 프로필(.chrome-profile) 대신 자동화 크롬을 같이 쓴다. 끝나면 release-browser.sh.
# 종료 코드: 0 준비됨 / 2 사람이 해야 함(캡차·2단계 인증·저장된 비밀번호 없음)
D=${0:A:h}; source $D/env.sh
"$HOME/.local/bin/bredy-chrome" || { echo "브리디 자동화 크롬(9222)이 안 켜짐"; exit 2; }
mkdir -p "${RC_LOCK:h}"
if [ "$(cat "$RC_LOCK/owner" 2>/dev/null)" != "$RC_SESSION" ]; then
  while ! mkdir "$RC_LOCK" 2>/dev/null; do
    [ -n "$(find "$RC_LOCK" -maxdepth 0 -mmin +30 2>/dev/null)" ] && rm -rf "$RC_LOCK"; sleep 2
  done
  echo "$RC_SESSION" > "$RC_LOCK/owner"
fi
if ! pwc tab-list 2>/dev/null | grep -q 'cafe.naver.com\|about:blank'; then
  pwc detach >/dev/null 2>&1
  (cd "$RC_HOME" && npx --yes --package @playwright/cli playwright-cli attach --cdp=http://127.0.0.1:9222 --session="$RC_SESSION" >/dev/null 2>&1)
  pwc tab-new about:blank >/dev/null
fi
pwc goto "https://cafe.naver.com/ManageHome.nhn?clubid=$RC_CLUB" >/dev/null; pwc dialog-accept >/dev/null; sleep 4
url=$($D/pw.sh eval "location.href")
if [[ "$url" == *nid.naver.com* ]]; then
  filled=$($D/pw.sh eval "(()=>{const id=document.querySelector('#id'),pw=document.querySelector('#pw'); return (id&&id.value||'')+'|'+!!(pw&&pw.value)})()" | tr -d '"')
  echo "로그인 화면: $filled"
  [[ "$filled" == ?*\|true ]] || { echo "저장된 아이디·비밀번호가 채워지지 않음 — 사람이 로그인해야 함"; exit 2; }
  $D/snap.sh >/dev/null
  keep=$($D/ref.sh 'checkbox "로그인 상태 유지"'); [ -n "$keep" ] && pwc check $keep >/dev/null
  pwc click $($D/ref.sh 'button "로그인"') >/dev/null; sleep 6
  pwc goto "https://cafe.naver.com/ManageHome.nhn?clubid=$RC_CLUB" >/dev/null; sleep 4
  url=$($D/pw.sh eval "location.href")
  [[ "$url" == *nid.naver.com* ]] && { echo "로그인 실패(캡차·2단계 인증일 수 있음): $url"; exit 2; }
fi
ok=$($D/pw.sh eval "document.body.innerText.includes('카페관리') || document.body.innerText.includes('로봇천국')")
[[ "$ok" == "true" ]] || { echo "카페 관리 화면이 안 열림: $url"; exit 2; }
echo "준비됨: 로그인·카페 관리 권한 확인"
