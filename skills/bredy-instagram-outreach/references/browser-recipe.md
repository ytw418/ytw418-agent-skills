# 인스타 웹을 Paseo 브라우저로 다루는 법 (2026-10-10 실제로 겪은 것)

도구: `mcp__paseo__browser_*` (ToolSearch 로 `select:` 해서 불러온다).

## 먼저 확인

1. `browser_list_tabs` — instagram.com 탭이 있으면 그 `browserId` 를 쓴다. 없으면 `browser_new_tab https://www.instagram.com/`.
2. `browser_screenshot` 이 `screenshot_no_frame`("not painted")이면 **Paseo 앱에서 브라우저 패널이 화면에 안 보이는 상태**다. 이때는 입력은 되지만 클릭·전송이 15초 타임아웃으로 실패한다. 보내지 말고 멈춰서 "Paseo 브라우저 패널을 채팅 옆에 펼쳐 두세요"라고 알린다.
3. 로그인 계정 확인: `https://www.instagram.com/direct/inbox/` 를 열고 `browser_wait text="bredy_breeder"`. 로그인 화면(`/accounts/login`)이면 멈추고 사용자에게 로그인을 부탁한다. **비밀번호·토큰을 받지 않는다.**
4. 다른 계정(예: 사용자 개인 계정)이면 보내지 않는다. 전환은 왼쪽 아래 '더 보기' → '계정 전환'. 브라우저에 저장 안 된 계정은 로그인 창이 뜨므로 사용자에게 넘긴다.

## 새 사람에게 보내기 (검증된 순서)

1. `browser_navigate https://ig.me/m/<handle>` → `/direct/t/<id>` 로 넘어간다.
2. `browser_list_tabs` 로 넘어간 URL 을 읽고 **그 URL(끝에 `/`)로 한 번 더 navigate** 한다. ig.me 로 막 연 대화방은 전송 버튼·Enter 가 먹지 않은 적이 있다.
3. `browser_wait text="<handle> · Instagram"` 으로 대화방이 열렸는지 본다.
4. 이전 대화 확인(스냅샷 없이): `browser_wait text="오후" timeoutMs=2500` 과 `text="오전" timeoutMs=1000`. 둘 다 시간 초과면 빈 대화방 → 보낸다. 하나라도 맞으면 `browser_snapshot` 으로 내용을 보고, 이미 영업 메시지가 있으면 보내지 않고 `mark <handle> 제외 "기존 대화"`.
5. `browser_snapshot` 으로 메시지 입력창(`textbox` 이름 없는 것, 대화방 아래쪽) ref 를 찾아 **먼저 클릭한다.** 클릭 없이 타이핑하면 글은 들어가도 Enter 가 전송되지 않는다.
   - 입력창 aria 이름에 글이 이미 있으면(이전 시도 잔여) 클릭 → `Meta+a` → `Backspace` 로 비운다.
6. 줄마다 `browser_type` → `browser_keypress Shift+Enter`, 마지막 줄 뒤에 `browser_keypress Enter`.
7. 전송 확인: `browser_wait text="회원님: <첫 줄 앞 10자쯤>" timeoutMs=8000`. 실패하면 `"You: <같은 글>"` 로 한 번 더. 그래도 실패하면 스냅샷으로 대화방에 말풍선(`article`)이 생겼는지 보고, 입력창에 글이 남아 있으면 '보내기' 버튼 ref 를 클릭한다. **확인 없이 다시 타이핑하지 않는다(중복 전송 방지).**
8. `node $OUT mark <handle> 보냄`.

## 이미 대화 중인 사람에게 답장

- DM함 목록 항목(`button "닉네임님 … Unread"`)을 클릭해서 연다. 열면 읽음 처리된다.
- 보내는 방법은 위 5~8 과 같다.

## 목록 모으기

- 팔로워: 프로필 → '팔로워 N' 링크 클릭(직접 URL `/followers/` 로는 창이 안 뜬다) → 대화상자 안에서 ref 없이 `browser_scroll deltaY=5000` 을 2.5초 간격으로 여러 번 → 마지막에 스냅샷 한 번. 스냅샷은 1500 노드에서 잘리므로 50명쯤씩 끊어서 저장한다.
- 홈 추천: 홈 피드의 '회원님을 위한 추천' 항목 옆 '팔로우' 버튼. 곤충·물고기·파충류 계정만 팔로우하고 `add` 한다.
- 해시태그: `https://www.instagram.com/explore/tags/<태그>/` (로그인 필요).

## 하지 말 것

- `browser_evaluate` — 인스타 CSP 가 막는다(unsafe-eval).
- 스냅샷 남발 — DM 화면 스냅샷은 6~10k 글자다. 확인은 `browser_wait` 로 한다.
- 차단을 피하려는 위장(무작위 지연을 일부러 넣기, 여러 계정 돌리기, 자동화 탐지 우회 도구)은 쓰지 않는다. 사람이 손으로 보낼 만한 양(하루 20명)만 보낸다.
- 화면에 '나중에 다시 시도하세요', '활동이 제한됨', '메시지를 보낼 수 없습니다' 같은 문구가 보이면 그날은 더 보내지 않고 사용자에게 알린다.
