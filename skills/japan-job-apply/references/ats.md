# 회사 ATS별 메모

## Lever (jobs.lever.co/<co>/<id>/apply)

- 이력서 `#resume-upload-input` 을 **먼저** 붙인다. 이력서를 읽어 이름·이메일을 덮어쓰므로 나머지는 그 뒤에 채운다.
- 텍스트: `name`, `email`, `phone`, `org`, `urls[GitHub]`, `urls[Portfolio]`. 질문: `cards[<uuid>][fieldN]` (select·textarea). 라벨은 `.application-question` 안에 있다.
- 현재 위치 `#location-input` 은 자동완성 선택이 필요하다. 선택 사항이면 비워 둔다(텍스트만 남기면 검증에 걸린다).
- 국가 select 값은 `Korea South` 형식이다.
- 학력 선택지에 전문학사가 없으면 가장 가까운 것을 고르고, 자유 기재 칸에 실제 학위를 적는다.
- 제출 `#btn-submit` → `/thanks` 에 "Application submitted!".

## Greenhouse (job-boards.greenhouse.io/<co>/jobs/<id>)

- 선택 상자는 react-select라 **Chrome 스크립트 이벤트로는 열리지 않는다.** Paseo 브라우저에서 combobox를 `browser_click` 으로 연 뒤, 열린 메뉴의 옵션(`react-select-<questionId>-option-N`)은 JS `.click()` 으로 골라도 된다.
- 텍스트(`#first_name`, `#last_name`, `#email`)는 select를 조작한 뒤 초기화될 때가 있다. 제출 직전에 native setter + `input`/`change`/`blur` 로 다시 넣고 값을 확인한다.
- 이력서: `browser_upload` 를 Attach 옆 `textbox "Attach"` ref에 쓴다.
- 체크박스형 필수 질문(이전 지원 이력, 개인정보 동의)은 사실 확인이 필요하다. 추정했다면 보고에 적는다.
- 제출 후 `/confirmation` 에 "Thank you for applying".

## HRMOS (hrmos.co/pages/<co>/jobs/<id>/apply)

- 필수: 이름, 이메일, 이력서. 메시지, 지원 경로(Job Board) 체크 → "Confirm details" → 확인 화면에서 제출.

## 코딩 테스트형 (예: challenge.hennge.com)

- 등록 폼: 이메일, 거주국(Semantic UI dropdown `div.item` 클릭), 직무 유형 라디오, **지원 포지션 드롭다운**(직무 유형을 고르면 나타난다), 약관 링크를 열면 동의 체크가 자동으로 켜짐, 보이지 않는 reCAPTCHA.
- 드롭다운이 열린 채면 Submit 클릭이 막힌다. 제목을 클릭해 닫고 누른다.
- 등록까지만 한다. 테스트는 사용자가 직접 푼다.
