---
name: bredy-smoke-test
description: bredy_app(Expo 앱)을 안드로이드 에뮬레이터 2대로 10분 안에 스모크 테스트한다. 로그인 → 상품등록(사진 포함) → 양방향 채팅(실시간·읽음)을 돌리고 중간·최종 보고를 표로 낸다. 사용자가 '에뮬레이터에서 간단하게 테스트해봐', '스모크 테스트', '버그 없이 잘 되는지 봐줘', '로그인하고 상품등록하고 채팅', '지금까지 한 거 앱에서 돌려봐' 등을 요청할 때 사용한다. 웹과 대조하는 디자인 검증이나 전체 회귀 테스트에는 쓰지 않는다.
---

# bredy 스모크 테스트

에뮬레이터 A(판매자)·B(구매자)로 로그인 → 상품등록 → 채팅을 확인한다. 시간 예산은 10분(준비 1 · 로그인 2 · 상품 3 · 채팅 3 · 보고 1)이다. 흐름 밖에서 본 이상은 한 줄로 적고 넘어간다. 원인을 파고드는 건 사용자가 요청할 때만 한다.

## 도구

조작은 `scripts/droid.py` 로 한다. 좌표 대신 라벨(텍스트·접근성 설명)로 탭하고, `tap` 은 키보드가 떠 있으면 먼저 내린다. zsh 는 변수 안 공백을 나누지 않으므로 Bash 호출마다 함수를 정의해 쓴다.

```bash
d() { python3 ~/.claude/skills/bredy-smoke-test/scripts/droid.py "$@"; }
d preflight
d -s emulator-5554 ui '상품|채팅'        # 라벨 찾기: C=clickable 'text' | 'desc' [bounds]
d -s emulator-5554 tap '상품 등록'        # 같은 라벨이 여럿이면 --nth N, 부분 일치는 --re
d -s emulator-5554 wait '판매중'
d -s emulator-5554 shot s01               # /tmp/smoke/s01_s.png (1/3 축소, 좌표×3 = 원본)
```

스크린샷은 이미지라 비싸다. 확인은 `ui`/`wait` 로 하고, 스크린샷은 결과 화면(로그인 후, 등록 결과, 채팅 양쪽)만 찍어 Read 로 본다.

## 0. 준비

1. `d preflight` 로 에뮬레이터(AVD·앞 화면·앱 설치), Metro(포트·dev-client·cwd), bredy_app HEAD, API 대상을 한 번에 본다.
   - API 가 dev 가 아니라는 경고가 나오면 **멈추고 묻는다**. 테스트 상품·메시지가 운영에 쌓인다.
   - Metro 는 bredy_app 원본 체크아웃(`~/Desktop/pro/bredy_app`, master)에서 `--dev-client` 로 뜬 것을 쓴다. 없으면 거기서 `npx expo start --dev-client --port 8081` 을 백그라운드로 띄운다.
2. `ListAgents` 로 바쁜 세션이 쓰는 에뮬레이터를 피하고, 쓸 기기를 `SendMessage` 로 알린다. 2대가 안 되면 A 한 대에서 계정을 바꿔 가며 채팅을 확인한다.
3. 앱이 그 Metro 에 붙어 앞 화면에 떠 있으면 그대로 쓴다(Fast Refresh 로 이미 최신이다). 꺼져 있으면 `d -s <기기> launch` 를 쓴다. dev 콜드 스타트는 번들과 폰트(7.7MB)를 Metro 에서 받느라 첫 화면까지 1분 넘게 걸리기도 하니 백그라운드로 돌리고 기다린다.
4. 시작 시각(`date +%H:%M`)을 적고, 테스트 데이터 이름에 HHMM 을 붙인다.

## 1. 로그인 (A)

1. `tap '마이페이지'` → `tap '로그아웃'` → 확인 창 `tap '로그아웃'` → 비로그인 홈(알림 뱃지 없음)을 확인한다.
2. `tap '마이페이지'` → 로그인 화면 `테스트 계정` 목록에서 판매자 계정(예: `인증브리더Demo`)을 탭한다 → 마이페이지에 그 이름이 보이면 통과.
3. B 는 A 와 **다른 계정**이어야 한다(예: `파트너브리더De`). 비로그인이거나 같은 계정이면 같은 방법으로 바꾼다.

## 2. 상품등록 (A)

`tap '홈'` → `tap '상품 등록'`(FAB) 후 차례로 입력한다.

| 항목 | 명령 |
|---|---|
| 사진 | `tap '사진 추가'` → `tap --re '^Photo taken'`(시스템 선택기 첫 사진) → `tap --re '^Add'` |
| 상품명 | `tap '상품명'` → `type 'Smoke test HHMM'` |
| 카테고리 | `tap '파충류'` → `tap '레오파드 게코'` |
| 타입·가격 | `tap '생물'` → `tap '가격을 입력해주세요'` → `type 15000` |
| 설명 | `tap --re '^사육 정보'` → `type 'Smoke test product. Please ignore.'` |
| 등록 | `tap '상품 등록하기'` → `wait '판매중'` → 상세에 제목·`15,000원` 이 보이면 통과(토스트 "상품이 등록되었습니다."는 금방 사라진다) |

갤러리가 비어 있으면 PNG 를 `adb push <파일> /sdcard/Pictures/` 한 뒤 `adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/<파일>` 로 등록한다.

**중간 보고**: 여기서 사용자에게 표(로그아웃·로그인·상품등록 결과 + 경과 시간)를 내고, 답을 기다리지 말고 계속한다.

## 3. 채팅 (B → A → B)

1. B: `tap '검색'` → `type '<상품명>'` → `key ENTER` → `tap --re '^<상품명>, '`(결과 행) → `tap '채팅하기'` → `tap '메시지 입력'` → `type 'Smoke chat HHMM'` → `tap '메시지 전송'` → `ui 'Smoke chat|메시지 입력'` 으로 말풍선이 생기고 입력창이 `메시지 보내기` 로 비었는지 본다.
2. A: `key BACK`(등록 후 상세는 replace 로 열려 홈으로 간다) → `tap --re '채팅$'`(뱃지가 있으면 설명이 `3, 채팅`) → `ui 'Smoke chat'` 으로 목록 행에 `방금 전`·안 읽은 수가 있는지 본다 → `tap --re 'Smoke chat'` → `tap '메시지 입력'` → `type 'Smoke reply HHMM'` → `tap '메시지 전송'`.
3. B(손대지 않음): `wait 'Smoke reply HHMM' --timeout 10` 으로 실시간 수신을 확인하고, `ui '읽음'` 으로 B 메시지에 읽음 표시가 붙었는지 본다.

## 4. 최종 보고·정리

- 맨 위에 한 줄 결론과 기준(bredy_app HEAD, API 대상, 시작~끝 시각)을 쓴다.
- 표는 단계 | 확인한 것 | 결과(✅/❌, 실패면 스크린샷 경로와 화면 문구)로 쓴다.
- `d -s <A> logs`, `d -s <B> logs` 에 ReactNativeJS 경고·에러가 있으면 보고에 넣는다. 네이티브 `ReactNoCrashSoftException`, `Unable to display loading message` 는 dev client 시작 때 나오는 잡음이다.
- 바뀐 상태를 적는다: 기기별 로그인 계정, dev 서버에 남은 테스트 상품·메시지. 상품 삭제는 묻고 한다(A 상품 상세 → `scroll down` → `삭제하기`).

## 버그 아님 (2026-10-02 확인)

- 채팅하기는 상품별 새 방이 아니라 두 사람의 기존 1:1 방을 연다(`POST /api/chat` 이 기존 방을 돌려준다). 방 위쪽에 상품 맥락 바가 없는 것도 서버가 상품 데이터를 안 줘서다(채팅 PRD E-6).
- 상품 조회수는 늘 0이다. breeder_web 에 `viewCount` 를 올리는 코드가 없다.

## 함정

- 칩을 눌러도 키보드가 안 내려가서, 키보드 위를 탭하면 Gboard 번역 팝업 등이 뜬다. `tap` 은 자동으로 내리고, 직접 `adb shell input tap` 을 쓸 땐 먼저 `hidekb` 한다.
- `adb input text` 는 한글을 못 친다. 상품명·메시지는 영문으로 쓴다(`type` 이 막아 준다).
- 검색 화면은 입력창 텍스트도 상품명이라 `tap '<상품명>'` 이 입력창을 누른다. 결과 행은 `--re '^<상품명>, '` 로 누른다.
- 화면 밖 요소는 bounds 가 뒤집혀 `tap` 이 못 찾는다. `scroll down` 후 다시 한다.
- 홈 카드 등 접근성 설명에 한글 줄바꿈용 U+2060 이 섞여 있다. 정규식은 영문·숫자 조각으로 건다.
- 테스트 계정 목록은 운영 빌드가 아닐 때만 보인다(`EXPO_PUBLIC_ENABLE_TEST_LOGIN`·런타임 env).
