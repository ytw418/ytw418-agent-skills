---
name: robot-cafe-content
description: 로봇천국 네이버 카페(cafe.naver.com/zxgamezx)에 운영 글을 올린다. 하루 세 칸 — 아침 [오늘의 로봇 뉴스], 점심 분야별 게시판 정보글(요일마다 휴머노이드·로봇청소기·드론 등), 저녁 정보 게시판 글(채용 모음·로봇 정보·꿀팁·회사·직무 정보·교육·자격증·행사 일정·주간 이야기) — 을 편성표대로 고르고, 원문까지 열어 사실을 검증하고, 카페 공식 말투로 쓰고, 말투·출처·원문 복사 검사를 거쳐, 브리디 자동화 크롬(9222)의 자기 탭으로 등록하고, 비로그인 확인과 기록까지 한다. 사용자가 '로봇 뉴스 올려줘', '오늘의 로봇 뉴스', '로봇천국 글 올려', '로봇카페 콘텐츠', '로봇카페 게시판 채워', '정보글 올려' 등을 요청하거나 Paseo 일정(08:30·12:30·19:30)이 실행할 때 쓴다. 카페 설정·게시판 구조 변경, 다른 카페 활동(bredy-cafe-activity)에는 쓰지 않는다.
---

# 로봇천국 콘텐츠

운영 규칙은 `~/Desktop/pro/robot-cafe/docs/prd/robot-cafe-ops-policy.md`(RC-OPS-001)가 기준이다. 이 스킬은 그중 P-6(콘텐츠 운영)·P-7(말투)·P-8(저작권)을 실행한다.

- 데이터 폴더 `~/Desktop/pro/robot-cafe` — 날짜별 기록(`content/<YYYY-MM-DD>/`), PRD
- 계정은 운영자 본계정(카페 별명 kingdom). 본계정이 카페 5개를 운영하므로 **하루 최대 3개, 글 사이 2시간 이상**을 반드시 지킨다.
- 편성표는 `scripts/calendar.json`: 아침(morning) 로봇 뉴스, 점심(lunch) 분야별 정보글, 저녁(evening) 정보 게시판 글. 토요일 저녁은 쉰다.

## 쓰지 않는 게시판

로봇 질문답변, 사용후기·리뷰, 팝니다·삽니다·거래후기·사기신고, 면접·합격후기, 스터디·프로젝트, 내 로봇 자랑은 **회원이 쓰는 곳**이다. 운영자가 대신 쓰면 가짜 질문·가짜 후기가 되므로(PRD P-6.8, 네이버 어뷰징) 이 스킬은 글을 올리지 않는다.

## 순서 (한 칸)

```bash
S=~/.claude/skills/robot-cafe-content/scripts; D=~/Desktop/pro/robot-cafe/content/$(date +%F); mkdir -p $D
SLOT=morning   # 또는 lunch / evening — 요청이나 일정 문구에서 정한다
```

1. **준비** — `python3 $S/prepare.py $SLOT` → JSON 한 개(편성 확인 + 한도 확인 + 주제·중복 자료를 한 번에, 브라우저는 열지 않는다). `proceed:false` 면 `reason` 을 보고하고 끝낸다(종료 코드 3 쉬는 칸 / 1 한도에 걸림·오늘 이 칸을 이미 올림). 쓰는 키: `board`·`head`·`kind`, `files`(title·body·sources 경로), `research`(조사 종류), `used_urls`(30일 안에 쓴 기사 주소 — 겹치지 않게), `board_titles`(그 게시판에 쓴 제목 — 주제 중복 방지, guide는 [references/topics.md](references/topics.md)에서 안 쓴 주제를 고른다), `yesterday_candidates`(news일 때 어제 이전 후보 파일 경로 — 읽는다). head에 `|`가 있으면 주제에 맞는 하나를 골라 4단계에 `--head`로 준다.
2. **조사** — `Agent(subagent_type: general-purpose, model: sonnet)`에 [references/research-prompt.md](references/research-prompt.md)의 종류별 요청문(news·guide·jobs·events)을 채워 넘기고 결과를 기다린다. talk는 조사하지 않고 이번 주 `content/*/log.md`의 글을 쓴다. 받은 JSON을 `$D/$SLOT-sources.json`에 저장한다(news는 쓰지 않은 검증 소식을 `$D/candidates.md`에도). `$D`는 prepare의 `dir`.
3. **작성** — [references/style.md](references/style.md)의 종류별 구조·말투대로 `$D/$SLOT-title.txt`, `$D/$SLOT-body.txt`를 쓴다.
4. **등록** — `python3 $S/publish.py $SLOT [--head <말머리>]` 를 **Bash 포그라운드, timeout 600000** 으로 실행한다(2~6분). 검사(lint --fetch) → 한도 → 브라우저 준비 → 글쓰기 화면 입력·원문 대조·등록 → 비로그인 확인 → 기록(log.py) → 탭·잠금 정리를 한 번에 하고 결과 JSON 한 개를 낸다. **백그라운드로 돌리고 알림을 기다린다고 답하지 않는다** — 일정 세션이 거기서 끝나 기록·확인이 빠진다(10-20 점심, 10-21 아침·점심이 그렇게 안 올라갔다). 결과(`ok`·`code`·`message`)별 처리:
   - `ok:true` — 끝. `url`·`title` 을 보고에 쓴다. (같은 칸을 두 번 올리지 않는다: 성공하면 `$SLOT-published.json` 이 남고, 다시 실행하면 멈춘다.)
   - 종료 코드 4(검사 실패) — `message`·`lint.notes` 의 '고칠 것'대로 글을 고치고 다시 실행(최대 3번). 숫자·고유명사는 sources의 사실과 한 번 더 대조한다.
   - 종료 코드 2(`needs_human`) — 캡차·2단계 인증·저장된 비밀번호 없음. 멈추고 "사람이 로그인해야 한다"고 보고한다.
   - 종료 코드 5(한도·이미 올림), 3(쉬는 칸) — 올리지 않고 보고하고 끝낸다.
   - 종료 코드 6(본문 불일치·게시판·말머리·화면 문제로 등록 안 함) — 다시 시도하지 말고 보고한다.
   - 종료 코드 7(`maybe_posted`, 등록 확인 실패·시간 초과) — 글이 올라갔을 수 있다. 다시 시도하지 말고 카페에서 먼저 확인한 뒤 보고한다.
   - `--dry-run` 을 주면 등록 직전까지만 하고 비로그인 확인·기록을 하지 않는다(시험용).
5. **보고** — 한국어로 짧게: 칸·게시판·제목·글 주소, 출처(매체·날짜), 조심해서 쓴 표현, 실패했다면 어느 단계에서 왜.

스크립트 안에서 일어나는 일(고장 났을 때 한 단계씩 돌려 볼 때만): `lint.py` → `history.py today` → `ensure-browser.sh`(브리디 자동화 크롬 9222 자기 탭 + 네이버 잠금, 끝나면 `release-browser.sh`) → `post.sh`(typebody.sh·cmp.py 원문 대조) → `anon-check.mjs <글번호> "<제목 앞부분>"` → `log.py`. 로그는 `$D/$SLOT-publish.log`.

## 지키는 것

- **말투는 카페 공식 존댓말**(사용자 결정 2026-10-18). 반말·음슴체·'ㅋㅋ'·인스타/스레드 말투 금지. 기준은 references/style.md.
- **사실**: 원문을 열어 확인한 것만 쓴다. 회사 발표 수치는 "회사 측은 ~라고 밝혔다", 계획은 "~할 예정이라고 한다". 제목 숫자보다 본문 숫자. 일반인 실명 금지. 자극적인 사건·사고, 판촉 기사는 고르지 않는다. 가격·규정은 확인한 날짜를 붙인다.
- **저작권**: 기사·공고 문장을 옮기지 않고 직접 요약한다(news·guide·talk는 원문과 20자 이상 같으면 lint가 막는다). 기사 사진을 올리지 않고 링크 미리보기 카드만 쓴다.
- **에디터**: 본문은 `typebody.sh`로만 넣는다(한 줄씩, 링크 줄 뒤 3초). 줄 앞에 `1. `·`①`을 쓰지 않는다(자동 목록이 켜져 글이 섞인다).
- 카페 설정·게시판·공지를 바꾸지 않는다. 가짜 회원·가짜 질문·자작 댓글을 만들지 않는다.
