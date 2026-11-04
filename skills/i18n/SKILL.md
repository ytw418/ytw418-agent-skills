---
name: i18n
description: Allibee 프론트엔드 i18n 키를 추가/수정할 때 키 버전 suffix(V2, V3...) 규칙과 앱별 반영 방법을 따른다. cue·Cue 안 React MFE(apps.cue.*·react.*)는 cue locales/{ko,en,ja}.ts 를 직접 고치고, contract·packages 는 네임스페이스/마지막키 분리 포맷 시트 행을 만든다. 번역 값에 \n 줄바꿈이 있으면 시트 셀 내 줄바꿈으로 붙여넣을 수 있는 따옴표 감싼 형태로 변환한다.
---

# i18n

Allibee 프론트엔드의 i18n 키 작성/변경 시 아래 규칙을 따른다.

## 사용 시점

-   새 번역 키를 추가할 때
-   기존 키 의미가 바뀌어 키를 버전업해야 할 때
-   contract·`packages.*` 키를 Google Sheet에 붙여넣을 한 줄 포맷이 필요할 때

## 큐·리액트 MFE는 번역 파일을 직접 고친다 (2026-11-04 사용자 결정)

"이제 큐랑 리액트 mfe는 엑셀시트에 추가 안 하고 바로 직접 ja, ko, en 번역 파일을 수정할 거야." allibee-frontend develop 도 cue 번역 원본을 시트에서 파일로 옮겼다(AGENTS.md i18n 절, #5075).

-   대상 키: `apps.cue.*`, Cue 안에 뜨는 React MFE 의 `react.*`
-   고칠 파일: allibee-frontend `apps/cue/src/lib/i18n/locales/{ko,en,ja}.ts` 세 파일에 같은 키를 함께 넣는다. 키 오름차순 자리에 넣는다
-   검사: `cd apps/cue && npx vitest run locales.test --poolOptions.threads.singleThread` (세 파일 키 일치·빈 문구·자리표시자). 워크트리에서 `--maxWorkers=1` 은 Tinypool 오류가 난다
-   시트 행·`generate-cue-i18n` Action·`npm run sheet-to-i18n` 은 쓰지 않는다. 사용자에게 시트 행을 주지 않고, PR 본문에는 넣은 키만 적는다
-   React 저장소 카탈로그(`lib/locales/*.json`, `apps/business-agent/src/lib/i18n/locales/*.json`)를 고쳐도 Cue 화면은 바뀌지 않는다 — Cue 화면 문구는 위 cue 파일의 `react.*` 키로 고친다. React 단독 앱 화면은 작업 대상이 아니다(글로벌 CLAUDE.md §15)
-   주의: React 이전 내역 위젯(`agent-history-widget-mount.tsx`) 등 `BusinessAgentViteI18nProvider` 를 쓰는 화면은 Cue 사전이 아니라 React 번들 카탈로그를 읽는다. 그 화면 문구는 어느 사전을 읽는지 먼저 확인한다

## 공통 규칙

1. contract·`packages.*` 생성 파일(`lib/locales/*.json`, `apps/contract/src/lib/i18n/generated/*`)은 직접 고치지 않는다 — 시트 입력 뒤 Action 으로만 생성한다. 훅 `~/.claude/hooks/i18n-file-guard.py` 가 막는다. cue `locales/*.ts` 는 막지 않는다.
2. 기존 키의 **의미(문구/용도)**가 바뀌면 기존 키를 덮어쓰지 않고 suffix를 붙인다.
3. suffix는 `V2`, `V3`, ... 순서로 증가시킨다.
4. 키는 파일 경로를 반영한 dot-notation을 따른다. (예: `apps.cue.routes.sign-up.direct.email-input.page.subtitle`)
5. **시트 행(contract·packages)을 줄 때는 마크다운 표로 주지 않는다.** 항상 ` ```text ` 코드블록 안에 탭 구분 한 줄(키 컬럼 → ko → en → ja)로 준다. 표는 복사하면 탭이 사라져 시트에 붙여넣을 수 없다.
6. 새 키를 넣기 전에 같은 경로의 키가 이미 있는지 번역 파일에서 확인한다.
7. 코드에는 기본값을 둔다 — cue 는 `$_(key, { default: '기본값' })`, React 는 `translateRuntime(key, '기본값')`. 시트 반영 전(contract·packages)이나 테스트 목에서 키 이름·`MISSING_MESSAGE` 가 보이지 않게 한다.

## 앱 판별

| 키 prefix | 원본 | 방법 |
| --- | --- | --- |
| `apps.cue.*`, `react.*` (Cue 안 MFE) | cue `locales/{ko,en,ja}.ts` | **직접 수정** |
| `apps.contract.*`, `routes.*` | contract 시트 | 시트 행 — **분리 포맷** (네임스페이스 + 마지막 키) |
| `packages.*` (공용) | packages.service.lib 시트 | 시트 행 — **분리 포맷** |

> cue 작업이라도 새 `packages.*` 키는 공용 시트(분리 포맷)로 간다. cue 는 `apps/cue/src/lib/i18n/messages/` 에서 `lib/locales` 의 `packages.*` 를 합쳐 쓰고, cue 파일에 둔 `packages.*` 키는 그 값을 덮어쓴다.

## contract / 공용(packages) 시트 포맷 — 분리 포맷

컬럼 5개: `네임스페이스 | 마지막 키 | ko | en | ja`

전체 키가 아래라고 가정:

```text
apps.contract.routes.clm.repository.contract-extract.page.paymentMethodOneTime
```

시트용 한 줄 포맷 (마지막 세그먼트를 분리):

```text
apps.contract.routes.clm.repository.contract-extract.page	paymentMethodOneTime	한글	영어	일본어
```

## 줄바꿈(`\n`) 포함 값 처리

코드 값에 `\n`이 있으면 시트에는 **셀 내부의 실제 줄바꿈**으로 들어가야 한다. `\n` 두 글자를 그대로 시트에 넣지 않는다.

붙여넣기용 출력 규칙:

1. `\n`을 실제 개행으로 변환한다.
2. 개행이 포함된 셀만 큰따옴표(`"`)로 감싼다. 값 안에 `"`가 있으면 `""`로 이스케이프한다.
3. 컬럼 구분은 평소처럼 탭.

예 — 코드 값이 `계약 묻고 ∙ 쓰고 ∙ 검토하는\n모든 순간에` 인 경우 (contract 분리 포맷):

```text
routes.sign-in.page	promoHeading	"계약 묻고 ∙ 쓰고 ∙ 검토하는
모든 순간에"	"For every moment you ask,
draft, and review contracts"	"契約を尋ね、作成し、レビューする
すべての瞬間に"
```

이 블록을 통째로 복사해 시트에서 붙여넣을 시작 셀(A열) 하나만 선택하고 붙여넣으면, 따옴표로 감싼 값은 한 셀 안에 줄바꿈으로 들어간다.

주의:

- 사용자에게 전달할 때는 반드시 코드블록으로, 개행이 살아있는 상태로 출력한다. `\n` 문자를 그대로 노출하면 안 된다.
- 환경에 따라 붙여넣기가 여러 행으로 쪼개지면, 대체 방법으로 해당 셀에 수식 형태를 붙여넣는다: `="계약 묻고 ∙ 쓰고 ∙ 검토하는"&CHAR(10)&"모든 순간에"`

## 예시

### contract — 신규 키

원본 키:

```text
routes.resetPasswordFromEmailPage.changePassword
```

시트용:

```text
routes.resetPasswordFromEmailPage	changePassword	비밀번호변경	Change password	パスワードの変更
```

### 의미 변경으로 버전업 (공통)

```text
routes.resetPasswordFromEmailPage.changePasswordV2          # contract
apps.cue.routes.sso-sign-up-callback.page.titleV2           # cue
```
