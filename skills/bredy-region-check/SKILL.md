---
name: bredy-region-check
description: 브리디 앱(bredy_app)·웹(breeder_web)의 '내 동네 설정'과 '현재 위치로 찾기'를 실제 화면으로 검증한다. 카카오맵 서비스 켜짐 확인, 에뮬레이터 위치(geo fix)·앱 언어(ko-KR) 지정, 쉬는 에뮬레이터 확보와 분담 알림, 워크트리 Metro 연결, 시/군/구 고르기→완료→이전 화면 복귀 확인, dev 테스트 계정의 동네 값 확인·복원, 웹 next dev+Playwright 흐름(저장 요청 가로채기)과 캡처까지 한다. 사용자가 '동네 설정 확인해봐', '현재 위치 찾기 테스트', '위치 설정이 안 돼', '내 동네 버그', '동네 브리더 검증', '우리 동네 화면 확인' 등을 요청하거나 RegionPickerScreen·RegionPicker·locateRegion 을 고친 뒤 확인할 때 사용한다. 동네 기능 자체를 새로 설계하거나 서버 nearby API 만 고칠 때는 쓰지 않는다.
---

# 브리디 내 동네·현재 위치 검증

## 코드 위치

| | 앱 `~/Desktop/pro/bredy_app` | 웹 `~/Desktop/pro/breeder_web` |
|---|---|---|
| 화면 | `src/components/features/region/RegionPickerScreen.tsx`, 라우트 `src/app/settings/region/{index,[sido]}.tsx` | `components/features/region/RegionPicker.tsx`, `app/(web)/settings/region/` |
| 현재 위치 | `src/lib/locateRegion.ts`(expo-location, 기기 역지오코딩) + `src/lib/regionMatch.ts`(주소→목록) | `libs/client/locateRegion.ts`(브라우저 위치 + 카카오 coord2RegionCode) |
| 테스트 | `npm run test:region` | `npx jest __tests__/regionPicker.test.tsx __tests__/regionWeb.test.tsx` |
| 기획 | `docs/prd/neighborhood.md`(v2), 기준표 `docs/parity/README.md` O-6 | — |

동작 기준(2026-10-09): 고른 동네·'나를 표시'는 하단 **완료**로 한 번에 저장하고 내 동네를 연 화면으로 돌아간다. 처음 동네를 정하면 '나를 표시'가 켜져 있다. 시/군/구 화면은 저장하지 않고 내 동네 화면으로 값만 넘긴다.

## 지킬 것

- dev DB 쓰기는 **테스트 계정**에만 하고, 끝나면 원래 값으로 되돌린다(`scripts/test_account_region.cjs find` 로 먼저 기록). 웹 검증은 저장 요청을 가로채 DB 에 쓰지 않는다.
- 에뮬레이터는 여러 세션이 같이 쓴다. 남이 쓰는 기기를 뺏지 않는다. 앱 언어 변경은 액티비티를 다시 만들어 남의 화면을 날리니 비어 있을 때만 한다.
- 보고에는 캡처를 넣는다(`scripts/pr-screenshots.sh` → `ytw418/pr-assets`).

## 1. 빠른 점검 (1분)

```bash
S=~/.claude/skills/bredy-region-check/scripts
bash $S/kakao_map_check.sh            # 웹 현재 위치의 전제. FAIL(OPEN_MAP_AND_LOCAL)이면 사용자에게 콘솔에서 카카오맵을 켜 달라고 알린다
cd ~/Desktop/pro/bredy_app && npm run -s test:region
```

## 2. 앱 — 에뮬레이터

1. **기기 확보**: `adb devices` → 기기마다 `adb -s <s> shell dumpsys activity activities | grep -m1 topResumedActivity` 와 `adb -s <s> logcat -d -t 3000 | grep "ActivityTaskManager: START"` 로 최근에 누가 띄웠는지 본다. 런처에 쉬는 기기를 고르고 `ListAgents` 의 busy bredy 세션들에 `SendMessage` 로 "emulator-XXXX 를 N분 쓴다"를 알린다. 같은 AVD 두 번째 실행은 첫 인스턴스가 `-read-only` 가 아니면 실패한다.
2. **Metro**: 워크트리면 `cp -cR ~/Desktop/pro/bredy_app/node_modules ./node_modules`, `.env` 복사 후 `TMPDIR=/tmp/<세션>-metro npx expo start --dev-client --port 80xx --clear`(run_in_background, timeout 7200000). `adb -s <s> reverse tcp:80xx tcp:80xx` → `adb -s <s> shell am start -a android.intent.action.VIEW -d "exp+bredyapp://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A80xx" app.bredy.mobile`. Metro 로그에 `Bundled` 가 찍힌 뒤 홈이 뜰 때까지 기다린다(`emu_ui.sh <s> wait 브리디 90`).
3. **고르기 → 완료**:
   ```bash
   U="bash $S/emu_ui.sh emulator-5554"
   $U open bredy://settings/region && $U wait "현재 위치로 찾기"
   $U shot /tmp/r-01-home.png
   $U tap "경기도" && $U wait "경기도 성남시" && $U tap "경기도 성남시"
   $U wait "완료를 누르면 저장돼요" && $U shot /tmp/r-02-picked.png
   $U tap "완료" && $U texts | head      # 내 동네를 연 화면(딥링크면 홈)으로 돌아와야 한다
   ```
4. **현재 위치로 찾기**:
   ```bash
   bash $S/emu_locate.sh emulator-5554 gangnam ko   # en-US 에뮬레이터는 영어 주소라 ko 를 준다(비어 있을 때만)
   $U open bredy://settings/region && $U wait "현재 위치로 찾기" && $U tap "현재 위치로 찾기"
   $U wait "완료를 누르면 저장돼요" 45 && $U shot /tmp/r-03-located.png
   ```
   에뮬레이터는 현재 위치가 15초 타임아웃 → 마지막 위치로 받으므로 30초쯤 걸린다. 결과 해석:

   | 화면 | Metro 로그(`[locateRegion]`) | 뜻 |
   |---|---|---|
   | 행이 "서울특별시 강남구" + "완료를 누르면 저장돼요" | `current position failed … timeout` 만 | 정상(폴백 경로) |
   | 토스트 "서울특별시의 시/군/구를 골라 주세요" + 서울 목록 | `unmatched address Seoul … Gangnam District` | 영어 주소. `ko` 로 다시 |
   | "현재 위치를 찾지 못했습니다" | `failed` | geo fix 안 됨·위치 꺼짐. `location_mode` 3 인지 본다 |
   | "위치 권한이 꺼져 있어요" + 설정 열기 | — | 권한 영구 거부. 앱 정보에서 권한을 켠다 |

   확인한 뒤 '완료'는 누르지 않고 뒤로 가거나, 눌렀다면 아래 4번으로 되돌린다.

## 3. 웹 — next dev + Playwright

```bash
cd <breeder_web 워크트리>      # node_modules 는 cp -cR 클론, prisma 타입 오류면 npx prisma generate
(npx next dev -p 3021 > /tmp/region-next.log 2>&1 &)
until curl -s -o /dev/null -w "%{http_code}" http://localhost:3021/auth/login | grep -qE "200|30[0-9]"; do sleep 3; done
for p in /posts /settings/region /settings/region/%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C; do curl -s -o /dev/null --max-time 240 "http://localhost:3021$p"; done   # 미리 컴파일
perl -e 'alarm 300; exec @ARGV' node $S/web_region_flow.cjs "$PWD" /tmp/region-web   # mkdir -p 먼저
pkill -f "next dev -p 3021"
```

기대 출력: `완료 비활성: true` → `나를 표시: true` → `저장 요청: [{"regionSido":"서울특별시","regionSigungu":"강남구","regionVisible":true}]` → `완료 뒤 주소: …/posts`. 웹 현재 위치는 1번 카카오 점검이 OK 일 때만 실제 브라우저(Vercel 프리뷰)에서 따로 본다. Playwright 가 `mach_port_rendezvous` 로 죽으면 jest 렌더 테스트와 Vercel 프리뷰로 대신한다.
- 스크립트는 로그인 뒤 홈(`/`)을 건너뛴다(`?next=/posts`). next dev 가 많이 떠 있으면 홈 첫 컴파일이 400초를 넘기고, 컴파일 중에 서버를 끄면 캐시가 꼬여 다음에도 멈춘다 → 서버를 끄고 그 워크트리의 `.next` 를 지운 뒤 다시 띄운다.
- 로그인 직후 '알림을 켜고 소식을 바로 받아보세요' 시트가 버튼을 가린다. 스크립트가 '나중에'로 닫는다.

## 4. 테스트 계정 값 확인·복원

```bash
node $S/test_account_region.cjs find              # regionUpdatedAt 최근 순. 방금 바꾼 계정을 찾는다
node $S/test_account_region.cjs set 79 서울특별시 구로구 true   # 원래 값으로
```

에뮬레이터 dev build 는 보통 테스트 계정 79(초보집사민)로 로그인돼 있다(10-09 기준 원래 값: 서울특별시 구로구, 표시 켜짐).

## 5. 정리·보고

- Metro 종료(`kill $(lsof -iTCP:80xx -sTCP:LISTEN -t)`), `adb -s <s> reverse --remove tcp:80xx`, 바꾼 앱 언어는 기기가 비어 있으면 `emu_locate.sh <s> <장소> reset`(남이 쓰는 중이면 남겨 두고 보고에 적는다).
- 캡처를 `bash scripts/pr-screenshots.sh <파일...>`(앱·웹 저장소 어디서든)로 올려 PR 표·보고에 넣고, 로컬 경로도 적는다.
- 보고에 적을 것: 카카오맵 켜짐 여부, 앱 고르기→완료→복귀, 현재 위치 결과(어느 언어·경로), 웹 저장 요청 본문, 되돌린 테스트 계정 값, 남긴 기기 상태.
