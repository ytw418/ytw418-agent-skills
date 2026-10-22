---
name: naver-cafe-revamp
description: 오래되거나 비어 있는 네이버 카페를 새 주제 카페로 개편한다(예 게임천국→로봇천국, 곤충 키우기→외국곤충연구회). 이름 후보 판단과 법·정책 확인부터 설계 문서, 기본정보(이름·설명·주제·검색어·아이콘), 멤버 등급, 메뉴(그룹·게시판·등업·보관함), 타이틀 배너·아이콘·대문 이미지 제작과 적용, 상단메뉴, 가입 질문, 글양식, 공지 3종, 옛 글 이동·삭제, 비로그인 확인까지 한다. 사용자가 '카페 만들어줘', '내 카페 ○○로 바꿔줘', '카페 개편', '카페 리뉴얼', '로봇 카페 만든 것처럼', '카페 이름 뭘로 하지', '카페 메뉴 다시 짜줘', '카페 대문·배너 만들어줘' 등을 요청할 때 사용한다. 이미 개편된 카페에 매일 글을 올리는 일은 robot-cafe-content, 남의 카페에 댓글 다는 일은 bredy-cafe-activity 담당.
---

# 네이버 카페 개편

## 준비

- 브라우저는 브리디 자동화 크롬(CDP 9222) 하나다. 네이버 계정은 본계정 ytw418 하나뿐이라(10-19 사용자) 카페도 여기서 한다. playwright 세션 `robot-cafe` 로 붙어 자기 탭만 쓰고(robot-cafe-content 의 `ensure-browser.sh` / `release-browser.sh`), 네이버 잠금 `/tmp/bredy-chrome-locks/naver` 를 잡는다. 옛 전용 프로필 `~/Desktop/pro/robot-cafe/.chrome-profile` 은 안 쓴다.
- 카페 찾기: 로그인한 세션에서 `apis.naver.com/cafe-home-web/cafe-home/v1/cafes/join?page=1&perPage=100&type=join` 을 fetch 해 `manageCafe:true` 와 이름으로 고른다. 기본 정보는 `apis.naver.com/cafe-web/cafe2/CafeGateInfo.json?cluburl=<주소>`(clubid·개설일·멤버 수), 메뉴는 `SideMenuList?cafeId=<C>`.
- 작업 폴더 `~/Desktop/pro/<카페 이름>/` 을 만들고 변수를 정한다.

```bash
export NC_HOME=~/Desktop/pro/insect-cafe NC_CLUB=16902363 NC_SESSION=robot-cafe
S=~/.claude/skills/naver-cafe-revamp/scripts
$S/ensure-login.sh        # 0 준비됨 / 2 사람이 로그인해야 함(캡차·2단계 인증) → 사용자에게 알리고 멈춘다
```

## 순서

1. **조사·판단** — 주제의 법·플랫폼 정책을 공식 자료(법령 원문, 부처 보도자료)로 먼저 확인한다. 사용자의 전제("곧 합법화된다" 등)가 근거 없으면 그대로 말한다. 거래가 불법·회색지대면 이름에 '장터'·'마켓'을 넣지 않고, 장터는 합법 품목만 연다. 비슷한 대형 카페의 메뉴·등급·수익 구조를 2~3개 본다.
2. **이름 정하기(사용자 확인 필수)** — 후보마다 장단점과 추천을 붙여 `AskUserQuestion` 으로 묻는다. 이름·주제는 바꾸면 3개월 잠기고, 카페 주소는 영영 못 바꾼다는 점을 같이 알린다. 형식은 `이름 - 검색키워드·키워드` 로 60byte 안(한글 2byte).
3. **설계 문서** — `$NC_HOME/설계.md`: 카페 정보, 법 상황 표(출처), 기본정보(이름·설명 100byte·주제·검색어 10개), 등급 6단계 표(주제에 맞는 이름, 자동등업 조건, 판매 글은 3번째 등급부터), 메뉴 트리, 글양식 목록, 운영 규칙, 로드맵. 기존 메뉴는 이름·종류만 바꿔 재사용하고, 빈 업체·제휴 게시판은 만들지 않는다.
4. **이미지** — `assets/design.template.html` 을 `$NC_HOME/assets/design.html` 로 복사, 폰트(`~/Desktop/pro/bredy-marketing/assets/fonts`)를 `$NC_HOME/assets/fonts/` 로 복사, 색·문구·마스코트를 바꾼 뒤 `node $S/render.mjs design.html "#banner=banner.png" "#icon=icon.png" "#gate=gate.png"`. PNG 를 직접 열어 잘림·겹침을 본다.
5. **적용** — `references/procedure.md` 의 화면별 절차대로. 각 단계는 저장 알림을 확인하고 다시 열어 값을 검증한 뒤 다음으로 간다.
   1. 기본정보(+모바일 아이콘)
   2. 멤버 등급
   3. 메뉴 — `assets/menu-apply.template.js` 를 `$NC_HOME/menu-apply.js` 로 복사해 이 카페의 메뉴 id 로 고치고 `pwr eval "$(cat menu-apply.js)"` → 결과의 `missing=[] notInOrder=[]`·`ERR` 없음 확인 → 상단 `저장하기` → 실제 id 기록
   4. 옛 글: `list-articles.sh` 로 확인 → `move-articles.sh` 로 보관함 이동. 외부에 보이면 안 되는 글의 삭제는 제목·번호를 보여 주고 사용자 확인 뒤 `delete-articles.sh`
   5. 타이틀 → 대문(이미지 + 게시판 링크 + 규칙 경고) → 상단메뉴 8칸 → 가입 안내·질문
   6. 글양식 — `$NC_HOME/forms/forms.json`(`assets/forms.example.json` 형식) → `make-form.sh 0..n` → 글쓰기 화면에서 한 게시판 확인
   7. 공지 3종 — 새 출발 안내(전체 공지), 운영 규칙(필독), 주제의 법·정책 정리(필독, 출처 링크) → `notice.sh 1 "<제목>" notices/<n>.txt "<종류>"`
6. **확인** — `node $S/anon-check.mjs https://cafe.naver.com/<주소> <공지 주소>` 로 비로그인 화면을 캡처해 직접 본다.
7. **기록·보고** — `설계.md` 끝에 '적용 결과'(등급 코드, 메뉴 id 전부, 상단메뉴, 공지 글번호, 남은 문제)를 적는다. 보고는 한국어로: 바뀐 것, 사용자 전제와 다른 사실, 남은 결정(옛 글 삭제 등). 사용자 몫의 결정이 남으면 `~/Desktop/pro/personal-todo/todo.md` 에 한 줄 추가.

## 주의

- 되돌리기 어려운 것은 사용자 확인 뒤에만 한다: 카페 이름·주제 저장(3개월 잠김), 글 삭제, 가입 방식·공개 여부 변경.
- 탭은 작업마다 열고 닫는다. 업로더 팝업 탭은 자동으로 닫히지만 `ManageMemberLevelUpBoardAddPopup` 같은 안내 팝업은 직접 닫는다.
- 공지·정보 게시판은 읽기 전체공개(0), 장터·신고 게시판은 멤버만 읽기(1), 판매 글은 중간 등급부터 쓰기.
- 카페 수익화(광고 신청·공동구매·제휴비)는 사용자의 사업자등록·지원금 일정과 얽히므로 설계 문서의 로드맵에만 적고 실행하지 않는다.
