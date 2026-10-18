#!/usr/bin/env python3
"""usage: lint.py <제목.txt> <본문.txt> [--kind news|guide|jobs|events|talk] [--sources sources.json] [--fetch]
카페 글 검사: 공식 말투(SNS 말투 금지), 금지 표현, 글 종류별 제목·링크 수, 링크마다 '출처:/공고:/안내:' 줄,
검증된 링크만, (news·guide·talk) 원문과 20자 이상 똑같은 문장."""
import html, json, re, subprocess, sys

args = sys.argv[1:]
title, body = open(args[0]).read().strip(), open(args[1]).read()
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
kind = opt('--kind', 'news')
sources = json.load(open(opt('--sources'))) if '--sources' in args else None
RULES = {  # 제목 접두어, 링크 수 범위, 본문 글자 수 범위
    'news': ('[오늘의 로봇 뉴스]', (3, 6), (600, 3000)),
    'guide': (None, (1, 5), (600, 2500)),
    'jobs': ('[이번 주 로봇 채용]', (3, 10), (300, 3000)),
    'events': ('[로봇 행사]', (2, 8), (300, 2500)),
    'talk': (None, (0, 3), (150, 1200)),
}
prefix, (lo, hi), (cmin, cmax) = RULES[kind]
errs, warns = [], []
if prefix and not title.startswith(prefix):
    errs.append(f'제목은 {prefix}로 시작해야 함')
if not prefix and title.startswith('['):
    warns.append('말머리가 제목 앞에 붙으므로 제목에 [..]를 또 쓰지 않는 게 좋음')
if not cmin <= len(body) <= cmax:
    errs.append(f'본문 {len(body)}자 — {cmin}~{cmax}자')
lines = [l.strip() for l in body.split('\n') if l.strip()]
link_line = re.compile(r'^(출처|공고|안내):')
prose = [l for l in lines if not link_line.match(l)]
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
bare = [l for l in lines if re.search(r'https?://', l) and not link_line.match(l)]
if bare:
    errs.append('링크는 출처:/공고:/안내: 줄에만 — ' + bare[0][:40])
if not lo <= len(urls) <= hi:
    errs.append(f'링크 {len(urls)}개 — {lo}~{hi}개')
if sources is not None:
    ok = {s['url'] for s in sources if s.get('verified')}
    errs += ['검증 목록에 없는 링크: ' + u for u in urls if u not in ok]
if '--fetch' in args and kind in ('news', 'guide', 'talk'):
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
