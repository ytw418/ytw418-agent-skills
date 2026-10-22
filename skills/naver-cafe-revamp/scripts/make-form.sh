#!/bin/zsh
# usage: make-form.sh <index>  — $NC_HOME/forms/forms.json 의 n번째 글양식을 통합게시판용으로 만든다
# forms.json: [[양식 제목, [적용 게시판 이름...], 게시판 안내문(없으면 ""), [본문 줄...]], ...]
S=${0:A:h}; source $S/env.sh
python3 -I - "$1" "$NC_HOME/forms/forms.json" "$S/form-setup.js" <<'PY'
import json, sys
f = json.load(open(sys.argv[2]))[int(sys.argv[1])]
open('/tmp/nc_form_title.txt', 'w').write(f[0])
open('/tmp/nc_form_body.txt', 'w').write('\n'.join(f[3]))
js = open(sys.argv[3]).read().replace('BOARDS_JSON', json.dumps(f[1], ensure_ascii=False)).replace('GUIDE_JSON', json.dumps(f[2], ensure_ascii=False))
open('/tmp/nc_form_setup.js', 'w').write(js)
PY
pwc goto "https://cafe.naver.com/ManageArticleFormWrite.nhn?cafeId=$NC_CLUB&type=seone" >/dev/null; pwc dialog-accept >/dev/null; sleep 6
snap >/dev/null; pwc fill $(ref 'textbox "제목을 입력해주세요."') "$(cat /tmp/nc_form_title.txt)" >/dev/null
pwr eval "$(cat /tmp/nc_form_setup.js)"
sleep 1; snap >/dev/null; pwc fill $(ref 'textbox "가입인사 양식') "$(cat /tmp/nc_form_body.txt)" >/dev/null   # 본문 칸은 placeholder 가 '가입인사 양식…'인 textbox
bgclick $(ref 'button "저장하기"') 6
echo "done: $(cat /tmp/nc_form_title.txt) — 결과의 guide=/body= 가 false 여도 저장된다. 글쓰기 화면에서 게시판을 골라 확인할 것"
