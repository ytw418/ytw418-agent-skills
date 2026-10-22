#!/bin/bash
# Gemini(Veo)로 영상 1개 생성 → 내려받기. 사용: gemini-video.sh <프롬프트 파일> <출력 mp4>
# 브리디 자동화 크롬(9222)의 구글 로그인을 쓴다. 생성은 몇 분 걸린다(최대 10분 기다림). 종료 코드 3 = 한도·거절 문구.
set -u
cd ~/Desktop/pro/bredy-marketing
source scripts/bpw.sh gemini; trap bpw_end EXIT
P=$(python3 -c "import json,sys;print(json.dumps('동영상을 만들어줘. 세로 9:16. '+open(sys.argv[1]).read().strip()))" "$1"); OUT=$2
pw goto https://gemini.google.com/app >/dev/null 2>&1; sleep 6
pw run-code "async page => { const t = page.getByRole('textbox').last(); await t.click(); await page.keyboard.insertText($P); await page.keyboard.press('Enter'); return 'sent'; }" | sed -n 2p
for i in $(seq 1 40); do sleep 15
  S=$(pw eval "() => (document.querySelector('video')?.src||'') + '|' + (/(한도|limit|can't create|만들 수 없|정책)/i.test(document.body.innerText.slice(-3000)) ? 'BLOCK' : '')" | sed -n 2p | tr -d '"')
  case "$S" in http*) break;; *BLOCK*) echo "거절·한도"; exit 3;; esac; done
U=${S%%|*}; [ -z "$U" ] && { echo "시간 초과"; exit 4; }
C=$(pw run-code "async page => (await page.context().cookies('$U')).map(c=>c.name+'='+c.value).join('; ')" | sed -n 2p | sed 's/^"//;s/"$//')
curl -sL -H "Cookie: $C" -o "$OUT" "$U"; ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" || exit 5
