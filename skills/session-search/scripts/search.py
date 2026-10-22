#!/usr/bin/env python3
"""과거 Claude Code 세션 기록에서 대화 내용을 검색한다.

~/.claude/projects/**/*.jsonl 을 훑어 사용자/어시스턴트 발화와 도구 입력에서
패턴을 찾고, 세션 경로·시각·매칭 줄을 출력한다. 읽기 전용.
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

PROJECTS = Path.home() / ".claude" / "projects"

# 기록 전문을 그대로 뱉으면 검색 결과가 컨텍스트를 잡아먹는다.
SNIPPET_CHARS = 220


def iter_texts(obj):
    """중첩된 메시지 구조에서 사람이 읽을 수 있는 문자열만 뽑아낸다."""
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for key, val in obj.items():
            # base64 이미지·서명 같은 잡음은 건너뛴다
            if key in ("data", "signature", "thinking_signature"):
                continue
            yield from iter_texts(val)
    elif isinstance(obj, list):
        for item in obj:
            yield from iter_texts(item)


def snippet(text: str, match: re.Match) -> str:
    start = max(0, match.start() - SNIPPET_CHARS // 2)
    end = min(len(text), match.end() + SNIPPET_CHARS // 2)
    out = text[start:end].replace("\n", " ⏎ ")
    return ("…" if start else "") + out + ("…" if end < len(text) else "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pattern", help="검색할 정규식 (대소문자 무시)")
    ap.add_argument("--days", type=int, default=90, help="검색 기간 (기본 90일)")
    ap.add_argument("--role", choices=["user", "assistant", "any"], default="any")
    ap.add_argument("--max", type=int, default=25, help="최대 결과 수")
    ap.add_argument("--project", help="프로젝트 디렉토리명 부분 일치 필터")
    ap.add_argument("--files-only", action="store_true", help="세션 파일 경로만 출력")
    args = ap.parse_args()

    try:
        rx = re.compile(args.pattern, re.IGNORECASE)
    except re.error as exc:
        sys.exit(f"정규식 오류: {exc}")

    if not PROJECTS.is_dir():
        sys.exit(f"세션 디렉토리가 없다: {PROJECTS}")

    cutoff = time.time() - args.days * 86400
    hits, seen_files, scanned = [], set(), 0

    for path in sorted(PROJECTS.rglob("*.jsonl"), key=lambda p: -p.stat().st_mtime):
        try:
            if path.stat().st_mtime < cutoff:
                continue
        except OSError:
            continue
        if args.project and args.project.lower() not in path.parent.name.lower():
            continue
        scanned += 1

        try:
            with path.open(encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    # 정규식을 돌리기 전에 싸게 걸러낸다
                    if not rx.search(line):
                        continue
                    try:
                        rec = json.loads(line)
                    except ValueError:
                        continue
                    msg = rec.get("message") or {}
                    role = msg.get("role") or rec.get("type") or "?"
                    if args.role != "any" and role != args.role:
                        continue
                    for text in iter_texts(msg.get("content", "")):
                        m = rx.search(text)
                        if not m:
                            continue
                        hits.append(
                            {
                                "file": str(path),
                                "project": path.parent.name,
                                "ts": rec.get("timestamp", ""),
                                "role": role,
                                "snippet": snippet(text, m),
                            }
                        )
                        seen_files.add(str(path))
                        break
                    if len(hits) >= args.max:
                        break
        except OSError:
            continue
        if len(hits) >= args.max:
            break

    if args.files_only:
        for f in sorted(seen_files):
            print(f)
        return

    truncated = len(hits) >= args.max
    # 상한에 걸리면 나머지 세션은 아예 열지 않는다. scanned를 "전체 검색"으로
    # 읽으면 안 되므로 조기 종료를 명시한다.
    scope = f"세션 {scanned}개까지 보고 중단" if truncated else f"세션 {scanned}개 전체 검색"
    print(f"{scope} (최근 {args.days}일) — 매칭 {len(hits)}건\n")
    for h in hits:
        ts = h["ts"][:19].replace("T", " ") if h["ts"] else "?"
        print(f"[{ts}] {h['role']}  ({h['project']})")
        print(f"  {h['snippet']}")
        print(f"  ↳ {h['file']}\n")

    if truncated:
        print(
            f"결과를 {args.max}건에서 끊었고 나머지 세션은 열지 않았다."
            " --max 를 늘리거나 패턴을 좁혀라."
        )


if __name__ == "__main__":
    main()
