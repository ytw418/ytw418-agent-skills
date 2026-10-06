---
name: bredy-app-deploy
description: 브리디 앱(bredy_app, Expo)의 Android 운영 빌드를 EAS 클라우드에서 만들고 Google Play 내부 테스트 트랙에 제출한다. 사전 검사(tsc·lint·색 검사·스토어 준비 검사), 웹 선배포 여부 확인, 변경 내역·출시 노트 작성, 빌드 번호 태그까지 한다. 사용자가 '앱 배포해줘', '브리디 앱 배포', '안드로이드 배포', '플레이스토어 올려줘', '앱 빌드해서 제출', 'eas 빌드 제출' 등을 요청할 때 사용한다. 웹(breeder_web) 배포는 breeder-web-deploy 스킬, iOS·OTA 업데이트에는 쓰지 않는다.
---

# 브리디 앱 배포 (Android, EAS)

- 레포: `/Users/yoonseongjun/Desktop/pro/bredy_app`, 브랜치 `master`
- 빌드: `eas build --platform android --profile production` (EAS 클라우드). `versionCode` 는 EAS 원격(`appVersionSource: remote`, `autoIncrement`)이 올린다. `app.json` 은 건드리지 않는다.
- 제출: `eas submit --profile production` → Play **internal** 트랙(`eas.json`). 운영 트랙 승격은 사용자가 Play 콘솔에서 직접 한다.
- iOS 는 하지 않는다.

## 1. 사전 조건

```bash
cd /Users/yoonseongjun/Desktop/pro/bredy_app
npx -y eas-cli whoami          # 로그인 안 돼 있으면 멈추고 `eas login` 을 요청
git fetch -q origin --tags
git status -sb
```

- EAS 는 커밋 여부와 상관없이 **작업 트리 그대로** 올린다. 여러 세션이 master 를 같이 쓰므로 미커밋 변경이 있으면 빌드하지 않고, 어떤 파일이 걸려 있는지 보여 준 뒤 사용자에게 묻는다(커밋할지, 다른 세션 작업인지).
- `master` 가 `origin/master` 보다 뒤에 있으면 `git pull --ff-only`, 앞서 있으면 먼저 푸시할지 묻는다. 빌드할 커밋이 origin 에 있어야 태그·변경 내역이 맞는다.

## 2. 웹 선배포 확인

앱 운영 빌드는 `https://bredy.app`(breeder_web main)을 쓴다. 앱이 새 API 에 기대는데 웹이 아직 dev 에만 있으면 운영 앱이 깨진다.

```bash
git -C /Users/yoonseongjun/Desktop/pro/breeder_web fetch -q origin
git -C /Users/yoonseongjun/Desktop/pro/breeder_web log --oneline origin/main..origin/dev
```

출력이 있으면 목록을 보여 주고 "웹을 먼저 배포할지(breeder-web-deploy)" 묻는다. 답을 받기 전에는 빌드하지 않는다.

## 3. 사전 검사

```bash
npm run typecheck && npm run lint && npm run check:colors && npm run store:check:release
```

하나라도 실패하면 빌드하지 않고 실패 내용을 요약해 보고한다. lint 경고(warn)는 막지 않는다.

## 4. 변경 내역

지난 배포 태그(`android-v*`) 이후 커밋을 모은다.

```bash
LAST=$(git tag -l 'android-v*' --sort=-creatordate | head -1)
git log --oneline ${LAST:+$LAST..}HEAD --no-merges
```

- 태그가 없으면 최근 30개만 보고 "첫 태그 배포"라고 적는다.
- 사용자가 체감하는 변화만 골라 한국어 **출시 노트**를 쓴다(Play 제한 500자, `<ko-KR>` 한 블록). docs·마케팅·리팩터링 커밋은 빼고 기능·수정 단위로 3~6줄.

## 5. 빌드

```bash
npx -y eas-cli build --platform android --profile production --non-interactive --no-wait --json
```

- 출력의 build `id` 를 잡아 둔다. 빌드는 15~25분 걸린다. 상태는 백그라운드 명령으로 기다린다(포그라운드 sleep 금지):

```bash
until s=$(npx -y eas-cli build:view <id> --json | python3 -c "import json,sys;print(json.load(sys.stdin)['status'])"); [ "$s" != "NEW" ] && [ "$s" != "IN_QUEUE" ] && [ "$s" != "IN_PROGRESS" ]; do sleep 30; done; echo $s
```

- `ERRORED` 면 제출하지 않는다. `npx -y eas-cli build:view <id> --json` 의 `error`, 로그 URL 을 보고 원인을 요약해 보고한다. 같은 빌드를 무작정 재시도하지 않는다.
- `FINISHED` 면 `appVersion`, `appBuildVersion`(versionCode)을 기록한다.

## 6. 제출

```bash
npx -y eas-cli submit --platform android --profile production --id <buildId> --non-interactive --wait
```

실패하면(서비스 계정 키, 중복 versionCode 등) 메시지를 그대로 보고하고 멈춘다.

## 7. 태그

빌드한 커밋에 태그를 달아 다음 배포의 기준점으로 쓴다.

```bash
git tag -a android-v<appVersion>-<versionCode> <빌드한 커밋 SHA> -m "<출시 노트>"
git push origin android-v<appVersion>-<versionCode>
```

빌드한 커밋 SHA 는 `build:view` 의 `gitCommitHash` 를 쓴다.

## 8. 보고

한국어로 보고한다:
- 버전 `1.0.0 (versionCode N)`, 빌드한 커밋, EAS 빌드 링크
- 제출 결과(internal 트랙), 출시 노트(Play 콘솔에 붙여 넣을 수 있게 그대로)
- "운영 트랙 승격은 Play 콘솔에서 직접 해 주세요" 안내
- 건너뛴 단계나 경고가 있었다면 그대로 적는다.
