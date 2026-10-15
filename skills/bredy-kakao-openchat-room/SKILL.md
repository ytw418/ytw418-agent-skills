---
name: bredy-kakao-openchat-room
description: 브리디 카카오톡 오픈채팅방(종별 홍보방)을 하나 더 연다. breeder_web 의 종별 소식 문구 기능(`/admin/kakao-digest`, 매일 08시 슬랙 발송)에 방을 추가하고(KAKAO_DIGEST_ROOMS 한 줄), dev DB 읽기 전용 조회로 종 필터를 확인하고, 관리자 화면 캡처와 dev PR 을 만든 뒤, 카톡에서 방을 만들 때 쓸 방 이름·해시태그·공지·방장봇 문구까지 써 준다. 사용자가 '오픈채팅방 추가', '곤충방도 만들어', '물고기 톡방 열자', '카톡방 소식 문구에 ○○ 추가', '오픈채팅 소식 종 늘려', '톡방 공지 써줘' 등을 요청할 때 사용한다. 소식 기능 자체(문구 형식·조회 기준·크론)를 바꾸거나 카톡 자동 발송 봇을 만들 때는 쓰지 않는다.
---

# 브리디 오픈채팅방 추가

2026-10-15에 정한 방식이다. 카톡 자동 발송은 **하지 않는다**(카카오 약관 위반이라 계정·방이 제재될 수 있다). 브리디가 종별 소식 글을 만들고, 운영자가 관리자 화면에서 복사하거나 매일 08:00 KST 슬랙으로 받아 붙여넣는다. 첫 방은 크레다(웹 PR #265).

## 코드 위치 (breeder_web)

| 무엇 | 파일 |
|---|---|
| 방 설정·문구 형식 | `libs/shared/kakaoDigest.ts` — `KAKAO_DIGEST_ROOMS` |
| 조회·슬랙 발송 | `libs/server/kakaoDigest.ts` |
| 관리자 API·화면 | `pages/api/admin/kakao-digest.ts`, `app/admin/kakao-digest/page.tsx` |
| 크론 | `pages/api/internal/cron/kakao-digest.ts`, `vercel.json` `0 23 * * *` |
| 테스트 | `__tests__/kakaoDigest.test.ts`(ROOMS[0] 기준이라 방을 추가해도 그대로 둔다) |
| 종 이름 | `libs/categoryTaxonomy.ts` `CATEGORY_TREE`, DB `Category`(`speciesCategoryIds`) |

`KAKAO_DIGEST_ROOMS` 가 없으면(#265 미머지) 먼저 사용자에게 알리고 그 PR 을 머지할지 묻는다.

## 지킬 것

- **dev DB 는 읽기만 한다.** 아래 스크립트는 `count`·`findMany` 만 한다. 프로젝트 AGENTS.md 의 DB 안전 규칙이 우선이다.
- **포유류 방 주의**: 강아지·고양이·햄스터·토끼·페럿·기니피그는 동물보호법상 반려동물이다. 동물판매업 등록이 없는 개인 분양 광고는 불법이 될 수 있다. 이런 방을 열자고 하면 "정보·자랑 전용, 분양 금지"로만 만들고 분양 링크 섹션을 빼야 하는지 **사용자에게 먼저 묻는다**(지금 문구 형식은 분양글 섹션이 항상 들어간다).
- 웹 작업은 `breeder_web` 워크트리 브랜치 → `dev` PR 이다. 관리자 전용이라 커밋 트레일러는 `Parity: web-only — 관리자 전용 운영 도구`.
- PR 본문과 보고에 캡처를 넣는다(`~/Desktop/pro/bredy_app/scripts/pr-screenshots.sh`). 예시 데이터로 찍은 화면은 "예시 데이터"라고 밝힌다.

## 1. 방 정하기

사용자에게서 받는다(없으면 제안하고 확인한다).
- **종**: 카테고리 트리의 정확한 이름(예: `장수풍뎅이`, `구피`, `레오파드 게코`). 대분류(`곤충`)로 열면 하위 종까지 모두 잡힌다.
- **key**: 영어 소문자. `utm_campaign` 으로 쓰인다(예: `rhino-beetle`, `guppy`, `insect`).
- **label**: 글 제목에 들어갈 짧은 이름(예: `장수풍뎅이`, `구피`). **emoji** 1개.

## 2. 워크트리와 종 필터 확인

```bash
cd ~/Desktop/pro/breeder_web && git fetch -q origin dev
git worktree add -b feat/kakao-room-<key> ../breeder_web-wt/kakao-room-<key> origin/dev
cd ../breeder_web-wt/kakao-room-<key>
cp -cR ../../breeder_web/node_modules ./node_modules && cp ../../breeder_web/.env .env && npx prisma generate >/dev/null
S=~/.claude/skills/bredy-kakao-openchat-room/scripts
cp $S/count_room.ts ./kd-count.tmp.ts && npx tsx --tsconfig tsconfig.json kd-count.tmp.ts "<종 이름>" "<별칭1>,<별칭2>"; rm -f kd-count.tmp.ts
```

- `categoryIds` 가 비면 트리에 없는 이름이다. 이름을 고치거나 사용자에게 확인한다.
- `분양글 category 값` 에 나온 옛 문자열(띄어쓰기 없는 이름, 줄임말)을 `aliases` 에 넣는다. 경매는 `categoryId` 가 비어 있을 수 있어서 별칭이 중요하다.

## 3. 방 추가

`libs/shared/kakaoDigest.ts` 의 `KAKAO_DIGEST_ROOMS` 에 항목을 하나 추가한다.

```ts
{ key: "<key>", species: "<트리 이름>", label: "<짧은 이름>", emoji: "<이모지>", aliases: ["<트리 이름>", ...] },
```

그 다음 확인한다.

```bash
npx jest __tests__/kakaoDigest.test.ts && npx tsc --noEmit && npx eslint libs/shared/kakaoDigest.ts
cp $S/dump_digests.ts ./kd-dump.tmp.ts && npx tsx --tsconfig tsconfig.json kd-dump.tmp.ts /tmp/<세션>/real.json; rm -f kd-dump.tmp.ts
```

새 방의 문구가 출력되는지 본다. 24시간 데이터가 없으면 "조용하네요" 문구가 정상이다.

## 4. 캡처

`next dev` 는 2시간 한도에 걸려 죽는다. 서버 띄우기, 캡처, 종료를 한 명령으로 돌린다.

```bash
(npx next dev -p 3010 > /tmp/<세션>/next.log 2>&1 &); until curl -s -o /dev/null -w "%{http_code}" http://localhost:3010/admin/login | grep -q 200; do sleep 3; done
node $S/shot.cjs /tmp/<세션>/real.json /tmp/<세션>/01-kakao-digest-<key>.png; pkill -f "next dev -p 3010"
```

캡처 파일은 Read 로 열어 새 방 카드가 보이는지 확인한다. 소식이 많은 날 모습이 필요하면 예시 JSON 을 따로 만들어 `02-…-example.png` 로 찍는다.

## 5. 커밋·PR

```bash
npm run verify:ci
git add libs/shared/kakaoDigest.ts && git commit -m "feat(admin): 오픈채팅 소식에 <label> 방 추가" -m "Parity: web-only — 관리자 전용 운영 도구" -m "Co-Authored-By: ..."
git push -u origin feat/kakao-room-<key>
bash ~/Desktop/pro/bredy_app/scripts/pr-screenshots.sh /tmp/<세션>/01-kakao-digest-<key>.png
```

PR 본문은 전용 경로(`/tmp/<세션>/pr-body.md`)에 쓴다. `/tmp/release-body.md` 같은 공용 경로는 다른 세션과 겹친다. 본문에는 요약, dev DB 조회 숫자, `## 스크린샷` 표, `Parity: web-only` 를 넣는다. `gh pr create --base dev --body-file …` 로 만든 뒤 `gh pr view` 로 본문을 확인한다. 머지와 운영 배포는 사용자가 정한다(`breeder-web-deploy` 스킬).

## 6. 방 운영 키트 (보고에 넣는다)

카톡에서 방을 만들 때 그대로 붙여넣을 문구를 써 준다.

- **방 이름**: 브랜드가 아니라 종 이름이 앞에 와야 검색된다. 예: `장수풍뎅이·사슴벌레 키우는 사람들 (사육정보·나눔)`
- **해시태그**: 종 이름, 줄임말, 사육 키워드.
- **공지**:
  - 방의 목적(정보·자랑·질문)
  - 분양 규칙: "분양·나눔은 브리디에 올리고 링크만 공유" + `https://bredy.app/products?category=<종>&utm_source=kakao&utm_medium=openchat&utm_campaign=<key>`
  - 금지 사항: 도배, 같은 홍보 반복, 개인정보
  - 매일 아침 소식이 올라온다는 안내
- **방장봇**(카카오 공식 기능): 입장 인사 1개, 키워드 응답("분양" → 브리디 등록 방법과 링크, "사육" → 반려생활 질문 링크) 2~3개.
- **첫 50명 모으기**: 인스타 DM 문구에 방 링크를 추가(`bredy-instagram-outreach` 스킬), 앱 반려생활 공지에 방 링크 넣기.

## 7. 보고

다음을 적는다.
- PR 링크
- dev DB 조회 숫자(categoryIds, 분양글·경매·게시글 수)
- 캡처 이미지와 로컬 경로
- 운영 키트 문구
- 남은 일: 머지와 운영 배포. 운영 Vercel env `KAKAO_DIGEST_SLACK_WEBHOOK_URL` 이 이미 있으면 다음 날 08시 슬랙에 새 방 소식이 함께 온다.
- 2~3주 뒤 PostHog 에서 `utm_campaign=<key>` 유입과 가입을 보자고 제안한다.
