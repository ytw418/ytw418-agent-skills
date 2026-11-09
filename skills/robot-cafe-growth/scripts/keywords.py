#!/usr/bin/env python3
"""네이버 자동완성으로 사람들이 실제로 치는 검색어를 본다. usage: python3 -I keywords.py "드론 비행금지" ["로봇청소기 물걸레" ...]"""
import json, sys, urllib.parse, urllib.request

for q in sys.argv[1:]:
    url = ("https://ac.search.naver.com/nx/ac?st=100&r_format=json&q_enc=UTF-8&r_enc=UTF-8&q="
           + urllib.parse.quote(q))
    d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=10))
    print(q, "→", ", ".join(x[0] for x in d["items"][0][:10]) if d["items"] else "(없음)")
