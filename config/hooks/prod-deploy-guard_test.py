#!/usr/bin/env python3
"""prod-deploy-guard.py 테스트. 훅처럼(JSON stdin) 불러 막는지·통과하는지만 본다. 실제 배포·gh 호출은 없다.

사용: python3 prod-deploy-guard_test.py
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GUARD = os.path.join(HERE, "prod-deploy-guard.py")
STATE = os.path.join(tempfile.mkdtemp(prefix="prod-guard-test-"), "state.json")
fails = 0


def run(payload: dict, base: str = "dev") -> str:
    env = dict(os.environ, PROD_DEPLOY_GUARD_STATE=STATE, PROD_DEPLOY_GUARD_FAKE_BASE=base)
    out = subprocess.run([sys.executable, GUARD], input=json.dumps(payload), capture_output=True, text=True, env=env)
    return "deny" if '"deny"' in out.stdout else "allow"


def prompt(text: str) -> None:
    run({"hook_event_name": "UserPromptSubmit", "session_id": "s1", "prompt": text})


def bash(cmd: str, base: str = "dev") -> str:
    return run({"hook_event_name": "PreToolUse", "session_id": "s1", "tool_name": "Bash", "tool_input": {"command": cmd}}, base)


def check(name: str, got: str, want: str) -> None:
    global fails
    ok = got == want
    fails += 0 if ok else 1
    print(("ok   " if ok else "FAIL ") + f"{name}: {got} (기대 {want})")


# 허락 없음(조건·부정이 붙은 '배포'는 허락이 아니다)
prompt("운영에 배포하는건 내가 시킬때만 하는거야")
check("허락 없이 코드푸시", bash("cd ~/Desktop/pro/bredy_app && npm run -s ota:update -- --message x"), "deny")
check("허락 없이 main 대상 PR 머지", bash("gh pr merge 381 -R ytw418/breeder_web --merge", base="main"), "deny")
check("dev 대상 PR 머지는 통과", bash("gh pr merge 380 -R ytw418/breeder_web --squash", base="dev"), "allow")
check("커밋 메시지 속 'git push origin main' 은 통과", bash("git commit -m 'git push origin main 하지 말 것'"), "allow")
check("Play 출시 dry-run 은 통과", bash("node scripts/play-track-release.mjs release --track production --version-code 36 --dry-run"), "allow")
check("Vercel 승격(MCP) 막음", run({"hook_event_name": "PreToolUse", "session_id": "s1",
                                     "tool_name": "mcp__claude_ai_Vercel__request_promote", "tool_input": {}}), "deny")
# 이번 메시지에서 배포를 지시하면 풀린다
prompt("그래 다하면 배포도해")
check("배포 지시 뒤 코드푸시 통과", bash("npm run ota:update -- --message x"), "allow")
# 백그라운드 작업 알림은 사람 메시지가 아니라 허락을 지우지 않는다
prompt("[SYSTEM NOTIFICATION - NOT USER INPUT]\n<task-notification>done</task-notification>")
check("작업 알림 뒤에도 허락 유지", bash("gh pr merge 633 --merge", base="main"), "allow")
# 다음 메시지가 오면 허락이 사라진다
prompt("헤더 글자 좀 키워줘")
check("다음 메시지에선 다시 막음", bash("npx -y eas-cli update --branch production"), "deny")

# 회사: '배포해'는 demo 까지, prod 는 직접 지시
def bash_at(cmd: str, cwd: str) -> str:
    return run({"hook_event_name": "PreToolUse", "session_id": "s1", "tool_name": "Bash", "tool_input": {"command": cmd}, "cwd": cwd})


CO = "/Users/x/Desktop/bhsn/allibee-frontend"
prompt("demo 배포해")
check("회사 demo 배포 통과", bash_at("gh workflow run cue-gcp-demo-deploy.yml --ref cue/master", CO), "allow")
check("회사 '배포해'로 prod 는 막음", bash_at("gh workflow run cue-gcp-prod-deploy.yml --ref cue/production", CO), "deny")
check("개인은 '배포해'로 prod 통과", bash_at("npm run ota:update -- --message x", "/Users/x/Desktop/pro/bredy_app"), "allow")
prompt("큐 prod 배포해")
check("회사 prod 지시 뒤 통과", bash_at("gh workflow run cue-gcp-prod-deploy.yml --ref cue/production", CO), "allow")

sys.exit(1 if fails else 0)
