---
name: api-temp-patch
description: BE API가 아직 없을 때 FE(allibee-frontend apps/cue)가 생성 API 코드(service.ts·types.d.ts·functionNames.json)를 BE·타입 생성기가 낼 모양 그대로 먼저 고치고, 아직 없는 동작은 가짜 응답으로 갈아끼워 화면을 먼저 개발한다. 신규 API는 가짜 응답(지연·성공·오류 전환), 기존 API는 실제 응답에 새 필드·바뀐 모양을 덧입힌다. 가짜는 티켓별 한 파일(fake/<티켓>.ts)과 FAKE(<티켓>) 표시로 모으고, BE 배포 뒤 타입 생성 Action 결과로 충돌을 정리해 걷어낸다. 사용자가 'API 임시 수정', '임시 api 수정 스킬', '가짜 응답으로 먼저', 'BE 전에 화면 먼저', '타입 먼저 고치고 나중에 컨플릭트 정리', 'api-temp-patch' 등을 요청할 때 사용한다. 화면 목업만 필요하면(앱 코드 없이) HTML 목업으로 충분하다.
---

# API 임시 수정 (api-temp-patch)

BE API 배포 전에 FE 화면을 먼저 만든다. 원래 `apps/cue/src/lib/api/generated/`(service.ts·types.d.ts·functionNames.json)는 GitHub Action 타입 생성기로만 바꾸지만, 이 방식에서는 **생성기가 낼 모양 그대로 먼저 직접 고치고**, BE 배포 뒤 생성 결과로 충돌을 정리한다. 화면은 처음부터 최종 함수 이름·타입으로 부르므로 연동 때 고칠 곳이 거의 없다.

처음 쓴 곳: ALLIBEE-1612(체결본 목록 엑셀 다운로드, PR #5489). 2026-10-29 사용자 결정.

## 1. 준비

- 기능 티켓 키로 develop 기준 워크트리·브랜치를 만든다: `git worktree add ../allibee-frontend-<번호> -b feature/<티켓> origin/develop` (메인 저장소는 다른 작업 중일 수 있으니 건드리지 않는다)
- node_modules: 같은 develop lockfile을 쓰는 다른 워크트리의 루트 node_modules를 심볼릭 링크하거나 루트에서 `npm ci`. `.env`는 메인 저장소 `apps/cue`에서 복사한다(커밋 금지)
- BE에 요청할 API 모양(경로·쿼리·요청·응답 JSON·오류 코드)을 먼저 정해 티켓 코멘트 'BE API 요청'에 적는다. 가짜 응답은 이 JSON과 같은 모양으로 만든다

## 2. 생성 코드 먼저 고치기 — 생성기가 낼 모양 그대로

- service.ts 함수는 같은 파일의 비슷한 함수를 복사해 고친다. 모양: `export function X({ requestBody }: { requestBody: T } = {} as any, requestConfig?: RequestConfig): AxiosPromise<R> { return axiosInstance(mergeObjects(toAxiosOptions({ method, url, query, body, mediaType }), requestConfig)); }`
- 함수 이름은 생성기가 경로·operationId로 정한다. 같은 컨트롤러의 기존 이름 규칙대로 가정하고 `functionNames.json`에도 등록한다. 'BE API 요청' 코멘트에 가정한 이름·경로를 적어 BE가 맞추게 한다
- 타입은 types.d.ts의 `declare type Cue... = {`에 필드를 추가·변경한다
- 파일 응답은 `AxiosPromise<Blob>`로 두고, 부르는 쪽에서 `responseType: 'blob'`을 준다. 실패 응답도 Blob이므로 `JSON.parse(await blob.text())`로 code를 읽는다

## 3. 가짜 응답 갈아끼우기

- 가짜 코드는 티켓별 한 파일 `apps/cue/src/lib/api/fake/<티켓>.ts`에만 둔다. generated/ 쪽은 import 한 줄과 함수 본문 한 줄만 바꾼다
- 가짜가 들어간 모든 곳에 같은 한 줄 주석을 단다: `// FAKE(<티켓>): BE 배포 뒤 타입 생성 Action 결과로 바꾸고 fake/<티켓>.ts 를 지운다`. 나중에 `grep -rn "FAKE(<티켓>)" apps/cue`로 전부 찾는다
- **신규 API**: 실제 호출 대신 약 1초 지연 뒤 BE 응답 샘플을 돌려준다. 오류 흐름은 `localStorage` 키(예: `<티켓 밑줄 표기>_FAKE_<이름>`) 값(limit·error·forbidden 등)으로 axios 오류와 같은 모양으로 reject한다. 파일 응답이 필요하면 파이썬 zipfile로 만든 최소 xlsx 등을 base64로 넣는다(엑셀 라이브러리가 없다)
- **기존 API의 필드 추가·응답 변경**: 실제 호출은 그대로 두고 결과를 감싼다(`return fakePatchX(axiosInstance)(...)` 한 줄). 새 필드는 id 기반 결정적 가짜 값으로 채우고, 바뀐 모양은 변환하고, BE가 모르는 새 요청 값(정렬 키 등)은 보내기 전에 빼고 받은 페이지 안에서 흉내 낸다(걸러 내기·정렬)
- 한계: 흉내는 받은 페이지 안에서만 맞는다(건수·커서·서버 정렬은 진짜와 다름). 같은 API를 쓰는 다른 화면도 이 브랜치에서는 가짜 모양을 받는다 → PR은 BE 배포 전까지 draft

## 4. 화면 개발·검증

- 화면은 처음부터 최종 함수 이름·타입으로 부른다
- 테스트는 분기 로직과 가짜 덧입히기 로직만 1~2개. 페이지 테스트가 `vi.mock('$lib/api')`를 쓰면 새 함수도 목에 넣는다
- svelte-check·vitest는 develop 기준(바로 앞 커밋)과 결과를 비교해 '새로 생긴 오류·실패 0'을 확인한다 — 저장소에 원래 실패가 많다
- i18n: 생성 locale 파일은 고치지 않는다. 시트 행(키·ko·en·ja 탭 구분 TSV)을 티켓 코멘트에 남긴다. 시트 입력 전에는 화면에 키 원문이 보인다
- 화면 확인·흐름 영상: 로컬 개발 서버(https://localhost:5173)에 로그인한 상태가 필요하다. 회사 자동화 크롬(9224)에 탭을 열어 사용자가 한 번 로그인하면, 같은 출처라 워크트리를 바꿔도 유지된다

## 5. PR·티켓

- 커밋 메시지는 `[<티켓>] …`, draft PR(base develop, assignee ytw418, 제목 `<티켓> …`, 대괄호 없이)
- PR 본문: 가짜 위치, 전환 방법(localStorage), 'BE 배포 뒤 할 일', develop 대비 검증 결과
- 티켓 코멘트: PR 링크, 가정한 함수 이름·경로, 가짜 전환 방법, i18n 시트 행

## 6. BE 배포 뒤 걷어내기

1. 타입 생성 Action 실행 → service.ts·types.d.ts·functionNames.json 충돌은 생성 결과를 받는다
2. `grep -rn "FAKE(<티켓>)" apps/cue`로 남은 곳을 정리하고 `fake/<티켓>.ts`(·`.test.ts`)를 지운다
3. 함수 이름이 다르면 호출부만 고친다 → dev 실제 API로 확인 → ready for review
