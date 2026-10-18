"""네이버 블로그(bredy_team)에 사진 여러 장 + 글을 올리고 발행한다(naver-shorts.py 의 사진판).
사용법: python3 blog/naver-photos.py <본문.txt> <제목> <카테고리> <태그,태그> <사진...>  (사진은 맨 위에 개별사진으로)

사용법: python3 blog/naver-shorts.py <meta.json 의 ep> <카테고리 이름>   (예: ep2 "브리디 소식")
순서: 글쓰기 화면 → 제목 → 동영상(업로드·영상 제목·완료) → 영상 아래 본문 → 발행 창(카테고리·태그) → 발행 → 글 주소 출력.
본문은 blog/shorts-1015/<ep>.txt 에서 @@VID 줄을 뺀 것. URL 로 끝나는 줄 뒤 Enter 는 링크 미리보기로 먹히므로 빈 줄을 하나 더 넣는다.
네이버가 로그아웃돼 있으면 크롬 저장 비밀번호로 '로그인'을 누른다."""
import json, os, re, subprocess, sys, time
import sys as _s; _s.path.insert(0, "/Users/yoonseongjun/Desktop/pro/bredy-marketing/scripts"); import bpw  # 자동화 크롬 도우미(2026-10-18)
SESSION = bpw.start("naver")

CWD = "/Users/yoonseongjun/Desktop/pro/bredy-marketing"




def pw(*args):
    r = subprocess.run(["npx", "--yes", "--package", "@playwright/cli", "playwright-cli", f"-s={SESSION}", *args],
                       cwd=CWD, capture_output=True, text=True)
    return r.stdout + r.stderr


def refs(pattern, snap=None):
    snap = snap or pw("snapshot")
    return [m.group(1) for line in snap.splitlines() if re.search(pattern, line)
            for m in [re.search(r"\[ref=([a-z0-9]+)\]", line)] if m]


def need(pattern, what, last=False):
    for _ in range(10):
        r = refs(pattern)
        if r:
            return r[-1] if last else r[0]
        time.sleep(1.5)
    print(f"못 찾음: {what}")
    sys.exit(1)


def main():
    src, title, cat, tags, photos = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(","), sys.argv[5:]
    body = []
    for line in open(src, encoding="utf-8").read().splitlines():
        body.append(line)
        if re.search(r"https?://\S+$", line):
            body.append("")
    pw("goto", "https://blog.naver.com/PostWriteForm.naver?blogId=bredy_team")
    time.sleep(9)
    if "nid.naver.com" in pw("tab-list"):
        pw("click", need(r'button "로그인"', "로그인 버튼"))
        time.sleep(6)
        pw("goto", "https://blog.naver.com/PostWriteForm.naver?blogId=bredy_team")
        time.sleep(9)
    snap = pw("snapshot")
    if "작성 중인 글" in snap:
        c = refs(r'button "취소"', snap)
        if c:
            pw("click", c[0])
            time.sleep(1)

    # 제목
    pw("click", need(r"paragraph \[ref=[^]]+\]: 제목", "제목 칸"))
    pw("type", title)
    # 사진(여러 장이면 '개별사진')
    out = pw("click", need(r'button "사진 추가"', "사진 버튼"))
    if "File chooser" not in out:
        print("파일 선택 창이 안 뜸"); sys.exit(1)
    pw("upload", *[f"{CWD}/{p}" for p in photos])
    time.sleep(6)
    ind = refs(r'generic \[ref=[^]]+\] \[cursor=pointer\]: 개별사진')
    if ind:
        pw("click", ind[0]); time.sleep(4)
    # 마지막 사진 다음 문단
    snap = pw("snapshot").splitlines()
    i = max(k for k, l in enumerate(snap) if re.search(r'img "[^"]*\.(png|jpe?g)"|사진 설명을 입력하세요', l))
    para = next(re.search(r"\[ref=([a-z0-9]+)\]", l).group(1) for l in snap[i:] if re.search(r"paragraph \[ref=", l) and "사진 설명" not in l and "AI 활용" not in l)
    pw("click", para)
    pw("type", "\n".join(body))
    time.sleep(2)
    # 발행
    pw("click", need(r'button "발행"', "발행 버튼"))
    time.sleep(2)
    pw("click", need(r'button "카테고리 목록 버튼"', "카테고리 버튼"))
    time.sleep(1)
    pw("click", need(rf'button "{re.escape(cat)}"', f"카테고리 {cat}"))
    time.sleep(1)
    pw("click", need(r'combobox "태그 입력', "태그 칸"))
    for t in tags:
        pw("type", t)
        pw("press", "Enter")
    time.sleep(1)
    pw("click", need(r'button "발행"', "최종 발행 버튼", last=True))
    time.sleep(9)
    m = re.search(r"\(current\) \[[^\]]*\]\((https://blog\.naver\.com/PostView[^)]*logNo=(\d+)[^)]*)\)", pw("tab-list"))
    print(f"https://blog.naver.com/bredy_team/{m.group(2)}" if m else "발행 확인 안 됨")


main()
