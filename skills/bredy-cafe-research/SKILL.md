---
name: bredy-cafe-research
description: 브리디 시장조사용으로 네이버 카페(식물·강아지·고양이·물고기·거북이·소동물 등) 최근 글의 제목·본문·사진을 브리디 자동화 크롬(9222) 네이버 로그인으로 수집하고, 카페별 글 수·반응·게시판·많이 나온 말·분양 비중·가격을 집계한다. 종별 대표 카페 찾기 → 활동량 확인 → 수집(글 사이 3~5초, 이어받기) → 잠긴 글 점검 → 집계 보고(report.md)까지 한다. 사용자가 '카페 크롤링', '카페 글 수집', '○○ 카페 30개 긁어줘', '네이버 카페 시장조사', '카페 사진이랑 글 받아줘', '카페 집계' 등을 요청할 때 사용한다. 카페에 댓글·글을 다는 일은 bredy-cafe-activity, 로봇천국 카페 운영은 robot-cafe-content 담당.
---

# 브리디 카페 시장조사 수집

2026-10-21 사용자 요청("식물 카페 식집사 사진이랑 글 크롤링, 시장조사용")으로 만들었다. 첫 실행 결과는 `~/Desktop/pro/bredy-marketing/research/cafe/report.md`(식물 2곳·피그미다람쥐·강아지·고양이·물고기·거북이).

## 지키는 것

- **내부 분석용만.** 받은 사진·글을 브리디·SNS·크루 글에 다시 올리지 않는다(저작권). 보고 끝에 한 줄로 알린다.
- **작성자 닉네임·ID 는 저장하지 않는다.** 스크립트가 이미 빼고 저장한다(회원 등급 숫자만 남김).
- **천천히.** 글 사이 3~5초, 카페당 한 번에 200개 이하. 네이버 계정(ytw418 본계정 — 블로그·카페 활동 전부 이 계정)이 정지되면 손실이 크다.
- 브라우저는 자동화 크롬(9222)에 붙는다(`bchrome.mjs withTab("naver")`, 사이트 잠금). 새 브라우저를 띄우지 않는다. 로그인이 풀렸으면 사용자에게 알린다.
- 결과 폴더 `bredy-marketing/research/` 는 `.gitignore` 에 있다(수백 MB·개인 글). 커밋하지 않는다.

## 순서

스크립트는 이 스킬의 `scripts/` 에 있다(`S=~/.claude/skills/bredy-cafe-research/scripts`).

1. **카페 찾기** — `node $S/cafe-find.mjs 검색어1 검색어2 …` → 검색 상위 6곳의 주소이름·clubid·이름.
   - 회원 수는 API 가 안 준다. 이름으로 대표 카페를 고르고, 동음이의어(거북이 → 주식·갑상선 카페)는 `반려거북`처럼 바꿔 검색한다.
   - 고른 뒤 **활동량을 확인**한다: 목록 API 로 최근 50개 날짜 범위를 본다(아래 '목록 API'). 글이 거의 없는 카페(10-21 거사모 rjqnrdl 은 글 1개)는 다음 후보로.
2. **수집** — `node $S/cafe-crawl.mjs <주소이름> <clubid> [글 수=200] [menuId]` (백그라운드로 돌리고 끝 알림을 기다린다).
   - 결과: `research/cafe/<카페>/articles.jsonl`(게시판·날짜·조회·댓글·좋아요·가격·제목·본문·사진 파일·잠김·원문 링크), `images/<글번호>_<n>.jpg`, `summary.csv`(엑셀용, BOM).
   - 끊기면 같은 명령을 다시 — 받은 글은 건너뛴다. 특정 게시판만은 `menuId` 를 준다(거래 게시판 등).
   - 여러 카페는 **한 줄에 하나씩** 순서대로 돌린다(같은 네이버 잠금). zsh 에서 `for c in "a 1" …; set -- $c` 는 단어로 안 나뉘어 실패한다(10-21 실수) — 함수 `run() { node … "$1" "$2" 30; }; run domouse 30998997; run …` 처럼 쓴다.
3. **잠긴 글 점검** — 가입 안 했거나 등급이 낮으면 본문 대신 가입 권유 문구가 나온다(`locked:true`, 본문·사진 비움). 카페마다 잠긴 수를 보고하고, 절반 넘게 잠기면 '가입·등업이 필요하다'를 사용자 할 일로 올린다(가입 질문 답·등업은 사용자 몫).
4. **집계** — `python3 $S/cafe-report.py [카페 …]` → `research/cafe/report.md`. **카페 이름을 주면 그 카페만으로 report.md 를 덮어쓴다** — 끝에는 인자 없이 전체로 다시 돌린다.
   - 카페별: 글 수·기간·하루 평균, 평균 조회·댓글·좋아요, 사진 글·질문형 제목·분양/판매/나눔 제목 비율, 게시판 분포, 많이 나온 말 20, 가격 분포(목록에 가격이 있을 때), 반응 많은 글 5(링크).
5. **보고** — 카페별 표(글·본문 있음·사진·잠김) + 눈에 띄는 점 3~5줄 + 저장 위치 + '내부 분석용' 한 줄.

## 목록 API (참고)

자동화 크롬의 `m.cafe.naver.com` 탭 안에서 `fetch(..., {credentials:"include"})` 로 부른다.
- 목록: `https://apis.naver.com/cafe-web/cafe2/ArticleListV3dot1.json?search.clubid=<id>&search.queryType=lastArticle&search.page=<p>&search.perPage=50[&search.menuid=<m>]` → `message.result.articleList[]`(articleId·menuId·menuName·subject·readCount·commentCount·likeItCount·writeDateTimestamp·cost·marketArticle), `hasNext`.
- 카페 정보: `CafeGateInfo.json?cluburl=<주소이름>` → cafeId.
- 본문은 API 가 아니라 글 화면(`m.cafe.naver.com/ca-fe/web/cafes/<id>/articles/<aid>`) DOM 에서 읽는다: 제목 `h2.tit`, 본문 `.se-main-container`(옛 에디터 `#postContent`·`#tbody`), 사진은 그 안 `img`(pstatic). 사진은 `page.request.get`(referer m.cafe) 로 받는다.

## 10-21 첫 실행에서 알게 된 것

| 카페 | clubid | 메모 |
|---|---|---|
| 알뜰한 식물생활 greenruby07 | 29839016 | 식집사 커뮤니티, 하루 ~100글·댓글 평균 9.8, 가입됨 |
| 꽃사랑 다육사랑 장터 plantremarket | 25090431 | 거래 게시판(팔아요 56·거래완료 59·나눔 227)은 등급 제한으로 전부 잠김 |
| 피그미다람쥐 domouse | 30998997 | 30개 중 18 잠김 |
| 강사모 dogpalza | 10258021 | 15 잠김, 펫페어·업체 홍보 글 많음 |
| 고양이라서 다행이야 ilovecat | 10070043 | 28/30 잠김 — 가입 필요 |
| 홈다리 hby | 10135947 | 가입됨, 질문형 30% |
| 거북이 공원 snappingturtle | 13262356 | 분양 27%·분양 양식 있음, 조회 평균 97 |
