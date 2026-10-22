#!/bin/zsh
# usage: delete-articles.sh <게시판 id> <글번호> [글번호...]  — 그 게시판 목록에서 지정한 글만 체크해 삭제한다. 되돌릴 수 없으니 list-articles.sh 로 먼저 확인한다.
source ${0:A:h}/env.sh
M=$1; shift; IDS=$(IFS=,; echo "$*")
pwc tab-new "https://cafe.naver.com/f-e/cafes/$NC_CLUB/menus/$M?viewType=L" >/dev/null; sleep 7
chk=$(pwr eval "(()=>{const want=[$IDS]; for(const id of want){const c=document.getElementById('check_'+id); if(!c) return 'missing '+id; if(!c.checked) c.click();} const on=[...document.querySelectorAll('input[id^=check_]')].filter(c=>c.checked).map(c=>+c.id.slice(6)).sort(); return on.join(',')===want.slice().sort().join(',')?'ok '+on:'mismatch '+on})()")
echo "선택: $chk"
[[ "$chk" == '"ok '* ]] || { echo "선택이 요청과 달라 멈춤"; pwc tab-close >/dev/null; exit 1; }
snap >/dev/null; bgclick $(ref 'button "삭제"') 4; sleep 2; pwc dialog-accept >/dev/null 2>&1
pwc tab-close >/dev/null; echo "삭제 요청 완료 — list-articles.sh 로 확인"
