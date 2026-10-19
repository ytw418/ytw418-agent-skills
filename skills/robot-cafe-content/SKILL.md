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

1. **편성 확인** — `python3 $S/slot.py $SLOT` → `{board, head, kind}`. 종료 코드 3이면 쉬는 칸이니 보고하고 끝낸다. head에 `|`가 있으면 주제에 맞는 하나를 고른다.
2. **한도 확인** — `python3 $S/history.py today "<board>"`. 종료 코드 1(하루 3개·2시간 안·그 게시판에 오늘 이미 올림)이면 올리지 않고 보고하고 끝낸다.
3. **브라우저** — `$S/ensure-browser.sh`. 브리디 자동화 크롬(CDP 9222)에 세션 `robot-cafe` 로 붙어 자기 탭을 열고 네이버 잠금(`/tmp/bredy-chrome-locks/naver`)을 잡는다(10-19 — 네이버는 본계정 하나뿐이라 옛 전용 프로필 `.chrome-profile` 은 안 쓴다). 종료 코드 2(캡차·2단계 인증·로그인 실패)면 멈추고 "사람이 로그인해야 한다"고 보고한다. **실행이 끝나면(성공·실패·중단 모두) `$S/release-browser.sh`** 로 탭을 닫고 잠금을 푼다.
4. **주제·중복** — `python3 $S/history.py used`(30일 안에 쓴 주소). guide는 `python3 $S/history.py titles "<board>"`로 쓴 제목을 보고 [references/topics.md](references/topics.md)에서 안 쓴 주제를 고른다. news는 어제 폴더의 `candidates.md`도 읽는다.
5. **조사** — `Agent(subagent_type: general-purpose, model: sonnet)`에 [references/research-prompt.md](references/research-prompt.md)의 종류별 요청문(news·guide·jobs·events)을 채워 넘기고 결과를 기다린다. talk는 조사하지 않고 이번 주 `content/*/log.md`의 글을 쓴다. 받은 JSON을 `$D/$SLOT-sources.json`에 저장한다(news는 쓰지 않은 검증 소식을 `$D/candidates.md`에도).
6. **작성** — [references/style.md](references/style.md)의 종류별 구조·말투대로 `$D/$SLOT-title.txt`, `$D/$SLOT-body.txt`를 쓴다.
7. **검사** — `python3 $S/lint.py $D/$SLOT-title.txt $D/$SLOT-body.txt --kind <kind> --sources $D/$SLOT-sources.json --fetch`가 '통과'할 때까지 고친다(talk는 `--sources` 생략 가능). 숫자·고유명사는 sources의 사실과 한 번 더 대조한다.
8. **등록** — `$S/post.sh "<board>" $D/$SLOT-title.txt $D/$SLOT-body.txt [--head <말머리>]` (2~4분 → Bash `run_in_background`로 돌리고 기다린다). 글양식이 미리 채워진 게시판(채용공고 등)은 스크립트가 비우고 쓴다. 종료 코드 3(본문 불일치)·4(게시판·말머리·화면 문제)·5(등록 확인 실패)면 다시 시도하지 말고 보고한다 — 5는 글이 올라갔을 수도 있으니 카페에서 먼저 확인한다.
9. **비로그인 확인** — `node $S/anon-check.mjs <ARTICLE_ID> "<제목 앞부분>"`
10. **기록** — `python3 $S/log.py "<board>" $D/$SLOT-title.txt <URL> $D/$SLOT-sources.json $D/$SLOT-body.txt "<검사 결과 한 줄>"` (talk처럼 sources가 없으면 `echo '[]' > $D/$SLOT-sources.json` 후 기록)
11. **보고** — 한국어로 짧게: 칸·게시판·제목·글 주소, 출처(매체·날짜), 조심해서 쓴 표현, 실패했다면 어느 단계에서 왜.

## 지키는 것

- **말투는 카페 공식 존댓말**(사용자 결정 2026-10-18). 반말·음슴체·'ㅋㅋ'·인스타/스레드 말투 금지. 기준은 references/style.md.
- **사실**: 원문을 열어 확인한 것만 쓴다. 회사 발표 수치는 "회사 측은 ~라고 밝혔다", 계획은 "~할 예정이라고 한다". 제목 숫자보다 본문 숫자. 일반인 실명 금지. 자극적인 사건·사고, 판촉 기사는 고르지 않는다. 가격·규정은 확인한 날짜를 붙인다.
- **저작권**: 기사·공고 문장을 옮기지 않고 직접 요약한다(news·guide·talk는 원문과 20자 이상 같으면 lint가 막는다). 기사 사진을 올리지 않고 링크 미리보기 카드만 쓴다.
- **에디터**: 본문은 `typebody.sh`로만 넣는다(한 줄씩, 링크 줄 뒤 3초). 줄 앞에 `1. `·`①`을 쓰지 않는다(자동 목록이 켜져 글이 섞인다).
- 카페 설정·게시판·공지를 바꾸지 않는다. 가짜 회원·가짜 질문·자작 댓글을 만들지 않는다.
