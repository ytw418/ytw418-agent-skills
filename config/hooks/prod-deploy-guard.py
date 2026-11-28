#!/usr/bin/env python3
"""운영 배포 하네스(2026-10-25 사용자 결정 "운영에 배포하는 건 내가 시킬 때만, 아니면 나한테 허락을 받거나 — 훅으로 강하게").

두 이벤트에서 돈다.
- UserPromptSubmit: 사용자 메시지에 배포 지시("배포해", "코드푸시해", "운영 반영", "롤백해" …)가 있고 부정·조건
  ("시킬 때만", "허락", "하지 마" …)이 없으면 그 세션의 '이번 메시지 허락'을 기록한다. 다음 메시지가 오면 덮어쓴다
  (허락은 지시한 그 메시지 동안만 유효하다).
- PreToolUse: 운영 배포 명령(main 대상 PR 머지·main 푸시·Vercel 운영 배포/재배포/롤백·앱 코드푸시·EAS 업데이트/제출/운영 빌드·
  Play 출시·App Store 심사 제출)을 허락 없이 실행하면 막는다(deny). 막히면 무엇을 운영에 낼지 보여 주고 사용자에게 허락을 받는다.

dev 머지·브랜치 푸시·미리보기 배포·빌드·테스트는 막지 않는다. 테스트: python3 prod-deploy-guard_test.py
"""
import json
import os
import re
import subprocess
import sys
import time

STATE = os.environ.get("PROD_DEPLOY_GUARD_STATE") or os.path.expanduser("~/.claude/hooks/state/prod-deploy-approval.json")

APPROVE = re.compile(
    r"(배포|코드\s*푸시|릴리스|출시|운영\s*(?:까지|에|으로)?\s*(?:반영|올|내)|프로덕션|스토어\s*(?:제출|올|빌드)|심사\s*제출|"
    r"롤백|되돌려|deploy|release|rollback)",
    re.IGNORECASE,
)
# 회사(앨리비·큐)는 '배포해'로 dev·demo 까지만, prod 는 메시지에 prod·운영 등을 직접 써야 한다(2026-11-10 사용자 결정).
# 개인(브리디·언니노트)은 '배포해'만으로 prod 까지 간다.
PROD_WORD = re.compile(r"(prod|프로드|운영|프로덕션|production|실서버|라이브)", re.IGNORECASE)
COMPANY_PROD = re.compile(r"(prod|production)", re.IGNORECASE)
DENY = re.compile(r"(시킬\s*때만|허락|하지\s*마|하지\s*말|말고|금지|묻고|물어|보류|멈춰|하면\s*안|안\s*돼|않)")

# 백그라운드 작업 완료·세션 이벤트처럼 사람이 쓰지 않은 프롬프트. 이것 때문에 허락이 풀려 사용자가 "운영배포해"를 두세 번 말해야 했다(2026-11-20).
AUTOMATED = re.compile(r"(?:<task-notification>|<side-sessions-event>|<ci-monitor-event>|\[SYSTEM NOTIFICATION)")

DEPLOY_PATTERNS = [
    (r"\bnpm\s+run\s+(?:-s\s+)?ota:update\b", "앱 코드푸시(npm run ota:update)"),
    (r"\beas(?:-cli)?(?:@\S+)?\s+update\b", "EAS update(코드푸시·롤백)"),
    (r"\beas(?:-cli)?(?:@\S+)?\s+submit\b", "스토어 제출(eas submit)"),
    (r"\beas(?:-cli)?(?:@\S+)?\s+build\b[^\n]*--profile[ =]production", "스토어용 운영 빌드(eas build production)"),
    (r"\beas(?:-cli)?(?:@\S+)?\s+metadata:push\b", "App Store 메타데이터 푸시"),
    (r"play-track-release\.mjs\s+release\b(?![^\n]*--dry-run)", "Play 트랙 출시"),
    (r"asc-submit\.mjs\s+submit\b(?![^\n]*--dry-run)", "App Store 심사 제출"),
    (r"\bvercel(?:@\S+)?\b[^\n]*(?:--prod\b|\bredeploy\b|\bpromote\b|\brollback\b)", "Vercel 운영 배포·재배포·승격·롤백"),
    (r"\bgit\s+push\b[^\n]*(?:\s|:|/)(?:refs/heads/)?(?:main|production)\b", "main·production 브랜치 푸시"),
    (r"\bgh\s+api\b[^\n]*/pulls/\d+/merge\b", "API 로 PR 머지"),
    (r"\bgh\s+workflow\s+run\b[^\n]*(?:deploy|release|prod)", "배포 워크플로 실행"),
]
PROD_BASES = {"main", "production", "cue/production"}
MCP_DEPLOY = re.compile(r"mcp__(?:claude_ai_)?Vercel__(request_promote|request_rollback|approve_rolling_release_stage|"
                        r"start_rolling_release|complete_rolling_release|create_deployment)$")


def load_state() -> dict:
    try:
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(state: dict) -> None:
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    cutoff = time.time() - 3 * 86400  # 오래된 세션 기록은 지운다
    state = {k: v for k, v in state.items() if v.get("at", 0) > cutoff}
    with open(STATE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False)


def prompt_approves(prompt: str) -> bool:
    return bool(APPROVE.search(prompt or "")) and not DENY.search(prompt or "")


def strip_message_text(command: str) -> str:
    """커밋 메시지·PR 본문(heredoc, -m/--body/--title 문자열)은 실행되지 않으므로 검사에서 뺀다."""
    command = re.sub(r"<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n.*?\n\1\b", " ", command, flags=re.DOTALL)
    command = re.sub(r"(?:-m|--message|--body|--title|-t|-b)\s+(\"(?:[^\"\\]|\\.)*\"|'[^']*')", " ", command)
    return command


def pr_base(command: str, cwd: str) -> str:
    fake = os.environ.get("PROD_DEPLOY_GUARD_FAKE_BASE")
    if fake is not None:
        return fake
    m = re.search(r"\bgh\s+pr\s+merge\s+(\d+)?", command)
    number = m.group(1) if m and m.group(1) else ""
    repo = re.search(r"(?:-R|--repo)[ =](\S+)", command)
    args = ["gh", "pr", "view"] + ([number] if number else []) + (["-R", repo.group(1)] if repo else []) + \
        ["--json", "baseRefName", "-q", ".baseRefName"]
    try:
        out = subprocess.run(args, cwd=cwd or None, capture_output=True, text=True, timeout=15)
        return out.stdout.strip() or "?"
    except Exception:
        return "?"


def deploy_label(command: str, cwd: str) -> str:
    body = strip_message_text(command)
    for pattern, label in DEPLOY_PATTERNS:
        if re.search(pattern, body):
            return label
    if re.search(r"\bgh\s+pr\s+merge\b", body):
        base = pr_base(body, cwd)
        if base in PROD_BASES:
            return f"{base} 대상 PR 머지(운영 릴리스)"
        if base == "?":
            return "PR 머지(대상 브랜치를 확인하지 못함 — main 이면 운영 배포)"
    return ""


def deny(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"[운영 배포 하네스] {reason}은(는) 운영 배포다. 사용자가 이번 메시지에서 배포를 직접 지시하지 않았다. "
                "여기서 멈추고, 무엇을 운영에 낼지(포함 변경·버전·되돌리는 법)를 보여 준 뒤 사용자에게 허락을 받아라. "
                "사용자가 '배포해'·'코드푸시해'처럼 답하면 그 메시지 동안 풀린다(~/.claude/CLAUDE.md '운영 배포')."
            ),
        }
    }, ensure_ascii=False))
    sys.exit(0)


def github_pr_base(tool_input: dict):
    owner, repo, num = tool_input.get("owner"), tool_input.get("repo"), tool_input.get("pullNumber")
    if not (owner and repo and num):
        return None
    try:
        r = subprocess.run(["gh", "api", f"repos/{owner}/{repo}/pulls/{int(num)}", "--jq", ".base.ref"],
                           capture_output=True, text=True, timeout=20)
        return r.stdout.strip() or None
    except Exception:
        return None


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    event = payload.get("hook_event_name") or ""
    session = str(payload.get("session_id") or "default")
    state = load_state()

    if event == "UserPromptSubmit":
        prompt = str(payload.get("prompt") or "")
        if AUTOMATED.search(prompt[:300]):
            sys.exit(0)
        state[session] = {"approved": prompt_approves(prompt), "prod": bool(PROD_WORD.search(prompt)), "at": time.time(), "prompt": prompt[:200]}
        save_state(state)
        sys.exit(0)

    if event != "PreToolUse":
        sys.exit(0)
    tool = str(payload.get("tool_name") or "")
    tool_input = payload.get("tool_input") or {}
    cwd = str(payload.get("cwd") or "")
    approval = state.get(session, {})
    if approval.get("approved"):
        command = strip_message_text(str(tool_input.get("command") or ""))
        company = "/Desktop/bhsn/" in cwd or "allibee" in command
        if not (company and COMPANY_PROD.search(command) and deploy_label(command, cwd) and not approval.get("prod")):
            sys.exit(0)
        deny("회사(앨리비·큐) prod 배포 — '배포해'는 dev·demo 까지만 허락한다. prod 는 'prod 배포해'처럼 직접 지시받아야 하고, 그")
    if MCP_DEPLOY.match(tool):
        if tool.endswith("create_deployment") and "production" not in json.dumps(tool_input):
            sys.exit(0)
        deny(f"Vercel {tool.rsplit('__', 1)[-1]}")
    if re.search(r"mcp__.*[Gg]it[Hh]ub.*__merge_pull_request$", tool):
        # 클라우드는 gh pr merge 대신 GitHub MCP 로 머지한다(2026-11-28). main 대상이면 막는다.
        base = github_pr_base(tool_input)
        if base is None or base in PROD_BASES:
            deny(f"GitHub PR #{tool_input.get('pullNumber')} 머지(대상 {base or '확인 못 함'})")
        sys.exit(0)
    command = str(tool_input.get("command") or tool_input.get("input") or tool_input.get("keys") or "")
    if not command:
        sys.exit(0)
    label = deploy_label(command, cwd)
    if label:
        deny(label)
    sys.exit(0)


if __name__ == "__main__":
    main()
