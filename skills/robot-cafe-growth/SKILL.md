---
name: robot-cafe-growth
description: 로봇천국 네이버 카페(cafe.naver.com/zxgamezx)의 회원 수를 늘리는 하루 성장 점검. 멤버 수·조회·댓글 지표를 쌓고, 자동 등록이 멈췄는지 잡아 고치고, 회원 글에 운영자로 답하고, 스팸을 골라내고, 주 1회 잘 읽힌 글을 보고 다음 주 주제·제목 검색어를 바꾼다. 사용자가 '로봇카페 활성화', '로봇카페 회원 늘려', '로봇천국 성장 점검', '카페 지표 봐줘' 등을 요청하거나 Paseo 일정 '로봇천국 성장 점검'(매일 23:00, 일정 ID 47b398a9)이 실행할 때 쓴다. 글 작성·등록 자체는 robot-cafe-content 담당.
---

# 로봇천국 성장 점검

목표·진단·실험 목록은 `~/Desktop/pro/robot-cafe/growth/plan.md`(목표: 멤버 10,000명, PRD G-5). 매일 기록은 `growth/metrics.csv`·`growth/log.md`. 전략 근거는 `community-marketing`·`content-strategy` 스킬(필요할 때만 읽는다).

## 매일 (10분 안)

```bash
G=~/.claude/skills/robot-cafe-growth/scripts; C=~/.claude/skills/robot-cafe-content/scripts
python3 -I $G/metrics.py
```

1. **자동 등록 살아 있나** — `publish_alert:true`(24시간 운영 글 0개)면 오늘 `content/<날짜>/*-publish.log` 끝을 읽어 원인을 찾는다. `$C/ensure-browser.sh` 가 2면 네이버 로그인이 풀린 것 → 사용자 할 일(`~/Desktop/pro/personal-todo/todo.md`, CLAUDE.md §11)에 "로봇천국: 브리디 자동화 크롬에서 네이버 다시 로그인"을 넣고 보고한다. 스크립트 문제면 고치고 그날 빠진 칸을 `publish.py <칸>` 으로 하나만 올린다(하루 3개·2시간 간격 한도 지킴).
2. **회원 글** — `member_posts` 중 `spam_suspect:false` 이고 답 없는 글은 운영자(kingdom)로 정보성 답 댓글을 단다(카페 공식 존댓말, robot-cafe-content references/style.md). 자작 질문·자작 댓글·가짜 회원은 만들지 않는다(PRD P-6.8). 스팸 후보는 글 번호·제목을 보고에 적고, 사용자가 삭제를 허락한 종류만 지운다.
3. **기록** — `growth/log.md` 에 날짜·멤버 수(7일 전 대비)·조회 상위 3개·한 일 한 줄씩.

## 주 1회 (월요일)

- 7일 `top_posts_7d` 와 `metrics.csv` 를 보고 무엇이 읽혔는지 `plan.md` '배운 것'에 한 줄 적는다.
- 다음 주 정보글 주제를 robot-cafe-content `references/topics.md` 에 3개 넣는다. 주제마다 `python3 -I $G/keywords.py "<핵심어>"` 로 자동완성에 실제로 나오는 검색어를 골라 적는다(제목 맨 앞에 쓸 말).
- `plan.md` 실험 목록에서 다음 하나를 고른다. 카페 설정·게시판 권한 변경, 외부 채널 사용은 사용자 승인 뒤에만 한다.

## 보고

한국어 다섯 줄 안: 멤버 수(전주 대비), 자동 등록 상태, 회원 글 처리, 사용자가 할 일, 다음 실험.
