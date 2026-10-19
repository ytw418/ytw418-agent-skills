# 로봇천국 공통 변수. 다른 스크립트가 source 한다.
export RC_HOME="${ROBOT_CAFE_HOME:-$HOME/Desktop/pro/robot-cafe}"   # 기록·PRD가 있는 데이터 폴더(옛 .chrome-profile 은 10-19부터 안 씀)
export RC_SESSION="${RC_SESSION:-robot-cafe}"                        # Playwright CLI 세션 이름(브리디 자동화 크롬 9222 의 자기 탭)
export RC_LOCK=/tmp/bredy-chrome-locks/naver                         # 네이버 사이트 잠금(bpw.sh 와 같은 잠금 — 같은 네이버 본계정)
export RC_CLUB=16729678                                              # cafe.naver.com/zxgamezx
pwc(){ touch "$RC_LOCK" 2>/dev/null; (cd "$RC_HOME" && npx --yes --package @playwright/cli playwright-cli -s="$RC_SESSION" "$@" 2>&1); }
