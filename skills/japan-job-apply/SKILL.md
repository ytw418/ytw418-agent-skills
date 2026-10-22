---
name: japan-job-apply
description: 일본 개발자 구직 사이트(Japan Dev, TokyoDev, CareerCross)에 이력서 기반 프로필을 등록하고, 해외에서 지원 가능한(비자 지원) 프론트엔드 공고를 자격 요건으로 걸러 회사 ATS(Lever·Greenhouse·HRMOS·자체 폼)까지 실제 지원서를 제출한 뒤 지원 현황표로 보고한다. 사용자가 '일본 구직 사이트에 이력서 올려줘', '일본 개발자 취업 지원해줘', 'Japan Dev 지원', 'TokyoDev 지원', 'CareerCross 프로필', '해외 지원 가능한 공고 찾아서 지원', '프론트엔드 몇 개 지원해줘' 등을 요청할 때 사용한다. 영문 이력서 PDF 작성 자체나 코딩 테스트 풀이에는 쓰지 않는다.
---

# 일본 개발자 구직: 프로필 등록 + 지원

흐름: 준비 → 프로필 → 공고 선별 → 지원 → 보고. 지원서는 회사에 바로 전달되어 되돌릴 수 없으니, **사용자가 지원을 요청한 범위 안에서만 제출**하고 답변은 이력서에 있는 사실만 쓴다.

## 0. 준비

1. 이력서 PDF 경로와 연락처(이메일·전화)는 이력서에서 읽는다. 원본이 한국어면 영문 2페이지 ATS 이력서가 있는지 먼저 묻는다(`pdf` 스킬로 만든다).
2. 브라우저 고르기:
   - **사용자 Chrome**(로그인 세션 필요): `scripts/cjs.sh <URL 일부> <js파일>` 로 탭 안에서 JS를 실행한다. 창·프로필이 여러 개라 탭을 못 찾으면 아래로 모든 탭을 본다. 로그인이 안 보이면 다른 창에 새 탭을 열어 확인한다(`tell window id N to make new tab`, URL은 `set URL of t to` 로 따로 넣는다. `%5B` 같은 인코딩이 있으면 한 번에 넣을 때 실패한다).
     ```bash
     osascript -e 'tell application "Google Chrome" to get {id, URL of tabs} of every window'
     ```
   - **Paseo 브라우저**(`mcp__paseo__browser_*`): 로그인이 필요 없는 회사 ATS 폼, 그리고 react-select처럼 **진짜 클릭이 있어야 열리는 UI**에 쓴다. 파일은 `browser_upload` 로 바로 올린다.
3. 비밀번호·이메일 토큰·OAuth 로그인은 사용자에게 넘긴다. 토큰 로그인은 **지원서를 낼 그 브라우저에서** 메일을 요청한다(세션이 브라우저별로 따로다).

## 1. 프로필 등록

사이트별 URL·필드·함정은 [references/sites.md](references/sites.md) 를 읽고 진행한다.

- 경력 수준은 **재직 기간 합계**로 고른다(이력서 첫 줄의 "5+ years"를 믿지 않는다). 언어 수준은 이력서 표기 그대로 적는다.
- 공개 범위(검색 노출 여부)는 사용자가 정한다. 정하지 않았으면 기본값과 바꾸는 방법을 보고에 적는다.
- 저장 후 프로필 페이지를 다시 읽어 값이 들어갔는지 확인한다.

## 2. 공고 선별

1. Japan Dev `front-end-jobs-in-japan`, `react-jobs-in-japan`, `javascript-jobs-in-japan`, `full-stack-jobs-in-japan`, TokyoDev `/jobs/frontend` 에서 **"Apply from abroad"** 가 붙은 공고만 모은다.
2. 각 공고 상세에서 다음을 읽고 **필수 조건을 못 맞추면 뺀다**(빼는 이유를 보고에 적는다):
   - 최소 경력(Japan Dev: Junior 1~2년 / Mid 3~5년 / Senior 5년+, 본문의 "N+ years"가 우선)
   - 영어(Business / Fluent), 일본어(Required)
   - 필수 기술(예: Go 백엔드 필수, React Native 필수)
3. 경계선(예: 5년 필수인데 4년 10개월)은 지원하지 말고 사용자에게 묻는다.
4. 사용자 스택과 겹치는 공고(Svelte, React/TypeScript)를 위로 올려 후보 표를 보여 주고, 지원 범위를 받는다.

공고 상세는 Japan Dev 탭에서 XHR로 여러 개를 한 번에 읽으면 빠르다.
```js
// /jobs/<company>/<slug> 의 요건만 뽑기
var x=new XMLHttpRequest();x.open('GET','/jobs/'+slug,false);x.send();
var t=new DOMParser().parseFromString(x.responseText,'text/html').body.textContent.replace(/\s+/g,' ');
t.slice(t.indexOf('Language Requirements'), t.indexOf('Language Requirements')+300)
```

## 3. 지원

공고마다 경로가 다르다. 지원 버튼을 누른 뒤 어디로 가는지 보고 맞는 절차를 따른다. ATS별 필드와 함정은 [references/ats.md](references/ats.md) 를 읽는다.

| 지원 경로 | 하는 일 |
|---|---|
| Japan Dev 안에서 바로 제출(메시지 칸 + 저장된 이력서) | 회사별 메시지(1200자 이내)를 쓰고 Submit. 상세에 "You applied to this job on …" 이 뜨면 완료 |
| Japan Dev "Continue" → 외부 링크 | 링크 URL을 읽어 새 탭으로 연다(클릭만으로는 탭이 안 열릴 때가 있다) |
| TokyoDev "Apply" → 모달 "Continue applying" | `/c/<co>/j/<job>/applications/new` → 회사 ATS로 넘어감. 회사에 TokyoDev를 언급한다 |
| 회사 코딩 테스트 등록(HENNGE 등) | 등록 폼까지만 낸다. **테스트는 사용자가 직접 푼다**(약관상 본인만 응시 가능, 대신 풀면 부정행위) |

회사별 메시지는 짧은 영어로 쓴다: 지원 경로 1줄 → 공고 스택과 겹치는 실제 경력 2~3개 → 이주 가능·언어 수준(사실대로) → 서명·GitHub. 이력서에 없는 성과·자격은 만들지 않는다.

제출 후에는 반드시 완료 화면(`/thanks`, `/confirmation`, "Application submitted", "Thank you for registering")을 읽어 확인한다.

## 4. 보고

표 하나로 낸다: 회사 · 포지션 · 연봉 · 상태(제출/등록/보류) · 연락 받을 이메일. 그 아래에 다음을 적는다.
- 사용자가 확인할 답변(이전 지원 이력, 면접 언어, 학력 선택지 매핑 등 추정이 들어간 것)
- 지원하지 않은 공고와 이유
- 사용자가 직접 할 일(코딩 테스트, 이메일 인증)
