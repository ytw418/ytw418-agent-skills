#!/bin/zsh
# usage: ensure-browser.sh  — robot-cafe 브라우저 세션을 열고 네이버 로그인·카페 관리 권한을 확인한다.
# 종료 코드: 0 준비됨 / 2 사람이 해야 함(캡차·2단계 인증·저장된 비밀번호 없음)
D=${0:A:h}; source $D/env.sh
if ! (cd "$RC_HOME" && npx --yes --package @playwright/cli playwright-cli list 2>/dev/null) | grep -A1 -- "- $RC_SESSION:" | grep -q "status: open"; then
  rm -f "$RC_HOME"/.chrome-profile/Singleton* 2>/dev/null
  pwc open "https://cafe.naver.com/ManageHome.nhn?clubid=$RC_CLUB" --browser chrome --headed --profile "$RC_HOME/.chrome-profile" >/dev/null
  sleep 5
fi
pwc goto "https://cafe.naver.com/ManageHome.nhn?clubid=$RC_CLUB" >/dev/null; pwc dialog-accept >/dev/null; sleep 4
url=$($D/pw.sh eval "location.href")
if [[ "$url" == *nid.naver.com* ]]; then
  filled=$($D/pw.sh eval "(()=>{const id=document.querySelector('#id'),pw=document.querySelector('#pw'); return (id&&id.value||'')+'|'+!!(pw&&pw.value)})()")
  echo "로그인 화면: $filled"
  [[ "$filled" == *ytw418*true* ]] || { echo "저장된 아이디·비밀번호가 채워지지 않음 — 사람이 로그인해야 함"; exit 2; }
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
