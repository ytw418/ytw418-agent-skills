"""GitHub PR, 커밋, 리뷰 정보를 수집하고 필요한 필드만 압축하여 반환한다.

gh CLI를 사용하여 bhsn-ai org의 활동을 수집하고,
필요한 필드만 추출한 압축 데이터를 로컬 파일에 저장한다.

사용법:
    python fetch_github_activity.py \
        --username girinman \
        --start 2026-02-14 \
        --end 2026-02-19 \
        --output /tmp/github_girinman.json \
        --project-filter GEN

출력 형식:
    {
        "prs": [{"title": "...", "url": "...", "state": "...", "repo": "...", "created_at": "..."}],
        "commits": [{"message": "...", "url": "...", "repo": "...", "date": "..."}],
        "reviews": [{"title": "...", "url": "...", "repo": "...", "author": "...", "state": "..."}]
    }
"""

import json
import os
import subprocess
import argparse
import re
import sys


def run_gh(args: list[str], timeout: int = 45) -> list[dict] | dict:
    """gh CLI를 실행하고 JSON 결과를 반환한다."""
    try:
        result = subprocess.run(
            ["gh"] + args,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            print(f"[gh] stderr: {result.stderr.strip()}", file=sys.stderr)
            return []
        if not result.stdout.strip():
            return []
        stdout = result.stdout.strip()
        try:
            return json.loads(stdout)
        except json.JSONDecodeError:
            parsed_lines = []
            for line in stdout.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    parsed_lines.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
            return parsed_lines
    except subprocess.TimeoutExpired:
        print(f"[gh] timeout ({timeout}s) for: gh {' '.join(args)}", file=sys.stderr)
        return []
    except FileNotFoundError:
        print("[gh] gh CLI not found", file=sys.stderr)
        return []


def fetch_prs(username: str, start: str, end: str) -> list[dict]:
    """작성한 PR 목록을 수집한다 (dev→stage 머지 PR 제외)."""
    full = run_gh([
        "api", "search/issues",
        "--method", "GET",
        "-f", f"q=is:pr author:{username} org:bhsn-ai created:{start}..{end}",
    ])
    items = full if isinstance(full, list) else full.get("items", []) if isinstance(full, dict) else []

    prs = []
    for item in items:
        title = item.get("title", "")
        # dev→stage 머지 PR 제외
        if "dev" in title.lower() and "stage" in title.lower():
            continue
        prs.append({
            "title": title,
            "url": item.get("html_url", ""),
            "state": item.get("state", ""),
            "repo": item.get("repository_url", "").split("/")[-1],
            "created_at": item.get("created_at", "")[:10],
            "number": item.get("number"),
        })
    return prs


def fetch_commits(username: str, start: str, end: str) -> list[dict]:
    """작성한 커밋 목록을 수집한다 (머지 커밋 제외)."""
    full = run_gh([
        "api", "search/commits",
        "--method", "GET",
        "-f", f"q=author:{username} org:bhsn-ai author-date:{start}..{end}",
    ])
    items = full if isinstance(full, list) else full.get("items", []) if isinstance(full, dict) else []

    commits = []
    for item in items:
        commit_data = item.get("commit", {})
        repo_url = item.get("repository", {}).get("html_url", "")
        sha = item.get("sha", "")
        msg_lines = commit_data.get("message", "").split("\n")
        first_line = msg_lines[0] if msg_lines else ""

        if first_line.startswith("Merge "):
            continue

        commits.append({
            "message": first_line,
            "url": f"{repo_url}/commit/{sha}" if repo_url and sha else "",
            "repo": repo_url.split("/")[-1],
            "date": commit_data.get("author", {}).get("date", "")[:10],
        })
    return commits


def fetch_reviews(username: str, start: str, end: str) -> list[dict]:
    """리뷰한 PR 목록을 수집한다 (본인 PR 제외)."""
    full = run_gh([
        "api", "search/issues",
        "--method", "GET",
        "-f", f"q=is:pr reviewed-by:{username} org:bhsn-ai updated:{start}..{end}",
    ])
    items = full if isinstance(full, list) else full.get("items", []) if isinstance(full, dict) else []

    reviews = []
    for item in items:
        author_login = item.get("user", {}).get("login", "")
        if author_login == username:
            continue
        reviews.append({
            "title": item.get("title", ""),
            "url": item.get("html_url", ""),
            "repo": item.get("repository_url", "").split("/")[-1],
            "author": author_login,
            "state": item.get("state", ""),
        })
    return reviews


def filter_by_project(data: dict, jira_keys: list[str]) -> dict:
    """Jira 티켓 키 목록과 매칭되는 항목만 필터링한다.

    Args:
        data: {"prs": [...], "commits": [...], "reviews": [...]}
        jira_keys: 매칭할 Jira 티켓 키 목록 (예: ["GEN-576", "GEN-577"])

    Returns:
        필터링된 data (같은 구조)
    """
    if not jira_keys:
        return data

    key_set = set(k.upper() for k in jira_keys)
    ticket_pattern = re.compile(r"[A-Z]+-\d+")

    def matches(text: str) -> bool:
        found = ticket_pattern.findall(text.upper())
        return any(k in key_set for k in found)

    return {
        "prs": [p for p in data["prs"] if matches(p.get("title", ""))],
        "commits": [c for c in data["commits"] if matches(c.get("message", ""))],
        "reviews": data["reviews"],  # 리뷰는 필터링하지 않음
    }


def fetch_and_compress(
    username: str,
    start: str,
    end: str,
    output_file: str,
    project_filter: str | None = None,
) -> dict:
    """GitHub 활동을 수집하고 압축하여 로컬 파일에 저장한다."""
    data = {
        "prs": fetch_prs(username, start, end),
        "commits": fetch_commits(username, start, end),
        "reviews": fetch_reviews(username, start, end),
    }

    # 프로젝트 필터링 (jira_keys는 별도 전달 필요 — CLI에서는 미지원)
    # main agent가 결과 파일 읽은 후 직접 필터링하거나,
    # --project-filter 옵션으로 프로젝트 prefix 필터링
    if project_filter:
        prefix = project_filter.upper()
        ticket_pattern = re.compile(rf"\b{prefix}-\d+")

        def has_prefix(text: str) -> bool:
            return bool(ticket_pattern.search(text.upper()))

        data = {
            "prs": [p for p in data["prs"] if has_prefix(p.get("title", ""))],
            "commits": [c for c in data["commits"] if has_prefix(c.get("message", ""))],
            "reviews": data["reviews"],
        }

    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GitHub 활동 수집 및 압축")
    parser.add_argument("--username", required=True, help="GitHub 사용자명")
    parser.add_argument("--start", required=True, help="시작일 (YYYY-MM-DD)")
    parser.add_argument("--end", required=True, help="종료일 (YYYY-MM-DD)")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    parser.add_argument(
        "--project-filter",
        default=None,
        help="Jira 프로젝트 prefix로 필터링 (예: GEN)",
    )
    args = parser.parse_args()

    result = fetch_and_compress(
        username=args.username,
        start=args.start,
        end=args.end,
        output_file=args.output,
        project_filter=args.project_filter,
    )
    pr_count = len(result.get("prs", []))
    commit_count = len(result.get("commits", []))
    review_count = len(result.get("reviews", []))
    print(f"[fetch_github_activity] PR {pr_count}개, 커밋 {commit_count}개, 리뷰 {review_count}개 저장 → {args.output}")
