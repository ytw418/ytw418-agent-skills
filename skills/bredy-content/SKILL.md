---
name: bredy-content
description: 브리디(bredy.app) 인스타그램·쓰레드용 마케팅 콘텐츠(카드뉴스 이미지 4:5, 15초 릴스 영상 9:16)를 브랜드 템플릿으로 만들고, 영업 멘트·콘텐츠 캘린더·자동 게시 설계를 다룬다. 사용자가 '브리디 카드뉴스', '브리디 릴스', '인스타 콘텐츠 만들어줘', '오늘 콘텐츠', '쓰레드 게시물', '분양/경매/동네 브리더/혈통 홍보', '마케팅 자동화', '영업 멘트' 등을 요청할 때 사용한다.
---

# 브리디 콘텐츠 제작 스킬

작업 폴더: `~/Desktop/breeder/bredy-marketing` (이하 `$MK`). 전체 설명은 `$MK/README.md`.
앱 소스: `~/Desktop/breeder/bredy_app` (기능 사실 확인용).

## 0. 시작 전 (항상)
1. `$MK/docs/facts-and-rules.md`를 읽는다. **확인된 사실만** 문구에 쓰고, 표의 ⚠ 항목과 "쓰지 말 것"을 지킨다.
2. 새 기능을 홍보하려면 앱 소스/PRD(`bredy_app/docs/prd/`, `src/app/`)에서 근거를 찾고 사실표에 추가한다. 근거가 없으면 쓰지 않고 사용자에게 묻는다.
3. 주제가 정해지지 않았으면 `$MK/docs/content-strategy.md`의 비율·캘린더·훅 공식으로 제안한다.

## 1. 카드뉴스 (1080×1350 PNG)
1. `$MK/cards/cards.mjs`에 `triple('set-이름', [슬라이드1, 슬라이드2, 슬라이드3])` 또는 `sets['pinned-…']` 단일 카드를 추가한다. 기존 세트(`set-bloodline/adoption/auction/neighborhood`)를 복사해 수정하는 것이 가장 빠르다.
   - 구성: 1장 훅(고민 질문) → 2장 3단계/3가지 → 3장 CTA(`bredy.app 에서 시작하기`)
   - 테마: `''` 크림, `'orange'`, `'dark'`. 폰 화면은 `phone('shot.jpg','i')` 또는 `phone('auctions.jpg','a')`
2. 처음이면 `cd $MK/cards && npm install`. 생성: `node cards.mjs $MK/output/<YYYY-MM-DD>/cards` 후 `_html` 폴더 삭제.
3. 결과 PNG를 직접 열어 확인한다: 글자 겹침, 칩/버튼이 다른 요소를 가리는지, 줄바꿈. 겹치면 `top`/`font-size`를 조정하고 다시 만든다.

## 2. 릴스 (1080×1920 MP4, 15초)
1. `$MK/reels/src/reels.ts`의 `reels` 배열에 설정 객체를 추가한다 (id는 `Reel…`). 훅 문구는 한 줄 9자 이내 권장, 첫 3초가 훅.
2. 처음이면 `cd $MK/reels && npm install`. 렌더: `./render.sh ReelXxx $MK/output/<날짜>/reels/이름.mp4` (약 40초).
3. 먼저 정지 프레임으로 확인해도 된다 (훅=50, 단계=150, CTA=440):
   `npx remotion still src/index.ts <ID> out.png --frame=440 --browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
4. 확인 포인트: 훅 글자 줄바꿈, CTA 버튼과 폰 화면 겹침. BGM은 넣지 않는다(인스타 앱에서 음원 추가).
5. 렌더가 간헐적으로 실패하면(getPool 오류) 같은 명령을 한 번 다시 실행한다.

## 3. 전달
- 결과물은 `$MK/output/<날짜>/{cards,reels}`에 저장하고, 사용자에게 파일을 보여준다 (SendUserFile).
- 요약에 반드시 포함: 쓴 사실 문구의 출처, 아직 **확인이 필요한 항목(⚠)**, 스크린샷 속 회원 정보 주의.

## 4. 자동 게시
- 아직 연결하지 않았다. 사용자가 요청하면 `$MK/docs/automation.md` 설계대로 진행한다.
- **사용자의 명시적 승인 없이 게시/DM 전송을 하지 않는다.** 토큰·비밀번호를 파일이나 채팅에 쓰지 않는다. 계정 연결·토큰 발급은 사용자가 직접 한다.

## 5. 영업 멘트 / 캘린더만 요청받았을 때
- `$MK/docs/content-strategy.md` 6번의 멘트를 대상에 맞게 바꿔 쓴다. 포유류(개·고양이) 분양 영업은 보류 상태이므로 만들기 전에 사용자에게 규제 확인 여부를 묻는다.

## 브랜드
오렌지 `#F97316`, 연한 배경 `#FFF4EC`, 잉크 `#191919`, 폰트 Pretendard. 말투는 친근한 "~해요". 경쟁사 디자인·문구·사진은 복제하지 않는다.
