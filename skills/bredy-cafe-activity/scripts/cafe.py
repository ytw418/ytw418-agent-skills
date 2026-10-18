"""카페 활동 일괄 도구(토큰·시간 절약용). 브라우저는 자동화 크롬(scripts/bpw.py).
  python3 scripts/cafe.py collect <out.json> [카페당 후보 수=8]   — 홈다리·파사모 최근 질문 후보를 본문·댓글 요약과 함께 모은다
  python3 scripts/cafe.py run <plan.json>                          — 블로그 글(있으면) 발행 → 댓글({BLOG} 자리에 주소) → log.md 기록, 댓글 사이 3~6분
plan.json: [{"cafe":"hby","id":2800700,"comment":"…{BLOG}…", "blog":{"file":"…txt","title":"…","category":"…","tags":"a,b","photo":"assets/photos/…"}}]
"""
import json, os, random, re, subprocess, sys, time

CWD = "/Users/yoonseongjun/Desktop/pro/bredy-marketing"
SESSION = None  # collect 에서만 자동화 크롬에 붙는다(run 은 하위 스크립트가 각자 붙음)
CAFES = {"hby": 10135947, "reptilia": 12440585}
Q = r"[?？]|질문|궁금|도와|왜|어떻게|괜찮|되나|될까|문의|방법|인가요|일까요|맞나요|할까요"
SKIP = r"^\[|분양|판매|나눔|후기|공지|이벤트|동정|병인가|정체|뭘까|뭔가요|뭐죠"  # 홍보·사진 판별형 질문 제외


def pw(*a):
    r = subprocess.run(["npx", "--yes", "--package", "@playwright/cli", "playwright-cli", f"-s={SESSION}", *a], cwd=CWD, capture_output=True, text=True)
    return r.stdout + r.stderr


def ev(js):
    out = pw("eval", js).splitlines()
    try:
        v = json.loads(out[1])
        return json.loads(v) if isinstance(v, str) and v[:1] in "[{" else v
    except Exception:
        return None


def article_url(cafe, aid):
    return f"https://m.cafe.naver.com/ca-fe/web/cafes/{CAFES[cafe]}/articles/{aid}"


def collect(out, n):
    global SESSION
    import sys as _s; _s.path.insert(0, CWD + "/scripts"); import bpw
    SESSION = bpw.start("naver")
    done = set()
    for f in os.popen(f"ls {CWD}/content/*-cafe/log.md 2>/dev/null").read().split():
        done |= set(re.findall(r"#(\d+)", open(f, encoding="utf-8").read()))
    res = []
    for cafe in CAFES:
        pw("goto", f"https://m.cafe.naver.com/{cafe}"); time.sleep(4)
        for _ in range(int(os.environ.get("SCROLLS", "3"))):
            pw("eval", "window.scrollBy(0,4000)"); time.sleep(1.2)
        rows = ev("JSON.stringify([...new Map([...document.querySelectorAll('a[href*=\"articleid\"],a[href*=\"/articles/\"]')].map(a=>{const m=a.href.match(/articleid=(\\d+)|articles\\/(\\d+)/)||[];return [m[1]||m[2],a.innerText.split('\\n')[0].trim()]})).entries()])") or []
        cands = [(i, t) for i, t in rows if i and re.search(Q, t) and not re.search(SKIP, t) and i not in done][:n]
        for aid, title in cands:
            pw("goto", article_url(cafe, aid)); time.sleep(4)
            d = ev("JSON.stringify((()=>{const t=document.body.innerText.replace(/\\n+/g,' | ');const i=t.indexOf('구독');const j=t.indexOf('좋아요',i);const k=t.indexOf('댓글을 남겨',j);const c=(t.slice(j,k).match(/댓글 \\| (\\d+)/)||[])[1];return {lock:/등급 이상의 멤버만/.test(t)||/로그인/.test(t.slice(0,80)),body:t.slice(i+4,j).slice(0,420),cmt:Number(c||0),cmts:t.slice(j,k).slice(0,260),mine:/bredy_team/.test(t)}})())") or {}
            if d.get("lock") or d.get("mine") or (d.get("cmt") or 0) > int(os.environ.get("MAXCMT", "3")):
                continue
            res.append({"cafe": cafe, "id": int(aid), "title": title, **{k: d.get(k) for k in ("cmt", "body", "cmts")}})
    json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for r in res:
        print(f"{r['cafe'][:3]} #{r['id']} 댓글{r['cmt']} | {r['title'][:40]} | {(r['body'] or '')[60:200]}")


def run(plan_path):
    plan = json.load(open(plan_path, encoding="utf-8"))
    log = os.path.join(os.path.dirname(os.path.abspath(plan_path)), "log.md")
    for k, it in enumerate(plan):
        blog = ""
        if it.get("blog"):
            b = it["blog"]
            r = subprocess.run(["python3", f"{CWD}/blog/naver-photos.py", b["file"], b["title"], b["category"], b["tags"], b["photo"]],
                               cwd=CWD, capture_output=True, text=True)
            blog = (r.stdout.strip().splitlines() or [""])[-1]
            if not blog.startswith("https://"):
                print(f"{it['cafe']} #{it['id']} 블로그 실패: {blog}", flush=True); continue
        text = it["comment"].replace("{BLOG}", blog).strip()
        tmp = f"/tmp/cafe-c-{it['id']}.txt"
        open(tmp, "w", encoding="utf-8").write(text)
        r = subprocess.run(["python3", f"{CWD}/scripts/cafe-comment.py", article_url(it["cafe"], it["id"]), tmp], cwd=CWD, capture_output=True, text=True)
        res = (r.stdout.strip().splitlines() or ["?"])[-1]
        line = f"- {time.strftime('%H:%M')} {it['cafe']} #{it['id']} {res} | 블로그 {blog or '-'} | {text.splitlines()[0][:50]}"
        print(line, flush=True)
        open(log, "a", encoding="utf-8").write(line + "\n")
        if k < len(plan) - 1:
            time.sleep(random.uniform(180, 360))


if __name__ == "__main__":
    {"collect": lambda: collect(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 8), "run": lambda: run(sys.argv[2])}[sys.argv[1]]()
