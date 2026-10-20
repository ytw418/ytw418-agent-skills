# 앱 에뮬레이터 검증 (워크트리 + 로컬 웹)

1. 워크트리 준비: `cp -cR ~/Desktop/pro/bredy_app/node_modules ./node_modules`, `cp ~/Desktop/pro/bredy_app/.env* .`
2. 에뮬레이터: `~/Library/Android/sdk/emulator/emulator -list-avds`. **bredy_pixel 은 /data 가 거의 차서 dev build 설치가 INSUFFICIENT_STORAGE** → `bredy_qa` 를 쓴다. 다른 세션이 쓰고 있으면 먼저 알린다.
3. dev build 가 없거나 낡았으면(에뮬레이터는 **arm64**):
   ```
   export JAVA_HOME=$(/usr/libexec/java_home -v 17) ANDROID_HOME=~/Library/Android/sdk
   npx expo prebuild --platform android --no-install
   cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a   # 처음 15분, 증분 1~2분
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
   x86_64 만 빌드하면 `INSTALL_FAILED_NO_MATCHING_ABIS`. 백그라운드로 돌리고 기다리는 동안 웹 검사를 한다.
4. 로컬 웹(서버 변경 포함): 웹 워크트리에서 `npx next dev -p 3010`(Bash `run_in_background`, timeout 7200000). `.next` 가 꼬여 API 가 HTML 404 를 주면 서버를 내리고 `rm -rf .next` 후 다시 띄운다.
5. Metro: `TMPDIR=/tmp/<기능>-metro-tmp EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3010 npx expo start --dev-client --port 8097 --clear` → `adb reverse tcp:8097 tcp:8097; adb reverse tcp:3010 tcp:3010` → `adb shell am start -a android.intent.action.VIEW -d "exp+bredyapp://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8097"`. 포트는 `lsof -tiTCP:<p> -sTCP:LISTEN` 로 비었는지 먼저 본다.
6. 첫 화면: 개발 메뉴 Continue → 바깥 탭으로 닫기(뒤로 키는 앱을 닫는다) → 관심 분야 온보딩 '건너뛰기' → `bredy://login` → '테스트 계정' 목록에서 계정 탭 → 알림 권유 '나중에'. 화면은 `bredy://chat/<id>` 같은 딥링크로 바로 연다. 떠 있는 개발 도구(톱니) 버튼은 `adb shell input draganddrop 971 247 120 1500 1500` 로 옮긴다.
7. 조작은 `scripts/ui.sh`(dump·tap·shot). **에뮬레이터가 느려 탭이 밀린다** — 단계마다 4초 기다리고, 좌표는 `perl -e 'alarm 40; exec @ARGV' ui.sh dump` 로 확인한다(폴링 화면에서 dump 가 멈출 수 있다). 길게 누르기는 `adb shell input swipe x y x+1 y+1 2000`. 코드 저장(Fast Refresh) 직후엔 화면이 바뀌어 탭이 엉뚱한 곳에 갈 수 있으니 다시 확인한다.
8. 캡처는 `adb exec-out screencap -p > /tmp/<기능>-e2e/app-0N-<화면>.png`, Read 로 직접 본다. 끝나면 Metro·next dev 를 내리고 `adb emu kill`.
