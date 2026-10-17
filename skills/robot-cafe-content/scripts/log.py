#!/usr/bin/env python3
"""usage: log.py <게시판> <제목.txt> <글주소> <sources.json> <본문.txt> <검사 메모>
content/<오늘>/log.md 에 등록 기록과 실제로 쓴 출처를 남긴다."""
import datetime, json, os, re, sys

home = os.environ.get('ROBOT_CAFE_HOME', os.path.expanduser('~/Desktop/pro/robot-cafe'))
board, title_f, url, src_f, body_f, note = sys.argv[1:7]
now = datetime.datetime.now()
d = f'{home}/content/{now.date().isoformat()}'
os.makedirs(d, exist_ok=True)
p = d + '/log.md'
title = open(title_f).read().strip()
used = re.findall(r'https?://\S+', open(body_f).read())
src = {s['url']: s for s in json.load(open(src_f))}
head = '' if os.path.exists(p) else f'# {now.date().isoformat()} 등록 기록\n\n| 시각(KST) | 게시판 | 제목 | 주소 | 계정 |\n|---|---|---|---|---|\n'
row = f'| {now:%H:%M} | {board} | {title} | {url} | ytw418 (kingdom) |\n'
srcs = '\n'.join(f"| {src.get(u, {}).get('media', '?')} | {src.get(u, {}).get('date', '?')} | {u} |" for u in used)
with open(p, 'a') as f:
    f.write(head + row + f'\n### 출처 ({now:%H:%M} 글)\n\n| 매체 | 게재일 | 주소 |\n|---|---|---|\n{srcs}\n\n- 검사: {note}\n\n')
print('기록:', p)
