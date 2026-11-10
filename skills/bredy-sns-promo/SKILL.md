---
name: bredy-sns-promo
description: 브리디에 올라온 무료 분양글·진행 중 경매를 골라 홍보 카드(1080×1350)를 만들고 인스타(bredy_breeder)·스레드(bredy_breeder)·X(자동화 크롬에 로그인된 계정)·네이버 블로그(bredy_team) 4곳에 올린 뒤 실제로 올라갔는지 확인한다. 사용자가 '무료 분양 홍보해줘', '경매 홍보 올려줘', '분양글 SNS에 올려', '인스타 스레드 X 블로그에 올려줘', '브리디 매물 홍보' 등을 요청할 때 사용한다. 틱톡은 올리지 않는다(2026-10-21 사용자 결정). 영업 DM 은 bredy-instagram-outreach, 카페 댓글은 bredy-cafe-activity.
---

# 브리디 매물 SNS 홍보

작업 폴더 `~/Desktop/pro/bredy-marketing`. 브라우저는 브리디 자동화 크롬(9222)의 자기 탭만 쓴다(`scripts/bpw.sh`). 사이트가 다르면 병렬로 돌려도 된다.

## 규칙 (2026-10-21 사용자 결정)
- 올리는 곳: 인스타 · 스레드 · X · 네이버 블로그. **틱톡 금지.**
- **카드 사진은 그 분양글·경매에 올라온 사진을 쓴다**(2026-10-29 사용자 "사진이 맨날 똑같다, 게시글에 있는 사진을 써야지" — 10-21 'CC0 사진만' 규칙을 바꿈). API 응답의 사진(`photos`/`image` → `https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/<id>/public`)을 내려받아 `assets/photos/listing-<id>.jpg` 로 두고 카드에 넣는다. 사람 얼굴·연락처·가격표·상호가 보이면 다른 장을 고르고, 쓸 만한 사진이 없을 때만 CC0 사진. '예시 사진' 안내 줄은 넣지 않는다.
- 카드에 버튼 모양을 넣지 않는다(눌리지 않는다). 안내는 글자로 쓴다: `앱스토어·플레이스토어에서 '브리디' 검색 · 프로필 링크`.
- 용어: 무료나눔 X → 무료 분양, 판매·구매 X → 분양·입양(bredy_app `docs/terminology.md`).
- 공개 게시라서 대상 목록·문구를 사용자에게 먼저 보여 주고 승인을 받은 뒤 올린다.

## 1. 대상 고르기
- 무료 분양: hycli `list-products`(`price: 0`, `status: 판매중`).
- 경매: `curl -s "https://bredy.app/api/auctions?page=1&size=3&status=진행중"`. 진행 중인 것만 홍보한다(끝난 경매는 의미가 없다). 마감 시각은 KST 로 바꿔 적는다.

## 2. 카드 만들기 — 도감 카드 틀 (2026-11-10 사용자 A안 채택, `docs/instagram-brand.md`)
피드 카드는 전부 `cards/feed-card.mjs` 하나로 만든다(옛 `simple-card.mjs`·`auction.mjs`·`promo.mjs` 는 쓰지 않는다). 종이색 바탕 위 흰 카드, 경매만 검정 카드, 주황은 가격·강조 단어·pill 에만. 마스코트·AI 이미지·버튼 모양 금지.
```bash
node cards/feed-card.mjs product <분양글 id> output/<폴더>      # 01.png 카드 + 02~.png 추가 사진(캐러셀)
node cards/feed-card.mjs auction <경매 id> output/<폴더>        # 검정 카드, 마감·시작가 자동(끝난 경매는 멈춤)
node cards/feed-card.mjs post <게시글 id> output/<폴더>         # 회원 질문·자랑글: 사진 + 제목 + 본문 두 줄(크루 계정 id 99~148 글은 제외)
node cards/feed-card.mjs text output/<폴더> 가이드 $'크레스티드 게코\n*사육 가이드*' "온도 · 습도 · 먹이"   # *별표* 가 주황
sips -Z 400 output/<폴더>/01.png --out /tmp/preview.png   # Read 로 열어 사진·이름이 제대로 나왔는지 확인
```
- 제목은 회원이 쓴 그대로 나온다(`cleanTitle` 이 '분양합니다·저렴하게' 만 뺀다). "spt" 처럼 거칠면 이름이 제대로 적힌 글을 고르거나, JSON 을 내려받아 `title` 만 고쳐서 넘긴다.
- 사진이 흐리거나 개체가 작게 나온 글은 고르지 않는다 — 디자인으로 못 가린다.

### 경매 스토리 카드 (2026-11-10 사용자 "Repbox 참고해서 꾸준히")
경매는 피드 카드와 함께 스토리 카드(1080×1920)도 만든다. 마감 시각(KST 오늘/내일/날짜)·현재가·입찰 수는 API 값으로 채우고, 정보 줄·한 줄 소개는 경매 설명에서 뽑는다(없으면 비운다 — 성별·해칭일·무게를 지어내지 않는다).
```bash
curl -s "https://bredy.app/api/auctions/<id>" > output/<폴더>/a.json
node cards/auction-story.mjs output/<폴더>/a.json output/<폴더>/story.png "수컷 | 26.08.13 해칭 | 4g" "한 줄 소개"
node scripts/post-story.mjs output/<폴더>/story.png      # 인스타 스토리
```
기본 색은 다크(검정 배경·주황 하나, 11-10 사용자 선택), `STORY_THEME=orange|cream` 로 바꿀 수 있다. 마감이 지난 경매는 스크립트가 멈춘다. 진행 중 경매가 여러 개면 한 장씩 따로 올린다(Repbox 처럼 연속 스토리).

## 3. 글 파일
- `caption.txt` (인스타): 소개 몇 줄 → 빈 줄 → `👉 앱스토어·플레이스토어에서 '브리디' 검색` / `(프로필 링크로도 바로 가요)` → 해시태그 5개.
- `threads.txt` (스레드, 2026-11-10 반응 상위 100 실측 — `~/Desktop/pro/bredy-marketing/docs/threads-playbook.md` §2-1): 해시태그·링크·앱 검색 안내 없이 4줄 안팎 반말. 글 하나에 노리는 반응 하나 — 경매는 '응원·댓글'(예: "이 아이 시작가 1만원인데 아직 첫 입찰이 없어 ㅠㅠ / 마감 내일 밤이야 / 너네라면 얼마 부를 것 같아"). 홍보 문구·교훈 맺음 금지.
- `x.txt`: 한글은 2자로 세서 280자를 넘지 않게 짧게 쓰고, 해시태그는 2개만 넣는다.
- 블로그 `blog/<날짜>/body.txt`: 여러 건을 한 글로 묶는다.

## 블로그 쿠팡 파트너스 링크 (2026-10-22 사용자 결정)
네이버 블로그(bredy_team) 글에는 **정보글·분양·경매 홍보글 모두** 관련 용품 쿠팡 파트너스 링크를 **하나만** 넣는다(구글 애드센스는 네이버 블로그에 못 넣고, 생물 거래 글에 넣으면 AdMob 계정까지 위험해서 쓰지 않는다).
- 링크 만들기: `bash ~/Desktop/pro/bredy-marketing/scripts/coupang-link.sh "<검색어 또는 쿠팡 주소>"` → `https://link.coupang.com/a/...`(트래킹 AF2109367, 자동화 크롬 파트너스 로그인 사용). 검색어는 글 주제 용품(예: `크레스티드게코 슈퍼푸드`, `게코 사육장`, `거북이 여과기`). 생물 자체는 링크하지 않는다.
- 위치: 본문 끝, 브리디 안내 줄 **앞**. `🛒 같이 쓰면 좋은 용품: <링크>` 한 줄 → 빈 줄 → 대가성 문구 → 빈 줄 → 브리디 안내(맨 마지막).
- 대가성 문구(빼면 공정위 표시 위반): `이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.`
- 카페 댓글·인스타·스레드·X 에는 쿠팡 링크를 넣지 않는다(블로그만).

## 4. 올리기
```bash
zsh  scripts/post-carousel.sh <caption.txt> <card.png>                  # 인스타
bash scripts/threads-media.sh <threads.txt> pets <card.png>     # 스레드 (주제는 스크립트가 항상 pets 로 고정, 2026-10-25)
bash scripts/x-post.sh <x.txt> <card.png>                               # X
python3 blog/naver-photos.py <body.txt> "<제목>" "브리디 소식" "태그,태그" <카드...>   # 블로그
```

## 5. 실제로 올라갔는지 확인 (스크립트 출력만 믿지 않는다)
- 인스타: `post-carousel.sh` 가 고정 게시물을 건너뛰고 캡션 첫 줄이 맞는 글 주소를 출력한다. '못 찾음'이면 프로필에서 직접 본다.
- X: 게시 뒤 프로필(`x.com/<계정>`) 첫 글이 방금 쓴 첫 줄인지 본다.
- 스레드·블로그: 출력된 글 주소를 연다.
- 보고에는 곳마다 주소를 적고, 확인하지 못한 곳은 그렇다고 쓴다.

## 고친 기록
- X 는 10-21 고침: compose 화면엔 입력칸이 둘(홈·팝업)이라 `[role=dialog]` 안에서 찾고, 사진은 `input[type=file]` 에 직접 넣고, 게시 버튼 클릭은 가려져 막히므로 ⌘+Enter 로 게시한다.
- 인스타 주소는 10-21 고침: 프로필 맨 앞 고정 게시물 3개를 건너뛴다.
