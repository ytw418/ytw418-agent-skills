# 브리디 자동화 크롬(CDP 9222)에 붙는 공용 도우미(bash·zsh 공용). 사용: source "$(dirname "$0")/bpw.sh" <사이트>; trap bpw_end EXIT
# → pw <playwright-cli 명령…> 이 '자기 탭'에서만 돈다. 같은 사이트 작업은 잠금으로 차례대로, 다른 사이트끼리는 병렬. 탭 번호(tab-select)는 쓰지 않는다.
BPW_SITE="${1:-misc}"
"$HOME/.local/bin/bredy-chrome" || exit 1
mkdir -p /tmp/bredy-chrome-locks; BPW_LOCK="/tmp/bredy-chrome-locks/$BPW_SITE"
while ! mkdir "$BPW_LOCK" 2>/dev/null; do
  [ -n "$(find "$BPW_LOCK" -maxdepth 0 -mmin +30 2>/dev/null)" ] && rm -rf "$BPW_LOCK"; sleep 2
done
BPW_S="job-$BPW_SITE-$$"
_bpwx(){ npx --yes --package @playwright/cli playwright-cli "$@" 2>&1; }
_bpwx attach --cdp=http://127.0.0.1:9222 --session="$BPW_S" >/dev/null
pw(){ _bpwx -s="$BPW_S" "$@"; }
pw tab-new about:blank >/dev/null
bpw_end(){ pw tab-close >/dev/null; _bpwx -s="$BPW_S" detach >/dev/null; rm -rf "$BPW_LOCK"; }
