#!/usr/bin/env python3
"""로봇천국 하루 성장 지표: 멤버 수, 최근 글 조회·댓글, 지난 24시간 운영 글 수, 회원 글(답할 것·스팸 후보).
usage: python3 -I metrics.py   → JSON 한 개 출력 + ~/Desktop/pro/robot-cafe/growth/metrics.csv 에 하루 한 줄
로그인 없이 공개 API 만 쓴다."""
import csv, datetime as dt, json, os, re, urllib.request

CLUB, URL, OPERATOR = 16729678, "zxgamezx", "kingdom"
OUT = os.path.expanduser("~/Desktop/pro/robot-cafe/growth/metrics.csv")
SPAM = re.compile(r"최저가|제작|대행|상위노출|부업|수익|카톡|텔레|오픈채팅|문의주세요|http")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return json.load(urllib.request.urlopen(req, timeout=20))


def main():
    gate = get(f"https://apis.naver.com/cafe-web/cafe2/CafeGateInfo.json?cluburl={URL}")
    members = re.search(r'"memberCount":\s*(\d+)', json.dumps(gate))
    members = int(members.group(1)) if members else None
    arts = get(f"https://apis.naver.com/cafe-web/cafe2/ArticleListV2dot1.json?search.clubid={CLUB}"
               "&search.queryType=lastArticle&search.page=1&search.perPage=50")["message"]["result"]["articleList"]
    now = dt.datetime.now().timestamp() * 1000
    recent = [a for a in arts if now - a["writeDateTimestamp"] < 7 * 86400e3 and a["menuName"] != "게임천국 보관함"]
    ops_24h = sum(1 for a in arts if a["writerNickname"] == OPERATOR and now - a["writeDateTimestamp"] < 86400e3)
    members_posts = [{"id": a["articleId"], "board": a["menuName"], "title": a["subject"], "writer": a["writerNickname"],
                      "comments": a["commentCount"], "spam_suspect": bool(SPAM.search(a["subject"]))}
                     for a in recent if a["writerNickname"] != OPERATOR]
    row = {"date": dt.date.today().isoformat(), "members": members, "ops_posts_24h": ops_24h,
           "posts_7d": len(recent), "views_7d": sum(a["readCount"] for a in recent),
           "comments_7d": sum(a["commentCount"] for a in recent), "member_posts_7d": len(members_posts)}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    rows = list(csv.DictReader(open(OUT))) if os.path.exists(OUT) else []
    rows = [r for r in rows if r["date"] != row["date"]] + [row]
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(row)); w.writeheader(); w.writerows(rows)
    prev = rows[-8] if len(rows) >= 8 else rows[0]
    top = sorted(recent, key=lambda a: -a["readCount"])[:3]
    print(json.dumps({**row, "members_vs_7d_ago": (members or 0) - int(prev["members"] or 0),
                      "publish_alert": ops_24h == 0,  # 24시간 동안 운영 글 0개 = 자동 등록이 멈췄다
                      "top_posts_7d": [f'{a["readCount"]}회 {a["subject"]}' for a in top],
                      "member_posts": members_posts}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
