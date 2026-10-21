#!/usr/bin/env python3
"""kickoff brief.md 형식 검사와 착수 판정.

사용: python3 check_brief.py <brief.md> [--json]
종료 코드: 형식 오류가 있으면 1, 없으면 0 (착수 판정과 무관).
board.py·serve.py 가 이 파일의 함수를 불러 쓴다.
"""
import datetime
import json
import os
import re
import sys

SECTIONS = ["0.", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9."]
TYPES = {"누락", "모순", "모호", "위험"}
IMPACTS = {"막힘", "중요", "사소"}
# 보낼 질문: 질문지에 넣었지만 아직 안 보냄. 질문함: 실제로 보냄(사용자 승인 뒤).
# 기다림: 따로 묻지 않아도 되는 대기(담당자가 하기로 함·다른 사람이 이미 물음).
STATES = {"열림", "추천(확인 전)", "보낼 질문", "질문함", "기다림", "답 옴", "정함", "범위 밖"}
CLOSED = {"정함", "범위 밖"}
WAIT_STATES = {"질문함", "기다림"}  # 담당자 쪽 차례. 답 대기로 센다
DECISION_STATES = {"확정", "제안"}
# 작업 단계. 앞의 셋은 check 판정으로 정하고, 뒤의 넷은 사용자가 정한다.
KICKOFF_STAGES = {"검토 중", "질문 대기", "착수 가능"}
USER_STAGES = {"진행 중", "보류", "취소", "완료"}
# 작업(W-n) 단계. '자동'이면 관련 Q 로 정하고, 나머지는 사용자가 정한다.
WORK_AUTO = "자동"
WORK_USER_STAGES = ["진행 중", "완료", "보류", "취소"]
WORK_FLOW = ["검토 중", "질문 대기", "결정 필요", "착수 가능", "진행 중", "완료"]
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
# R-1·Q-12·D-3·W-2. PR-1·BR-3 같은 다른 키의 일부는 잡지 않는다
REF = re.compile(r"(?<![A-Za-z0-9])[RQDW]-\d+(?!\d)")
QREF = re.compile(r"(?<![A-Za-z0-9])Q-\d+(?!\d)")


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


# 기다림 답 칸이 '다른 사람이 이미 물어봄'인지('하기로 함'이 아니라). 화면도 이 값(waiting[].others_asked)을 쓴다
ASKED_BY_OTHER = re.compile(r"물어\s?(봄|봤|보는)|이미 물|이미 문의")
PROMISE = re.compile(r"기로\s?(함|했|하셨)")


def others_asked(answer):
    a = answer or ""
    return bool(ASKED_BY_OTHER.search(a)) and not PROMISE.search(a)


def answer_who(answer):
    """'질문함 — ○○, 2026-10-17, slack:…' → '○○, '. 상태 말과 날짜 사이(누구에게·누가)."""
    a = answer or ""
    return DATE.split(a.split("—", 1)[1] if "—" in a else a)[0]


def wait_roles(q, people):
    """답 대기를 셀 역할. 결정 주체가 둘 이상이면 답 칸에 적힌 사람·역할 쪽만 센다(못 찾으면 모두)."""
    roles = owner_roles(q.get("결정 주체"))
    if len(roles) < 2:
        return roles
    who = answer_who(q.get("답"))
    hit = [r for r in roles if r in who or any(n in who for n, role in people.items() if role == r)]
    return hit or roles


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
            warnings.append(f"{qid} 질문함인데 답 칸에 보낸 날짜(YYYY-MM-DD)가 없다")
        if q.get("상태") == "기다림" and not first_date(q.get("답")):
            warnings.append(f"{qid} 기다림인데 답 칸에 날짜(YYYY-MM-DD)가 없다")

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
    to_send = [q.get("ID") for q in qs if q.get("상태") == "보낼 질문"]
    promised = [q.get("ID") for q in qs if q.get("상태") == "기다림"]
    replied = [q.get("ID") for q in qs if q.get("상태") == "답 옴"]
    defaults = [q.get("ID") for q in qs if q.get("상태") == "추천(확인 전)"]
    opened = [q.get("ID") for q in qs if q.get("상태") == "열림"]
    if opened:
        warnings.append(f"아직 분류하지 않은(열림) 항목: {', '.join(opened)}")

    qmap = {q.get("ID"): q for q in qs}
    for d in decisions:
        if d.get("상태") != "제안":
            continue
        related = QREF.findall(d.get("관련 Q", ""))
        if related and not any(qmap.get(r, {}).get("상태") in {"보낼 질문", "질문함", "기다림", "답 옴", "열림"} for r in related):
            warnings.append(f"{d.get('ID')}가 제안인데 관련 Q({', '.join(related)})가 모두 닫혔다 — 담당자 동의를 묻는 Q를 보낼 질문으로 둔다")

    # 담당자별 답 대기(질문함·기다림): 날짜가 가장 오래된 것 기준으로 며칠째인지. 보낼 질문은 아직 안 보냈으니 세지 않는다
    people = {}  # 결정 주체 '기획(○○)' 에서 이름 → 역할
    for q in qs:
        for part in (q.get("결정 주체") or "").split("+"):
            m = re.match(r"\s*([^()]+?)\s*\(([^)]+)\)", part)
            if m:
                people[re.sub(r"님$", "", m.group(2).strip())] = m.group(1).strip()
    waiting = {}
    for q in qs:
        if q.get("상태") not in WAIT_STATES:
            continue
        d = first_date(q.get("답"))
        # '기획+디자인'처럼 함께 정할 항목은 답 칸에 적힌 담당자 쪽에만, 못 찾으면 각 담당자 쪽에 모두 센다
        for owner in wait_roles(q, people):
            w = waiting.setdefault(owner, {"owner": owner, "ids": [], "promised": [], "others_asked": [], "oldest": None})
            w["ids"].append(q.get("ID"))
            if q.get("상태") == "기다림":
                w["promised"].append(q.get("ID"))
                if others_asked(q.get("답")):
                    w["others_asked"].append(q.get("ID"))
            if d and (w["oldest"] is None or d < w["oldest"]):
                w["oldest"] = d
    waiting_list = []
    for w in waiting.values():
        days = (today - w["oldest"]).days if w["oldest"] else None
        waiting_list.append({"owner": w["owner"], "ids": w["ids"], "promised": w["promised"], "others_asked": w["others_asked"],
                             "since": w["oldest"].isoformat() if w["oldest"] else None, "days": days})

    # 7장 작업 목록: 작업마다 지금 단계를 계산한다
    ids = {r.get("ID") for r in reqs} | {q.get("ID") for q in qs} | {d.get("ID") for d in decisions}
    work_rows = parse_table(sections.get("7.", []))
    if work_rows and "단계" not in work_rows[0]:
        work_rows = []
    if not work_rows and "7." in sections:
        warnings.append("7장이 작업 목록(W-n 표) 형식이 아니다 — SKILL.md 7단계대로 표로 바꾼다")
    rows_by_id = {w.get("ID", ""): w for w in work_rows}
    ids |= set(rows_by_id)

    def own_stage(w):
        """사용자가 정한 단계가 있으면 그것, 없으면 None."""
        v = w.get("단계", "") or WORK_AUTO
        return v if v in WORK_USER_STAGES else None

    work, seen = [], set()
    for w in work_rows:
        wid = w.get("ID", "")
        if not re.fullmatch(r"W-\d+", wid):
            errors.append(f"7장 ID 형식이 W-n 이 아니다: '{wid}'")
        if wid in seen:
            errors.append(f"7장 ID 중복: {wid}")
        seen.add(wid)
        set_stage = w.get("단계", "") or WORK_AUTO
        if set_stage != WORK_AUTO and set_stage not in WORK_USER_STAGES:
            errors.append(f"{wid} 단계가 '{WORK_AUTO}' 또는 {WORK_USER_STAGES} 중 하나가 아니다: '{set_stage}'")
        related = REF.findall(w.get("관련", ""))
        missing = [r for r in related if r not in ids]
        if missing:
            warnings.append(f"{wid} 관련 ID 가 문서에 없다: {', '.join(missing)}")
        rq = [qmap[r] for r in related if r in qmap]
        before = [r for r in related if r.startswith("W-") and r != wid and r in rows_by_id and own_stage(rows_by_id[r]) not in {"완료", "취소"}]
        ids_of = lambda st: ", ".join(q["ID"] for q in rq if q.get("상태") == st)
        unknown = [q["ID"] for q in rq if q.get("상태") not in STATES]
        if set_stage in WORK_USER_STAGES:
            stage, why = set_stage, "사용자가 정함"
        elif missing:
            stage, why = "검토 중", "문서에 없는 ID: " + ", ".join(missing)
        elif unknown:  # 상태 오타가 '착수 가능'으로 보이지 않게
            stage, why = "검토 중", "상태 확인 필요: " + ", ".join(unknown)
        elif any(q.get("상태") == "답 옴" for q in rq):
            stage, why = "결정 필요", "답 옴: " + ids_of("답 옴")
        elif any(q.get("상태") == "보낼 질문" for q in rq):
            stage, why = "검토 중", "아직 안 보낸 질문: " + ids_of("보낼 질문")
        elif any(q.get("상태") in WAIT_STATES for q in rq):
            stage, why = "질문 대기", " · ".join(f"{st}: {ids_of(st)}" for st in ("질문함", "기다림") if ids_of(st))
        elif any(q.get("상태") == "열림" for q in rq):
            stage, why = "검토 중", "아직 분류 안 됨: " + ids_of("열림")
        elif before:
            stage, why = "질문 대기", "앞 작업: " + ", ".join(before)
        elif any(q.get("상태") == "추천(확인 전)" for q in rq):
            stage, why = "착수 가능", "기본값으로 진행: " + ids_of("추천(확인 전)")
        else:
            stage, why = "착수 가능", "관련 질문이 모두 정해짐" if rq else "관련 질문 없음"
        waits = [first_date(q.get("답")) for q in rq if q.get("상태") in WAIT_STATES]
        waits = [d for d in waits if d]
        work.append({
            "id": wid, "title": w.get("작업", ""), "related": related, "owner": w.get("담당", ""),
            "stage_set": set_stage, "stage": stage, "why": why, "memo": w.get("메모", ""),
            "wait_days": (today - min(waits)).days if waits else None,
        })
    work_counts = {s: 0 for s in WORK_FLOW + ["보류", "취소"]}
    for w in work:
        work_counts[w["stage"]] = work_counts.get(w["stage"], 0) + 1
    progress = {"done": work_counts["완료"], "total": len(work) - work_counts["취소"]}

    early = ""
    for line in sections.get("7.", []):
        m = re.match(r"^-\s*막힘과 무관해 먼저 시작할 수 있는 것:\s*(.*)$", line)
        if m:
            early = m.group(1).strip()

    ready = [w["id"] for w in work if w["stage"] == "착수 가능"]
    if work:
        early = (", ".join(ready) + " 은 바로 시작할 수 있다") if ready else ""

    important_asked = [q.get("ID") for q in qs if q.get("영향") == "중요" and q.get("상태") in WAIT_STATES]
    # 막힘 중 아직 안 보낸 질문이나 분류 안 된 것(상태 오타 포함)이 있으면 대기가 아니라 검토 중이다
    unsent = [q.get("ID") for q in qs if q.get("ID") in blocking and (q.get("상태") in {"보낼 질문", "열림"} or q.get("상태") not in STATES)]
    verdict = "착수 가능" if not blocking else "검토 중" if unsent else "질문 대기"

    if path:
        folder = os.path.basename(os.path.dirname(os.path.normpath(path)))
        tid = re.sub(r"\s*\(.*\)\s*$", "", meta.get("작업 id", ""))
        if tid and folder and folder != "out2" and not re.fullmatch(r"[A-Z][A-Z0-9]+-\d+", tid) and tid != folder:
            warnings.append(f"0장 작업 id '{tid}' 가 폴더 이름 '{folder}' 와 다르다")
    stage = meta.get("상태", "")
    stage_key = next((s for s in KICKOFF_STAGES | USER_STAGES if stage.startswith(s)), "")
    if not stage_key:
        errors.append(f"0장 상태가 {sorted(KICKOFF_STAGES | USER_STAGES)} 중 하나로 시작하지 않는다: '{stage}'")
    elif stage_key in KICKOFF_STAGES and stage_key != verdict:
        # 질문을 보내 판정이 '질문 대기'로 바뀌었는데 0장이 '검토 중'에 남는 경우도 잡는다
        hint = (f" — 막힘 중 보낼 질문·열림(상태 오류 포함): {', '.join(unsent)}" if verdict == "검토 중"
                else f" — 0장을 '질문 대기 (막힘 {', '.join(blocking)})'로 바꾼다" if verdict == "질문 대기"
                else " — 0장을 '착수 가능'으로 바꾼다")
        warnings.append(f"0장 상태가 판정과 다르다: 상태 '{stage}', 판정 '{verdict}'{hint}")
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
        "to_send": to_send,
        "promised": promised,
        "replied": replied,
        "waiting": waiting_list,
        "defaults": defaults,
        "important_asked": important_asked,
        "proposals": proposals,
        "early_start": early,
        "work": work,
        "work_counts": work_counts,
        "progress": progress,
        "counts": {"requirements": len(reqs), "questions": len(qs), "acceptance": len(acs)},
    }


# 질문지(Slack 에 붙이는 글)에서 통보·지시로 들리는 말. references/slack-tone.md 참고
TONE_BANNED = ["답이 없으면", "답이 없는", "회신이 없", "미응답", "간주", "회신 바랍니다", "주시기 바랍니다", "기본값으로 진행하겠", "진행합니다"]


def check_questions(text):
    """questions.md 의 담당자 절(내부용 제외)을 점검해 경고 목록을 돌려준다."""
    warns = []
    for part in re.split(r"\n(?=## )", text):
        if not part.startswith("## ") or re.match(r"##\s*내부용", part):
            continue
        head, _, body = part.partition("\n")
        who = head.lstrip("# ").strip()
        for b in TONE_BANNED:
            if b in body:
                warns.append(f"질문지 '{who}': 통보처럼 들리는 말 '{b}' — references/slack-tone.md 대로 제안으로 바꾼다")
        if re.search(r"(?<![A-Za-z0-9])[QWD]-\d+", body):
            warns.append(f"질문지 '{who}': 본문에 내부 번호(Q-n·W-n·D-n)가 있다 — 내부용 절로 옮긴다")
        if re.search(r"[OＯ○]{2}님|<[^>\n]{1,40}>|[가-힣](PM|PO|팀장|매니저)님|담당자님", head + body) or "이름 확인 후 보냄" in head:
            warns.append(f"질문지 '{who}': 이름 자리 표시가 남아 있다 — 이름을 확인한 뒤 보낸다")
        for phrase, limit in [("생각하고 있는데 괜찮을까요", 2), ("여쭤봐요", 3), ("것 같아", 3)]:
            n = body.count(phrase)
            if n > limit:
                warns.append(f"질문지 '{who}': '{phrase}'가 {n}번 나온다 — {limit}번까지만 쓰고 표현을 바꾼다")
    return warns


def check(path, today=None):
    with open(path, encoding="utf-8") as f:
        result = check_text(f.read(), path, today)
    qpath = os.path.join(os.path.dirname(os.path.abspath(path)), "questions.md")
    if os.path.isfile(qpath):
        with open(qpath, encoding="utf-8") as f:
            result["warnings"] += check_questions(f.read())
    return result


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
        if result["to_send"]:
            print(f"  보낼 질문(아직 안 보냄) — 확인하고 보내기: {', '.join(result['to_send'])}")
        for w in result["waiting"]:
            since = f", {w['since']}부터 {w['days']}일째" if w["since"] else ""
            kinds = [("하기로 함", [i for i in w["promised"] if i not in w["others_asked"]]), ("이미 물어봄", w["others_asked"])]
            kinds = " · ".join(f"{k}: {', '.join(v)}" for k, v in kinds if v)
            promised = f" ({kinds})" if kinds else ""
            print(f"  {w['owner']} 답 대기: {', '.join(w['ids'])}{promised}{since}")
        if result["defaults"]:
            print(f"  추천(확인 전) 기본값으로 진행: {', '.join(result['defaults'])}")
        if result["important_asked"]:
            print(f"  중요 항목 답 대기(판정에는 안 셈): {', '.join(result['important_asked'])}")
        if result["proposals"]:
            print(f"  담당자 확인이 필요한 설계 제안: {', '.join(result['proposals'])}")
        if result["work"]:
            p = result["progress"]
            print(f"작업 {len(result['work'])}개, 완료 {p['done']}/{p['total']}")
            for w in result["work"]:
                print(f"  {w['id']} [{w['stage']}] {w['title']} — {w['why']}")
    sys.exit(1 if result["errors"] else 0)


if __name__ == "__main__":
    main()
