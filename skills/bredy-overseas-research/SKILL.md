---
name: bredy-overseas-research
description: 브리디 시장조사용으로 해외 반려생활 커뮤니티(미국·영어권 Reddit, 대만 PTT, 미국 XenForo 포럼 TheCatSite·dogforum 등)에서 강아지·고양이·파충류·식물·거북이·물고기·햄스터 글의 제목·본문·사진을 수집하고 사이트별로 집계한다. 종별 사이트 고르기 → 접속 확인 → 사이트 형태별 수집기 실행(이어받기) → 집계 보고까지 한다. 사용자가 '해외 크롤링', '해외 사이트 수집', '레딧 수집', 'PTT 수집', '해외 커뮤니티 시장조사', '외국 반려동물 글 모아줘', '해외에서 ○○ 200개씩' 등을 요청할 때 사용한다. 네이버 카페 수집은 bredy-cafe-research 담당.
---

# 브리디 해외 커뮤니티 시장조사 수집

2026-10-21 PTT 고양이 10건(`bredy-marketing/scripts/ptt-crawl.py`, 사진 속 글자 거르기)으로 시작했고, 사이트 목록은 `bredy-marketing/research/overseas/crawl-targets.md` 에 있다. 10-23 사용자 "그때 여러 사이트 대상으로 다양하게 수집하는 스킬"로 여러 사이트 수집기를 묶었다.

## 지키는 것

- **내부 분석용만.** 받은 사진·글을 브리디·SNS·크루 글에 다시 올리지 않는다(저작권·약관). 보고 끝에 한 줄로 알린다.
- **작성자 이름은 저장하지 않는다**(수집기가 이미 뺀다).
- 로그인이 필요한 영역은 받지 않는다. 사이트 사이 간격을 지킨다(Reddit 목록 2초·사진 0.4초, PTT 요청 1초, 포럼 글 2~4초). 한 사이트에 한 번 200개 이하.
- 브라우저가 필요한 사이트(Reddit·포럼)는 자동화 크롬(9222)에 붙는다(`bchrome.mjs withTab`, 사이트 잠금). 새 브라우저를 띄우지 않는다.
- 결과는 `bredy-marketing/research/overseas/<사이트-대상>/` (`.gitignore` 의 `research/`, 커밋하지 않는다).

## 수집기 (`S=~/.claude/skills/bredy-overseas-research/scripts`)

| 사이트 | 나라 | 수집기 | 접근 | 비고 |
|---|---|---|---|---|
| Reddit | 미국·영어권 | `node $S/reddit-crawl.mjs <서브레딧> [글 수=200] [new\|hot\|top]` | 자동화 크롬 탭 안 공개 JSON(터미널 curl 은 403) | 점수·댓글 수·플레어. 갤러리·이미지 글 사진, 영상은 건너뜀 |
| PTT | 대만 | `python3 -I $S/ptt-research.py <보드> [글 수=200]` | 터미널(`over18=1` 쿠키) | `bredy-marketing/scripts/ptt-crawl.py` 함수 재사용. 말머리 그대로(거래·나눔 `交易·贈送·送養` 은 market) |
| XenForo 포럼 | 미국 | `node $S/xenforo-crawl.mjs <게시판 주소> <저장 이름> [글 수=200]` | 자동화 크롬(터미널은 봇 차단 403·202) | 스레드 첫 글만, 조회·답글 수 |

여러 개를 돌릴 땐 zsh 함수로 한 줄씩(`r() { node … "$1" "$2"; }; r dogs 100; r cats 100`). zsh 는 `$c` 를 단어로 안 나눈다. Reddit·포럼(크롬)과 PTT(터미널)는 따로 백그라운드로 동시에 돌려도 된다.

끊기면 같은 명령을 다시 — 받은 글은 건너뛴다.

## 종별 대상 (10-23 확인)

| 종 | Reddit | PTT 보드 | 포럼 |
|---|---|---|---|
| 강아지 | dogs | dog | dogforum.com (XenForo) |
| 고양이 | cats | cat | thecatsite.com/forums/<게시판>/ (XenForo, 크롬에서 열림) |
| 파충류 | reptiles | Reptile | — |
| 식물 | houseplants | Plant | — |
| 거북이 | turtle, tortoise | 없음(404) | tortoiseforum.org 는 Cloudflare 확인 화면에 막힘 |
| 물고기 | Aquariums | Aquarium (fish 는 404) | reef2reef·plantedtank 는 미확인 |
| 햄스터 | hamsters | hamster | — |

일본(5ch·Ameba·ブログ村)은 수집기 미작성 — `crawl-targets.md` 참고, 필요하면 새 수집기를 같은 출력 형식으로 만든다.

## 출력 형식 (모든 수집기 공통)

`articles.jsonl` 한 줄 = `{articleId, menu(플레어·말머리·접두어), date, views, comments, likes(Reddit 점수), market, title, body, images[파일 이름], locked, url}` + `images/<id>_<n>.<ext>` + `summary.csv`(엑셀용).
네이버 카페 수집과 같아서 집계는 카페 스킬의 스크립트로 한다:

```bash
CAFE_RESEARCH_DIR=~/Desktop/pro/bredy-marketing/research/overseas python3 ~/.claude/skills/bredy-cafe-research/scripts/cafe-report.py
```

→ `research/overseas/report.md`(인자 없이 돌려야 전체가 들어간다). PTT 는 조회·추천 수가 0(목록에서 안 받음)이라 반응 비교에서 뺀다.

## 보고

사이트·대상별 표(글·사진·본문 빈 글) + 종별로 눈에 띄는 점 3~5줄(나라별 차이, 분양·거래 비중, 많이 묻는 것) + 저장 위치 + '내부 분석용' 한 줄.
