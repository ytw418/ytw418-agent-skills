#!/bin/zsh
# usage: post.sh <게시판 이름> <제목.txt> <본문.txt> [--dry-run]
# 글쓰기 화면에서 게시판 고르기 → 제목 → 본문 한 줄씩 입력 → 원문 대조 → 등록 → 글 번호 출력.
# 글양식이 붙은 게시판(삽니다·채용공고 등)은 본문이 미리 채워지므로 아직 지원하지 않는다.
D=${0:A:h}; source $D/env.sh
BOARD=$1; TITLE="$(cat $2)"; BODY=$3; DRY=$4
pwc goto "https://cafe.naver.com/ca-fe/cafes/$RC_CLUB/articles/write?boardType=L" >/dev/null; pwc dialog-accept >/dev/null; sleep 7
$D/snap.sh >/dev/null; pwc click $($D/ref.sh 'button "게시판을 선택해 주세요."') >/dev/null; sleep 1
$D/snap.sh >/dev/null; b=$($D/ref.sh "button \"$BOARD\""); [ -z "$b" ] && { echo "게시판을 찾지 못함: $BOARD"; exit 4; }
pwc click $b >/dev/null; sleep 1.5; $D/snap.sh >/dev/null
T=$($D/ref.sh 'textbox "제목을 입력해 주세요."'); B=$($D/ref.sh 'paragraph .*내용을 입력하세요')
[ -z "$B" ] && { echo "본문이 비어 있지 않음(글양식 게시판?) — 중단"; exit 4; }
pwc fill $T "$TITLE" >/dev/null
$D/typebody.sh $B $BODY || { echo "본문이 원문과 다르게 들어감 — 등록하지 않음"; exit 3; }
links=$(grep -cE 'https?://' $BODY); cards=$($D/pw.sh eval "document.querySelectorAll('.se-component.se-oglink').length")
echo "링크 $links개 / 미리보기 카드 $cards개"
if [ "$DRY" = "--dry-run" ]; then pwc goto "about:blank" >/dev/null; pwc dialog-accept >/dev/null; echo "DRY RUN: 등록하지 않음"; exit 0; fi
$D/snap.sh >/dev/null; R=$($D/ref.sh 'button "등록"')
(pwc click $R > /tmp/rc_post_click.txt &); sleep 10; pwc dialog-accept >/dev/null
href=$($D/pw.sh eval "location.href")
id=$(python3 -c "import re,sys,urllib.parse as u; h=u.unquote(u.unquote(sys.argv[1])); m=re.search(r'articles/(\d+)',h) or re.search(r'articleid=(\d+)',h); print(m.group(1) if m else '')" "$href")
[ -z "$id" ] && { echo "등록을 확인하지 못함: $href"; exit 5; }
echo "ARTICLE_ID=$id"; echo "URL=https://cafe.naver.com/ca-fe/cafes/$RC_CLUB/articles/$id"
