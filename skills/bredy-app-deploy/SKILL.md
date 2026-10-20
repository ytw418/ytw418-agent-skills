---
name: bredy-app-deploy
description: 브리디 앱(bredy_app, Expo)을 운영에 내보낸다. JS 만 바뀌었으면 코드푸시(EAS Update)로 바로 내고, 네이티브가 바뀌었으면 Android·iOS 스토어 빌드(EAS 클라우드, Android 한도 소진 시 로컬 빌드)를 만들어 Play 프로덕션·App Store 심사까지 제출한다. 사전 검사, 웹 선배포 확인, 버전·출시 노트, 런타임 기록, 태그까지 한다. 사용자가 '앱 배포해줘', '브리디 앱 배포', '다음 버전 빌드해서 업데이트', '스토어 올려줘', '플레이스토어 올려줘', '앱스토어 제출', 'iOS 배포', '코드푸시', 'OTA 업데이트', '앱 수정 바로 반영' 등을 요청할 때 사용한다. 웹(breeder_web) 배포는 breeder-web-deploy 스킬, 스토어 스크린샷 디자인은 bredy_app docs/store-screenshots.md 를 따른다.
---

# 브리디 앱 배포 (코드푸시 · Android · iOS)

- 레포: `/Users/yoonseongjun/Desktop/pro/bredy_app`, 브랜치 `master`(여러 세션이 같이 쓴다 — 내 변경만 커밋).
- 2026-10-16 Play 프로덕션, 10-20 App Store 출시 뒤의 절차다. 상세 배경은 앱 `docs/ota-update.md`.
- 스크립트는 모두 앱 저장소 `scripts/` 에 있다.

| 할 일 | 스크립트 |
|---|---|
| 코드푸시 확인·올리기 | `npm run ota:check` / `npm run ota:update -- --message "…"` |
| Android 로컬 빌드(EAS 한도 소진 시) | `scripts/android-local-build.sh [출력.aab]` |
| Play 트랙 출시·출시 노트 | `node scripts/play-track-release.mjs status \| release --track production --version-code N --notes-file f` |
| Play 등록정보(스크린샷·제목·그래픽) | `node scripts/play-listing-screenshots.mjs upload [--dir d] [--title t] [--feature-graphic f]` |
| App Store 스크린샷 | `node scripts/asc-screenshots.mjs status \| upload --version V --dir d` |
| App Store 빌드 연결·심사 제출 | `node scripts/asc-submit.mjs status \| submit --version V --build N [--dry-run]` |
| 스토어 빌드 런타임 기록 | `scripts/store-runtimes.json` |

## 1. 사전 조건

```bash
cd /Users/yoonseongjun/Desktop/pro/bredy_app   # 워크트리면 node_modules 를 cp -cR 로 클론(메모 bredy-worktree-metro)
npx -y eas-cli whoami                           # ytw418. 안 돼 있으면 멈추고 `eas login` 요청
git fetch -q origin --tags && git status -sb
```

- EAS·코드푸시 모두 **작업 트리 그대로** 올린다. 미커밋 변경이 있으면 어떤 파일인지 보여 주고 묻는다.
- 올릴 커밋이 `origin/master` 에 있어야 한다(뒤처졌으면 `git pull --ff-only`, 앞서 있으면 푸시할지 묻기).

## 2. 웹 선배포 확인

운영 앱은 `https://bredy.app`(breeder_web main)을 부른다.

```bash
git -C /Users/yoonseongjun/Desktop/pro/breeder_web fetch -q origin
git -C /Users/yoonseongjun/Desktop/pro/breeder_web log --oneline origin/main..origin/dev
```

출력이 있고 앱 변경이 그 API 에 기대면 웹을 먼저 배포할지(breeder-web-deploy) 묻는다. 답 전에는 내보내지 않는다.

## 3. 사전 검사

```bash
npm run typecheck && npm run lint && npm run check:colors
```

실패하면 멈추고 요약해 보고한다. lint 경고는 막지 않는다. `store:check:release` 의 pending(심사 연락처 env)은 ASC 에 이미 있어 무시한다.

## 4. 코드푸시로 될지 판단

```bash
npm run ota:check
```

- 두 플랫폼 모두 "같음" → **코드푸시로 낸다(5절).** 스토어 빌드는 하지 않는다.
- "다름" → 네이티브·`app.json`·`package.json` scripts 등이 바뀌었다. **스토어 빌드(6절~)** 로 간다.
- 한쪽만 같으면 그쪽은 코드푸시, 다른 쪽은 스토어 빌드로 나눌 수 있다(`--platform`).

## 5. 코드푸시

```bash
npm run ota:update -- --message "<무엇을 고쳤는지>" [--platform android|ios]
git tag -a ota-$(date +%Y%m%d)-<짧은설명> HEAD -m "<message>" && git push origin --tags
```

- `eas update` 를 직접 부르지 않는다 — 빌드 프로필 env(API 주소·광고 ID·PostHog 키)가 빠진 번들이 운영에 깔린다.
- 사용자에게는 앱을 다음에 켤 때(또는 10분 넘게 비웠다 돌아올 때) 적용된다.
- 되돌리기: `npx eas-cli update:rollback`(docs/ota-update.md).
- 보고: 올린 업데이트 그룹 ID·커밋·메시지, 적용 시점 안내.

## 6. 버전·출시 노트

- 스토어 버전: `app.json` `expo.version` 과 `store.config.json` `apple.version` 을 같은 값으로 올린다(예 1.1.0 → 1.2.0, 수정만이면 1.1.1). 빌드 번호는 EAS 원격(`autoIncrement`)이 올린다.
- 변경 내역: 지난 태그(`android-v*`, `ios-v*`) 이후 `git log --oneline <태그>..HEAD --no-merges`. docs·마케팅·리팩터링은 빼고 사용자가 체감하는 것만 3~6줄.
  - iOS: `store.config.json` `apple.info.ko.releaseNotes`. `apple.copyright` 가 있어야 한다(없으면 심사 제출이 409).
  - Android: `<ko-KR>…</ko-KR>` 파일(500자). 플랫폼마다 지난 빌드가 다르면 노트도 따로 쓴다.
- 커밋(트레일러 `Parity: app-only — 스토어 버전`) 후 푸시.

## 7. 빌드

EAS 무료 플랜은 월 30회 중 **Android 15회**다. 먼저 남은 횟수를 본다.

```bash
npx -y eas-cli@latest account:usage ytw418 --non-interactive --json   # builds.byPlatformAndSize
```

- iOS(클라우드):
  ```bash
  npx -y eas-cli build --platform ios --profile production --non-interactive --no-wait --json
  ```
- Android, 한도가 남았으면 클라우드(`--platform android`, 위와 같음). **다 썼으면 로컬:**
  ```bash
  scripts/android-local-build.sh /tmp/bredy-android.aab   # 약 15~20분, JDK17·힙 6GB, 끝나면 versionCode·런타임 출력
  ```
  로컬 빌드는 반드시 이 스크립트로 한다. 그냥 `eas build --local` 을 쓰면 빌드 안에 다른 런타임이 박혀 코드푸시가 닿지 않는다(10-20 vc27). 확인: `unzip -p <aab> base/assets/fingerprint` 가 `ota:check` 의 값과 같아야 한다.
- 클라우드 빌드 대기는 백그라운드 until 루프로(포그라운드 sleep 금지):
  ```bash
  until s=$(npx -y eas-cli build:view <id> --json | python3 -c "import json,sys;print(json.load(sys.stdin)['status'])"); [ "$s" != "NEW" ] && [ "$s" != "IN_QUEUE" ] && [ "$s" != "IN_PROGRESS" ]; do sleep 30; done; echo $s
  ```
  `ERRORED` 면 `build:view` 의 error·로그 URL 을 요약해 보고하고 멈춘다. 무작정 재시도하지 않는다.

## 8. 제출 — Android

```bash
npx -y eas-cli submit --platform android --profile production --id <buildId> --non-interactive --wait   # 클라우드 빌드
npx -y eas-cli submit --platform android --profile production --path /tmp/bredy-android.aab --non-interactive --wait   # 로컬 빌드
node scripts/play-track-release.mjs release --track production --version-code <N> --notes-file <notes> --dry-run
node scripts/play-track-release.mjs release --track production --version-code <N> --notes-file <notes>   # 커밋 = 검토 요청
```

- submit 은 internal 트랙에 넣는다. 프로덕션은 위 스크립트로 넣는다(대한민국, 전체 출시). 승인 여부는 API 에 없다 — 콘솔 '게시 개요'.

## 9. 제출 — iOS

```bash
# (1) 업로드: eas.json submit.production.ios 에 ascApiKeyPath·ascApiKeyIssuerId·ascApiKeyId 를 잠시 넣고(값은 ~/.appstoreconnect/eas.env) 제출 뒤 git checkout eas.json
npx -y eas-cli submit --platform ios --profile production --id <buildId> --non-interactive --wait
# (2) 버전·제목·출시 노트·copyright: ASC 키 env 로 metadata push(새 버전을 만든다)
source ~/.appstoreconnect/eas.env && export EXPO_ASC_API_KEY_PATH=$(eval echo $EXPO_ASC_API_KEY_PATH)
npx -y eas-cli metadata:push --profile production --non-interactive < /dev/null
# (3) 스크린샷: 새 버전은 이전 버전 스크린샷을 그대로 가져온다. 바꿀 때만
node scripts/asc-screenshots.mjs upload --version <V> --dir store-assets/screenshots/ios
# (4) 빌드 처리(VALID) 대기 → 연결 → 심사 제출
node scripts/asc-submit.mjs submit --version <V> --build <N> --dry-run
node scripts/asc-submit.mjs submit --version <V> --build <N>
```

- 출시 방식은 `AFTER_APPROVAL`(승인되면 자동 출시)이다.
- 심사 대기 중인 제출을 바꾸려면 메모 `ios-asc-submit` 의 취소 → 교체 → 재제출 순서.

## 10. 기록·태그

```bash
# 스토어에 낸 빌드의 런타임(코드푸시 기준)을 기록한다 — 로컬 빌드는 EAS 목록에 없어 이 파일이 유일한 기록이다
#   scripts/store-runtimes.json 의 android/ios 를 { appVersion, appBuildVersion, runtimeVersion, note } 로 갱신
npm run ota:check    # 두 플랫폼 "같음" 이어야 한다
git commit -m "chore(release): 스토어 빌드 런타임 기록 <V>(android N·ios M)" && git push
git tag -a android-v<V>-<N> <빌드한 커밋> -m "<노트>" && git tag -a ios-v<V>-<M> <빌드한 커밋> -m "<노트>"
git push origin android-v<V>-<N> ios-v<V>-<M>
```

빌드한 커밋은 클라우드면 `build:view` 의 `gitCommitHash`, 로컬이면 빌드할 때 HEAD.

## 11. 보고(한국어)

- 버전·빌드 번호, 빌드한 커밋, 빌드 방식(클라우드/로컬), EAS 빌드 링크
- 제출 결과: Play 프로덕션 검토 요청 / App Store `WAITING_FOR_REVIEW`
- 출시 노트 원문, 코드푸시 기준 런타임이 맞는지(`ota:check` 결과)
- 화면 변화가 있는 배포면 바뀐 화면 캡처(앱 AGENTS.md 'PR·완료 보고 스크린샷'), 없으면 그 이유
- 건너뛴 단계·경고는 그대로 적는다.

## 함정

- R8 이 Gradle 기본 힙(2GB)에서 OutOfMemoryError → 로컬 빌드 스크립트가 `~/.gradle/gradle.properties` 를 빌드 동안만 6GB 로 둔다(파일이 이미 있으면 손대지 않으니 직접 확인).
- 로컬 빌드 로그에 서명 키가 base64 로 찍힌다 — 공유·커밋하지 말고 지운다(스크립트가 지움).
- 에뮬레이터 확인용 APK: `bundletool build-apks --mode=universal --ks=<디버그 키>` 로 AAB 에서 만든다. `bredy_pixel` 은 /data 가 거의 차 있어 `bredy_qa` 가 낫다.
- 스토어 스크린샷·제목은 사용자 결정이 있다(곤충 큰 사진 금지, 제목 '브리디 - 생물인을 위한 SNS 동네 친구 찾기'). 바꾸기 전에 묻는다.
