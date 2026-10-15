---
name: bredy-repo-cleanup
description: 브리디 앱(bredy_app)·웹(breeder_web) 레포에서 안 쓰는 이미지·컴포넌트·코드·md·테스트·패키지를 찾아 지우고, 로컬 디스크(다 끝난 워크트리·빌드 캐시)를 비운다. knip 으로 후보를 찾고 git grep 으로 참조 0 을 다시 확인한 뒤, 보호 목록은 건드리지 않고, 지운 뒤 타입 검사·lint·테스트·번들/빌드까지 통과해야 커밋한다. 사용자가 '레포 정리', '코드 정리', '안 쓰는 파일 지워', '안 쓰는 이미지 정리', '레포가 무거워', '디스크 정리', '워크트리 정리', '안 쓰는 패키지 정리', '죽은 코드 정리' 등을 요청할 때 사용한다. 리팩터링·코드 품질 개선(simplify)이나 DB 데이터 정리에는 쓰지 않는다.
---

# 브리디 레포 정리

목표는 **동작을 하나도 바꾸지 않고** 무게만 줄이는 것이다. 애매하면 지우지 않고 '보류'로 보고한다.

| | 앱 `~/Desktop/pro/bredy_app` | 웹 `~/Desktop/pro/breeder_web` |
|---|---|---|
| 커밋 위치 | 원본 체크아웃 master 에 바로(내 파일만 stage) | 워크트리 `chore/remove-unused-*` → dev PR |
| 검사 | `npx tsc --noEmit` · `npm run lint` · `npm run test:*` 전부 · `CI=1 npx expo export --platform android --output-dir /tmp/x` | `npm run lint` · `npx tsc --noEmit` · `npx jest` · PR 의 Vercel 프리뷰 빌드 |

## 0. 방어 규칙 (반드시)

1. **DB 명령 금지.** `prisma generate` 말고 prisma·supabase·시드 명령은 실행하지 않는다(`AGENTS.md` DB 안전 규칙).
2. **지우기 전에 기존 검사를 한 번 돌려 지금 상태가 초록인지 확인한다.** 원래 빨간 것을 정리 탓으로 착각하지 않게.
3. **knip 결과를 그대로 믿지 않는다.** 후보마다 `git grep -F <파일명 또는 경로>` 로 참조 0 을 다시 확인한다. 자기 자신·같이 지우는 파일만 참조하면 함께 지운다.
4. **아래 보호 목록은 참조 0 이어도 지우지 않는다**(보류로 보고).
5. 정리 커밋은 기능 커밋과 섞지 않는다. 파일 삭제 커밋과 패키지 제거 커밋을 나눠 `git revert` 로 하나씩 되돌릴 수 있게 한다.
6. 검사가 하나라도 실패하면 원인 파일을 `git restore --staged --worktree <파일>` 로 되살리고 다시 검사한다. 실패를 덮지 않는다.
7. 여러 세션이 같은 작업 트리를 쓴다. 앱 master 에서는 `git add <내가 지운 경로>` 만 하고 `git add -A` 를 쓰지 않는다.

### 보호 목록

- 문서: `AGENTS.md`·`CLAUDE.md`·`README.md`, `docs/prd/**`, `docs/parity/**`, `docs/ops/**`·`docs/operations/**`·`docs/current/**`, `docs/terminology.md`, `docs/archive/**`(README 가 맥락 보존용이라고 적음), AGENTS.md·다른 md 가 경로로 가리키는 문서, 오늘·어제 만든 문서(진행 중일 수 있음)
- 디자인 원본: `design/mockups/**`(AGENTS.md 디자인 기준표의 원본), `design/mockups/**/notes.md`
- 앱·웹 사본 모듈: 앱 `src/lib/*` 중 "웹 … 사본"이라 적힌 파일, 웹 `libs/shared/**`, 앱 `scripts/web-tests/**`(웹 jest 사본) — 한쪽에서 안 써도 테스트·짝 저장소가 쓴다
- 웹 `public/designer/**`: 디자인 산출물이고 앱이 `/designer/…` 경로를 DB 값으로 받아 쓸 수 있다. 웹 `public` 의 관례 파일(favicon·manifest·sw.js·robots·icon·apple-icon)
- 스토어: 앱 `store-assets/**`(스토어 원본·render.mjs), `assets/fonts/**`, `app.json`·`app.config.js` 가 가리키는 아이콘·스플래시
- 실행 진입점: `package.json` scripts·훅(`.claude/hooks/**`)·스킬이 실행하는 `scripts/**`, `prisma/**`(migrations 포함), 설정 파일(babel·metro·jest·next·eslint·tailwind·playwright config, `__mocks__`)
- 비밀·환경: `.env*`, `credentials/`, `google-services.json`, `GoogleService-Info.plist`
- 패키지: Expo 설정 플러그인·네이티브 모듈(앱 `expo-*`, `react-native-*`) — JS 에서 안 써도 네이티브 빌드가 바뀐다. peer 의존일 수 있는 것(`encoding` 등). devDependencies 는 knip 이 jest 설정을 못 읽어 대부분 오탐이니 손대지 않는다

## 1. 로컬 디스크 (git 밖, 커밋 없음)

```bash
du -sh <repo>/.[!.]* <repo>/* 2>/dev/null | sort -rh | head      # 큰 폴더부터
```

- 다 끝난 워크트리: 먼저 목록만 보고, 그다음 지운다.
  ```bash
  S=~/.claude/skills/bredy-repo-cleanup/scripts
  $S/safe-worktree-prune.sh ~/Desktop/pro/breeder_web            # 목록만
  $S/safe-worktree-prune.sh ~/Desktop/pro/breeder_web --apply    # 변경 0 + 머지됨 + 하루 지남 + 실행 중 아님만
  ```
  `--force` 로 지우지 않는다. 변경이 있거나 머지 안 된 워크트리는 남기고 보고한다.
- 빌드 캐시(다시 생김): 실행 중인 프로세스가 없을 때만 지운다(`pgrep -fl "next|expo|metro|xcodebuild"`).
  - 앱: `ios/build`(Xcode DerivedData, 수 GB), `dist`, `.expo`. `ios/Pods`·`node_modules` 는 지우면 재설치가 오래 걸려 남긴다.
  - 웹: 각 체크아웃의 `.next`, `test-results`, `playwright-report`, `tsconfig.tsbuildinfo`.
- 지우기 전후 `df -k /` 로 비운 양을 잰다.

## 2. 안 쓰는 이미지·폰트

```bash
$S/unused-assets.sh ~/Desktop/pro/bredy_app assets design
$S/unused-assets.sh ~/Desktop/pro/breeder_web public
```

- `name@2x/@3x.png` 는 `name.png` 를 쓰면 쓰는 것이다(스크립트가 처리).
- 끝에 나오는 '경로 조합' 목록에 걸린 폴더의 후보는 보류한다.
- 앱은 지운 뒤 `expo export` 로 번들을 만들어 `require()` 누락을 잡는다(tsc 로는 안 잡힌다).

## 3. 안 쓰는 코드·테스트·패키지

```bash
npx --yes knip@5 --no-progress --reporter compact --include files,dependencies,unlisted
```

- 웹은 knip 이 jest 설정을 못 읽어 `__tests__/**`·`e2e/**`·`jest.*` 를 전부 미사용으로 낸다 → 그 줄은 버린다.
- 앱은 `babel.config.js`·`metro.config.js`·`scripts/*.mjs`(수동 실행) 가 오탐이다.
- 후보 파일마다 확인:
  ```bash
  git grep -n -E "<이름>[\"'/]|<이름>\$" -- '*.ts' '*.tsx' '*.js' '*.mjs' '*.json' '*.py' '*.sh'
  ```
  테스트만 import 하는 소스는 테스트와 함께 판단한다(보통 보류).
- 테스트: 대상 소스가 사라진 테스트, `testMatch`/`package.json test:*` 어디에도 안 걸리는 테스트만 지운다. "테스트가 많아서"는 지울 이유가 아니다.
- 패키지: `git grep -F <패키지명> -- . ':!package.json' ':!package-lock.json'` 결과 0 이고 보호 목록이 아닌 것만 `npm uninstall`. 앱 네이티브 패키지는 지우지 않는다. 다른 패키지가 없어지면 쓰던 컴포넌트를 먼저 지우고 그다음 패키지를 지운다.
- export 단위(안 쓰는 export·타입)는 사본 모듈·공개 타입이 많아 이번 범위에서 뺀다.

## 4. md 문서

참조 0 이고 내용이 일회성(작업 보고·지난 계획·옛 비교 리포트)인 것만 지운다. 판단 근거로 첫 6줄과 마지막 수정일(`git log -1 --format=%cs -- <f>`)을 본다. 기획 원본·가이드·"필독"은 보류.

## 5. 검사 → 커밋

1. 위 표의 검사를 전부 돌린다. 웹 워크트리는 `cp -cR ../../breeder_web/node_modules .` + `npx prisma generate` 로 준비하고, 커밋 전에 `rm -rf node_modules` 한다.
2. 커밋 메시지: `chore: 안 쓰는 파일 정리(…)` + 지운 묶음 목록 + 트레일러 `Parity: both — <상대편 커밋·PR>`(양쪽을 정리했을 때) 또는 `Parity: app-only|web-only — 미사용 파일 정리, 화면 변화 없음`.
3. 웹 PR 본문에는 `## 스크린샷` 아래 `스크린샷 없음 — 화면 변화 없음(참조 없는 파일 삭제만)` 줄을 **명령 안에 직접** 넣는다(`--body-file` 로 넘기면 pr-guard 훅이 못 보고 명령 전체를 막는다).
4. PR 본문에 '일부러 남긴 것'(보류 목록과 이유)을 적는다.
5. 웹 PR 은 Vercel 프리뷰 빌드가 초록인지 본 뒤 사용자에게 머지를 넘긴다(머지는 사용자 지시가 있을 때만).

## 6. 보고

- 비운 디스크 양, 지운 파일 수·줄 수, 커밋·PR 링크
- 돌린 검사와 결과(통과 수)
- 보류 목록(경로 · 이유) — 사용자가 고르면 다음에 지운다
