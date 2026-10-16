---
name: user-chrome-control
description: 사용자가 로그인해 둔 실제 크롬 창(Play 콘솔·App Store Connect·Gmail·관리자 화면 등)을 터미널에서 읽고 누르고 입력한다. Claude in Chrome 확장 도구(mcp__claude-in-chrome__*)가 이 세션에 없을 때 쓴다. 열린 크롬 인스턴스·창·탭 전부 나열 → 사용자 크롬(PID) 고정 → Scripting Bridge 로 탭 JS 실행(본문 읽기·버튼 클릭·입력·이동)까지 한다. 사용자가 '크롬에서 해줘', '내가 로그인해둔 크롬', '플레이 콘솔에서 바꿔줘', '브라우저에서 처리해', '크롬 컨트롤', '콘솔 들어가서 제출해' 등을 말하거나, 사람 로그인이 필요한 웹 콘솔 작업을 맡길 때 사용한다. 사진 업로드가 필요한 SNS 게시는 Playwright CLI 방식(paseo-browser-file-upload 메모)을 쓴다.
---

# 사용자 크롬 조작 (Scripting Bridge)

## 0. 먼저 볼 것 (순서 지킴)

1. `ToolSearch "claude-in-chrome"` — 확장 도구가 이 세션에 있으면 그걸 쓴다(chrome-browser 스킬). Paseo 등이 띄운 비대화형 세션에는 보통 없다. 이 세션에서 확장을 붙일 수는 없다(`claude --chrome` 로 시작한 세션만 붙는다).
2. 없으면 이 스킬. **열린 크롬을 전부 나열**하고 사용자가 로그인한 창을 고른다:

```bash
S=~/.claude/skills/user-chrome-control/scripts
$S/chrome-list.sh        # pid 별 [USER]/[automation] 와 "창 탭 URL | 제목"
```

- `[USER]` = `--user-data-dir` 없이 뜬 사용자 크롬. Playwright CLI 크롬(bredy-marketing `.chrome-profile*`)은 `[automation]`.
- **함정**: 크롬이 여러 개 떠 있으면 `osascript 'tell application "Google Chrome"'`·JXA `Application("Google Chrome")`·System Events `process "Google Chrome"` 가 **엉뚱한 인스턴스**에 붙는다(2026-10-16 Playwright 창을 사용자 창으로 착각). 항상 PID 로 겨냥한다 — 이 스킬의 `cj` 는 `SBApplication(processIdentifier:)` 를 쓴다.

## 1. 'Apple Events의 자바스크립트 허용' 켜기

`execute javascript` 가 "AppleScript를 통한 자바스크립트 실행 기능이 꺼져 있습니다"로 실패하면, 사용자에게 시키지 말고 System Events 로 그 PID 의 메뉴를 누른다(손쉬운 사용 권한은 있다):

```bash
PID=49863   # chrome-list 의 [USER] pid
osascript -e "tell application \"System Events\" to tell (first process whose unix id is $PID)" \
  -e 'set frontmost to true' -e 'delay 0.5' \
  -e 'click menu item "Apple Events의 자바스크립트 허용" of menu 1 of menu item "개발자 정보" of menu 1 of menu bar item "보기" of menu bar 1' -e 'end tell'
```

토글이라 이미 켜져 있으면 꺼진다. 누르기 전에 `pc text` 로 JS 가 되는지 먼저 확인하고, 안 될 때만 누른다. 상태는 프로필 `Preferences` 의 `"allow_javascript_apple_events":true` 로도 보인다.

## 2. 조작 (`pc`)

```bash
$S/pc tabs                         # 사용자 크롬 탭 목록
$S/pc go "https://play.google.com/console/u/1/..."   # 탭 0:0 이동 (--tab W:T 로 다른 탭)
$S/pc text 8000                    # 본문 innerText 앞 N자
$S/pc click "CSV 파일로 내보내기"    # 보이는 버튼/링크/라디오 중 글자 포함 + 가장 짧은 것 클릭
$S/pc form                         # input/textarea/radio/checkbox 상태(비밀번호는 숨김)
$S/pc js '(() => ...)()'           # 임의 JS (결과 문자열 출력), `pc js -` 는 stdin
```

- 이동 뒤 `sleep 6~8` 후 읽는다(SPA 로딩). 동작마다 `text`/`form` 으로 결과를 확인한다.
- **입력**(Angular/React 폼): `value` 직접 대입은 안 먹는다. 네이티브 setter + 이벤트:
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true}))` (textarea 는 `HTMLTextAreaElement.prototype`).
- **라디오 묶음**: `input[type=radio]` 를 `name` 으로 묶어 질문 순서대로 고른다. 질문이 답에 따라 늘어나면 다시 센다.
- `다음`이 `disabled` 면 `저장`을 먼저 누른다(Play 콘솔 설문).
- `confirm/alert` 를 띄울 버튼(삭제 등)은 피한다 — 대화상자가 뜨면 JS 가 멈춘다.
- 새 탭 만들기는 구현 안 함 → 사용자 탭을 `go` 로 옮긴다(빈 탭·작업 중이 아닌 탭인지 먼저 본다).
- 파일 업로드 칸은 JS 로 못 채운다. 가능하면 API(예: Play `applications.dataSafety` 에 CSV 문자열)로 우회한다.
- 출력에 비밀번호·토큰이 나오면 답변에 옮기지 않는다.

## 3. 예: Play 콘솔

- 개발자 계정 bredy_dev `u/1`, developer 5189747299384110742, 브리디 app 4975164001738366260.
- `…/app/<id>/app-content/overview`(앱 콘텐츠, '조치됨' 탭), `…/app-content/data-privacy-security`(데이터 보안 — CSV 내보내기는 ~/Downloads/data_safety_export.csv), `…/app-content/content-rating-overview`, `…/app-content/testing-credentials`(로그인 세부정보), `…/app-content/ad-id-declaration`, `…/publishing`(게시 개요 — 변경사항 검토 전송).
