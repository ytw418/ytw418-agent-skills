"""대만 PTT 보드 시장조사 수집(말머리 거르기·사진 글자 거르기 없이 전부). 목록·본문·사진은 bredy-marketing/scripts/ptt-crawl.py 함수를 그대로 쓴다.
  python3 -I ptt-research.py <보드> [글 수=200]      예) python3 -I ptt-research.py Reptile 200
결과: bredy-marketing/research/overseas/ptt-<보드>/ articles.jsonl·images/·summary.csv (cafe-report.py 형식)
작성자는 저장하지 않는다. 내부 분석용 — 재게시 금지. 요청 사이 1초(ptt-crawl.fetch).
"""
import csv, json, re, sys
from datetime import datetime
from pathlib import Path

MKT = Path("/Users/yoonseongjun/Desktop/pro/bredy-marketing")
sys.path.insert(0, str(MKT / "scripts"))
import importlib.util
spec = importlib.util.spec_from_file_location("ptt", MKT / "scripts" / "ptt-crawl.py")
ptt = importlib.util.module_from_spec(spec); spec.loader.exec_module(ptt)

board, n = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 200
out = MKT / "research" / "overseas" / f"ptt-{board}"
(out / "images").mkdir(parents=True, exist_ok=True)
jl = out / "articles.jsonl"
done = {json.loads(l)["articleId"] for l in jl.open(encoding="utf-8")} if jl.exists() else set()
got, page = len(done), f"{ptt.BASE}/bbs/{board}/index.html"
print(f"ptt/{board} 이미 {got}개, 목표 {n}개", flush=True)
while page and got < n:
    items, page = ptt.list_page(board, page)
    for url, title in items:
        if got >= n:
            break
        pid = url.rsplit("/", 1)[1].removesuffix(".html")
        if pid in done or title.startswith("(本文已被刪除)"):
            continue
        try:
            p = ptt.parse_post(url)
        except Exception as e:
            print(f"  실패 {url}: {e}", flush=True); continue
        files = [f.name for f in ptt.download_images(p, out)]
        # ptt.download_images 는 images/<id>/NN.ext 로 저장 → images/<id>_NN.ext 로 펼친다
        flat = []
        for f in sorted((out / "images" / pid).glob("*")) if (out / "images" / pid).exists() else []:
            dest = out / "images" / f"{pid}_{f.name}"; f.rename(dest); flat.append(dest.name)
        if (out / "images" / pid).exists():
            (out / "images" / pid).rmdir()
        head = re.match(r"\s*(?:Re:|Fw:)?\s*[\[［【](.*?)[\]］】]", p["title"] or title)
        try:
            date = datetime.strptime(p["date"], "%a %b %d %H:%M:%S %Y").isoformat()
        except ValueError:
            date = ""
        row = {"articleId": pid, "menu": head.group(1) if head else "(no tag)", "date": date, "views": 0, "comments": 0, "likes": 0,
               "memberLevel": None, "market": bool(head and re.search("交易|販售|出售|徵求|送養|認養|贈送|贈", head.group(1))), "cost": None,
               "title": p["title"] or title, "body": p["content"], "images": flat, "locked": False, "url": url}
        with jl.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
        got += 1
        if got % 20 == 0:
            print(f"{got}/{n}", flush=True)

rows = [json.loads(l) for l in jl.open(encoding="utf-8")]
with (out / "summary.csv").open("w", encoding="utf-8-sig", newline="") as fh:
    w = csv.writer(fh); w.writerow(["id", "date", "tag", "title", "images", "market", "body_200", "url"])
    for r in rows:
        w.writerow([r["articleId"], r["date"], r["menu"], r["title"], len(r["images"]), r["market"], r["body"][:200].replace("\n", " "), r["url"]])
print(f"끝: {len(rows)}개 → {out}")
