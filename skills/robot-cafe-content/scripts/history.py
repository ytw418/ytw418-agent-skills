#!/usr/bin/env python3
"""usage: history.py used [일수]          — 지난 기록에 이미 쓴 기사 주소(중복 방지)
       history.py titles <게시판> [일수] — 그 게시판에 이미 쓴 제목(주제 중복 방지)
       history.py today [게시판]          — 오늘 올린 글 수·마지막 등록 후 지난 분·그 게시판에 오늘 올렸는지.
                                            하루 3개 이상, 2시간 안, 그 게시판에 이미 올렸으면 종료 코드 1"""
import datetime, glob, os, re, sys

home = os.environ.get('ROBOT_CAFE_HOME', os.path.expanduser('~/Desktop/pro/robot-cafe'))
cmd = sys.argv[1] if len(sys.argv) > 1 else 'used'
today = datetime.date.today()
if cmd == 'used':
    cut = today - datetime.timedelta(days=int(sys.argv[2]) if len(sys.argv) > 2 else 30)
    urls = set()
    for p in glob.glob(home + '/content/*/log.md'):
        try:
            if datetime.date.fromisoformat(os.path.basename(os.path.dirname(p))[:10]) < cut:
                continue
        except ValueError:
            pass
        urls |= {u for u in re.findall(r'https?://[^\s|)]+', open(p).read()) if 'cafe.naver.com' not in u}
    print('\n'.join(sorted(urls)))
elif cmd == 'titles':
    board = sys.argv[2]
    cut = today - datetime.timedelta(days=int(sys.argv[3]) if len(sys.argv) > 3 else 120)
    for p in sorted(glob.glob(home + '/content/*/log.md')):
        try:
            if datetime.date.fromisoformat(os.path.basename(os.path.dirname(p))[:10]) < cut:
                continue
        except ValueError:
            pass
        for t, b, title in re.findall(r'^\| (\d\d:\d\d) \| ([^|]+) \| ([^|]+) \|', open(p).read(), re.M):
            if board in b:
                print(title.strip())
elif cmd == 'today':
    board = sys.argv[2] if len(sys.argv) > 2 else '로봇 뉴스'
    p = f'{home}/content/{today.isoformat()}/log.md'
    rows = re.findall(r'^\| (\d\d:\d\d) \| ([^|]+) \|', open(p).read(), re.M) if os.path.exists(p) else []
    rows = [r for r in rows if r[0] != '시각(KST)']
    last = max((r[0] for r in rows), default=None)
    mins = None
    if last:
        h, m = map(int, last.split(':'))
        now = datetime.datetime.now()
        mins = int((now - now.replace(hour=h, minute=m, second=0)).total_seconds() // 60)
    done = any(board in r[1] for r in rows)
    print(f'오늘 {len(rows)}개, 마지막 등록 후 {mins}분, 오늘 [{board}] 등록={done}')
    sys.exit(0 if len(rows) < 3 and (mins is None or mins >= 120) and not done else 1)
