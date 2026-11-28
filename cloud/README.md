# 클라우드 세션 설정 (2026-11-28)

클라우드 프로젝트 스레드는 레포 여러 개를 한 폴더(예 `/home/user`)에 받고 그 폴더에서 시작한다.
그래서 맥에서 쓰는 것 중 아래가 빠져 있었다.

- 각 레포 `.claude/settings.json` 훅(db-guard·pr-guard·parity-guard·dev-local-guard·hands-off-guard): 레포 안에서 시작한 세션만 불러온다.
- `~/.claude/CLAUDE.md`(전역 지침), `~/.claude/hooks`(운영 배포·Slack 전송 확인 훅)

`install.sh` 가 이것을 채운다. 클라우드 환경 설정 스크립트에서 한 줄로 부른다:

```bash
if [ -f ytw418-agent-skills/cloud/install.sh ]; then bash ytw418-agent-skills/cloud/install.sh; fi
```

- `repo-hooks.py`: 레포 훅을 `CLAUDE_PROJECT_DIR=<레포>` 로 대신 돌린다. 클라우드 Vercel 도구 이름(`mcp__Vercel__`)도 맥 이름(`mcp__claude_ai_Vercel__`)처럼 맞춘다.
- `../config/hooks/`: 맥 `~/.claude/hooks` 에서 가져온 전역 훅. prod-deploy-guard 는 클라우드 Vercel 이름과 GitHub MCP 머지(main 대상)도 막게 고쳤다.
- `../config/CLAUDE.md`: 맥 `~/.claude/CLAUDE.md` 원본(맥은 심링크).

클라우드로 안 옮긴 것과 이유
- korean-report(Stop): 클라우드 스레드 답은 도구로 나가서 마지막 글자 검사가 엉뚱하게 막을 수 있다. 한국어 규칙은 프로젝트 지침에 있다.
- usage-budget: 세션마다 새 컨테이너라 주간 기록이 안 이어진다.
- browser-auth-rule·allibee-local-open·jira-image-embed·i18n-skill-gate: 맥 자동화 크롬·회사 저장소 전용.
- Orca·Paseo·graphify 훅, 로컬 MCP(perplexity·hycli·rea·atlassian): 맥 앱·로컬 프로그램이 있어야 돈다. PostHog·Expo·Vercel·GitHub 는 클라우드 커넥터로 이미 붙어 있다.
