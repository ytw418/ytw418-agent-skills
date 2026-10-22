#!/bin/zsh
# usage: notice.sh <공지 게시판 id> <제목> <본문.txt> <전체 공지|게시판 공지|필독 공지>  — 공지를 써서 등록하고 글 주소를 출력한다
# 필독 공지는 최대 2개. 전체·필독 공지는 멤버에게 내소식 알림이 간다.
S=${0:A:h}; source $S/env.sh
pwc goto "https://cafe.naver.com/ca-fe/cafes/$NC_CLUB/articles/write?boardType=L&menuId=$1" >/dev/null; pwc dialog-accept >/dev/null; sleep 8
snap >/dev/null; B=$(ref 'button "게시판을 선택해 주세요."')   # menuId 로 열어도 게시판이 안 골라져 있으면 고른다
if [ -n "$B" ]; then pwc click $B >/dev/null; sleep 1; snap >/dev/null; pwc click $(ref 'button "공지사항"') >/dev/null; sleep 1; snap >/dev/null; fi
pwc fill $(ref 'textbox "제목을 입력해 주세요."') "$2" >/dev/null
R=$($S/typebody.sh $(ref 'paragraph \[ref=[a-z0-9]*\]: 내용을 입력하세요') "$3"); echo "$R"
[[ "$R" == *"mismatch 0"* ]] || { echo "본문이 원문과 달라 등록하지 않고 멈춤 — 글쓰기 탭에서 고친 뒤 직접 등록하거나 다시 실행"; exit 1; }
pwr eval "(()=>{const cb=[...document.querySelectorAll('input[type=checkbox]')].find(c=>c.id==='notice'); if(!cb.checked) (cb.labels[0]||cb).click(); return 'notice='+cb.checked})()"
sleep 1; snap >/dev/null; pwc click $(ref 'button "전체 공지"') >/dev/null; sleep 1; snap >/dev/null
[ "$4" != "전체 공지" ] && pwc click $(ref "button \"$4\"") >/dev/null; sleep 1
snap '(전체 공지|게시판 공지|필독 공지)"' 4
(pwc click $(ref 'button "등록"') > /tmp/nc_post.txt &); sleep 10; grep -E "dialog" /tmp/nc_post.txt | head -1
pwr eval "location.href"
