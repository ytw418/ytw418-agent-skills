# 네이버 카페 개편 공통 변수. 다른 스크립트가 source 한다.
# 쓰기 전에: export NC_HOME=<카페 작업 폴더> NC_CLUB=<clubid> NC_SESSION=<playwright 세션 이름>
# 브라우저는 브리디 자동화 크롬(CDP 9222)의 자기 탭이다(10-19 — 네이버 계정은 본계정 하나뿐). 시작 ensure-login.sh, 끝 release-login.sh.
: ${NC_HOME:?NC_HOME(카페 작업 폴더)을 정하세요}
: ${NC_CLUB:?NC_CLUB(clubid)을 정하세요}
: ${NC_SESSION:?NC_SESSION(카페 계정 전용 playwright 세션)을 정하세요}
export NC_LOCK=/tmp/bredy-chrome-locks/naver   # 네이버 사이트 잠금(bpw.sh·robot-cafe-content 와 같은 잠금)
export NC_SNAP=/tmp/nc_snap_${NC_SESSION}.yml
pwc(){ touch "$NC_LOCK" 2>/dev/null; (cd "$NC_HOME" && npx --yes --package @playwright/cli playwright-cli -s="$NC_SESSION" "$@" 2>&1); }
pwr(){ pwc "$@" | sed -n '/### Result/,/### Ran/p' | sed '1d;$d'; }          # 결과만
snap(){ pwc snapshot > "$NC_SNAP"; [ -n "$1" ] && grep -nE "$1" "$NC_SNAP" | grep -v -- "- /url" | head -${2:-80}; }
ref(){ grep -m1 -E "$1" "$NC_SNAP" | grep -o 'ref=[a-z0-9]*' | cut -d= -f2; }   # 마지막 스냅샷에서 첫 ref
bgclick(){ (pwc click "$1" > /tmp/nc_click.txt 2>&1 &); sleep ${2:-6}; grep -E "dialog" /tmp/nc_click.txt | head -1; pwc dialog-accept >/dev/null 2>&1; }  # 알림창을 띄우는 클릭
