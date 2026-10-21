---
name: bredy-sns-promo
description: 브리디에 올라온 무료 분양글·진행 중 경매를 골라 홍보 카드(1080×1350)를 만들고 인스타(bredy_breeder)·스레드(bredy_breeder)·X(자동화 크롬에 로그인된 계정)·네이버 블로그(bredy_team) 4곳에 올린 뒤 실제로 올라갔는지 확인한다. 사용자가 '무료 분양 홍보해줘', '경매 홍보 올려줘', '분양글 SNS에 올려', '인스타 스레드 X 블로그에 올려줘', '브리디 매물 홍보' 등을 요청할 때 사용한다. 틱톡은 올리지 않는다(2026-10-21 사용자 결정). 영업 DM 은 bredy-instagram-outreach, 카페 댓글은 bredy-cafe-activity.
---

# 브리디 매물 SNS 홍보

작업 폴더 `~/Desktop/pro/bredy-marketing`. 브라우저는 브리디 자동화 크롬(9222)의 자기 탭만 쓴다(`scripts/bpw.sh`). 사이트가 다르면 병렬로 돌려도 된다.

## 규칙 (2026-10-21 사용자 결정)
- 올리는 곳: 인스타 · 스레드 · X · 네이버 블로그. **틱톡 금지.**
- 회원이 올린 사진은 쓰지 않는다. `assets/photos` 의 CC0 사진만 쓴다(크레는 `crested-1.jpg`·`crested-2.jpg`가 개체가 잘 보인다. `crested-3.jpg`는 풀이 대부분이다).
- 카드에 버튼 모양을 넣지 않는다(눌리지 않는다). 안내는 글자로 쓴다: `앱스토어·플레이스토어에서 '브리디' 검색 · 프로필 링크`.
- 용어: 무료나눔 X → 무료 분양, 판매·구매 X → 분양·입양(bredy_app `docs/terminology.md`).
- 공개 게시라서 대상 목록·문구를 사용자에게 먼저 보여 주고 승인을 받은 뒤 올린다.

## 1. 대상 고르기
- 무료 분양: hycli `list-products`(`price: 0`, `status: 판매중`).
- 경매: `curl -s "https://bredy.app/api/auctions?page=1&size=3&status=진행중"`. 진행 중인 것만 홍보한다(끝난 경매는 의미가 없다). 마감 시각은 KST 로 바꿔 적는다.

## 2. 카드 만들기
```bash
node cards/simple-card.mjs "$PWD/output/<폴더>/card.png" "<태그>" "<제목1>" "<제목2(노랑)>" "<설명1>" "<설명2>" "앱스토어·플레이스토어에서 '브리디' 검색 · 프로필 링크" crested-1.jpg
sips -Z 400 output/<폴더>/card.png --out /tmp/preview.png   # Read 로 열어 사진·글자가 제대로 나왔는지 확인
```

## 3. 글 파일
- `caption.txt` (인스타·스레드): 소개 몇 줄 → 빈 줄 → `👉 앱스토어·플레이스토어에서 '브리디' 검색` / `(프로필 링크로도 바로 가요)` → 해시태그 5개.
- `x.txt`: 한글은 2자로 세서 280자를 넘지 않게 짧게 쓰고, 해시태그는 2개만 넣는다.
- 블로그 `blog/<날짜>/body.txt`: 여러 건을 한 글로 묶는다.

## 4. 올리기
```bash
zsh  scripts/post-carousel.sh <caption.txt> <card.png>                  # 인스타
bash scripts/threads-media.sh <caption.txt> 크레스티드게코 <card.png>     # 스레드 (주제)
bash scripts/x-post.sh <x.txt> <card.png>                               # X
python3 blog/naver-photos.py <body.txt> "<제목>" "브리디 소식" "태그,태그" <카드...>   # 블로그
```

## 5. 실제로 올라갔는지 확인 (스크립트 출력만 믿지 않는다)
- 인스타: `post-carousel.sh` 가 출력하는 주소는 고정 게시물일 수 있다(10-21에 10-10 게시물 주소가 나왔다). 프로필 첫 줄에서 캡션 첫 줄을 찾아 확인한다.
- X: `x-post.sh` 의 "X 게시됨" 판정은 믿을 수 없다(10-21 두 번 다 거짓 성공). 프로필이나 `from:<계정>` 검색으로 글이 있는지 본다. 없으면 게시 버튼이 사진 업로드 중에 비활성이었는지 의심한다.
- 스레드·블로그: 출력된 글 주소를 연다.
- 보고에는 곳마다 주소를 적고, 확인하지 못한 곳은 그렇다고 쓴다.

## 알려진 문제 (고칠 것)
- `x-post.sh`: 10-21 기준 글이 실제로 올라가지 않는다. 버튼 이름은 `사진 또는 동영상 추가`, `게시하기`다.
- `post-carousel.sh`: 마지막에 출력하는 게시물 주소가 틀린다.
