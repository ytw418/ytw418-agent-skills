"""Slack 채널에서 특정 유저의 메시지를 기간 필터링하여 수집한다.

Slack MCP는 oldest/latest 파라미터를 지원하지 않으므로,
Slack API conversations.history를 직접 호출한다.

사용법:
    python fetch_slack_messages.py \
        --channel C0A520V6KE1 \
        --user U092LHJH732 \
        --oldest 1739376000 \
        --latest 1739634000 \
        --output /tmp/slack_common.json \
        --slack-users ~/.claude/skills/daily-scrum/assets/slack_users.json
"""

import json
import os
import re
import urllib.request
import urllib.error
import argparse
import sys
from datetime import datetime

CLAUDE_CONFIG = os.path.expanduser("~/.claude.json")
REQUEST_TIMEOUT = 30


def get_slack_token() -> str:
    with open(CLAUDE_CONFIG) as f:
        data = json.load(f)
    return data["mcpServers"]["slack"]["env"]["SLACK_BOT_TOKEN"]


def load_slack_users(users_file: str) -> dict:
    """slack_users.json에서 {user_id: display_name} 맵 반환."""
    path = os.path.expanduser(users_file)
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        users = json.load(f)
    result = {}
    if isinstance(users, dict):
        users = users.get("members", [])
    for u in users:
        uid = u.get("id", "")
        name = (
            u.get("profile", {}).get("display_name")
            or u.get("profile", {}).get("real_name")
            or u.get("name", uid)
        )
        if uid:
            result[uid] = name
    return result


def resolve_user_name(user_map: dict, user_id: str) -> str:
    return user_map.get(user_id, user_id)


def _slack_api_get(url: str, token: str) -> dict:
    """Slack API GET with error handling."""
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            data = json.loads(resp.read())
        if not data.get("ok"):
            error = data.get("error", "unknown")
            print(f"[slack] API error: {error}", file=sys.stderr)
        return data
    except urllib.error.URLError as e:
        print(f"[slack] URL error: {e}", file=sys.stderr)
        return {"ok": False, "error": str(e)}
    except TimeoutError:
        print(f"[slack] timeout ({REQUEST_TIMEOUT}s)", file=sys.stderr)
        return {"ok": False, "error": "timeout"}


def fetch_channel_messages(
    token: str,
    channel_id: str,
    user_id: str,
    oldest: str,
    latest: str,
) -> list[dict]:
    """지정 채널에서 특정 유저의 메시지를 기간 필터링하여 반환한다."""
    messages = []
    cursor = ""

    while True:
        url = (
            f"https://slack.com/api/conversations.history"
            f"?channel={channel_id}&oldest={oldest}&latest={latest}&limit=200"
        )
        if cursor:
            url += f"&cursor={cursor}"

        data = _slack_api_get(url, token)
        if not data.get("ok"):
            break

        for msg in data.get("messages", []):
            if msg.get("user") == user_id and msg.get("type") == "message":
                if not msg.get("subtype"):
                    messages.append(msg)

        cursor = data.get("response_metadata", {}).get("next_cursor", "")
        if not cursor:
            break

    return messages


def fetch_thread_replies(
    token: str,
    channel_id: str,
    thread_ts: str,
) -> list[dict]:
    """스레드 답글을 수집한다 (부모 메시지 제외)."""
    url = (
        f"https://slack.com/api/conversations.replies"
        f"?channel={channel_id}&ts={thread_ts}&limit=100"
    )
    data = _slack_api_get(url, token)
    if not data.get("ok"):
        return []
    return data.get("messages", [])[1:]


def compress_messages(
    raw_messages: list[dict],
    token: str,
    channel_id: str,
    user_map: dict,
    fetch_replies: bool = True,
) -> list[dict]:
    """raw Slack 메시지에서 필요한 필드만 추출하고 user ID를 이름으로 치환한다."""
    compressed = []

    def replace_mention(m):
        uid = m.group(1)
        return f"@{resolve_user_name(user_map, uid)}"

    for msg in raw_messages:
        ts = float(msg.get("ts", 0))
        dt = datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")
        author = resolve_user_name(user_map, msg.get("user", ""))
        text = msg.get("text", "")

        # <@UXXXXXXX> → 실제 이름으로 치환
        text = re.sub(r"<@(U[A-Z0-9]+)>", replace_mention, text)

        # Slack permalink
        ts_str = msg.get("ts", "0")
        ts_no_dot = ts_str.replace(".", "")
        permalink = f"https://bhsn.slack.com/archives/{channel_id}/p{ts_no_dot}"

        item = {"author": author, "time": dt, "text": text, "url": permalink}

        # 스레드 답글 수집
        if fetch_replies and msg.get("reply_count", 0) > 0:
            raw_replies = fetch_thread_replies(token, channel_id, msg["ts"])
            item["replies"] = [
                {
                    "author": resolve_user_name(user_map, r.get("user", "")),
                    "time": datetime.fromtimestamp(float(r.get("ts", 0))).strftime("%Y-%m-%d %H:%M"),
                    "text": re.sub(r"<@(U[A-Z0-9]+)>", replace_mention, r.get("text", "")),
                }
                for r in raw_replies
                if not r.get("subtype")
            ]

        compressed.append(item)

    return compressed


def fetch_and_compress(
    channel_id: str,
    user_id: str,
    oldest: str,
    latest: str,
    output_file: str,
    slack_users_file: str = "~/.claude/skills/daily-scrum/assets/slack_users.json",
) -> list[dict]:
    """Slack 메시지를 수집하고 압축하여 로컬 파일에 저장한다."""
    token = get_slack_token()
    user_map = load_slack_users(slack_users_file)
    raw = fetch_channel_messages(token, channel_id, user_id, oldest, latest)
    compressed = compress_messages(raw, token, channel_id, user_map)

    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(compressed, f, ensure_ascii=False, indent=2)

    return compressed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Slack 메시지 수집 및 압축")
    parser.add_argument("--channel", required=True, help="채널 ID")
    parser.add_argument("--user", required=True, help="유저 Slack ID")
    parser.add_argument("--oldest", required=True, help="시작 Unix timestamp")
    parser.add_argument("--latest", required=True, help="종료 Unix timestamp")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    parser.add_argument(
        "--slack-users",
        default="~/.claude/skills/daily-scrum/assets/slack_users.json",
        help="slack_users.json 경로",
    )
    args = parser.parse_args()

    result = fetch_and_compress(
        channel_id=args.channel,
        user_id=args.user,
        oldest=args.oldest,
        latest=args.latest,
        output_file=args.output,
        slack_users_file=args.slack_users,
    )
    print(f"[fetch_slack_messages] {len(result)}개 메시지 저장 → {args.output}")
