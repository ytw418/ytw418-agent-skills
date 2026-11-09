#!/usr/bin/env python3
"""브리디 운영 DB 에 데이터 변경 SQL(INSERT/UPDATE/DELETE)을 안전하게 실행한다.

사용:
  python3 -I prod_sql.py <sql 파일>                  # 미리보기: 트랜잭션 안에서 실행하고 항상 ROLLBACK, 바뀔 행 수만 보여 준다
  python3 -I prod_sql.py <sql 파일> --apply --expect N  # 바뀐 행 수 합이 N 일 때만 COMMIT, 아니면 ROLLBACK
  python3 -I prod_sql.py --self-test

접속 주소: ~/.config/bredy-backup/prod-write.url (chmod 600, 운영 postgres 계정). 읽기 조회는 prod.url(backup_reader)을 쓴다.
"""
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

URL_FILE = os.path.expanduser("~/.config/bredy-backup/prod-write.url")
LOG_DIR = os.path.expanduser("~/bredy-backups/prod/sql-log")
EXPECTED_REF = "nbtiaibtenjitjuverwy"  # Supabase 'bredy' 운영

# 구조 변경·대량 삭제·권한·psql 메타 명령은 이 스킬로 실행하지 않는다(DB 안전 규칙).
FORBIDDEN = re.compile(
    r"\b(DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|COPY|VACUUM|REINDEX|CLUSTER|COMMIT|ROLLBACK|BEGIN|SAVEPOINT)\b",
    re.I,
)
DML = re.compile(r"^\s*(WITH\b.*?\)\s*)?(INSERT|UPDATE|DELETE)\b", re.I | re.S)


def strip_literals(sql: str) -> str:
    """주석·문자열·따옴표 식별자를 비운다. 'REVOKED' 같은 값이 금지어로 잡히지 않게."""
    sql = re.sub(r"--[^\n]*", " ", sql)
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    sql = re.sub(r"'(?:[^']|'')*'", "''", sql)
    return re.sub(r'"(?:[^"]|"")*"', '""', sql)


def split_statements(sql: str) -> list[str]:
    """따옴표 안의 ; 는 무시하고 문장을 나눈다. shortcut: $$ 달러 인용은 모른다 — 함수 본문이 필요해지면 고친다."""
    out, buf, quote = [], [], None
    i = 0
    while i < len(sql):
        ch = sql[i]
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
        elif ch in "'\"":
            quote = ch
            buf.append(ch)
        elif sql.startswith("--", i):
            j = sql.find("\n", i)
            i = len(sql) if j < 0 else j
            continue
        elif ch == ";":
            out.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
        i += 1
    out.append("".join(buf))
    return [s.strip() for s in out if s.strip()]


def check(statements: list[str]) -> list[str]:
    """문제가 있으면 오류 문구 목록을 돌려준다."""
    errors = []
    if not statements:
        errors.append("SQL 문장이 없습니다.")
    for n, stmt in enumerate(statements, 1):
        bare = strip_literals(stmt)
        if "\\" in bare:
            errors.append(f"{n}번 문장: psql 메타 명령(\\...)은 쓸 수 없습니다.")
        bad = FORBIDDEN.search(bare)
        if bad:
            errors.append(f"{n}번 문장: '{bad.group(1)}' 는 이 스킬로 실행하지 않습니다(DB 안전 규칙).")
        kind = DML.match(bare)
        if kind and kind.group(2).upper() in ("UPDATE", "DELETE") and not re.search(r"\bWHERE\b", bare, re.I):
            errors.append(f"{n}번 문장: WHERE 없는 {kind.group(2).upper()} 는 실행하지 않습니다.")
        if kind and re.search(r"\bRETURNING\b", bare, re.I):
            errors.append(f"{n}번 문장: RETURNING 은 빼 주세요(스크립트가 행 수를 세려고 붙입니다).")
        if not kind and not re.match(r"^\s*SELECT\b", bare, re.I):
            errors.append(f"{n}번 문장: INSERT/UPDATE/DELETE/SELECT 만 쓸 수 있습니다.")
    if statements and not any(DML.match(strip_literals(s)) for s in statements):
        errors.append("바꾸는 문장(INSERT/UPDATE/DELETE)이 없습니다. 조회는 prod.url(읽기 전용)로 하세요.")
    return errors


def build_script(statements: list[str], apply: bool, expect: int | None) -> str:
    lines = ["\\set ON_ERROR_STOP 1", "BEGIN;"]
    counters = []
    for n, stmt in enumerate(statements, 1):
        if DML.match(strip_literals(stmt)):
            var = f"n{n}"
            counters.append(var)
            lines.append(f"WITH x AS ({stmt} RETURNING 1) SELECT count(*) AS {var} FROM x \\gset")
            lines.append(f"\\echo {n}번 문장 바뀐 행: :{var}")
        else:
            lines.append(f"{stmt};")
    total = " + ".join(f":{v}" for v in counters)
    lines.append(f"SELECT ({total}) AS total \\gset")
    lines.append("\\echo 바뀐 행 합계: :total")
    if apply:
        lines.append(f"SELECT (:total = {expect}) AS ok \\gset")
        lines += ["\\if :ok", "COMMIT;", "\\echo RESULT=COMMITTED", "\\else", "ROLLBACK;",
                  f"\\echo RESULT=ROLLED_BACK (예상 {expect} 행과 다름)", "\\endif"]
    else:
        lines += ["ROLLBACK;", "\\echo RESULT=PREVIEW_ROLLED_BACK"]
    return "\n".join(lines) + "\n"


def read_url() -> str:
    try:
        st = os.stat(URL_FILE)
    except FileNotFoundError:
        sys.exit(f"{URL_FILE} 가 없습니다. SKILL.md '접속 주소 준비'를 따라 만드세요.")
    if st.st_mode & 0o077:
        sys.exit(f"{URL_FILE} 권한이 너무 넓습니다. chmod 600 하세요.")
    url = open(URL_FILE).read().strip()
    if EXPECTED_REF not in url:
        sys.exit("접속 주소가 운영(bredy) 프로젝트가 아닙니다.")
    return url


def self_test():
    ok = check(split_statements("update \"M\" set status='REVOKED' where id=1;"))
    assert ok == [], ok
    assert check(split_statements("update \"M\" set a=1")), "WHERE 없는 UPDATE 를 막아야 함"
    assert check(split_statements("drop table x")), "DROP 을 막아야 함"
    assert check(split_statements("delete from x where id=1; truncate y")), "섞인 TRUNCATE 를 막아야 함"
    assert len(split_statements("update a set b='x;y' where id=1; select 1")) == 2
    assert check(split_statements("select 1")), "바꾸는 문장 없으면 막아야 함"
    s = build_script(split_statements("update a set b=1 where id=2"), True, 1)
    assert "RETURNING 1" in s and "\\if :ok" in s
    print("self-test ok")


def main():
    args = sys.argv[1:]
    if args == ["--self-test"]:
        return self_test()
    if not args or args[0].startswith("-"):
        sys.exit(__doc__)
    path, apply = args[0], "--apply" in args
    expect = None
    if apply:
        if "--expect" not in args:
            sys.exit("--apply 에는 --expect N(미리보기에서 본 행 수)이 필요합니다.")
        expect = int(args[args.index("--expect") + 1])
    sql = open(path).read()
    statements = split_statements(sql)
    errors = check(statements)
    if errors:
        sys.exit("실행하지 않음:\n- " + "\n- ".join(errors))

    result = subprocess.run(
        ["psql", read_url(), "-X", "-q", "-A", "-F", " | "],
        input=build_script(statements, apply, expect), capture_output=True, text=True,
    )
    output = (result.stdout + result.stderr).replace(read_url(), "<prod-write-url>")
    print(output.strip())

    if apply:
        os.makedirs(LOG_DIR, mode=0o700, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        with open(os.path.join(LOG_DIR, f"{stamp}.log"), "w") as f:
            f.write(f"-- {stamp} expect={expect}\n{sql}\n-- 결과\n{output}\n")
    sys.exit(0 if result.returncode == 0 and "RESULT=" in output and "ROLLED_BACK (" not in output else 1)


if __name__ == "__main__":
    main()
