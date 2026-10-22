#!/bin/zsh
# usage: typebody.sh <본문 문단 ref> <본문.txt>  — 스마트에디터 ONE 에 한 줄씩 입력하고 원문과 대조한다(한 번에 type 하면 글자·줄이 빠진다)
source ${0:A:h}/env.sh
pwc click $1 >/dev/null; sleep 0.5
n=$(grep -c "" $2); i=0
while IFS= read -r line || [ -n "$line" ]; do
  i=$((i+1)); [ -n "$line" ] && { pwc type "$line" | grep -E "^Error|Error:" | head -1; sleep 0.4; }
  [ $i -lt $n ] && { pwc press Enter >/dev/null; sleep 0.25; }
  case "$line" in *http*) sleep 3;; esac   # 링크 미리보기 카드가 붙을 때까지
done < $2
J=$(pwr eval "JSON.stringify([...document.querySelectorAll('.se-text-paragraph')].map(p=>p.innerText))" | python3 -I -c "import sys,json;print(json.loads(sys.stdin.read()))")
python3 -I ${0:A:h}/cmp.py $2 "$J"
