---
name: adsense-bot-check
description: 애드센스 봇(Mediapartners-Google)이 실제로 받는 화면을 재서 '가치가 별로 없는 콘텐츠' 거절 원인(화면에서만 데이터를 받아 봇 본문이 빈 페이지, 얇은 페이지가 사이트맵에 많음, 처리방침이 사이트 밖, ads.txt)을 찾고, 고친 뒤 애드센스 콘솔의 사이트 검토 상태를 확인한다. 사용자가 '애드센스 승인', '애드센스 거절', '애드센스 재검토', '애드센스 상태 확인', '봇이 보는 화면', '가치 없는 콘텐츠' 등을 말하거나 bredy.app·unnienote.app 의 애드센스 일을 맡길 때 쓴다. 정책 전 항목 점검표는 adsense-site-auditor 스킬(이 스킬은 측정·확인 도구).
---

# 애드센스 봇 화면 점검

2026-11-09 bredy.app 점검을 스크립트로 묶었다. 점검표 전체(정책·개인정보 등 70여 항목)가 필요하면 `adsense-site-auditor` 스킬을 같이 쓴다.

## 1. 봇이 받는 화면 재기

```bash
python3 -I scripts/bot_check.py bredy.app --after "버전 0.1.0" --per 2
python3 -I scripts/bot_check.py unnienote.app --per 2
```

- robots.txt(Mediapartners-Google·`Disallow: /` 확인), ads.txt(https·http·www), 사이트맵 구역별 개수, 홈과 구역마다 몇 쪽의 상태 코드·robots 메타·본문 글자 수를 찍는다.
- `--after` 는 메뉴(사이드 메뉴) 끝 글자. 주면 그 뒤만 본문으로 센다. 브리디는 `버전 0.1.0`.
- `THIN`(본문 300자 미만)인데 `index` 인 쪽이 고칠 대상이다. 특정 경로를 더 보려면 뒤에 `/privacy /terms` 처럼 붙인다.

## 2. 고치는 순서 (브리디에서 한 것)

1. 화면에서만 받는 목록 → 서버에서 첫 페이지를 읽어 SWR `fallbackData` 로 넘긴다(breeder_web `/life`·홈 인기글·`/products` 방식). 화면 모양은 그대로다.
2. 서버에서 그리기 어려운 얇은 페이지(프로필 등) → `noindex, follow` + 사이트맵 제외. 글 자체는 계속 색인된다.
3. 처리방침·약관이 다른 도메인이면 사이트 안 페이지로(브리디는 Notion 사본 `libs/legal/*.json`, 다시 만들기 `scripts/notion-legal-dump.py`).
4. 자동 생성·복제 글(보호소 공고·번역 복제 등)은 noindex·사이트맵 제외.
5. 고친 뒤 운영 배포는 사용자가 그 메시지에서 지시했을 때만(~/.claude/CLAUDE.md §13). 배포 뒤 1단계를 다시 돌려 운영에서 확인한다.

## 3. 콘솔 상태 확인

```bash
node scripts/console_status.cjs --site bredy.app        # 자동화 크롬 9222 (ytw418 로그인, u/0)
```

- 사이트 목록(승인 상태·Ads.txt 상태)과 그 사이트의 검토 단계를 읽는다. 자기 탭만 열고 닫는다.
- `리뷰가 요청됨` = 검토 중. **재요청 버튼이 없다.** 고친 내용은 진행 중인 검토가 다시 볼 때 반영된다. 사이트를 지웠다 다시 넣지 않는다(대기 순서가 처음으로).
- 거절 상태면 상세의 '검토 요청'을 누르기 전에 사용자에게 확인한다(밖으로 나가는 동작).
- Ads.txt '찾을 수 없음'이 떠도 1단계에서 200·올바른 게시자 줄이면 콘솔의 예전 확인 결과다.

## 결과 보고

봇 본문 전후 표(경로 · 전 · 후), 콘솔 상태, 남은 위험을 한국어로 적는다. 승인은 보장할 수 없다고 밝힌다.
