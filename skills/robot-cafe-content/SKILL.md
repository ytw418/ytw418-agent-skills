---
name: robot-cafe-content
description: 로봇천국 네이버 카페(cafe.naver.com/zxgamezx)에 운영 글을 올린다. 매일 [오늘의 로봇 뉴스] — 최근 로봇 기사를 원문까지 열어 검증하고, 카페 공식 말투로 요약하고, 말투·출처·원문 복사 검사를 거쳐, 로그인된 robot-cafe 브라우저로 로봇 뉴스 게시판에 등록하고, 비로그인 화면 확인과 기록까지 한다. 사용자가 '로봇 뉴스 올려줘', '오늘의 로봇 뉴스', '로봇천국 글 올려', '로봇카페 콘텐츠', '로봇 카페 자동 글' 등을 요청하거나 매일 아침 Paseo 일정이 실행할 때 쓴다. 카페 설정·게시판 구조 변경, 다른 카페 활동(bredy-cafe-activity)에는 쓰지 않는다.
---

# 로봇천국 콘텐츠

운영 규칙은 `~/Desktop/pro/robot-cafe/docs/prd/robot-cafe-ops-policy.md`(RC-OPS-001)가 기준이다. 이 스킬은 그중 P-6(콘텐츠 운영)·P-7(말투)·P-8(저작권)을 실행한다.

- 데이터 폴더 `$RC_HOME` = `~/Desktop/pro/robot-cafe` — 브라우저 프로필(`.chrome-profile`), 날짜별 기록(`content/<YYYY-MM-DD>/`), PRD
- 계정은 본계정 ytw418(카페 별명 kingdom). 본계정이 카페 5개를 운영하므로 **하루 최대 3개, 글 사이 2시간 이상**을 반드시 지킨다.
- 스크립트는 이 스킬의 `scripts/`에 있다. 아래 `S=<이 스킬 폴더>/scripts`.

## 매일 뉴스 순서

```bash
S=~/.claude/skills/robot-cafe-content/scripts; D=~/Desktop/pro/robot-cafe/content/$(date +%F); mkdir -p $D
```

1. **한도 확인** — `python3 $S/history.py today`. 종료 코드 1이면(오늘 뉴스가 이미 있거나 한도) 아무것도 올리지 않고 그 사실만 보고하고 끝낸다.
2. **브라우저** — `$S/ensure-browser.sh`. 저장된 비밀번호로 자동 로그인한다. 종료 코드 2(캡차·2단계 인증·로그인 실패)면 멈추고 "사람이 로그인해야 한다"고 보고한다. 다른 세션(bredy-sns·bredy-mine·bredy-post)은 쓰지 않는다.
3. **이미 쓴 기사** — `python3 $S/history.py used`로 30일 안에 쓴 주소를 모으고, 어제 폴더의 `candidates.md`(예비 소식)를 읽는다.
4. **조사** — `Agent(subagent_type: general-purpose, model: sonnet)`에 [references/research-prompt.md](references/research-prompt.md)의 요청문을 날짜·이미 쓴 주소·예비 소식으로 채워 맡기고 결과를 기다린다. 받은 JSON 중 쓸 것과 예비를 모두 `$D/sources.json`에 저장하고, 쓰지 않은 검증 소식은 `$D/candidates.md`에 남긴다.
5. **작성** — [references/style.md](references/style.md)의 말투·구조·예시대로 `$D/news-title.txt`, `$D/news-body.txt`를 쓴다. 소식은 3~5건, 국내 1건 이상, 분야를 섞는다.
6. **검사** — `python3 $S/lint.py $D/news-title.txt $D/news-body.txt --sources $D/sources.json --fetch`가 '통과'할 때까지 고친다. 숫자·고유명사는 sources.json의 사실과 한 번 더 대조한다.
7. **등록** — `$S/post.sh "로봇 뉴스" $D/news-title.txt $D/news-body.txt` (2~3분 걸림 → Bash `run_in_background`로 돌리고 끝나기를 기다린다). 출력의 `ARTICLE_ID`·`URL`을 받는다. 종료 코드 3(본문 불일치)·4(게시판·화면 문제)·5(등록 확인 실패)면 다시 시도하지 말고 보고한다 — 5는 글이 올라갔을 수도 있으니 카페에서 먼저 확인한다.
8. **비로그인 확인** — `node $S/anon-check.mjs <ARTICLE_ID> "오늘의 로봇 뉴스"`
9. **기록** — `python3 $S/log.py "로봇 뉴스(메뉴 17)" $D/news-title.txt <URL> $D/sources.json $D/news-body.txt "<검사 결과 한 줄>"`
10. **보고** — 한국어로 짧게: 제목, 글 주소, 소식 목록(매체·날짜), 조심해서 쓴 표현(회사 주장·예정·심사 전 등), 실패했다면 어느 단계에서 왜.

## 지키는 것

- **말투는 카페 공식 존댓말**이다(사용자 결정 2026-10-18). 반말·음슴체·'ㅋㅋ'·인스타/스레드 말투 금지. 자세한 기준은 references/style.md.
- **사실**: 기사 원문을 열어 확인한 것만 쓴다. 회사 발표 수치는 "회사 측은 ~라고 밝혔다", 계획은 "~할 예정이라고 한다". 제목 숫자보다 본문 숫자를 쓴다. 일반인 실명은 쓰지 않는다. 자극적인 소재(사고 영상, 성추행 논란 등)는 고르지 않는다.
- **저작권**: 기사 문장을 옮기지 않고 직접 요약한다(원문과 20자 이상 같으면 lint가 막는다). 기사 사진을 올리지 않는다 — 링크 미리보기 카드만 쓴다. 소식마다 `출처: 매체명 링크` 한 줄.
- **에디터**: 본문은 `typebody.sh`로만 넣는다(한 줄씩, 링크 줄 뒤 3초). 줄 앞에 `1. `·`①`을 쓰지 않는다(자동 목록이 켜져 글이 섞인다).
- 카페 설정·게시판·공지를 바꾸지 않는다. 가짜 회원·가짜 질문·자작 댓글을 만들지 않는다.

## 다른 글 종류

PRD P-6.4 편성(주 2회 분야별 입문 정보, 주 1회 채용 모음, 월 1회 전시회 일정)은 아직 자동 일정이 없다. 사용자가 요청하면 같은 순서(한도 → 브라우저 → 조사 → 작성 → 검사 → 등록 → 확인 → 기록)로 쓰고, 게시판 이름과 제목 형식만 바꾼다. 채용공고 게시판처럼 글양식이 붙은 게시판은 `post.sh`가 아직 지원하지 않으니(본문이 미리 채워짐) 먼저 사용자에게 알린다.
