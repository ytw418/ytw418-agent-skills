#!/usr/bin/env python3
"""usage: lint.py <제목.txt> <본문.txt> [--sources sources.json] [--fetch]
카페 글 검사: 공식 말투(SNS 말투 금지), 금지 표현, 출처 줄과 링크 수, 검증된 링크만, 원문과 20자 이상 똑같은 문장."""
import html, json, re, subprocess, sys

args = sys.argv[1:]
title, body = open(args[0]).read().strip(), open(args[1]).read()
sources = json.load(open(args[args.index('--sources') + 1])) if '--sources' in args else None
errs, warns = [], []
if not title.startswith('[오늘의 로봇 뉴스]'):
    errs.append('제목은 [오늘의 로봇 뉴스]로 시작해야 함')
lines = [l.strip() for l in body.split('\n') if l.strip()]
prose = [l for l in lines if not l.startswith('출처')]
for l in prose:
    if re.search(r'(함|임|듯|음|됨|봄|ㅋ+|ㅎ+|ㅠ+)[.!?~]*$', l):
        errs.append('SNS 말투 줄: ' + l[:40])
for w in ['ㅋㅋ', 'ㅎㅎ', '■', '✔', '→', '▶', '해보세요', '강추', '대박']:
    if w in body:
        errs.append('금지 표현: ' + w)
if body.count('것 같습니다') > 2:
    errs.append('"것 같습니다" %d번(최대 2번)' % body.count('것 같습니다'))
if body.count('네요') > 5:
    warns.append('"~네요" %d번' % body.count('네요'))
urls = re.findall(r'https?://\S+', body)
src_lines = [l for l in lines if l.startswith('출처')]
if len(src_lines) != len(urls):
    errs.append('출처 줄 %d개, 링크 %d개 — 소식마다 출처 한 줄' % (len(src_lines), len(urls)))
if not 3 <= len(urls) <= 6:
    errs.append('소식 %d건 — 3~6건' % len(urls))
if sources is not None:
    ok = {s['url'] for s in sources if s.get('verified')}
    errs += ['검증 목록에 없는 링크: ' + u for u in urls if u not in ok]
if '--fetch' in args:
    norm = lambda s: re.sub(r'\s+', '', s)
    for u in urls:
        raw = subprocess.run(['curl', '-sL', '--max-time', '15', '-A', 'Mozilla/5.0', u], capture_output=True).stdout.decode('utf-8', 'ignore')
        text = norm(html.unescape(re.sub(r'<[^>]+>', ' ', re.sub(r'(?s)<(script|style)\b.*?</\1>', ' ', raw))))
        if len(text) < 500:
            warns.append('원문을 못 읽어 대조 생략: ' + u)
            continue
        for l in prose:
            n = norm(l)
            if any(n[i:i + 20] in text for i in range(0, max(0, len(n) - 20) + 1)):
                errs.append('원문과 20자 이상 같음: ' + l[:40])
for w in warns:
    print('주의:', w)
for e in errs:
    print('고칠 것:', e)
print('통과' if not errs else '실패 %d건' % len(errs))
sys.exit(1 if errs else 0)
