# 관리 화면별 조작 절차

로봇천국(2026-10-17, clubid 16729678)·외국곤충연구회(2026-10-18, clubid 16902363) 개편에서 실제로 성공한 방법만 적었다. `<C>` 는 clubid. 명령은 `source scripts/env.sh` 뒤의 `pwc`·`pwr`·`snap`·`ref`·`bgclick` 기준.

목차: 0 공통 · 1 기본정보 · 2 멤버 등급 · 3 메뉴 · 4 타이틀 · 5 대문 · 6 상단메뉴·스킨 · 7 가입 조건 · 8 글양식 · 9 공지 · 10 옛 글 이동·삭제 · 11 비로그인 확인

## 0. 공통

- ref 는 `f41e24` 처럼 앞(프레임)이 페이지를 열 때마다 바뀐다. 화면이 바뀌면 `snap` 을 다시 찍고 `ref '<패턴>'` 으로 다시 얻는다.
- 저장 성공은 항상 alert "성공적으로 반영 되었습니다." 하나다. 알림창을 띄우는 클릭은 `bgclick <ref>` 로(백그라운드 클릭 → `dialog-accept`). 알림이 없으면 조용히 실패한 것 — 다시 열어서 값을 확인한다.
- 수정 중인 관리 화면에서 `goto`·`reload` 하면 beforeunload 확인창이 뜬다. 명령이 멈추면 `pwc dialog-accept`.
- 사진 업로드는 모두 새 탭 팝업(프로필업로더·포토업로더). `pwc tab-list` → `pwc tab-select <팝업 번호>` → 파일 선택 모달을 띄운 뒤 `pwc upload <파일>` → 팝업의 등록/올리기 → `tab-select` 로 원래 탭.
  - 파일 선택 모달 없이 `upload` 하면 `can only be used when there is related modal state` 오류. 포토업로더는 숨은 `input#pc_image_file` 을 `pwc eval "document.getElementById('pc_image_file').click()"` (백그라운드)로 눌러야 모달이 뜬다. 프로필업로더는 `button "Choose File"` 클릭.
- 바이트: 한글·`·`·『』·♡ 는 2byte, 영문·공백·숫자 1byte.

## 1. 기본정보 — `https://cafe.naver.com/ca-fe/admin/cafes/<C>/base-info-management`

- 구형 `ManageBaseInformation.nhn` 의 iframe 안에서 저장하면 알림 없이 원복된 적이 있다. 위 주소를 직접 연다.
- `snap 'textbox|combobox|byte'` 로 칸을 찾는다: `textbox "카페 이름"`(60byte), `textbox "카페명"`(모바일 10자), 설명 textbox(100byte), `combobox "주제"` + 소분류 combobox, 검색어 textbox + `link "검색어 등록"`(10개, 각 20byte).
- 이름 칸 아래 "마지막 변경일"과 "3개월 이후에 수정" 문구를 먼저 확인한다. 저장하면 3개월 잠긴다(개설 직후 2회 예외).
- 주제: 대분류 `pwc select <ref> "반려동물/동물"` 후 1초 쉬면 소분류 옵션이 바뀐다 → 다시 select.
- 검색어: 칸마다 `pwc fill <칸> "<키워드>"; pwc click <검색어 등록>` 반복.
- 모바일 아이콘: `link "편집"` → 프로필업로더 탭 → `Choose File` → upload icon.png(150×150, 500KB 미만) → `img "프로필 사진 등록"` 클릭 → 팝업이 닫힘.
- `저장하기`(strong 텍스트의 부모 link, 못 찾으면 strong ref 를 그대로 클릭해도 된다) → 알림 확인 → `CafeGateInfo.json?cluburl=<주소>` 로 이름·모바일명·아이콘 확인.

## 2. 멤버 등급 — `https://cafe.naver.com/ManageMemberLevel.nhn?clubid=<C>`

- 등급을 안 쓰던 카페는 `checkbox "등급사용"` 을 먼저 클릭하면 6행(기본 새싹·일반·성실·열심·우수·감사멤버)이 나온다.
- 행마다 이름 textbox, 설명 textbox, 등업방식 combobox(설정안함/자동등업/등업게시판). 첫 행은 콤보가 없다.
- 콤보를 `자동등업`·`등업게시판` 으로 바꾸면 조건칸 5개(게시글·댓글·방문·좋아요·가입 주)가 **그 행 이름·설명 다음, 콤보 앞**에 생긴다 → `snap` 다시. 조건칸 ref 는 연속 번호라 `f..e212..e216` 처럼 한 번에 채울 수 있다.
- 하단 `저장하기` → 알림. 다시 열어 값 확인.
- 등업게시판 방식을 쓰면 저장 후 "메뉴관리에서 신청게시판을 추가해주셔야 합니다" 팝업 탭(`ManageMemberLevelUpBoardAddPopup.nhn`)이 열린다 → `취소` 로 닫고 메뉴에서 등업게시판을 추가한다.
- 등급 코드는 메뉴 권한 select 의 value 로 확인: 보통 `1, 110, 120, 130, 140, 150, 888(스탭), 999(매니저)`, 읽기 권한 `0`=전체공개.

## 3. 메뉴 — `https://cafe.naver.com/ca-fe/admin/cafes/<C>/menu-management`

- Vue2 스토어: `s=document.querySelector('#app').__vue__.$store`, `NS='admin/menuManagement/'`, `mm=s.state.admin.menuManagement`. 목록은 `mm.menuList.map(m=>m.id+':'+m.code+':'+m.name)`. code: GROUP·NORMAL·WEBZINE·ALBUM·MEMO·LEVELUP·ATTENDANCE·SEPERATOR·MARKET·STAFFNORMAL.
- 설정 변경: `selectMenu({menu,isAppending:false})` → `updateSelectedMenuConfig(cfg)` → `selectedMenuConfig.errorMessage` 확인. 통합게시판은 `menuCode` 로 NORMAL/WEBZINE/ALBUM 을 바꿀 수 있다.
- 추가: 붙일 위치의 메뉴를 select → 왼쪽 팔레트 링크(`통합게시판`·`그룹 제목`·`등업게시판`·`스탭게시판`·`메모게시판`·`출석부`·`구분선`·`상품등록게시판`)를 **DOM 에서 click** → `addMenu(s.getters[NS+'selectedMenuType'])`. 새 메뉴는 임시 id(-1, -2…)로 선택된 상태가 되므로 바로 `updateSelectedMenuConfig`. 등업게시판·출석부는 1개만.
- 순서: 모든 메뉴 id 를 빠짐없이 나열해 `s.commit(NS+'setMenuList', ids.map(byId))` (`assets/menu-apply.template.js` 가 누락·잔여를 검사한다).
- 삭제: `s.dispatch(NS+'removeMenu',m)` 을 **await 없이** 부른 뒤 사이트 모달 `.ModalLayer button` '확인' 클릭. `window.confirm` 덮어쓰기로는 안 된다.
- 저장: 반드시 화면 상단 `link "저장하기"` 를 클릭(`bgclick`). `s.dispatch(NS+'save')` 를 직접 부른 뒤 버튼을 또 눌러 메뉴가 두 번 생긴 적이 있다. 저장 뒤 menuList 를 다시 찍어 실제 id 를 기록한다.
- 템플릿은 `window.confirm/alert` 를 잠깐 덮어쓰고 끝에서 되돌린다. 되돌리지 않으면 저장 성공 알림이 사라진다.
- 상품등록게시판은 거래종류(개인거래 value A)를 저장 전에 골라야 하고 나중에 못 바꾼다. 살아 있는 생물·법적 회색지대 상품이면 열지 않는다.

## 4. 타이틀 — `https://cafe.naver.com/ManageLogoUserImageView.nhn?clubid=<C>` (가로 1080, 세로 50~340)

- `사진 첨부하기`(generic ref) 백그라운드 클릭 → 포토업로더 탭 → `pc_image_file` 클릭 → upload banner.png → `button "올리기"` → 원래 탭 → `바로적용` 링크 `bgclick` → 알림.
- 확인: 카페 홈 HTML 에 `banner.png` 가 있는지 fetch.

## 5. 대문 — `https://cafe.naver.com/ManageGateEditor.nhn?clubid=<C>` (안쪽 폭 약 840)

- 편집기는 `iframe[name=cafe_main]` 안, 본문은 그 안의 iframe.
- `사진` 링크 → 포토업로더 → gate.png 업로드 → 올리기 → 본문에 `<img … width="840" height="300">` 이 들어간다(그 URL 을 아래 HTML 에 쓴다).
- `checkbox "html"` 클릭 → 보이는 textarea 값을 통째로 교체하고 input·change 이벤트 → `html` 다시 클릭 → `바로적용` → 알림.
- 대문 링크 형식: `https://cafe.naver.com/f-e/cafes/<C>/menus/<메뉴id>` (target=_blank). 이미지 + 그룹별 게시판 링크 + 규칙 경고 한 줄이면 충분하다.

## 6. 상단메뉴·스킨

- 상단메뉴 `https://cafe.naver.com/ManageLayout.nhn?clubid=<C>`: combobox 8개(ref 가 2씩 증가)에 게시판 이름을 select, 안 쓰는 칸은 `사용하지 않음` → `바로적용` → 다시 열어 `[selected]` 확인.
- 스킨 `ManageSkin.nhn?clubid=<C>`: 썸네일 클릭 → `바로적용`. 기존 스킨 색이 배너와 맞으면 건드리지 않는다.

## 7. 가입 조건 — `https://cafe.naver.com/ManageJoinCondition.nhn?clubid=<C>`

- 가입 안내 textbox 140byte. 가입 질문 최대 3개, 객관식 보기 최대 5개.
- 질문 형식 combobox 를 `객관식` 으로 → `textbox "클릭하면 추가"` 클릭 → `type` → `press Tab`. **보기를 추가할 때마다 이 칸의 ref 가 바뀐다** → 매번 `snap` 후 마지막 "클릭하면 추가" ref 를 다시 얻는다(고정 ref 로 반복하면 보기가 한 칸에 합쳐진다).
- `button "질문 추가하기"` 로 질문 추가, 필요 없는 질문은 `button "삭제"`.
- 하단 `저장하기` → 알림 → 다시 열어 질문·보기 확인. 가입 방식(바로/승인)은 계획에 없으면 건드리지 않는다.

## 8. 글양식 — `scripts/make-form.sh <index>`

- `$NC_HOME/forms/forms.json` 형식은 `assets/forms.example.json`. 적용 게시판 이름은 메뉴 이름과 정확히 같아야 한다.
- 결과 줄의 `guide=false body=false` 는 무시해도 저장된다. 확인은 `ca-fe/cafes/<C>/articles/write?boardType=L&menuId=<id>` 에서 `button "게시판을 선택해 주세요."` → 그 게시판을 고른 뒤 `.se-text-paragraph` 와 "게시판 안내를 확인해 주세요!" 문구를 본다(menuId 만으로는 양식이 안 채워진다).
- 게시판 유형별 최대 20개. 상품등록게시판 양식은 탭·항목이 다르다.

## 9. 공지 — `scripts/notice.sh <공지게시판id> <제목> <본문.txt> <종류>`

- 본문은 한 줄씩 입력(typebody.sh). 줄 시작의 `1. `·`① ` 는 자동 목록이 켜져 글이 섞인다 → `■`·`- ` 로 쓴다. URL 줄 뒤에는 미리보기 카드가 붙을 때까지 3초 쉰다.
- `공지로 등록` 체크는 `#notice` 의 label 을 DOM 에서 클릭해야 한다. 필독 공지 최대 2개.
- 본문 대조가 `mismatch 0` 이 아니면 스크립트가 등록하지 않고 멈춘다.

## 10. 옛 글 이동·삭제

- 확인: `scripts/list-articles.sh` (번호·게시판·제목·작성자·날짜).
- 이동: `scripts/move-articles.sh <원본id> <목적지id> <번호,번호>` → "게시글이 이동되었습니다." 팝업 방식(`ArticleMove.nhn` window.open·확인창)은 세션을 멈추게 했다.
- **숨김·스탭 게시판으로 옮겨도 비로그인 전체글보기에 제목이 계속 보인다.** 외부에 보이면 안 되는 글은 사용자 확인을 받고 지운다.
- 삭제: `scripts/delete-articles.sh <게시판id> <번호>...` — 목록에서 `check_<번호>` 만 체크하고, 체크된 것이 요청과 정확히 같을 때만 `삭제` → confirm 수락. 반영이 몇 초 늦을 수 있어 list-articles.sh 로 다시 본다.

## 11. 비로그인 확인 — `node scripts/anon-check.mjs https://cafe.naver.com/<주소> <공지 주소>...`

- `/tmp/nc_anon_home.png` 를 열어 타이틀·상단메뉴·대문·게시판 묶음·공지가 보이는지, 옛 글 제목이 남았는지 눈으로 확인한다.
- `login-wall true` 면 그 게시판 읽기 권한이 멤버 이상이다(공지·정보 게시판은 전체공개 0 으로 둔다).
