#!/usr/bin/env python3
"""usage: slot.py <morning|lunch|evening> [YYYY-MM-DD]
calendar.json 에서 그 날·시간대에 올릴 게시판·말머리·글 종류를 JSON 으로 출력한다. 쉬는 칸이면 종료 코드 3."""
import datetime, json, os, sys

cal = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'calendar.json')))
slot = sys.argv[1]
day = datetime.date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else datetime.date.today()
table = cal[slot]
plan = table.get('all') or table.get(str(day.weekday()))
if plan and 'odd' in plan:
    plan = plan['odd' if day.isocalendar()[1] % 2 else 'even']
if not plan:
    print(json.dumps({'slot': slot, 'date': day.isoformat(), 'rest': True}, ensure_ascii=False))
    sys.exit(3)
print(json.dumps(dict(plan, slot=slot, date=day.isoformat(), weekday='월화수목금토일'[day.weekday()]), ensure_ascii=False))
