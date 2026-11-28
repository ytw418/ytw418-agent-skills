#!/usr/bin/env python3
"""클라우드 여러 레포 세션용 훅 중계기.

클라우드 프로젝트 스레드는 레포 바깥 폴더(/home/user)에서 시작해서 각 레포의
.claude/settings.json 훅(db-guard·pr-guard·parity-guard·hands-off-guard 등)을 불러오지 않는다.
이 스크립트를 ~/.claude/settings.json 의 훅으로 걸면, 같은 폴더에 있는 레포들의 훅을
CLAUDE_PROJECT_DIR=<레포> 로 대신 돌려 결과(막기·문맥 추가)를 그대로 돌려준다.

사용: repo-hooks.py <EventName>   (stdin = 훅 입력 JSON)
세션이 레포 안에서 시작돼 그 레포 훅이 이미 불리는 경우는 그 레포를 건너뛴다.
"""
import hashlib, json, os, re, subprocess, sys

ROOT = os.environ.get("BREDY_REPOS_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))
REPOS = ["breeder_web", "bredy_app"]
# 클라우드 Vercel MCP 이름(mcp__Vercel__)도 맥 이름(mcp__claude_ai_Vercel__)처럼 맞춘다.
ALIASES = [("mcp__Vercel__", "mcp__claude_ai_Vercel__")]


def tool_names(name):
    out = [name]
    for a, b in ALIASES:
        if name.startswith(a):
            out.append(b + name[len(a):])
    return out


def main():
    event = sys.argv[1]
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw or "{}")
    except Exception:
        payload = {}
    tool = str(payload.get("tool_name") or "")
    native = os.path.realpath(os.environ.get("CLAUDE_PROJECT_DIR") or "")
    contexts, seen = [], set()
    for repo in REPOS:
        rdir = os.path.join(ROOT, repo)
        if os.path.realpath(rdir) == native:
            continue
        try:
            settings = json.load(open(os.path.join(rdir, ".claude", "settings.json")))
        except Exception:
            continue
        for group in settings.get("hooks", {}).get(event, []):
            matcher = group.get("matcher") or ""
            if matcher and tool and not any(re.fullmatch(matcher, n) for n in tool_names(tool)):
                continue
            for h in group.get("hooks", []):
                cmd = h.get("command", "")
                env = dict(os.environ, CLAUDE_PROJECT_DIR=rdir)
                data = raw
                if tool and tool not in tool_names(tool)[1:] and len(tool_names(tool)) > 1:
                    p = dict(payload, tool_name=tool_names(tool)[1])
                    data = json.dumps(p)
                try:
                    r = subprocess.run(cmd, shell=True, input=data, capture_output=True,
                                       text=True, env=env, cwd=rdir, timeout=h.get("timeout", 60))
                except Exception:
                    continue
                if r.returncode == 2:
                    sys.stderr.write(f"[{repo}] " + r.stderr)
                    sys.exit(2)
                out = r.stdout.strip()
                if not out:
                    continue
                try:
                    j = json.loads(out)
                except Exception:
                    j = None
                if j is not None:
                    hso = j.get("hookSpecificOutput") or {}
                    if hso.get("permissionDecision") in ("deny", "ask") or j.get("decision") == "block":
                        print(out)
                        sys.exit(0)
                    ctx = hso.get("additionalContext")
                    if ctx:
                        k = hashlib.sha1(ctx.encode()).hexdigest()
                        if k not in seen:
                            seen.add(k); contexts.append(ctx)
                else:
                    k = hashlib.sha1(out.encode()).hexdigest()
                    if k not in seen:
                        seen.add(k); contexts.append(out)
    if contexts and event in ("SessionStart", "UserPromptSubmit"):
        print(json.dumps({"hookSpecificOutput": {"hookEventName": event,
                                                 "additionalContext": "\n\n".join(contexts)}}))


if __name__ == "__main__":
    main()
