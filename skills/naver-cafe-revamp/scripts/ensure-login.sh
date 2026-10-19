#!/bin/zsh
# usage: ensure-login.sh  — 카페 계정 세션을 열고(없으면 NC_PROFILE 로) 네이버 로그인·카페 관리 권한을 확인한다.
# 종료 코드: 0 준비됨 / 2 사람이 해야 함(캡차·2단계 인증·저장된 비밀번호 없음)
source ${0:A:h}/env.sh
if ! (cd "$NC_HOME" && npx --yes --package @playwright/cli playwright-cli list 2>/dev/null) | grep -A1 -- "- $NC_SESSION:" | grep -q "status: open"; then
  : ${NC_PROFILE:?세션이 닫혀 있습니다. NC_PROFILE(이 계정 전용 크롬 프로필)을 정하세요}
  rm -f "$NC_PROFILE"/Singleton* 2>/dev/null
  pwc open "https://cafe.naver.com/ManageHome.nhn?clubid=$NC_CLUB" --browser chrome --headed --profile "$NC_PROFILE" >/dev/null; sleep 5
fi
pwc goto "https://cafe.naver.com/ManageHome.nhn?clubid=$NC_CLUB" >/dev/null; pwc dialog-accept >/dev/null; sleep 4
url=$(pwr eval "location.href")
if [[ "$url" == *nid.naver.com* ]]; then
  filled=$(pwr eval "(()=>{const id=document.querySelector('#id'),pw=document.querySelector('#pw'); return (id&&id.value||'')+'|'+!!(pw&&pw.value)})()" | tr -d '"')  # eval 결과는 따옴표가 붙은 JSON 문자열
  echo "로그인 화면: $filled"
  [[ "$filled" == ?*\|true ]] || { echo "저장된 아이디·비밀번호가 채워지지 않음 — 사람이 로그인해야 함"; exit 2; }
  snap >/dev/null; keep=$(ref 'checkbox "로그인 상태 유지"'); [ -n "$keep" ] && pwc check $keep >/dev/null
  pwc click $(ref 'button "로그인"') >/dev/null; sleep 6
  pwc goto "https://cafe.naver.com/ManageHome.nhn?clubid=$NC_CLUB" >/dev/null; sleep 4
  [[ "$(pwr eval "location.href")" == *nid.naver.com* ]] && { echo "로그인 실패(캡차·2단계 인증일 수 있음)"; exit 2; }
fi
[[ "$(pwr eval "document.body.innerText.includes('카페관리')||!!document.querySelector('iframe')")" == "true" ]] || { echo "카페 관리 화면이 안 열림: $url"; exit 2; }
echo "준비됨: 로그인·카페 관리 권한 확인 (clubid $NC_CLUB)"
