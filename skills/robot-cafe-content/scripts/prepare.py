#!/usr/bin/env python3
"""usage: prepare.py <morning|lunch|evening> [YYYY-MM-DD]
SKILL 1·2·4단계(편성 확인 → 한도 확인 → 주제·중복 자료)를 한 번에 모아 JSON 한 개로 출력한다.
에이전트는 이 JSON 을 읽고 조사·작성만 한다. 브라우저는 열지 않는다(읽기 전용).

종료 코드: 0 진행 가능 / 1 한도에 걸림·이미 올림 / 3 쉬는 칸
JSON 키: proceed(진행 여부) reason(멈출 때 이유) slot date weekday board head kind
         dir(오늘 폴더) files{title,body,sources} research(조사 종류: news|guide|jobs|events|none)
         limit{today_rows,mins_since_last,board_done,summary} used_urls(30일) board_titles(그 게시판 120일)
         yesterday_candidates(news 일 때 어제 이전 candidates.md 경로) already_published(오늘 이 칸 기록)"""
import glob, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HOME = os.environ.get('ROBOT_CAFE_HOME', os.path.expanduser('~/Desktop/pro/robot-cafe'))


def run(*cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


slot = sys.argv[1] if len(sys.argv) > 1 else ''
if slot not in ('morning', 'lunch', 'evening'):
    print(json.dumps({'proceed': False, 'reason': 'usage: prepare.py <morning|lunch|evening>'}, ensure_ascii=False))
    sys.exit(1)

code, out, _ = run(sys.executable, f'{HERE}/slot.py', *sys.argv[1:3])
plan = json.loads(out)
if code == 3 or plan.get('rest'):
    plan.update(proceed=False, reason='쉬는 칸 — 오늘은 올리지 않는다')
    print(json.dumps(plan, ensure_ascii=False))
    sys.exit(3)

date = plan['date']
d = f'{HOME}/content/{date}'
os.makedirs(d, exist_ok=True)
files = {k: f'{d}/{slot}-{k}.{"json" if k == "sources" else "txt"}' for k in ('title', 'body', 'sources')}
board, kind = plan['board'], plan['kind']

lcode, lout, _ = run(sys.executable, f'{HERE}/history.py', 'today', board)
m = re.search(r'오늘 (\d+)개, 마지막 등록 후 (\S+)분, 오늘 \[.*?\] 등록=(\w+)', lout)
limit = {
    'summary': lout,
    'today_rows': int(m.group(1)) if m else None,
    'mins_since_last': None if not m or m.group(2) == 'None' else int(m.group(2)),
    'board_done': (m.group(3) == 'True') if m else None,
}

marker = f'{d}/{slot}-published.json'
already = json.load(open(marker)) if os.path.exists(marker) else None

_, used, _ = run(sys.executable, f'{HERE}/history.py', 'used')
_, titles, _ = run(sys.executable, f'{HERE}/history.py', 'titles', board)

yest = None
if kind == 'news':
    older = sorted(p for p in glob.glob(f'{HOME}/content/*/candidates.md') if os.path.basename(os.path.dirname(p)) < date)
    yest = older[-1] if older else None

research = {'news': 'news', 'guide': 'guide', 'jobs': 'jobs', 'events': 'events'}.get(kind, 'none')
reason = None
if already:
    reason = f'오늘 이 칸은 이미 올렸다: {already.get("url")}'
elif lcode == 1:
    reason = f'한도에 걸림(하루 3개·2시간 간격·같은 게시판 하루 1개): {lout}'

plan.update(
    proceed=reason is None, reason=reason, dir=d, files=files, research=research, limit=limit,
    used_urls=used.split('\n') if used else [], board_titles=titles.split('\n') if titles else [],
    yesterday_candidates=yest, already_published=already,
)
print(json.dumps(plan, ensure_ascii=False))
sys.exit(0 if reason is None else 1)
