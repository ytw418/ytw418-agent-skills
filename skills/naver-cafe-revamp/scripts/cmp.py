# usage: python3 -I cmp.py <원문.txt> '<에디터 문단 JSON 배열>'  — 빈 줄을 뺀 줄 단위 대조
import sys, json
src = [l for l in open(sys.argv[1]).read().split('\n') if l.strip()]
got = [l for l in json.loads(sys.argv[2]) if l.strip()]
bad = [(i, s, g) for i, (s, g) in enumerate(zip(src, got)) if s.strip() != g.strip()]
print('src', len(src), 'got', len(got), 'mismatch', len(bad) + abs(len(src) - len(got)))
for b in bad[:5]: print(b)
