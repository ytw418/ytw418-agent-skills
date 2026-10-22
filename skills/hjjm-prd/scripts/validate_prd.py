#!/usr/bin/env python3
"""HJJM PRD 형식 검증기.

사용: python3 validate_prd.py <prd.md>
검사: 필수 섹션(0~9) 존재, 입력 식별값 채움, AC 행의 판정/검사 필드, 이슈 담당 파일 중복,
      추적표에 AC/검사 누락, 화면 상태 5종 존재. 오류가 있으면 종료 코드 1.
"""
import re
import sys
from collections import defaultdict

SECTIONS = ["## 0.", "## 1.", "## 2.", "## 3.", "## 4.", "## 5.", "## 6.", "## 7.", "## 8.", "## 9."]
STATES = ["기본", "로딩", "빈", "오류", "권한없음"]


def rows(block):
    out = []
    for line in block.splitlines():
        if line.startswith("|") and not re.match(r"^\|\s*-", line):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            out.append(cells)
    return out


def section(text, n):
    m = re.search(rf"^## {n}\..*?(?=^## \d+\.|\Z)", text, re.S | re.M)
    return m.group(0) if m else ""


def main(path):
    text = open(path, encoding="utf-8").read()
    errors = []

    for s in SECTIONS:
        if s not in text:
            errors.append(f"필수 섹션 없음: {s}")

    for key in ["prd_id", "version", "디자인 참조", "기준 SHA"]:
        m = re.search(rf"\|\s*{key}\s*\|\s*(.*?)\s*\|", section(text, 0))
        if not m or not m.group(1) or m.group(1).startswith("<"):
            errors.append(f"입력 식별값 비어 있음: {key}")

    ac_ids = set()
    for cells in rows(section(text, 5)):
        if len(cells) >= 5 and cells[0].startswith("AC-"):
            ac_ids.add(cells[0])
            if "예/아니오" not in cells[2]:
                errors.append(f"{cells[0]}: 판정이 '예/아니오'가 아님")
            if not re.search(r"V-|`", cells[3]):
                errors.append(f"{cells[0]}: 검사(V-n 또는 명령) 없음")
            if cells[4] not in ("자동", "수동"):
                errors.append(f"{cells[0]}: 자동/수동 표기 없음")
            if not (re.search(r"(면|에서|시|후|때|경우)", cells[1]) and re.search(r"(다|됨)$", cells[1])):
                errors.append(f"{cells[0]}: '조건 → 기대 결과' 문장 형태가 아님")
    if not ac_ids:
        errors.append("수용 기준(AC-n) 행이 없음")

    for screen in re.findall(r"^### (S-\d+)", section(text, 3), re.M):
        blk = re.search(rf"^### {screen}.*?(?=^### |\Z)", section(text, 3), re.S | re.M).group(0)
        for st in STATES:
            if f"{screen}.{st}" not in blk:
                errors.append(f"{screen}: 상태 '{st}' 행 없음")

    owners = defaultdict(list)
    issue_ids = set()
    for cells in rows(section(text, 7)):
        if len(cells) >= 7 and cells[0].startswith("I-"):
            issue_ids.add(cells[0])
            for f in re.findall(r"`([^`]+)`", cells[3]):
                owners[f].append(cells[0])
            if cells[3] in ("", "<>") or cells[3].startswith("<"):
                if cells[1] != "통합 QC/QA" and cells[3] != "-":
                    errors.append(f"{cells[0]}: 담당 파일 없음")
            if not cells[5]:
                errors.append(f"{cells[0]}: 필수 검사 없음")
    for f, ids in owners.items():
        if len(ids) > 1:
            errors.append(f"담당 파일 중복 {f}: {', '.join(ids)} (직렬화하거나 이슈를 합칠 것)")
    for cells in rows(section(text, 7)):
        if len(cells) >= 7 and cells[0].startswith("I-") and cells[4] != "-":
            for dep in re.findall(r"I-\d+", cells[4]):
                if dep not in issue_ids:
                    errors.append(f"{cells[0]}: 의존 {dep}가 없음")

    traced = set()
    for cells in rows(section(text, 6)):
        if len(cells) >= 4 and cells[0].startswith("F-"):
            traced.update(re.findall(r"AC-\d+", cells[2]))
            if not re.search(r"V-", cells[3]):
                errors.append(f"추적표 {cells[0]}: 검사 없음")
    for ac in sorted(ac_ids - traced):
        errors.append(f"추적표에 {ac} 없음")

    for v in ["V-build", "V-unit", "V-int", "V-e2e", "V-a11y", "V-sec", "V-design", "V-review"]:
        if v not in section(text, 8):
            errors.append(f"검증 계획에 {v} 없음")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(f"OK  AC {len(ac_ids)}개, 이슈 {len(issue_ids)}개, 담당 파일 {len(owners)}개")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
