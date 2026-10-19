---
name: bredy-instagram-outreach
description: 브리디 공식 인스타 계정(bredy_breeder)으로 크레·파충류·곤충·물고기 브리더·샵·키우는 사람에게 영업 DM 을 보내고 답장을 처리한다. 브리디 자동화 크롬(scripts/ig.mjs)으로 DM함 답장 정리 → 남은 창립 브리더 자리 확인 → 유형별 공통 문구에 닉네임만 넣어 하루 20명까지 발송 → targets.csv 기록 → 보고까지 한다. "인스타 DM 영업", "인스타 영업 돌려", "DM 보내줘", "인스타 답장 확인", "영업 메시지 보내", "브리더 DM", 아침·점심·저녁 자동 영업 일정 실행 때 쓴다.
---

# 브리디 인스타 DM 영업

상세 기획: `references/prd.md`. 문구: `references/templates.md`. 브라우저: **브리디 자동화 크롬**(`~/.bredy-chrome`, CDP 9222)에 `scripts/ig.mjs` 가 붙어 자기 탭에서 보낸다(2026-10-18 정책 — `~/Desktop/pro/bredy-marketing/docs/browser-automation.md`). `references/browser-recipe.md`(Paseo 브라우저 방식)는 예전 기록.

```bash
OUT=~/.claude/skills/bredy-instagram-outreach/scripts/outreach.mjs   # 데이터: ~/Documents/bredy-outreach
node $OUT slots        # 남은 창립 브리더 자리
node $OUT stats        # 상태별 수, 오늘 보낸 수(한도 20)
node $OUT next 7       # 이번에 보낼 후보(handle 닉네임 분야 유형)
node $OUT mark <handle> 보냄|답장|관심|가입|거절|제외 "메모"
node $OUT add <handle> <닉네임> <분야> <유형> <출처> "메모"
```

## 전제 (하나라도 아니면 보내지 않는다)

1. 브리디 자동화 크롬이 떠 있다(`~/.local/bin/bredy-chrome` — 꺼져 있으면 ig.mjs 가 켠다). Mac 이 잠자기면 안 된다.
2. 자동화 크롬에 **bredy_breeder 로 로그인**돼 있다 — `node $IG check` 가 "로그인됨". 저장된 계정의 '계속' 버튼은 ig.mjs 가 누른다. 그 밖의 로그인·본인 확인은 사용자에게 넘긴다.
3. `~/Documents/bredy-outreach/targets.csv` 가 있다(없으면 `add` 로 만든다).

```bash
IG=~/.claude/skills/bredy-instagram-outreach/scripts/ig.mjs   # 실행은 cd ~/Documents/bredy-outreach/runner 에서(playwright-core)
node $IG check | inbox | read <handle> | reply <handle> <글> | send [n] [--dry]
```
인스타 게시 스크립트와 같은 'instagram' 사이트 잠금을 써서, DM 보내기와 게시물 올리기가 겹치지 않는다(다른 사이트 작업과는 병렬).

## 실행 순서 (한 번 = 아침/점심/저녁 한 슬롯)

1. **준비 확인** — `node $IG check`. "로그인 안 됨"이면 이유를 적고 끝낸다.
2. **남은 자리** — `node $OUT slots` 는 보고용으로만 본다. 창립 100석은 10-16 에 마감됐고, 지금 문구(templates.md '첫 메시지 — 기본' 10-19 판)엔 남은 자리가 없어 0이어도 계속 보낸다(10-19 사용자 "더 보내야지 왜 멈춰").
3. **답장 정리** — `node $IG inbox` 로 안 읽은 대화를 받는다(필요하면 `read`). templates.md '자동으로 보내도 되는 것' 표에 맞으면 `node $IG reply` 로 보내고 `mark`. 표 밖이면 답하지 말고 보고의 '사람에게 넘길 것'에 `닉네임 — 받은 말 요약`을 적는다. 사용자가 직접 대화 중인 사람은 건드리지 않는다.
4. **새 메시지** — `node $IG send 10`(후보 순서대로 유형별 문구·닉네임·남은 자리를 넣어 보내고 45초 쉰다, 하루 한도·야간 금지는 스크립트가 지킨다). 유형별 문구(templates.md)에 닉네임만 넣는다(웹 링크 포함). 프로필을 따로 조사하지 않는다(토큰 절약).
5. **목록 보충** — 후보가 10명 미만이면 팔로워 → 팔로잉 → 홈 추천(관련 계정만 팔로우, 실행당 5명 이하) → 해시태그 순으로 `add`. 해외·무관·지인 계정은 `제외`/`확인필요`.
6. **보고** — `~/Documents/bredy-outreach/log/<YYYY-MM-DD>.md` 에 덧붙이고 답변에도 쓴다:
   - 사람에게 넘길 것(맨 위) / 답장 온 사람·처리 / 이번에 보낸 수·오늘 누계 / 가입 / 남은 자리 / 다음 후보 수

## 지키는 것

- 새 메시지는 자동 일정에선 실행당 10명, 하루 30명 이하(10-19 사용자: 아침·점심·저녁 10명씩). 사용자가 직접 "더 보내"라고 하면 `OUTREACH_DAILY_LIMIT=300 node $OUT next 200` 으로 목록을 뽑아 Haiku 서브에이전트에 빠른 순서로 넘긴다(10-10 사용자: "정확도는 낮춰도 되니 더 빠르게 더 많이"). 같은 사람에게 첫 메시지는 한 번. 무응답에 재촉하지 않는다. 거절하면 끝.
- 약속은 PRD 5장에 있는 것만(분양글·경매 무료, 올라온 개체를 인스타·유튜브 광고로 대신 홍보, 초기 등록 상위 노출, 샵·행사 베타 배너·팝업). 광고 시기·횟수, 상위 노출 기간, 인증 뱃지, 금전 보상, 창립 브리더 수수료 0원(10-16 100석 마감)은 약속하지 않는다.
- **밤 9시~아침 8시(KST)엔 새 영업 메시지를 보내지 않는다** — 정보통신망법 50조 3항(야간 광고성 정보는 별도 사전 동의 필요). 이 시간에 "더 보내" 요청이 오면 후보만 모아 두고 08:00 1회 Paseo 일정으로 미룬 뒤 알린다. 상대가 먼저 보낸 메시지에 답하는 것은 괜찮다.
- '상품·판매·구매' 대신 '분양글·분양·입양'.
- AI 여부를 물으면 솔직하게 답하고 사람에게 넘긴다.
- 차단 회피 위장(일부러 넣는 무작위 지연, 다계정, 탐지 우회 도구)은 쓰지 않는다. 인스타가 제한 경고를 띄우면 그날 중단하고 알린다.
- targets.csv·로그는 저장소에 커밋하지 않는다(다른 사람 계정 정보).

## 예전 방식 (기록)

10-11 `ig.mjs` 가 자기 프로필 창을 켰다 꺼서 사용자가 불편해했고(10-12) Paseo 브라우저로 바꿨다. 10-18 부터는 `ig.mjs` 가 늘 떠 있는 자동화 크롬의 자기 탭만 열고 닫아 창이 켜졌다 꺼지지 않는다 → 다시 `ig.mjs` 가 기본이다. Paseo 브라우저 방식(`references/browser-recipe.md`)은 쓰지 않는다.

## 자동 실행 (사용자가 켜 달라고 할 때만)

자동화 크롬은 어떤 에이전트든 붙을 수 있어서 **Paseo 일정(schedule, 새 에이전트)** 으로 돌릴 수 있다(예전엔 Paseo 브라우저 탭이 작업 공간마다 따로라 하트비트만 됐다). 예: cron `0 10,13,19 * * *` Asia/Seoul, cwd `~/Documents/bredy-outreach/runner`, 프롬프트 "bredy-instagram-outreach 스킬로 이번 슬롯 실행, 로그인에 사람이 필요하거나 인스타 제한 경고면 멈추고 보고". 10-18 기준 등록된 영업 일정은 없다(이전 하트비트 없음).
