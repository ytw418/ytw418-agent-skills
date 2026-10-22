---
name: bredy-cafe-activity
description: 브리디 운영자 네이버 계정으로 생물 카페(물생활 홈다리·파충류 파사모·곤충 개미마을)의 최근 질문글에 정보성 답 댓글을 달고, 같은 주제로 네이버 블로그(bredy_team) 정보글을 써서 댓글 끝에 그 블로그 링크를 남긴다(블로그 글 끝에서 브리디로 연결). 질문 고르기 → 본문·댓글 읽기 → 블로그 글 발행 → 카페 댓글 → 기록·보고까지 한다. 사용자가 '카페 활동해줘', '카페 활동', '카페 질문에 답 달아줘', '홈다리 댓글', '파사모 댓글', '카페에 정보 댓글', '카페 영업' 등을 요청할 때 사용한다. 브리디 앱 안 커뮤니티에 크루 계정으로 글을 쓰는 일은 bredy-crew-activity 스킬, 인스타 DM 영업은 bredy-instagram-outreach 스킬 담당.
---

# 브리디 카페 활동

2026-10-16 사용자와 정한 방식이다. 카페에 브리디 링크를 직접 달면 '타 사이트 홍보'로 삭제·강퇴되고 네이버 스팸 판정까지 갈 수 있다. 그래서 **카페엔 진짜 도움이 되는 답 + 내 블로그 정보글 링크**만 남기고, 블로그 글 끝에서 브리디로 넘어가게 한다. 홈다리 '표'(PYO AQUA LAB)가 자기 블로그 글로 신뢰를 쌓는 방식을 참고했다.

## 카페

| 카페 | 주소 | clubid | 상태 |
|---|---|---|---|
| 홈다리 (열대어, 24만) | cafe.naver.com/hby | 10135947 | 가입됨. 규칙상 홍보·타사이트 홍보·경매 유도 금지 → 브리디 링크 금지 |
| 파사모 (파충류) | cafe.naver.com/reptilia | 12440585 | 가입됨. 질문 양식(사진·사육 환경·급여일·증상) 있음 |
| 개미마을 (곤충류 2위, 1.9만) | cafe.naver.com/antavillage | 26294255 | 가입 전. 가입 질문이 성별·나이·거주지(시군) — **사용자가 직접 답해야 한다.** 가입 후 글 1개·댓글 3개면 등업 |
| 곤충아카데미 (곤충류 1위) | cafe.naver.com/insectacademy2 | 21576194 | 제외(사용자 결정). 질문 게시판이 6촌패밀리 이상이고 우리는 8촌 |

## 지키는 것

- **카페당 하루 1~2개.** 댓글이 지워지거나 경고가 오면 그 카페는 멈추고 사용자에게 알린다.
- 카페 댓글에 **bredy.app 링크를 넣지 않는다.** 링크는 블로그 글 하나만, 댓글 맨 끝 줄에.
- 사진·영상을 봐야만 답할 수 있는 질문(동정, '이거 병인가요?')은 고르지 않는다. 일반 정보로 답할 수 있는 질문만.
- 이미 좋은 답이 달린 글은 **보탤 정보가 있을 때만** 단다(예: 온습도계 → 얼음물·소금 테스트).
- 폐사·질병·응급은 일반 정보만 주고 '진료 가능한 병원' 을 권한다. 모르는 건 지어내지 않고, 통설은 '~래요'로 쓴다.
- 카페 글·댓글 문장을 블로그에 옮겨 적지 않는다. 질문은 주제로만 쓰고 카페 이름·글쓴이는 블로그에 쓰지 않는다.
- 말투는 사람처럼(대학생·20대·50대 아저씨처럼, 멋 부리지 않게). 기준은 `~/Desktop/pro/bredy-marketing/docs/facts-and-rules.md` 'SNS 글 말투'. 댓글은 3~4문장, 마지막 줄 '정리해둔 거 남겨요' + 링크.
- 네이버 자동화 금지 약관이 있으니 많이 몰아 달지 않는다. 댓글 사이 최소 40초.

## 브라우저

**브리디 자동화 크롬**(`~/.bredy-chrome`, CDP 127.0.0.1:9222) 하나에 붙는다(2026-10-18 정책 — `~/Desktop/pro/bredy-marketing/docs/browser-automation.md`). 스크립트가 알아서 붙고(`bpw`), 자기 탭을 열어 쓰고 닫으며, 네이버 작업끼리는 사이트 잠금으로 차례대로 돈다. 프로필 복제·`PW_SESSION`·`tab-select` 는 쓰지 않는다.

```bash
cd ~/Desktop/pro/bredy-marketing
node scripts/bchrome.mjs check   # 로그인 점검(❌ 면 사용자에게 알리고 자동화 크롬에 로그인 탭을 열어 둔다)
```

## 빠른 길 (일괄 도구, 2026-10-17)

여러 개를 할 때는 단계별 명령 대신 `scripts/cafe.py` 두 번으로 끝낸다(토큰·시간 절약).

```bash
cd ~/Desktop/pro/bredy-marketing   # cafe.py 는 저장소 scripts/ 에도 같은 사본이 있다
D=content/$(date +%F)-cafe; mkdir -p $D
SCROLLS=6 MAXCMT=3 python3 scripts/cafe.py collect $D/cands.json 30   # 질문 후보 + 본문 요약(이미 단 글·등급 잠금·댓글 많은 글 제외)
# → 고른 질문으로 $D/plan.json 작성: [{"cafe":"hby|reptilia","id":…,"comment":"…{BLOG}", "blog":{"file","title","category","tags","photo"}}]
python3 scripts/cafe.py run $D/plan.json   # 백그라운드로. 블로그 발행 → 댓글({BLOG} 치환) → $D/log.md, 댓글 사이 3~6분
```

사용자가 하루 개수를 늘려 달라고 하면 링크 댓글은 절반 정도만(나머지는 링크 없이 답만) 두어 스팸 신호를 줄인다.

## 순서 (한 개씩 할 때)

1. **질문 모으기** — 카페 모바일 홈을 스크롤해 질문형 제목만 뽑는다(토큰 아끼려고 스냅샷 대신 eval 한 번).
   ```bash
   pw goto "https://m.cafe.naver.com/hby"; sleep 4; for i in 1 2 3; do pw eval "window.scrollBy(0,4000)"; sleep 1.2; done
   pw eval "[...new Set([...document.querySelectorAll('a[href*=\"articleid\"],a[href*=\"/articles/\"]')].map(a=>a.innerText.split('\n')[0].trim()+' #'+((a.href.match(/articleid=(\d+)|articles\/(\d+)/)||[]).slice(1).join(''))))].filter(x=>/[?？]|질문|궁금|도와|왜|어떻게|괜찮|되나|될까|문의|방법|인가요|일까요/.test(x)).slice(0,15).join('\n')"
   ```
   카페 앱 공지·분양 홍보 글(`[가게이름]`)은 뺀다.
2. **본문·댓글 읽기** — `https://m.cafe.naver.com/ca-fe/web/cafes/<clubid>/articles/<id>` 를 열어 '작성일'부터 '댓글을 남겨' 앞까지 텍스트만 읽는다. '○촌 등급 이상만 볼 수 있는 게시판'이면 그 카페는 건너뛴다.
3. **블로그 글** — `content/<YYYY-MM-DD>-cafe/blog-<주제>.txt`. 질문자가 헷갈린 지점부터 답하고, 확인 방법·주의점을 짧은 줄로. 끝 두 줄은 브리디 연결 문장 + 링크(브리디 정보글 `https://bredy.app/posts/<id>` 또는 `https://bredy.app/posts`). **URL 은 맨 마지막 줄**(뒤에 글을 더 치면 링크 미리보기 때문에 에디터 커서가 튀어 순서가 섞인다).
   ```bash
   python3 ~/.claude/skills/bredy-cafe-activity/scripts/naver-photos.py <본문.txt> "<제목>" "<카테고리>" "<태그,태그>" assets/photos/<CC0 사진>
   ```
   카테고리: 물고기 → `물고기 키우기`, 파충류·곤충 → `브리디 소식`. 사진은 `assets/photos/SOURCES.md` 의 CC0 만. 출력된 글 주소를 확인한다.
   - 블로그 글에는 쿠팡 파트너스 링크 하나 + 대가성 문구를 넣는다(아래 '블로그 쿠팡 파트너스 링크').
4. **카페 댓글** — `content/<날짜>-cafe/c-<주제>.txt`(마지막 줄 = 블로그 링크).
   ```bash
   python3 ~/.claude/skills/bredy-cafe-activity/scripts/cafe-comment.py "https://m.cafe.naver.com/ca-fe/web/cafes/<clubid>/articles/<id>" content/<날짜>-cafe/c-<주제>.txt
   ```
   'ok' 면 달렸다. 모바일 카페는 '댓글을 남겨보세요'를 누르면 입력칸에 바로 포커스가 간다.
5. **기록·보고** — `content/<날짜>-cafe/log.md` 에 카페·글 번호·블로그 주소·댓글 요약을 남기고, 사용자에게 표로 보고한다(블로그 링크 + 댓글 첫 문장). 지난 댓글이 지워졌는지도 한 번 열어 확인해 같이 알린다.

## 같이 하면 좋은 것

- 같은 주제로 브리디 앱 커뮤니티에 정보글을 올리고 싶으면 bredy-crew-activity 스킬(크루 계정, 계획 → lint → 확인 → apply)로 올리고, 블로그 끝 링크를 그 글로 건다.
- 블로그에 '생물 키우는 사람들 앱 만드는 1인 개발자' 자기소개 글을 하나 고정해 두고 정보글 끝마다 '함께 보면 좋은 글'로 건다('표' 방식, 아직 안 함).

## 블로그 쿠팡 파트너스 링크 (2026-10-22 사용자 결정)
네이버 블로그(bredy_team) 글에는 **정보글·분양·경매 홍보글 모두** 관련 용품 쿠팡 파트너스 링크를 **하나만** 넣는다(구글 애드센스는 네이버 블로그에 못 넣고, 생물 거래 글에 넣으면 AdMob 계정까지 위험해서 쓰지 않는다).
- 링크 만들기: `bash ~/Desktop/pro/bredy-marketing/scripts/coupang-link.sh "<검색어 또는 쿠팡 주소>"` → `https://link.coupang.com/a/...`(트래킹 AF2109367, 자동화 크롬 파트너스 로그인 사용). 검색어는 글 주제 용품(예: `크레스티드게코 슈퍼푸드`, `게코 사육장`, `거북이 여과기`). 생물 자체는 링크하지 않는다.
- 위치: 본문 끝, 브리디 안내 줄 **앞**. `🛒 같이 쓰면 좋은 용품: <링크>` 한 줄 → 빈 줄 → 대가성 문구 → 빈 줄 → 브리디 안내(맨 마지막).
- 대가성 문구(빼면 공정위 표시 위반): `이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.`
- 카페 댓글·인스타·스레드·X 에는 쿠팡 링크를 넣지 않는다(블로그만).
