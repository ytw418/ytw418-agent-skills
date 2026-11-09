#!/usr/bin/env python3
"""가입인사 게시판(메뉴 5)에서 운영자 답이 없는 14일 안 글을 찾는다(회원 전용이라 로그인된 자동화 크롬으로 읽는다).
usage: python3 welcome.py  → JSON [{id,url,writer,title,comments}]. 답은 bredy-cafe-activity/scripts/cafe-comment.py <url> <글.txt>"""
import json, subprocess, sys
sys.path.insert(0, "/Users/yoonseongjun/Desktop/pro/bredy-marketing/scripts"); import bpw
S = bpw.start("naver")
def pw(*a):
    return subprocess.run(["npx", "--yes", "--package", "@playwright/cli", "playwright-cli", f"-s={S}", *a],
                          cwd="/Users/yoonseongjun/Desktop/pro/bredy-marketing", capture_output=True, text=True).stdout
pw("goto", "https://cafe.naver.com/zxgamezx")
js = """async()=>{const r=await fetch('https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/16729678/menus/5/articles?page=1&pageSize=30&sortBy=TIME&viewType=L',{credentials:'include'});
const t=await r.text();let d;try{d=JSON.parse(t)}catch(e){return 'ERR '+t.slice(0,300)};const l=((d.result||{}).articleList||[]).map(x=>x.item||x);if(!l.length)return 'EMPTY '+t.slice(0,400);return JSON.stringify(l.filter(a=>a.writerInfo.nickName!=='kingdom'&&Date.now()-a.writeDateTimestamp<14*864e5)
.map(a=>({id:a.articleId,url:'https://cafe.naver.com/zxgamezx/'+a.articleId,writer:a.writerInfo.nickName,title:a.subject,comments:a.commentCount})))}"""
out = pw("eval", js)
print(out[out.find('"['):out.rfind(']"') + 2] if '"[' in out else out)
