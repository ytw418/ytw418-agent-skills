---
name: bredy-meme-reel
description: 매일 새벽 요즘 유행하는 밈을 조사해 그날 밈 하나를 브리디 동물(고양이·강아지·파충류·햄스터 돌아가며)로 바꾼 9:16 영상을 구글 Gemini(Veo)로 만들고, 인스타 릴스(에뮬레이터 앱 유행 음원·밤 9시 예약, 스레드 동시 공유)·유튜브 쇼츠·틱톡에 올린다. 사용자가 '밈 릴스 만들어', '오늘 밈 영상', '유행 밈으로 숏폼', '밈 영상 올려줘'라고 하거나 새벽 5시 Paseo 일정이 실행할 때 쓴다. 매물 카드 홍보는 bredy-sns-promo.
---

# 브리디 밈 릴스 (하루 1개)

작업 폴더 `~/Desktop/pro/bredy-marketing`, 기록 `content/memes/memes.jsonl`(하루 한 줄), 그날 폴더 `content/memes/<YYYY-MM-DD>/`. 도우미는 이 스킬의 `scripts/`.

## 규칙 (2026-10-22 사용자 결정)
- **하루 1개.** Gemini 영상 생성은 하루 최대 2번(처음 + 다시 만들기 1번).
- **동물은 돌아가며**: 고양이 → 강아지 → 파충류(크레·레게·거북이) → 햄스터. `memes.jsonl` 마지막 줄의 다음 동물. 식물·곤충 클로즈업은 쓰지 않는다.
- **밈은 매일 달라야 한다**: 최근 14일 `memes.jsonl` 에 있는 밈·음원은 고르지 않는다.
- **`reels/shortform.mjs`·`assets/music` 무료 배경음은 쓰지 않는다**(10-22 "진짜 구리다"). 음원은 플랫폼 안의 유행 음원만 쓴다. 못 붙이면 Veo 원본 소리로 두고 보고한다.
- **톤·카메라·화면 글자는 밈마다 정한다**(고정값 금지). 예: 공포 밈 패러디면 어둡고 흔들리는 카메라, 브이로그 밈이면 손떨림 1인칭, 자막이 핵심인 밈이면 글자 있음.
- 실존 인물·유명인 얼굴, 정치·참사 밈, 피·혐오 표현 금지. 영상에 회원 사진·정보를 넣지 않는다.
- 시간: 새벽 05:00에 만들고, 게시는 **밤 9시** 예약(인스타) / 웹은 만들 때 바로 올리되 틱톡·유튜브 예약 기능이 있으면 21:00 로 건다. 10~18시엔 아무것도 돌리지 않는다.
- 공개 게시는 사전 승인됨(사용자 확인 없이 진행). 실패하면 그 플랫폼만 건너뛰고 보고한다.

## 1. 밈 조사 (10분 안)
같은 세 곳만 본다.
1. 인스타 인기 음원: `scripts/emu.sh on` → 인스타 앱 + → REEL → 아무 영상 → Audio → **Trending** 탭 캡처(상위 10곡·릴스 수). 영상은 고르지 말고 뒤로 나온다.
2. TikTok Creative Center 한국 인기 곡·해시태그(`https://ads.tiktok.com/business/creativecenter/inspiration/popular/music/pc/ko?region=KR`, 자동화 크롬).
3. 유튜브 쇼츠 `#밈`·`#챌린지` 검색 상위(자동화 크롬).

후보마다 적는다: 밈 이름, 형식(춤/립싱크/상황극/반전/POV), 핵심 동작, 쓰이는 음원, 인스타 Trending 에 그 음원이 있는지.

## 2. 고르기와 콘셉트
- 인스타 Trending 에 음원이 있는 밈을 먼저 고른다(릴스에 같은 음원을 붙일 수 있어야 밈이 산다).
- 오늘 동물로 바꿨을 때 웃긴지 한 줄로 설명할 수 있어야 한다.
- `content/memes/<날짜>/plan.json`: `{meme, format, animal, audio:{ig,tiktok,yt}, tone, camera, onscreen_text, hook, caption, hashtags}`.

## 3. 프롬프트 (`prompt.txt`, 영어로)
```
[밈 형식 그대로의 장면] performed by [오늘 동물, 구체적 품종·색].
Setting: [밈에 맞는 장소]. Action: [핵심 동작 1~2개, 박자·타이밍].
Tone: [plan.tone]. Camera: [plan.camera]. Length 8s, vertical 9:16.
On-screen text: [none | 짧은 영어/숫자만 — 한글은 Veo 가 깨뜨리므로 6단계에서 ffmpeg 로].
Avoid: real people or celebrities, human face close-ups, insects, gore, logos.
```

## 4. 생성
`bash scripts/gemini-video.sh content/memes/<날짜>/prompt.txt content/memes/<날짜>/raw.mp4`
- 종료 3(한도·거절)이면 프롬프트를 덜 자극적으로 한 번만 고쳐 다시. 그래도 안 되면 오늘은 멈추고 보고.

## 5. 품질 검사
`bash scripts/frames.sh raw.mp4 frames.png` → Read 로 본다. 불합격: 실존 인물처럼 보임, 손발·몸이 뒤틀림, 동물이 안 보임, 깨진 글자, 밈이 안 읽힘. 불합격이면 4단계 1번 더(하루 2번까지).

## 6. 편집 (ffmpeg 만)
- `onscreen_text` 가 있으면 한글 훅 자막을 처음 1.5초 위쪽에 `drawtext`(Pretendard ExtraBold, 흰 글자 + 검은 테두리)로 넣는다. 없으면 넣지 않는다.
- 끝 0.8초에 작게 `브리디` 한 줄(선택). Gemini 별 워터마크(오른쪽 아래)는 `delogo` 로 지운다.
- 결과 `final.mp4`. 배경음은 넣지 않는다.

## 7. 게시
- **인스타(+스레드)** — `scripts/emu.sh push final.mp4` → 앱: `+`(60,200) → REEL(872,2255) → 첫 영상(540,880) → Next 화면에서 Audio(128,1925) → 검색에 plan.audio.ig → 곡 선택 → →(975,2200) → Done(975,255) → Next(950,2275) → 안내창 OK(540,2045) → 캡션 칸(540,1112) 누르고 `emu.sh text "<캡션>"` → OK(990,200) → **고급 설정 → 예약 → 오늘 21:00** → 'Threads 에도 공유' 켜짐 확인 → 공유 → 원본 오디오 창은 'Turn off and share'(540,2235). **단계마다 `emu.sh shot` 으로 보고 다음을 누른다**(좌표는 10-22 기준, 화면이 다르면 캡처를 보고 맞춘다). 끝나면 `emu.sh off`.
- **유튜브 쇼츠** — `zsh scripts/post-reel.sh yt final.mp4 "<제목> #shorts" desc.txt`(bredy-marketing). 음원은 넣지 않거나 Studio 편집기 오디오에서 plan.audio.yt 를 고른다(무료 배경음 파일 금지).
- **틱톡** — TikTok Studio 업로드 → '사운드' 검색에 plan.audio.tiktok → 추가 → 저장 → 캡션 → 게시(예약 가능하면 21:00). 안내 창('확인'·'취소')이 여러 번 뜨니 닫으면서 진행. 사운드를 못 붙이면 원본 소리로 올린다.

## 브리디 유입 장치 (10-22)
링크마다 `?utm_source=<ig|threads|yt|tiktok>&utm_medium=meme&utm_campaign=<날짜>` 를 붙여 PostHog 에서 어느 밈이 데려왔는지 본다. 기본 주소 `https://bredy.app/download`(스토어 연결 랜딩).
- **인스타**: 캡션·댓글 링크는 눌리지 않는다 → 캡션 끝 `👉 프로필 링크에서 브리디 받기` + **고정 댓글로 참여 유도**(예: "우리 집 크레는 이 춤 몇 점? 🦎 키우는 애 자랑은 브리디에 올려 주세요 → 프로필 링크"). 프로필 링크는 위 download 주소(utm_source=ig)로 둔다(사용자가 한 번 설정).
- **스레드**: 인스타에서 같이 공유된 글에 **첫 댓글로 링크**(스레드는 링크 벌점 없음, 10-19 확인) — `bredy.app/download?utm_source=threads…`.
- **유튜브 쇼츠**: 설명란 첫 줄에 링크 + **고정 댓글에 링크**. 쇼츠 '관련 동영상' 칸은 브리디 소개 영상이 생기면 연결.
- **틱톡**: 프로필 링크는 팔로워 1,000명부터라 지금은 못 단다 → 캡션 `프로필에서 '브리디' 검색` + 고정 댓글로 앱 이름 안내.
- 영상 자체: 마지막 0.8초 `브리디` 글자 + 동물 캐릭터가 화면을 보는 컷이면 '다음 편은 브리디에서' 느낌으로 끝낸다(밈과 안 맞으면 생략).

## 8. 기록·보고
- `memes.jsonl` 에 `{date, meme, animal, audio, prompt, urls:{ig,threads,yt,tiktok}, regen}` 한 줄.
- 보고(한국어, Slack 본인 DM U092LHJH732 — channel_id·message 만): 오늘 밈 / 동물 / 음원 / 플랫폼별 주소 또는 실패 이유 / frames.png 를 본 소감 한 줄.
