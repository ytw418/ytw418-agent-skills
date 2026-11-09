#!/usr/bin/env python3
"""애드센스 봇(Mediapartners-Google)이 받는 화면을 잰다. 외부 의존성 없음(curl 사용).

사용: python3 -I bot_check.py <도메인> [--per 3] [--after "<메뉴 끝 글자>"] [/경로 ...]
  - robots.txt·ads.txt(https/http/www)·사이트맵 구역별 개수
  - 홈 + 넘긴 경로 + 사이트맵 구역마다 --per 개: 상태 코드, robots 메타, 본문 글자 수, 앞부분
  --after: 메뉴(사이드 메뉴 등) 끝에 오는 글자. 주면 그 뒤만 본문으로 센다(브리디는 "버전 0.1.0").
본문 300자 미만이면 THIN 으로 표시한다. 화면에서만 데이터를 받는(클라이언트 렌더) 페이지가 여기서 잡힌다.
"""
import argparse, html, re, subprocess
from collections import Counter, defaultdict

UA = "Mozilla/5.0 (compatible; Mediapartners-Google)"
THIN = 300


def fetch(url):
    r = subprocess.run(
        ["curl", "-s", "-A", UA, "-o", "-", "-w", "\n__META__%{http_code} %{redirect_url}", url],
        capture_output=True, text=True, errors="ignore", timeout=60,
    )
    body, _, meta = r.stdout.rpartition("\n__META__")
    code, _, redirect = meta.partition(" ")
    return code, redirect.strip(), body


def body_text(src, after):
    s = re.sub(r"<script.*?</script>|<style.*?</style>|<noscript.*?</noscript>", "", src, flags=re.S)
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
    if after and after in t:
        t = t.split(after, 1)[1].strip()
    return t


def page(url, after):
    code, redirect, src = fetch(url)
    robots = ",".join(re.findall(r'<meta name="robots" content="([^"]+)"', src)) or "-"
    t = body_text(src, after)
    flag = "THIN " if code == "200" and len(t) < THIN else ""
    tail = f" -> {redirect}" if redirect else f" | {t[:110]}"
    print(f"  {flag}{code} robots={robots} body={len(t)} {url}{tail}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("domain")
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--per", type=int, default=2)
    ap.add_argument("--after", default="")
    a = ap.parse_args()
    base = f"https://{a.domain}"

    print("[robots.txt]")
    _, _, robots = fetch(base + "/robots.txt")
    for line in robots.splitlines():
        if re.match(r"(?i)(user-agent|disallow|sitemap)", line.strip()):
            print("  " + line.strip())

    print("[ads.txt]")
    for u in (f"https://{a.domain}/ads.txt", f"http://{a.domain}/ads.txt", f"https://www.{a.domain}/ads.txt"):
        code, redirect, body = fetch(u)
        print(f"  {code} {u}" + (f" -> {redirect}" if redirect else f" | {body.strip()[:80]}"))

    print("[sitemap]")
    _, _, sm = fetch(base + "/sitemap.xml")
    locs = re.findall(r"<loc>([^<]+)</loc>", sm)
    sections = defaultdict(list)
    for loc in locs:
        sections[loc.split("/")[3] if loc.count("/") > 3 else ""].append(loc)
    print("  " + ", ".join(f"/{k or ''} {len(v)}" for k, v in sorted(sections.items(), key=lambda kv: -len(kv[1]))))
    if any(l.endswith(".xml") for l in locs):
        print("  (사이트맵 색인 파일이다 — 하위 사이트맵은 직접 열어 본다)")

    print("[pages]")
    page(base + "/", a.after)
    for p in a.paths:
        page(base + p, a.after)
    for key, urls in sorted(sections.items(), key=lambda kv: -len(kv[1])):
        if not key:
            continue
        step = max(1, len(urls) // (a.per + 1))
        for u in urls[step::step][: a.per]:
            page(u, a.after)

    print(f"\nTHIN = 봇 본문 {THIN}자 미만. 색인 대상(index)인데 THIN 이면 서버 렌더링하거나 noindex·사이트맵 제외를 검토한다.")


if __name__ == "__main__":
    main()
