#!/usr/bin/env python3
"""세션 고정 오버헤드를 실제 사용 이력과 대조해 미사용 항목을 찾는다.

설치되어 있으나 최근 N일간 한 번도 호출되지 않은 MCP 서버·스킬·서브에이전트를
절감 토큰 추정치와 함께 출력한다. 읽기 전용 — 아무것도 변경하지 않는다.
"""

import argparse
import json
import os
import re
import sys
import time
from collections import Counter
from pathlib import Path

HOME = Path.home()
PROJECTS = HOME / ".claude" / "projects"
SKILLS_DIR = HOME / ".claude" / "skills"
AGENTS_DIR = HOME / ".claude" / "agents"
CONFIG = HOME / ".claude.json"

# 한글은 거의 1자=1토큰, 영문/기호는 ~3.5자=1토큰.
# 이 계산만으로는 /context 실측의 60~70%만 나온다(마크다운 구조·래핑 오버헤드가
# 빠져서). CALIBRATION은 allibee-frontend MEMORY.md와 ~/.claude/CLAUDE.md를
# /context 실측값에 맞춰 역산한 값이다. 절대값은 여전히 근사이고,
# 신뢰할 수 있는 건 항목 간 상대 순위다.
HANGUL_CHARS_PER_TOKEN = 1.0
OTHER_CHARS_PER_TOKEN = 3.5
CALIBRATION = 1.5

HANGUL_RE = re.compile(r"[가-힣]")

# 호출 기록이 없어도 상시 유지해야 하는 항목. 세션 부트스트랩·안전장치라
# "안 썼으니 지우자"는 결론이 나오면 안 된다.
NEVER_PRUNE = {"skills": {"skill-creator", "find-skills", "init-bhsn", "token-diet"}}

TOOL_RE = re.compile(r'"name":\s*"mcp__([A-Za-z0-9_]+?)__')
SKILL_RE = re.compile(r'"skill":\s*"([^"]+)"')


def est_tokens(text: str) -> int:
    hangul = len(HANGUL_RE.findall(text))
    other = len(text) - hangul
    raw = hangul / HANGUL_CHARS_PER_TOKEN + other / OTHER_CHARS_PER_TOKEN
    return int(raw * CALIBRATION)


def scan_transcripts(days: int):
    """세션 로그에서 실제 호출된 MCP 서버·스킬을 센다."""
    if not PROJECTS.is_dir():
        return Counter(), Counter(), 0

    cutoff = time.time() - days * 86400
    servers, skills, scanned = Counter(), Counter(), 0

    for path in PROJECTS.rglob("*.jsonl"):
        try:
            if path.stat().st_mtime < cutoff:
                continue
            # 로그는 수백 MB까지 커질 수 있어 한 줄씩 흘려 읽는다.
            with path.open(encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    if "mcp__" in line:
                        servers.update(TOOL_RE.findall(line))
                    if '"skill"' in line:
                        skills.update(SKILL_RE.findall(line))
            scanned += 1
        except OSError:
            continue

    return servers, skills, scanned


def read_description(skill_md: Path) -> str:
    """SKILL.md frontmatter의 description을 뽑는다. 이게 상시 컨텍스트 비용이다."""
    try:
        text = skill_md.read_text(encoding="utf-8", errors="ignore")[:4000]
    except OSError:
        return ""
    if not text.startswith("---"):
        return ""
    end = text.find("\n---", 3)
    fm = text[3:end] if end > 0 else text[3:]
    out, capturing = [], False
    for line in fm.splitlines():
        if line.startswith("description:"):
            capturing = True
            out.append(line.split(":", 1)[1].strip())
        elif capturing:
            # 들여쓴 줄은 YAML 연속행, 그 외는 다음 키 시작
            if line.startswith((" ", "\t")):
                out.append(line.strip())
            else:
                break
    return " ".join(out)


def collect_skills():
    """설치된 스킬의 name -> (경로, description 토큰) 맵."""
    found = {}
    if not SKILLS_DIR.is_dir():
        return found
    for md in SKILLS_DIR.glob("*/SKILL.md"):
        name = md.parent.name
        # name+description 전체가 시스템 프롬프트에 들어간다
        found[name] = (md.parent, est_tokens(name + read_description(md)))
    return found


def collect_agents():
    found = {}
    if not AGENTS_DIR.is_dir():
        return found
    for md in AGENTS_DIR.glob("*.md"):
        found[md.stem] = (md, est_tokens(md.stem + read_description(md)))
    return found


def collect_mcp_servers():
    """로컬 설정된 MCP 서버. claude.ai 커넥터는 여기 없고 로그로만 보인다."""
    servers = {}
    try:
        data = json.loads(CONFIG.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return servers
    for name in data.get("mcpServers", {}):
        servers[name] = "global"
    for proj, val in data.get("projects", {}).items():
        for name in val.get("mcpServers", {}):
            servers.setdefault(name, f"project:{Path(proj).name}")
    return servers


def memory_files():
    """매 세션 통째로 로드되는 파일들."""
    out = []
    for p in [HOME / ".claude" / "CLAUDE.md", HOME / ".claude" / "AGENTS.md"]:
        if p.is_file():
            out.append((p, est_tokens(p.read_text(encoding="utf-8", errors="ignore"))))
    for p in PROJECTS.glob("*/memory/MEMORY.md"):
        out.append((p, est_tokens(p.read_text(encoding="utf-8", errors="ignore"))))
    return sorted(out, key=lambda x: -x[1])


def section(title):
    print(f"\n{'=' * 64}\n{title}\n{'=' * 64}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=60, help="사용 이력 스캔 기간 (기본 60일)")
    ap.add_argument("--json", action="store_true", help="기계 판독용 JSON 출력")
    args = ap.parse_args()

    servers_used, skills_used, scanned = scan_transcripts(args.days)
    if scanned == 0:
        print(f"경고: 최근 {args.days}일 내 세션 로그가 없다. --days를 늘려라.", file=sys.stderr)

    installed_skills = collect_skills()
    installed_agents = collect_agents()
    local_servers = collect_mcp_servers()

    # 로그에 보이지만 로컬 설정에 없는 것 = claude.ai 커넥터 또는 플러그인
    all_servers = dict(local_servers)
    for name in servers_used:
        all_servers.setdefault(name, "connector/plugin")

    unused_skills = sorted(
        (
            (n, meta[1])
            for n, meta in installed_skills.items()
            if skills_used.get(n, 0) == 0 and n not in NEVER_PRUNE["skills"]
        ),
        key=lambda x: -x[1],
    )
    unused_agents = sorted(
        ((n, meta[1]) for n, meta in installed_agents.items() if n not in skills_used),
        key=lambda x: -x[1],
    )
    unused_servers = sorted(
        (n, src) for n, src in all_servers.items() if servers_used.get(n, 0) == 0
    )

    if args.json:
        json.dump(
            {
                "days": args.days,
                "sessions_scanned": scanned,
                "servers_used": servers_used.most_common(),
                "skills_used": skills_used.most_common(),
                "unused_skills": unused_skills,
                "unused_agents": unused_agents,
                "unused_servers": unused_servers,
                "memory_files": [[str(p), t] for p, t in memory_files()],
            },
            sys.stdout,
            ensure_ascii=False,
            indent=2,
        )
        return

    print(f"세션 {scanned}개 스캔 (최근 {args.days}일)")

    section("MCP 서버 — 실제 호출 횟수")
    for name, count in servers_used.most_common():
        print(f"  {count:>6}  {name}  [{all_servers.get(name, '?')}]")
    if unused_servers:
        print(f"\n  호출 0회 ({len(unused_servers)}개) — 제거 후보:")
        for name, src in unused_servers:
            print(f"          {name}  [{src}]")

    # 같은 백엔드를 두 경로로 붙여두면 스키마 값을 두 번 낸다
    section("중복 백엔드 의심")
    lowered = {n: n.lower() for n in all_servers}
    for keyword in ("atlassian", "jira", "slack", "figma", "github", "notion"):
        hits = [n for n, low in lowered.items() if keyword in low]
        if len(hits) > 1:
            print(f"  '{keyword}' 계열 {len(hits)}개:")
            for h in sorted(hits, key=lambda x: -servers_used.get(x, 0)):
                print(f"      {servers_used.get(h, 0):>6}회  {h}")

    section(f"스킬 — 설치 {len(installed_skills)}개 / 미사용 {len(unused_skills)}개")
    total = sum(t for _, t in unused_skills)
    print(f"  미사용 description 합계 약 {total:,} 토큰 (매 세션 상시 로드)\n")
    for name, tok in unused_skills:
        print(f"  ~{tok:>5} tok  {name}")

    if unused_agents:
        section(f"서브에이전트 — 미사용 {len(unused_agents)}개")
        print(f"  합계 약 {sum(t for _, t in unused_agents):,} 토큰\n")
        for name, tok in unused_agents:
            print(f"  ~{tok:>5} tok  {name}")

    section("상시 로드 메모리 파일")
    for path, tok in memory_files():
        print(f"  ~{tok:>6} tok  {path}")

    section("절감 요약 (추정)")
    print(f"  미사용 스킬 제거        ~{total:,} 토큰/세션")
    print(f"  미사용 서브에이전트 제거 ~{sum(t for _, t in unused_agents):,} 토큰/세션")
    print(f"  호출 0회 MCP 서버        {len(unused_servers)}개 (서버당 수천~수만 토큰)")
    print(
        "\n  주의: 절대값은 근사다(실측 대비 ±30%). 신뢰할 것은 항목 간 상대 순위이고,"
        "\n  실제 절감폭은 정리 전후로 /context를 찍어 확인하라."
    )


if __name__ == "__main__":
    main()
