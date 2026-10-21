#!/usr/bin/env python3
"""kickoff 작업 현황판. ~/kickoff/*/brief.md 를 모아 단계별로 보여준다.

사용: python3 board.py [--root ~/kickoff] [--json] [--all]
  --all  완료·취소 작업도 보여준다(기본은 숨김).
"""
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # 스킬 폴더에 __pycache__ 를 만들지 않는다

_spec = importlib.util.spec_from_file_location("check_brief", Path(__file__).with_name("check_brief.py"))
check_brief = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check_brief)

# 보드 열. 사용자가 지금 답하거나 결정하거나 보낼 것이 있으면 단계와 상관없이 '결정 필요'로 올린다.
COLUMNS = ["결정 필요", "검토 중", "질문 대기", "착수 가능", "진행 중", "보류", "완료", "취소"]
# 멈췄거나 끝난 프로젝트는 보낼 질문이 남아도 사용자 차례로 올리지 않는다(화면 stages.ts toSendOf 와 같다)
QUIET_STAGES = {"보류", "완료", "취소"}
SLUG = re.compile(r"[\w.-]+")
JIRA_KEY = re.compile(r"[A-Z][A-Z0-9]+-\d+")


def valid_task_dir(root, name):
    """작업 폴더로 인정할 이름과 위치인지. serve.py 도 같은 기준을 쓴다."""
    if not SLUG.fullmatch(name) or name.startswith("."):
        return None
    d = Path(root) / name
    if d.is_symlink() or not d.is_dir() or not (d / "brief.md").is_file():
        return None
    if d.resolve().parent != Path(root).resolve():
        return None
    return d


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def task_state(d):
    """작업 하나의 판정과 화면 상태. 파일이 깨져도 현황판 전체가 멈추지 않게 오류로 담는다."""
    try:
        r = check_brief.check(str(d / "brief.md"))
    except (OSError, UnicodeDecodeError) as e:
        r = {"title": d.name, "task_id": "", "kind": "", "stage": "검토 중", "stage_text": "", "errors": [f"brief.md 를 읽지 못했다: {e}"],
             "warnings": [], "verdict": "질문 대기", "blocking": [], "asked": [], "to_send": [], "promised": [],
             "replied": [], "waiting": [], "defaults": [],
             "important_asked": [], "proposals": [], "early_start": "", "counts": {},
             "work": [], "work_counts": {}, "progress": {"done": 0, "total": 0}}
    inbox = read_json(d / "inbox.json") if (d / "inbox.json").exists() else None
    if inbox is not None and not isinstance(inbox, dict):
        r["errors"].append("inbox.json 이 객체가 아니다")
        inbox = {}
    inbox = inbox or {}
    answered = inbox.get("cards") if isinstance(inbox.get("cards"), dict) else {}
    decided = inbox.get("replies") if isinstance(inbox.get("replies"), dict) else {}
    cards = read_json(d / "cards.json")
    card_ids = [c.get("id") for c in (cards or {}).get("cards", []) if isinstance(c, dict)] if isinstance(cards, dict) else []
    submitted = bool(inbox.get("submitted"))
    r.update({
        "slug": d.name,
        "dir": str(d),
        "inbox_pending": submitted,
        "inbox_draft": (not submitted) and bool(answered or decided),
        "cards_open": 0 if submitted else len([c for c in card_ids if c not in answered]),
        "replies_open": [] if submitted else [q for q in r["replied"] if q not in decided],
        "has_questions": (d / "questions.md").is_file(),
        "updated": int((d / "brief.md").stat().st_mtime),
    })
    r["column"] = column_of(r)
    return r


def column_of(t):
    if t["cards_open"] or t["replies_open"]:
        return "결정 필요"
    # 아직 안 보낸 질문은 사용자가 확인하고 보낼 차례다(보류·완료·취소한 프로젝트는 빼고)
    if t.get("to_send") and t["stage"] not in QUIET_STAGES:
        return "결정 필요"
    return t["stage"] if t["stage"] in COLUMNS else "검토 중"


def collect(root):
    root = Path(os.path.expanduser(root))
    if not root.is_dir():
        return []
    tasks = []
    for d in sorted(root.iterdir()):
        d = valid_task_dir(root, d.name)
        if d:
            tasks.append(task_state(d))
    return tasks


def next_action(t):
    if t["cards_open"]:
        return f"질문 카드 {t['cards_open']}장 답하기" + (" · 고르다 만 답 있음" if t["inbox_draft"] else "")
    if t["replies_open"]:
        return f"받은 답 보고 결정: {', '.join(t['replies_open'])}"
    # 고른 카드 답에 따라 보낼 질문이 바뀔 수 있어 제출을 먼저 안내한다
    if t["inbox_draft"]:
        return "화면에서 고른 답 제출하기"
    if t.get("to_send") and t["stage"] not in QUIET_STAGES:
        return f"보낼 질문 {len(t['to_send'])}개 — 확인하고 보내기"
    if t["inbox_pending"]:
        return "제출함 · 에이전트 반영 기다림"
    if t["column"] == "질문 대기":
        return "담당자 답 기다림" + (" · 먼저 시작할 수 있는 작업 있음" if t["early_start"] else "")
    if t["column"] == "검토 중":
        return "검토 진행 중"
    if t["column"] == "착수 가능":
        return "시작할지 결정(진행 중 / 보류)"
    return ""


def waiting_text(t):
    """질문함: '기획 2건 3일째'. 기다림(하기로 함): '백엔드 — 하기로 함 0일째'. 섞이면 '기획 3건(하기로 함 1건) 3일째'.
    다른 사람이 이미 물어 기다리는 것(others_asked)은 질문처럼 '건'으로 센다."""
    merged = {}
    for w in t["waiting"]:
        m = merged.setdefault(w["owner"], {"n": 0, "promised": 0, "days": None})
        m["n"] += len(w["ids"])
        m["promised"] += len(w.get("promised") or []) - len(w.get("others_asked") or [])
        if w["days"] is not None:
            m["days"] = max(m["days"] or 0, w["days"])
    parts = []
    for owner, m in merged.items():
        if m["promised"] and m["promised"] == m["n"]:
            count = f" {m['n']}건" if m["n"] > 1 else ""
            parts.append(f"{owner} — 하기로 함{count}" + ("" if m["days"] is None else f" {m['days']}일째"))
            continue
        when = "" if m["days"] is None else (" 오늘" if m["days"] == 0 else f" {m['days']}일째")
        mixed = f"(하기로 함 {m['promised']}건)" if m["promised"] else ""
        parts.append(f"{owner} {m['n']}건{mixed}{when}")
    return ", ".join(parts)


def work_text(t):
    """진행 W-1 · 착수 가능 W-2 · 완료 1/5"""
    if not t.get("work"):
        return ""
    by = {}
    for w in t["work"]:
        by.setdefault(w["stage"], []).append(w["id"])
    parts = [f"{s} {', '.join(by[s])}" for s in ("결정 필요", "진행 중", "착수 가능") if s in by]
    p = t["progress"]
    parts.append(f"완료 {p['done']}/{p['total']}")
    return " · ".join(parts)


def display_name(t):
    name = t["title"] or t["slug"]
    tid = re.sub(r"\s*\(.*\)\s*$", "", t["task_id"] or "")
    if JIRA_KEY.fullmatch(tid) and tid not in name:
        name += f" · {tid}"
    return name


def main():
    argv = sys.argv[1:]
    root = "~/kickoff"
    if "--root" in argv:
        root = argv[argv.index("--root") + 1]
    tasks = collect(root)
    if "--all" not in argv:
        tasks = [t for t in tasks if t["column"] not in {"완료", "취소"}]
    if "--json" in argv:
        print(json.dumps({"root": os.path.expanduser(root), "columns": COLUMNS, "tasks": tasks}, ensure_ascii=False, indent=2))
        return
    if not tasks:
        print(f"{root} 에 진행 중인 킥오프가 없다.")
        return
    print("| 단계 | 프로젝트 | 구분 | 작업 | 답 대기 | 다음 할 일 |")
    print("|---|---|---|---|---|---|")
    for col in COLUMNS:
        for t in [t for t in tasks if t["column"] == col]:
            flag = " ⚠ 형식 오류" if t["errors"] else ""
            print(f"| {col} | {display_name(t)}{flag} | {t['kind']} | {work_text(t) or '-'} | {waiting_text(t) or '-'} | {next_action(t) or '-'} |")


if __name__ == "__main__":
    main()
