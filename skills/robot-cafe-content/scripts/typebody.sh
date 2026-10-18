#!/bin/zsh
# usage: typebody.sh <본문 문단 ref> <본문.txt>
# 스마트에디터 ONE 은 빠르게 치면 줄 끝 글자가 빠진다 → 한 줄씩 치고 쉰 뒤 Enter.
# 링크 줄 뒤에는 미리보기 카드가 붙을 때까지 3초 기다린다. 줄 앞에 '1. '·'①' 을 쓰면 자동 목록이 켜져 글이 섞이니 쓰지 않는다.
D=${0:A:h}; source $D/env.sh
pwc click $1 >/dev/null; sleep 0.5
n=$(grep -c "" $2); i=0
while IFS= read -r line || [ -n "$line" ]; do
  i=$((i+1)); [ -n "$line" ] && { pwc type "$line" >/dev/null; sleep 0.4; }
  [ $i -lt $n ] && { pwc press Enter >/dev/null; sleep 0.25; }
  case "$line" in *http*) sleep 3;; esac
done < $2
J=$($D/pw.sh eval "JSON.stringify([...document.querySelectorAll('.se-text-paragraph')].map(p=>p.innerText))" | python3 -c "import sys,json;print(json.loads(sys.stdin.read()))")
python3 $D/cmp.py $2 "$J"
