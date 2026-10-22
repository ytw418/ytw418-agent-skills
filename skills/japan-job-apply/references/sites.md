# 구직 사이트별 메모

## Japan Dev (japan-dev.com) — 주력

- 2019년 공개, Eric Turner 운영. 채용 성사 시 회사가 비용을 내는 구조라 구직자는 무료. Mercari·PayPay·Money Forward 등이 공고를 올린다.
- 가입: `/signup` (Google 또는 이메일+비밀번호, 사용자가 직접). 2단계 Profile 폼이 이어진다. 프로필: `/user/profile`.
- 프로필 폼은 Vue다.
  - 텍스트: native setter + `input` 이벤트.
  - 국가·기술: vue-select. `#vsN__combobox input` 에 값 넣고 `mousedown` → `#vsN__option-K` 에 `mousedown`+`click`.
  - 일본어·경력·공개 여부: `ul.form__pretty-select > li` 클릭. Vue 반영이 비동기라 클릭 후 다시 읽어 확인한다.
  - 기술(Engineering)을 고르면 **세부 분야 전체가 자동 선택**된다. `#vs3__combobox button.vs__deselect` 를 한 번에 하나씩(호출마다 0.4초 간격) 지워 Front-end·Web/Full-stack만 남긴다.
  - 이력서: `input[name="applicant[resume]"]` 에 `scripts/upload_js.sh` 로 붙인다.
- 저장 후 `/user/profile` 의 Edit로 직함·영어 수준·GitHub를 채운다. 섹션별로 Save가 따로 있어 하나씩 누른다.
- 공고 상세의 "Apply Now" → 모달에 프로필 값이 미리 채워진다. 자격 미달이면 `⛔ This job requires at least Senior experience ⛔` 가 뜬다. 이것을 선별 신호로 쓴다.
- Chrome 자동번역이 켜져 있으면 텍스트가 한국어로 바뀐다. 텍스트 매칭은 영어·한국어를 둘 다 넣거나 id·class로 찾는다.

## TokyoDev (tokyodev.com)

- 첫 화면에 로그인 버튼이 없다. `/sign_in` 에 이메일을 넣으면 토큰 메일이 온다. **등록 안 된 이메일이어도 "보냈다"고만 뜨고 메일은 오지 않는다.** 뉴스레터 구독이나 지원으로 이메일이 먼저 등록돼야 한다.
- 프로필: `/profile/new` (로그인 필요).
- 지원은 로그인 없이 된다. 공고의 "APPLY FOR THIS POSITION"(모달 `#modal-apply`) → "Continue applying" `/c/<co>/j/<job>/applications/new` → 회사 ATS로 리다이렉트.
- 프론트엔드 목록: `/jobs/frontend`. 공고 링크: `/companies/<co>/jobs/<slug>`.

## CareerCross (careercross.com/en) — 보조

- JAC Recruitment 계열. 외국계·영어 사용 일자리 위주라 비즈니스 영어나 일본 거주 요건이 많다. 개발자 전용 사이트가 아니다.
- 프로필 편집: `/en/resume/edit/<profileId>`. 섹션마다 `Add …` 링크 → `<section>_form_new` 폼 → `<section>_save_new` 버튼 구조.
  - 경력: `experiences[new][...]`, 날짜는 `YYYY-MM-DD`, 요약은 영문·일문 두 칸.
  - 학력: `educations[new][degree|institution_ja|institution_en|course_*|faculty_*|location_*|end_date]`. degree 값은 1 고졸 / 2 Technical/Vocational / 3 Associate / 4 Bachelor / 5 Post Grad.
  - 기술: `/en/user/skills-edit` 로 이동. `skill[ID]` 라디오(0 None / 1 Novice / 2 Intermediate / 3 Advanced), 라벨은 `.form-group .control-label`. React·TypeScript 항목이 없어 `Other (Open Source)` 로 대신한다.
  - 추가 정보: `additional_en`, `additional_ja` (기술 스택·어학·링크).
- 공개 범위: `input[name=visibility]` 0 = Hidden, 2 = Visible(스카우트 받음).
- 문서 업로드: `/en/document/add` 의 `#document_upload input[name=document]` → 바이러스 검사 중 `Pending...` 표시.
