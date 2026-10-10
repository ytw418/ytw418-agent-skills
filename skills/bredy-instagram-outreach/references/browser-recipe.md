# 인스타 웹을 Paseo 브라우저로 다루는 법 (2026-10-10 실제 20명 발송으로 검증)

도구: `mcp__paseo__browser_*` (ToolSearch 로 `select:` 해서 불러온다).

## 먼저 확인

1. `browser_list_tabs` — instagram.com 탭이 있으면 그 `browserId` 를 쓴다. 없으면 `browser_new_tab https://www.instagram.com/direct/inbox/`(같은 Paseo 브라우저라 로그인이 이어진다).
2. 로그인 계정: `browser_wait text="bredy_breeder" timeoutMs=10000`. 로그인 화면(`/accounts/login`)이거나 다른 계정이면 **아무것도 보내지 않고** 사용자에게 로그인·전환을 부탁한다. 비밀번호·토큰은 받지 않는다. 계정 전환: 왼쪽 아래 '더 보기' → '계정 전환'.
3. Paseo 브라우저 패널이 가려져 있어도 된다. 스크린샷은 `screenshot_no_frame`으로 실패하지만 아래 방법으로는 보내진다. 화면 확인은 스크린샷 대신 `browser_snapshot`·`browser_wait` 로 한다.

## 새 사람에게 보내기 (검증된 순서)

1. `browser_navigate https://ig.me/m/<handle>` → `browser_wait text="<handle> · Instagram" timeoutMs=7000`.
   - 시간 초과면 ig.me 가 `/m/<handle>`(페이지 없음)로 간 것이다 → 프로필로 간다: `browser_navigate https://www.instagram.com/<handle>/` → `browser_snapshot` → `button "메시지 보내기"` 클릭 → 오른쪽 아래 작은 채팅창이 뜬다.
   - 프로필이 '페이지를 사용할 수 없습니다'면 `mark <handle> 제외 "계정 없음"`.
2. `browser_wait text="zzzz" timeoutMs=1500`(잠깐 기다림) → `browser_snapshot`.
   - **이전 대화 확인**: 대화방 영역에 `article`(말풍선)이나 날짜(`2026. 2. 18. 오전 1:48` 같은 것)가 있으면 내용을 본다. 우리가 보낸 영업 메시지가 이미 있으면 보내지 않고 `mark <handle> 제외 "기존 대화"`. 상대가 우리를 스토리에서 언급한 정도는 보내도 된다.
   - **입력창 ref**: 대화방 아래쪽의 이름 없는 `textbox [ref=@eNN]`(바깥쪽 것). 보통 @e39~@e41, 프로필 채팅창은 @e87 근처.
   - 입력창 이름(aria)에 이미 글이 들어 있으면 이전 시도 잔여물이다 → 아래 3에서 첫 줄을 넣기 전에 `browser_keypress Meta+a` → `Backspace`.
3. **첫 줄만 `browser_type ref=<입력창>` 으로 넣는다.** ref 를 주면 그 자리를 눌러 포커스가 잡혀서, 패널이 가려져 있어도 Enter 전송이 된다. 첫 줄을 넣으면 입력창이 다시 그려져 ref 가 바뀌므로 **나머지는 ref 없이** 넣는다.
4. 나머지 줄: `browser_keypress Shift+Enter` → `browser_type`(ref 없이) 반복 → 마지막에 `browser_keypress Enter`.
5. **전송 확인**: `browser_wait text=": <첫 줄 앞부분>" timeoutMs=8000` — 왼쪽 대화 목록에 `회원님: <첫 줄>` 이 생기면 보내진 것이다. 프로필 채팅창으로 보냈으면 `https://www.instagram.com/direct/inbox/` 로 가서 같은 글을 기다린다.
   - 실패하면 `browser_snapshot` 으로 입력창에 글이 남았는지 본다. 남았으면 `button "보내기"` ref 를 한 번만 클릭한다. **확인 없이 다시 타이핑하지 않는다(중복 전송 방지).**
6. `node $OUT mark <handle> 보냄 "<문구 종류>"`.

## 답장 처리

- DM함 목록에서 `Unread` 가 붙은 항목만 연다(열면 읽음 처리된다). 항목 이름의 마지막 메시지가 `회원님: …`이면 우리가 마지막으로 말한 것이니 열지 않는다.
- 연 뒤 `browser_snapshot` 으로 대화 전체를 읽고 templates.md 답장 표대로 처리. 보내는 방법은 위 3~5 와 같다.
- 사용자가 손으로 대화 중인 사람(최근 우리 쪽 메시지가 템플릿이 아닌 짧은 대화체, 예: "와우 굿즈나오셨나요", "넵 ㅎㅎ")은 열지도 답하지도 않는다.

## 목록 모으기

- 팔로워: 프로필 → `link "팔로워 N"` 클릭(직접 URL `/followers/` 로는 창이 안 뜬다) → ref 없이 `browser_scroll deltaY=5000` 을 2.5초 간격으로 여러 번 → 스냅샷 한 번(1500 노드에서 잘리므로 50명쯤씩).
- 홈 추천: 홈 피드의 '회원님을 위한 추천' 옆 '팔로우'. 곤충·물고기·파충류 계정만, 실행당 5명 이하.
- 해시태그: `https://www.instagram.com/explore/tags/<태그>/`.

## 하지 말 것

- `browser_evaluate` — 인스타 CSP 가 막는다.
- 스냅샷 남발 — DM 화면 스냅샷은 6~10k 글자다. 사람마다 1번(대화방 열었을 때)만 찍고, 나머지 확인은 `browser_wait`.
- 탭 여러 개로 동시에 보내기 — 짧은 시간에 몰리면 공식 계정이 막힐 수 있다. 탭 하나로 차례대로.
- 차단을 피하려는 위장(일부러 넣는 무작위 지연, 다계정, 탐지 우회 도구).
- 화면에 '나중에 다시 시도하세요', '활동이 제한됨', '메시지를 보낼 수 없습니다'가 보이면 그날은 더 보내지 않고 알린다.
