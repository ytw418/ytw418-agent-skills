import os, re, subprocess, sys, time
import sys as _s; _s.path.insert(0, "/Users/yoonseongjun/Desktop/pro/bredy-marketing/scripts"); import bpw  # 자동화 크롬 도우미(2026-10-18)
SESSION = bpw.start("naver")
def pw(*a):
    r = subprocess.run(["npx","--yes","--package","@playwright/cli","playwright-cli",f"-s={SESSION}",*a], cwd="/Users/yoonseongjun/Desktop/pro/bredy-marketing", capture_output=True, text=True); return r.stdout + r.stderr
def ref(p, last=False):
    rs = [re.search(r"\[ref=([a-z0-9]+)\]", l).group(1) for l in pw("snapshot").splitlines() if re.search(p, l)]
    return (rs[-1] if last else rs[0]) if rs else None
url, text = sys.argv[1], open(sys.argv[2], encoding="utf-8").read().strip()
pw("goto", url); time.sleep(5)
box = ref(r'textbox|댓글을 남겨보세요|첫 댓글을 남겨보세요')
if not box: print("댓글칸 없음"); sys.exit(1)
pw("click", box); time.sleep(1.5)
act = ref(r'generic \[active\] \[ref=[^]]+\]: 댓글을 남겨보세요')  # 누르면 바로 입력칸(contenteditable)에 포커스가 간다
if act: pw("click", act)
pw("type", text); time.sleep(1)
btn = ref(r'button "등록"')
if not btn: print("등록 버튼 없음"); sys.exit(1)
pw("click", btn); time.sleep(4)
pw("goto", url); time.sleep(5)
print("ok" if text[:15] in pw("eval", "document.body.innerText") else "확인 안 됨")
