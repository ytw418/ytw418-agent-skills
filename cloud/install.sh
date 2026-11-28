#!/usr/bin/env bash
# 클라우드 세션(여러 레포를 /home/user 같은 한 폴더에 받는 환경)에서
# 맥과 같은 훅·전역 지침을 쓰게 한다. 환경 설정 스크립트에서 레포들이 있는 폴더 기준으로 돈다.
# 맥에서는 돌리지 않는다(맥은 레포 안에서 세션을 열어 훅이 원래 불린다).
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO="$(dirname "$HERE")"
mkdir -p "$HOME/.claude"
# 1) 전역 지침: 맥 ~/.claude/CLAUDE.md 와 같은 원본(config/CLAUDE.md)
[ -e "$HOME/.claude/CLAUDE.md" ] || ln -s "$REPO/config/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
# 2) 레포 훅 중계(db-guard·pr-guard·parity-guard·dev-local-guard·hands-off-guard)
python3 - "$HERE/repo-hooks.py" "$REPO/config/hooks" <<'PY'
import json, os, sys
hook, gdir = sys.argv[1], sys.argv[2]
p = os.path.expanduser("~/.claude/settings.json")
s = json.load(open(p)) if os.path.exists(p) else {}
hooks = s.setdefault("hooks", {})
entries = [(ev, m, f'python3 "{hook}" {ev}') for ev, m in
           [("PreToolUse", ".*"), ("Stop", None), ("SessionStart", None), ("UserPromptSubmit", None)]]
# 맥 ~/.claude/hooks 의 전역 훅 중 클라우드에서도 뜻이 있는 것(운영 배포·Slack 전송 확인)
pd, sl = f'python3 "{gdir}/prod-deploy-guard.py"', f'python3 "{gdir}/slack-send-guard.py"'
entries += [("UserPromptSubmit", None, pd),
            ("PreToolUse", r"Bash|mcp__.*Vercel__.*|mcp__.*[Gg]it[Hh]ub.*__merge_pull_request", pd),
            ("PreToolUse", r"mcp__.*[Ss]lack.*|Bash|Write|Edit|MultiEdit|NotebookEdit", sl)]
for ev, matcher, cmd in entries:
    arr = hooks.setdefault(ev, [])
    if any(h.get("command") == cmd for g in arr for h in g.get("hooks", [])):
        continue
    g = {"hooks": [{"type": "command", "command": cmd}]}
    if matcher:
        g["matcher"] = matcher
    arr.append(g)
json.dump(s, open(p, "w"), ensure_ascii=False, indent=2)
PY
echo "[bredy-cloud] 훅 중계·전역 지침 연결 완료"
