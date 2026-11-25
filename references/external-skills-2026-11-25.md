# 외부 스킬 출처 (2026-11-25 설치)

| 스킬 | 출처 | 커밋 | 라이선스 |
|---|---|---|---|
| frontend-design | anthropics/skills (Anthropic 공식) | e4bb5d9 | Apache-style (LICENSE.txt) |
| ui-ux-pro-max | nextlevelbuilder/ui-ux-pro-max-skill | 8db3633 | MIT |
| impeccable (4.10.0) | pbakaus/impeccable | b49177d | Apache 2.0 |
| emil-design-eng, animate, animate-expo, review-animations, remove-animations, break-ui, gestures, learn-taste | emilkowalski/skills | 64eb3de | MIT |
| brainstorming, writing-plans, systematic-debugging, verification-before-completion, receiving-code-review | obra/superpowers | 22f0b46 | MIT |
| pre-mortem, strategy-red-team, north-star-metric, growth-loops, gtm-strategy, competitor-analysis, market-sizing, monetization-strategy, identify-assumptions-existing, cohort-analysis | phuryn/pm-skills | 9af7bfd | MIT |

바꾼 것: ui-ux-pro-max SKILL.md 의 `${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/` 경로를 `<skill-dir>/` 로(플러그인 아닌 스킬 폴더 설치라서), scripts/tests 제외. brainstorming·writing-plans 맨 위에 브리디 적용 메모 한 단락, brainstorming 설명을 "코드로 만드는 기능·화면 변경 전"으로 좁힘(원본은 모든 창작 작업에 발동해 SNS 글·운영 작업까지 막음).
클라우드 스레드: `.claude/skills/` 에 위 스킬 심볼릭 링크(impeccable 은 bredy_app `.claude/skills/impeccable` 이 이미 있어 이름 충돌을 피하려고 뺐다).
안 넣은 것: superpowers 세션 시작 훅(using-superpowers 를 매 세션 강제 주입), PM 묶음의 live-polls·live-qa(유료 askone MCP 권유), create-prd(hjjm-prd 와 중복), user-personas 계열(pet-persona-review 와 중복).
Impeccable 엔진: 첫 실행 때 GitHub 릴리스에서 바이너리를 받아 engine-checksums.txt 의 sha256 으로 검증한다. 디자인 '뽑기'(roll) 때 익명 사용 통계를 impeccable.style 로 보낸다 → `impeccable telemetry off` 또는 DO_NOT_TRACK=1 로 끈다. 로그인하지 않으면 코드 점검 결과는 올라가지 않는다.
