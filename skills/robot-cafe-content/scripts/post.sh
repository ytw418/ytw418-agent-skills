#!/bin/zsh
# usage: post.sh <게시판 이름> <제목.txt> <본문.txt> [--head <말머리>] [--dry-run]
# 글쓰기 화면에서 게시판·말머리 고르기 → (글양식이 미리 채워졌으면 비우기) → 제목 → 본문 한 줄씩 입력 → 원문 대조 → 등록 → 글 번호 출력.
D=${0:A:h}; source $D/env.sh
BOARD=$1; TITLE="$(cat $2)"; BODY=$3; shift 3; HEAD=""; DRY=""
while [ $# -gt 0 ]; do case $1 in --head) HEAD=$2; shift 2;; --dry-run) DRY=1; shift;; *) shift;; esac; done
pwc goto "https://cafe.naver.com/ca-fe/cafes/$RC_CLUB/articles/write?boardType=L" >/dev/null; pwc dialog-accept >/dev/null; sleep 7
$D/snap.sh >/dev/null; pwc click $($D/ref.sh 'button "게시판을 선택해 주세요."') >/dev/null; sleep 1
$D/snap.sh >/dev/null; b=$($D/ref.sh "button \"$BOARD\""); [ -z "$b" ] && { echo "게시판을 찾지 못함: $BOARD"; exit 4; }
pwc click $b >/dev/null; sleep 2; pwc dialog-accept >/dev/null
if [ -n "$HEAD" ]; then
  $D/snap.sh >/dev/null; pwc click $($D/ref.sh 'button "말머리 선택"') >/dev/null; sleep 1
  $D/snap.sh >/dev/null; h=$(awk '/button "말머리 선택"/{p=1} p' /tmp/rc_snap.yml | grep -m1 "button \"$HEAD\"" | grep -o 'ref=[a-z0-9]*' | cut -d= -f2)
  [ -z "$h" ] && { echo "말머리를 찾지 못함: $HEAD"; exit 4; }
  pwc click $h >/dev/null; sleep 1
fi
$D/snap.sh >/dev/null; B=$($D/ref.sh 'paragraph .*내용을 입력하세요')
if [ -z "$B" ]; then   # 글양식이 채워진 게시판: 본문을 비운다
  pwc click ".se-text-paragraph >> nth=0" >/dev/null; sleep 0.5   # 양식 문단은 스냅샷 ref 로 안 잡혀 CSS 로 클릭한다
  pwc press Meta+a >/dev/null; sleep 0.4; pwc press Backspace >/dev/null; sleep 1
  $D/snap.sh >/dev/null; B=$($D/ref.sh 'paragraph .*내용을 입력하세요')
  [ -z "$B" ] && { echo "글양식을 비우지 못함 — 중단"; exit 4; }
  echo "글양식 비움"
fi
pwc fill $($D/ref.sh 'textbox "제목을 입력해 주세요."') "$TITLE" >/dev/null
$D/typebody.sh $B $BODY || { echo "본문이 원문과 다르게 들어감 — 등록하지 않음"; exit 3; }
links=$(grep -cE 'https?://' $BODY); cards=$($D/pw.sh eval "document.querySelectorAll('.se-component.se-oglink').length")
headnow=$($D/snap.sh >/dev/null; grep -m1 -E 'button "말머리 선택"|button "'"${HEAD:-없음}"'"' /tmp/rc_snap.yml | sed 's/.*button "\([^"]*\)".*/\1/')
echo "링크 ${links}개 / 미리보기 카드 ${cards}개 / 말머리 ${headnow}"
if [ -n "$DRY" ]; then pwc goto "about:blank" >/dev/null; pwc dialog-accept >/dev/null; echo "DRY RUN: 등록하지 않음"; exit 0; fi
R=$($D/ref.sh 'button "등록"')
(pwc click $R > /tmp/rc_post_click.txt &); sleep 10; pwc dialog-accept >/dev/null
href=$($D/pw.sh eval "location.href")
id=$(python3 -c "import re,sys,urllib.parse as u; h=u.unquote(u.unquote(sys.argv[1])); m=re.search(r'articles/(\d+)',h) or re.search(r'articleid=(\d+)',h); print(m.group(1) if m else '')" "$href")
[ -z "$id" ] && { echo "등록을 확인하지 못함: $href"; exit 5; }
echo "ARTICLE_ID=$id"; echo "URL=https://cafe.naver.com/ca-fe/cafes/$RC_CLUB/articles/$id"
