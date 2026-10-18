# 로봇천국 공통 변수. 다른 스크립트가 source 한다.
export RC_HOME="${ROBOT_CAFE_HOME:-$HOME/Desktop/pro/robot-cafe}"   # 브라우저 프로필·기록·PRD가 있는 데이터 폴더
export RC_SESSION="${RC_SESSION:-robot-cafe}"                        # Playwright CLI 세션 이름
export RC_CLUB=16729678                                              # cafe.naver.com/zxgamezx
pwc(){ (cd "$RC_HOME" && npx --yes --package @playwright/cli playwright-cli -s="$RC_SESSION" "$@" 2>&1); }
