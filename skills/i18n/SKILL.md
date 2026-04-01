---
name: i18n
description: Allibee 프론트엔드 i18n 키를 추가/수정할 때 키 버전 suffix(V2, V3...) 규칙과 Google Sheet 입력 포맷(네임스페이스, 마지막 키, 한/영/일 번역)을 일관되게 생성한다.
---

# i18n

Allibee 프론트엔드의 i18n 키 작성/변경 시 아래 규칙을 따른다.

## 사용 시점

-   새 번역 키를 추가할 때
-   기존 키 의미가 바뀌어 키를 버전업해야 할 때
-   Google Sheet에 붙여넣을 한 줄 포맷이 필요할 때
-   ko/en/ja locale 를 직접 수정하지마

## 핵심 규칙

1. 기존 키의 **의미(문구/용도)**가 바뀌면 기존 키를 덮어쓰지 않고 suffix를 붙인다.
2. suffix는 `V2`, `V3`, ... 순서로 증가시킨다.
3. Google Sheet 입력 시 키의 마지막 세그먼트를 분리해서 사용한다.

## 시트 입력 포맷

전체 키가 아래라고 가정:

```text
apps.contract.routes.clm.repository.contract-extract.page.paymentMethodOneTime
```

시트용 한 줄 포맷:

```text
apps.contract.routes.clm.repository.contract-extract.page paymentMethodOneTime 한글 영어 일본어
```

해석:

-   첫 번째 컬럼: 마지막 세그먼트를 제외한 네임스페이스
-   두 번째 컬럼: 마지막 세그먼트(실제 키)
-   세 번째~다섯 번째 컬럼: `ko`, `en`, `ja` 번역

## 예시

원본 키:

```text
routes.resetPasswordFromEmailPage.changePassword
```

시트용:

```text
routes.resetPasswordFromEmailPage changePassword 비밀번호변경 Change password パスワードの変更
```

의미 변경으로 버전업이 필요한 경우:

```text
routes.resetPasswordFromEmailPage.changePasswordV2
```
