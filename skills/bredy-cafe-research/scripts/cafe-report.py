"""cafe-crawl.mjs 수집 결과 집계 → research/cafe/report.md
  python3 scripts/cafe-report.py [카페 ...]   (생략하면 research/cafe/ 아래 전부)
"""
import collections, json, os, re, statistics, sys

ROOT = os.environ.get("CAFE_RESEARCH_DIR", "/Users/yoonseongjun/Desktop/pro/bredy-marketing/research/cafe")
STOP = set("오늘 너무 진짜 그냥 이제 요즘 정말 우리 혹시 처음 이거 저희 있나요 있어요 해요 했어요 하는 하고 같아요 어떻게 ㅎㅎ ㅋㅋ ㅠㅠ".split())
WORD = re.compile(r"[가-힣A-Za-z]{2,}")


def load(c):
    p = os.path.join(ROOT, c, "articles.jsonl")
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()] if os.path.exists(p) else []


def section(c, rows):
    n = len(rows)
    if not n:
        return f"## {c}\n\n수집된 글 없음\n"
    days = sorted(r["date"][:10] for r in rows)
    span = max(1, len(set(days)))
    menus = collections.Counter(r["menu"] for r in rows)
    words = collections.Counter(w for r in rows for w in WORD.findall(r["title"] + " " + r["body"][:300]) if w not in STOP)
    q = sum(bool(re.search(r"[?？]|질문|궁금|어떻게|왜|도와", r["title"])) for r in rows)
    locked = sum(r.get("locked") for r in rows)
    costs = sorted(int(r["cost"]) for r in rows if r.get("cost"))
    sale = sum(bool(re.search(r"분양|판매|팝니다|나눔|입양", r["title"])) for r in rows)
    top = sorted(rows, key=lambda r: (r["comments"] or 0) + (r["likes"] or 0), reverse=True)[:5]
    out = [f"## {c}", "",
           f"- 글 {n}개 · 기간 {days[0]} ~ {days[-1]}({len(set(days))}일) · 하루 평균 {n / span:.1f}개",
           f"- 평균 조회 {statistics.fmean(r['views'] or 0 for r in rows):.0f} · 댓글 {statistics.fmean(r['comments'] or 0 for r in rows):.1f} · 좋아요 {statistics.fmean(r['likes'] or 0 for r in rows):.1f}",
           f"- 사진 있는 글 {sum(bool(r['images']) for r in rows) / n:.0%} · 질문형 제목 {q / n:.0%} · 분양·판매·나눔 제목 {sale / n:.0%} · 회원 전용(잠김) {locked}",
           "- 게시판: " + ", ".join(f"{m} {k}" for m, k in menus.most_common(8)),
           "- 많이 나온 말: " + ", ".join(f"{w}({k})" for w, k in words.most_common(20))]
    if costs:
        out.append(f"- 가격 표시 글 {len(costs)}개 · 중앙값 {statistics.median(costs):,}원 · 범위 {costs[0]:,}~{costs[-1]:,}원")
    out += ["- 반응 많은 글:"] + [f"  - [{r['title'][:40]}]({r['url']}) 댓글 {r['comments']} · 좋아요 {r['likes']} · 조회 {r['views']}" for r in top]
    return "\n".join(out) + "\n"


cafes = sys.argv[1:] or sorted(d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d)))
md = "# 네이버 카페 시장조사 집계\n\n" + "\n".join(section(c, load(c)) for c in cafes)
open(os.path.join(ROOT, "report.md"), "w", encoding="utf-8").write(md)
print(md)
