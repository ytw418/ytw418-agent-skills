#!/usr/bin/env bash
# stale-guard.sh 를 LaunchAgent 로 설치한다(로그인할 때 + 10분마다).
# 스크립트는 ~/.local/bin 에 복사해 두므로 스킬 경로가 바뀌어도 동작한다.
# 사용: bash install-guard.sh            설치·갱신
#       bash install-guard.sh --uninstall 제거
set -eu

LABEL=com.ytw418.paseo-stale-guard
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BIN="$HOME/.local/bin/paseo-stale-guard.sh"
LOG="$HOME/Library/Logs/paseo-stale-guard.log"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true

if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$PLIST" "$BIN"
  echo "제거함: $LABEL"
  exit 0
fi

mkdir -p "$(dirname "$BIN")" "$(dirname "$PLIST")"
cp "$(cd "$(dirname "$0")" && pwd)/stale-guard.sh" "$BIN"
chmod +x "$BIN"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$BIN</string></array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>600</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootstrap "$DOMAIN" "$PLIST"
echo "설치함: $LABEL (로그: $LOG)"
