---
name: ios-safari-touch-check
description: iOS 시뮬레이터의 Safari에 Safari WebDriver(safaridriver) 터치 액션으로 실제 WebKit 터치 드래그·탭을 보내, 모바일 웹 터치 버그(끌어도 안 닫힘, 스와이프·탭이 안 먹음, 터치 영역이 작음)를 재현하고 수정 전후를 비교한다. 시도마다 pointer/touch 이벤트의 순서·대상·좌표를 남긴다. 사용자가 'iOS에서 확인해봐', '아이폰 사파리에서 재현해줘', '시뮬레이터로 터치 테스트', '모바일에서 드래그가 안 돼', '스와이프로 안 닫혀', 'iOS Safari 버그 검증', 'QA_모바일뷰 버그 재현' 등을 요청하거나, iPhone에서 보고된 터치·제스처 버그를 고친 뒤 실제 WebKit에서 확인해야 할 때 사용한다. 레이아웃만 보는 확인(Chromium 모바일 에뮬레이션으로 충분)이나 실기기 원격 디버깅에는 쓰지 않는다.
---

# iOS Safari Touch Check

macOS의 iOS 시뮬레이터 + `safaridriver` WebDriver 터치 액션으로 iOS WebKit의 실제 터치 파이프라인(hit-test, `touch-action`, pointer/touch 이벤트)을 돌린다. Playwright WebKit은 터치 드래그를 못 보내고(`touchscreen.tap`만 지원), 합성 JS 이벤트는 hit-test를 건너뛰므로 이 방법을 쓴다.

## 원칙

- **이미 켜진(Booted) 시뮬레이터는 쓰지 않는다.** 다른 세션이 앱 테스트에 쓰는 중일 수 있다. 꺼진 기기를 직접 켜고, 끝나면 그 기기만 끈다.
- **화면 좌표 클릭(cliclick, AppleScript, Simulator 창 마우스 드래그)은 쓰지 않는다.** 손쉬운 사용 권한이 없으면 조용히 무시되고, 다른 시뮬레이터 창에 입력이 갈 수 있다.
- 결과는 "시뮬레이터 + WebDriver 합성 터치" 증거다. 보고에 그렇게 적고 실기기 확인은 따로 남긴다.

## 1. 기기 준비

```bash
xcrun simctl list devices booted                              # 켜진 기기는 건드리지 않는다
xcrun simctl list devices available | grep -E "^-- |iPhone"   # 런타임 헤더(-- iOS x.y --)와 함께 본다
UDID=<원하는 런타임의 (Shutdown) 기기 UDID>                     # 같은 이름이 여러 개일 수 있어 UDID로 고른다
xcrun simctl boot "$UDID" && open -a Simulator
```

- Simulator 앱에 이미 켜진 다른 기기 창도 함께 보일 수 있다. 그 창은 건드리지 않는다.
- 시뮬레이터 Safari의 `localhost`는 Mac을 가리킨다. 로컬 dev 서버·Storybook URL을 그대로 쓴다.

## 2. 페이지 준비

- 로그인 없이 재현되면 Storybook 스토리(`/iframe.html?id=<story-id>&viewMode=story`)가 가장 빠르다.
- 닫힘이나 상태 변화를 보려면 스토리가 실제로 상태를 바꿔야 한다. `onOpenChange={() => undefined}` 같은 고정 스토리는 `useState`로 바꾼다.
- 모노레포 worktree에서 Storybook이 내부 패키지(`@scope/shared/...`)를 못 찾으면 그 패키지를 먼저 빌드한다.

## 3. 실행

```bash
# 처음 한 번만(새 Mac): sudo safaridriver --enable
(safaridriver -p 4447 > /tmp/safaridriver-4447.log 2>&1 &)   # 이미 떠 있으면 생략
curl -s localhost:4447/status                                # "ready":true 확인
node <이 SKILL.md가 있는 폴더>/scripts/ios-touch.mjs --udid "$UDID" \
  --url 'http://localhost:6006/iframe.html?id=<story-id>&viewMode=story' \
  --selector '[data-slot="mobile-bottom-sheet-handle"]' \
  --offsets 0,-6,6,12 --dy 120 --repeat 2 \
  --result "!document.querySelector('[role=dialog]')"
```

- 기본값: `--offsets 0 --dx 0 --dy 120 --move-ms 300 --repeat 1 --wait-ms 1000 --port 4447`. 탭은 `--dy 0`만 주면 된다. 전체 옵션은 스크립트 상단 주석에 있다.
- `--offsets`: 요소 중심에서 시작점을 위아래로 옮긴 값(px). 손가락이 목표를 살짝 벗어난 경우를 같이 본다.
- 시도마다 URL을 새로 로드하므로 페이지 상태가 초기화된다. result는 시도별 값이다.
- `--result`: 액션 뒤 페이지에서 평가할 JS 식(닫힘 여부, 상태 값 등). 출력의 이벤트 순서는 스크립트가 따로 수집한 것이라 페이지 자체 로그와 개수가 다를 수 있다.
- 출력(stdout): 시도마다 시작 좌표, result 값, 이벤트 순서(`type:대상@clientY`). 끝에 result 집계가 나온다. `pointerup@0`은 실패가 아니라 iOS의 알려진 동작이다(아래 참고).
- 첫 시도가 로드 직후 리렌더와 겹칠 수 있다. `--repeat 2` 이상으로 돌리고, 첫 회만 다르면 `--wait-ms`를 늘려 다시 본다.
- 세션 생성이 실패하면 응답 오류와 safaridriver 출력을 그대로 보고한다.

## 4. 수정 전후 비교

"고쳐졌다"고 하려면 같은 명령의 수정 전 결과가 있어야 한다. 커밋 전이면 파일을 잠깐 되돌려 돌린다. `git stash`는 다른 worktree와 공유되므로 쓰지 않는다.

```bash
cp <파일> /tmp/fixed-copy && git show HEAD:<파일> > <파일>   # HMR 반영을 몇 초 기다린 뒤 실행
node .../ios-touch.mjs ...                                  # 수정 전 결과
cp /tmp/fixed-copy <파일> && cmp <파일> /tmp/fixed-copy       # 복원을 반드시 확인
```

## 5. 정리

```bash
pkill -f "safaridriver -p 4447"   # 직접 띄운 경우만
xcrun simctl shutdown "$UDID"     # 직접 켠 기기만
```

## 알려진 iOS WebKit 동작 (iOS 18.6 시뮬레이터에서 관찰)

- 터치 `pointerup`의 `clientX/Y`·`pageY`·`screenY`가 0이다. `pointermove`와 `touchend`의 `changedTouches`는 정상이다. 드래그 거리는 마지막 `pointermove` 위치로 잰다.
- 손가락 아래 자식 요소가 아니라 부모(`currentTarget`)에 `setPointerCapture`를 걸면, 직후 첫 `pointermove`가 캡처 대상이 아니라 손가락 아래 요소로 간 경우가 있었다. 요소 핸들러 대신 `window`에서 같은 `pointerId`를 추적하면 안전하다.
- WebDriver 드래그는 `pointermove`가 1~2번뿐이라 실제 손가락보다 이동 이벤트가 적다. 이동 이벤트 개수에 기대는 로직의 약점이 잘 드러난다.
- 터치 판정 영역(hit target)이 작은 문제는 iOS 전용이 아니다. Chromium에서도 CDP `Input.dispatchTouchEvent`(Playwright `context.newCDPSession(page)`)로 재현해, iOS 전용 원인과 구분한다.

## 보고

- 시나리오(시작 위치·이동량) × 수정 전/후 결과 횟수를 표로 정리한다.
- 증거 출처를 "iOS <버전> 시뮬레이터 Safari + WebDriver 터치"로 밝히고, 실기기에서 확인하지 않았으면 그렇게 적는다.
