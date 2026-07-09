---
name: i18n
description: Allibee 프론트엔드 i18n 키를 추가/수정할 때 키 버전 suffix(V2, V3...) 규칙과 앱별 Google Sheet 입력 포맷을 일관되게 생성한다. contract는 네임스페이스/마지막키 분리 포맷, cue는 전체 키 한 컬럼 포맷을 사용한다. 번역 값에 \n 줄바꿈이 있으면 시트 셀 내 줄바꿈으로 붙여넣을 수 있는 따옴표 감싼 형태로 변환한다.
---

# i18n

Allibee 프론트엔드의 i18n 키 작성/변경 시 아래 규칙을 따른다.

## 사용 시점

-   새 번역 키를 추가할 때
-   기존 키 의미가 바뀌어 키를 버전업해야 할 때
-   Google Sheet에 붙여넣을 한 줄 포맷이 필요할 때

## 공통 규칙 (모든 앱)

1. **ko/en/ja locale 파일을 직접 수정하지 않는다.** (cue의 `src/lib/i18n/generated/*.ts`는 자동 생성 파일)
2. 기존 키의 **의미(문구/용도)**가 바뀌면 기존 키를 덮어쓰지 않고 suffix를 붙인다.
3. suffix는 `V2`, `V3`, ... 순서로 증가시킨다.
4. 키는 파일 경로를 반영한 dot-notation을 따른다. (예: `apps.cue.routes.sign-up.direct.email-input.page.subtitle`)

## 앱 판별

키 prefix로 어느 포맷을 쓸지 결정한다:

| 키 prefix | 시트 | 포맷 |
| --- | --- | --- |
| `apps.contract.*`, `routes.*` | contract 시트 | **분리 포맷** (네임스페이스 + 마지막 키) |
| `packages.service.lib.*` (공용) | packages.service.lib 시트 | **분리 포맷** (네임스페이스 + 마지막 키) |
| `apps.cue.*` | FE CUE 시트 | **전체 키 포맷** (한 컬럼) |

> cue 앱이 `packages.service.lib.*` 키를 쓰더라도, 해당 키는 공용 시트(분리 포맷)에 입력한다. cue의 `sheet-to-i18n.js`가 공용 시트를 함께 읽어 병합한다.

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

## cue 시트 포맷 — 전체 키 포맷

컬럼 4개: `전체 키(FE KEY) | ko | en | ja`

**키를 분리하지 않고 A열에 전체 키를 그대로 넣는다.**

전체 키가 아래라고 가정:

```text
apps.cue.lib.service.signIn.common.agreeAll
```

시트용 한 줄 포맷:

```text
apps.cue.lib.service.signIn.common.agreeAll	전체 동의	Agree to all	すべて同意
```

시트 반영 후 로컬 파일 생성:

```bash
# apps/cue 에서 실행 — src/lib/i18n/generated/{ko,en,ja}.ts 재생성
npm run sheet-to-i18n
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

### cue — 신규 키

```text
apps.cue.routes.sign-up.direct.email-input.page.subtitle	이메일을 입력해 주세요	Enter your email	メールアドレスを入力してください
```

### 의미 변경으로 버전업 (공통)

```text
routes.resetPasswordFromEmailPage.changePasswordV2          # contract
apps.cue.routes.sso-sign-up-callback.page.titleV2           # cue
```
