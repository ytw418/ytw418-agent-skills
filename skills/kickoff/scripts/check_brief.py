#!/usr/bin/env python3
"""kickoff brief.md 형식 검사와 착수 판정.

사용: python3 check_brief.py <brief.md> [--json]
종료 코드: 형식 오류가 있으면 1, 없으면 0 (착수 판정과 무관).
board.py·serve.py 가 이 파일의 함수를 불러 쓴다.
"""
import datetime
import json
import re
import sys

SECTIONS = ["0.", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9."]
TYPES = {"누락", "모순", "모호", "위험"}
IMPACTS = {"막힘", "중요", "사소"}
STATES = {"열림", "추천(확인 전)", "질문함", "답 옴", "정함", "범위 밖"}
CLOSED = {"정함", "범위 밖"}
DECISION_STATES = {"확정", "제안"}
# 작업 단계. 앞의 셋은 check 판정으로 정하고, 뒤의 넷은 사용자가 정한다.
KICKOFF_STAGES = {"검토 중", "질문 대기", "착수 가능"}
USER_STAGES = {"진행 중", "보류", "취소", "완료"}
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def split_row(line, honor_code=True):
    """표 한 행을 칸으로 나눈다. 백틱 안의 | 와 \\| 는 칸 구분으로 보지 않는다.
    백틱이 줄 끝까지 닫히지 않으면 백틱을 무시하고 다시 나눈다."""
    cells, buf, in_code, i = [], "", False, 0
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|") and not s.endswith("\\|"):
        s = s[:-1]
    while i < len(s):
        ch = s[i]
        if ch == "\\" and i + 1 < len(s) and s[i + 1] == "|":
            buf += "|"
            i += 2
            continue
        if ch == "`" and honor_code:
            in_code = not in_code
        if ch == "|" and not in_code:
            cells.append(buf.strip())
            buf = ""
        else:
            buf += ch
        i += 1
    cells.append(buf.strip())
    if in_code:
        return split_row(line, honor_code=False)
    return cells


SEPARATOR = re.compile(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$")


def parse_sections(text):
    sections, current = {}, None
    for line in text.splitlines():
        m = re.match(r"^##\s+(\d+\.)", line)
        if m:
            current = m.group(1)
            sections[current] = []
        elif current:
            sections[current].append(line)
    return sections


def table_blocks(lines):
    """연속한 '|' 줄을 표 하나로 본다. 둘째 줄이 구분선(|---|)인 것만 표다."""
    blocks, cur = [], []
    for l in lines + [""]:
        if l.strip().startswith("|"):
            cur.append(l)
            continue
        if len(cur) >= 2 and SEPARATOR.match(cur[1].strip()):
            blocks.append(cur)
        cur = []
    return blocks


def parse_tables(lines, mismatches=None):
    """장 안의 표를 모두 읽는다. 칸 수가 헤더와 다른 행은 mismatches 에 적는다."""
    tables = []
    for block in table_blocks(lines):
        header = split_row(block[0])
        rows = []
        for r in block[2:]:
            cells = split_row(r)
            if mismatches is not None and len(cells) != len(header):
                mismatches.append(f"'{cells[0] if cells else r.strip()[:20]}' 행의 칸 수 {len(cells)} ≠ 헤더 {len(header)}")
            cells += [""] * (len(header) - len(cells))
            rows.append(dict(zip(header, cells)))
        tables.append(rows)
    return tables


def parse_table(lines, mismatches=None):
    """장의 첫 표."""
    tables = parse_tables(lines, mismatches)
    return tables[0] if tables else []


def owner_roles(text):
    """'기획(김PM)+디자인' → ['기획', '디자인']. 이름 괄호는 떼고 역할로 묶는다."""
    return [re.sub(r"\(.*?\)", "", o).strip() for o in (text or "?").split("+") if o.strip()] or ["?"]


def is_placeholder(v):
    return bool(re.fullmatch(r"<[^>]*>", v.strip()))


def first_date(text):
    m = DATE.search(text or "")
    if not m:
        return None
    try:
        return datetime.date.fromisoformat(m.group(0))
    except ValueError:
        return None


def check_text(text, path="", today=None):
    today = today or datetime.date.today()
    sections = parse_sections(text)
    errors, warnings = [], []
    title_m = re.search(r"^#\s+(?:킥오프:\s*)?(.+)$", text, re.M)
    meta = {r.get("키", ""): r.get("값", "") for r in parse_table(sections.get("0.", []))}

    for s in SECTIONS:
        if s not in sections:
            errors.append(f"{s.rstrip('.')}장이 없다")

    for key, lines in sections.items():
        mismatches = []
        for table in parse_tables(lines, mismatches):
            for row in table:
                for col, v in row.items():
                    if is_placeholder(v):
                        errors.append(f"{key.rstrip('.')}장 '{col}' 칸에 템플릿 자리표시자가 남았다: {v}")
        for m in mismatches:
            errors.append(f"{key.rstrip('.')}장 {m} — 칸 안의 | 는 \\| 로 쓴다")

    for k in ["작업 id", "구분", "출처", "작성일", "상태"]:
        if k not in meta:
            errors.append(f"0장 '{k}' 행이 없다")
    if "요청자 질문" not in meta:
        warnings.append("0장 '요청자 질문' 행이 없다(없으면 '없음'으로 쓴다)")

    reqs = parse_table(sections.get("2.", []))
    if not reqs:
        errors.append("2장 요구사항이 없다")
    seen = set()
    for r in reqs:
        rid = r.get("ID", "")
        if not re.fullmatch(r"R-\d+", rid):
            errors.append(f"2장 ID 형식이 R-n 이 아니다: '{rid}'")
        if rid in seen:
            errors.append(f"2장 ID 중복: {rid}")
        seen.add(rid)
        if not r.get("출처"):
            errors.append(f"{rid} 출처가 비었다")

    qs = parse_table(sections.get("5.", []))
    seen = set()
    for q in qs:
        qid = q.get("ID", "")
        if not re.fullmatch(r"Q-\d+", qid):
            errors.append(f"5장 ID 형식이 Q-n 이 아니다: '{qid}'")
        if qid in seen:
            errors.append(f"5장 ID 중복: {qid}")
        seen.add(qid)
        if q.get("유형") not in TYPES:
            errors.append(f"{qid} 유형이 {sorted(TYPES)} 중 하나가 아니다: '{q.get('유형')}'")
        if q.get("영향") not in IMPACTS:
            errors.append(f"{qid} 영향이 {sorted(IMPACTS)} 중 하나가 아니다: '{q.get('영향')}'")
        if q.get("상태") not in STATES:
            errors.append(f"{qid} 상태가 {sorted(STATES)} 중 하나가 아니다: '{q.get('상태')}'")
        if not q.get("근거"):
            errors.append(f"{qid} 근거가 비었다")
        if not q.get("결정 주체"):
            errors.append(f"{qid} 결정 주체가 비었다")
        if q.get("상태") in {"정함", "답 옴"} and not q.get("답"):
            errors.append(f"{qid} 상태가 {q.get('상태')}인데 답이 비었다")
        if q.get("상태") == "추천(확인 전)" and not q.get("추천"):
            errors.append(f"{qid} 상태가 추천(확인 전)인데 추천이 비었다")
        if q.get("상태") == "질문함" and not first_date(q.get("답")):
            warnings.append(f"{qid} 질문함인데 답 칸에 질문한 날짜(YYYY-MM-DD)가 없다")

    proposals, decisions = [], parse_table(sections.get("6.", []))
    for d in decisions:
        did = d.get("ID", "")
        if not re.fullmatch(r"D-\d+", did):
            errors.append(f"6장 ID 형식이 D-n 이 아니다: '{did}'")
        if not d.get("이유"):
            errors.append(f"{did} 이유가 비었다")
        if "상태" in d:
            if d["상태"] not in DECISION_STATES:
                errors.append(f"{did} 상태가 {sorted(DECISION_STATES)} 중 하나가 아니다: '{d['상태']}'")
            elif d["상태"] == "제안":
                proposals.append(did)

    acs = parse_table(sections.get("8.", []))
    if not acs:
        warnings.append("8장 수용 기준이 없다")
    for a in acs:
        if not a.get("확인 방법"):
            errors.append(f"{a.get('ID', '?')} 확인 방법이 비었다")

    # 영향 칸이 깨진 Q 는 막힘으로 본다(형식 오류 때문에 착수 가능이 되지 않게)
    blocking = [q.get("ID") for q in qs if q.get("영향") not in {"중요", "사소"} and q.get("상태") not in CLOSED]
    asked = [q.get("ID") for q in qs if q.get("상태") == "질문함"]
    replied = [q.get("ID") for q in qs if q.get("상태") == "답 옴"]
    defaults = [q.get("ID") for q in qs if q.get("상태") == "추천(확인 전)"]
    opened = [q.get("ID") for q in qs if q.get("상태") == "열림"]
    if opened:
        warnings.append(f"아직 분류하지 않은(열림) 항목: {', '.join(opened)}")

    qmap = {q.get("ID"): q for q in qs}
    for d in decisions:
        if d.get("상태") != "제안":
            continue
        related = re.findall(r"Q-\d+", d.get("관련 Q", ""))
        if related and not any(qmap.get(r, {}).get("상태") in {"질문함", "답 옴", "열림"} for r in related):
            warnings.append(f"{d.get('ID')}가 제안인데 관련 Q({', '.join(related)})가 모두 닫혔다 — 담당자 동의를 묻는 Q를 질문함으로 둔다")

    # 담당자별 답 대기: 질문한 날짜가 가장 오래된 것 기준으로 며칠째인지
    waiting = {}
    for q in qs:
        if q.get("상태") != "질문함":
            continue
        d = first_date(q.get("답"))
        # '기획+디자인'처럼 함께 정할 항목은 각 담당자 쪽에 모두 센다
        for owner in owner_roles(q.get("결정 주체")):
            w = waiting.setdefault(owner, {"owner": owner, "ids": [], "oldest": None})
            w["ids"].append(q.get("ID"))
            if d and (w["oldest"] is None or d < w["oldest"]):
                w["oldest"] = d
    waiting_list = []
    for w in waiting.values():
        days = (today - w["oldest"]).days if w["oldest"] else None
        waiting_list.append({"owner": w["owner"], "ids": w["ids"], "since": w["oldest"].isoformat() if w["oldest"] else None, "days": days})

    early = ""
    for line in sections.get("7.", []):
        m = re.match(r"^-\s*막힘과 무관해 먼저 시작할 수 있는 것:\s*(.*)$", line)
        if m:
            early = m.group(1).strip()

    important_asked = [q.get("ID") for q in qs if q.get("영향") == "중요" and q.get("상태") == "질문함"]
    verdict = "착수 가능" if not blocking else "질문 대기"

    stage = meta.get("상태", "")
    stage_key = next((s for s in KICKOFF_STAGES | USER_STAGES if stage.startswith(s)), "")
    if not stage_key:
        errors.append(f"0장 상태가 {sorted(KICKOFF_STAGES | USER_STAGES)} 중 하나로 시작하지 않는다: '{stage}'")
    elif stage_key in {"질문 대기", "착수 가능"} and stage_key != verdict:
        warnings.append(f"0장 상태가 판정과 다르다: 상태 '{stage}', 판정 '{verdict}'")
    elif stage_key == "질문 대기":
        listed = re.search(r"\(막힘\s*([^)]*)\)", stage)
        if listed and sorted(re.findall(r"Q-\d+", listed.group(1))) != sorted(blocking):
            warnings.append(f"0장 상태 괄호의 막힘 목록이 실제와 다르다: 실제 {', '.join(blocking)}")

    return {
        "file": path,
        "title": title_m.group(1).strip() if title_m else "",
        "task_id": meta.get("작업 id", ""),
        "kind": meta.get("구분", ""),
        "stage": stage_key or stage,
        "stage_text": stage,
        "errors": errors,
        "warnings": warnings,
        "verdict": verdict,
        "blocking": blocking,
        "asked": asked,
        "replied": replied,
        "waiting": waiting_list,
        "defaults": defaults,
        "important_asked": important_asked,
        "proposals": proposals,
        "early_start": early,
        "counts": {"requirements": len(reqs), "questions": len(qs), "acceptance": len(acs)},
    }


def check(path, today=None):
    with open(path, encoding="utf-8") as f:
        return check_text(f.read(), path, today)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        sys.exit(2)
    result = check(args[0])
    if "--json" in sys.argv:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        for e in result["errors"]:
            print(f"오류: {e}")
        for w in result["warnings"]:
            print(f"경고: {w}")
        c = result["counts"]
        print(f"요구사항 {c['requirements']}개, 검토 항목 {c['questions']}개, 수용 기준 {c['acceptance']}개")
        print(f"판정: {result['verdict']}" + (" (먼저 시작할 수 있는 작업 있음)" if result["blocking"] and result["early_start"] else ""))
        if result["blocking"]:
            print(f"  막힘(미해결): {', '.join(result['blocking'])}")
        if result["replied"]:
            print(f"  답 옴 — 사용자 결정 필요: {', '.join(result['replied'])}")
        for w in result["waiting"]:
            since = f", {w['since']}부터 {w['days']}일째" if w["since"] else ""
            print(f"  {w['owner']} 답 대기: {', '.join(w['ids'])}{since}")
        if result["defaults"]:
            print(f"  추천(확인 전) 기본값으로 진행: {', '.join(result['defaults'])}")
        if result["important_asked"]:
            print(f"  중요 항목 답 대기(판정에는 안 셈): {', '.join(result['important_asked'])}")
        if result["proposals"]:
            print(f"  담당자 확인이 필요한 설계 제안: {', '.join(result['proposals'])}")
    sys.exit(1 if result["errors"] else 0)


if __name__ == "__main__":
    main()
