#!/usr/bin/env bash
# ~/.claude/CLAUDE.md 를 이 레포의 config/CLAUDE.md 로 심링크한다.
# Claude Code는 전역 지침을 Anthropic 계정에 동기화하지 않으므로,
# 여러 머신에서 같은 지침을 쓰려면 git + 심링크가 유일한 방법이다.
#
# config/ 하위에 두는 이유: 레포 루트에 CLAUDE.md가 있으면 이 레포에서
# 작업할 때 "프로젝트 지침"으로도 잡혀 같은 내용이 두 번 로드된다.

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
SOURCE="$REPO_ROOT/config/CLAUDE.md"
TARGET="$HOME/.claude/CLAUDE.md"

[ -f "$SOURCE" ] || { echo "원본이 없다: $SOURCE" >&2; exit 1; }

mkdir -p "$HOME/.claude"

if [ -L "$TARGET" ] && [ "$(readlink "$TARGET")" = "$SOURCE" ]; then
  echo "이미 연결되어 있다: $TARGET -> $SOURCE"
  exit 0
fi

# 기존 실파일은 절대 덮어쓰지 않는다 — 머신마다 다른 내용일 수 있다.
if [ -e "$TARGET" ] && [ ! -L "$TARGET" ]; then
  BACKUP="$TARGET.pre-symlink-$(date +%Y%m%d-%H%M%S)"
  cp "$TARGET" "$BACKUP"
  echo "기존 파일 백업: $BACKUP"
  echo "  내용이 다르면 수동으로 병합한 뒤 $SOURCE 에 커밋하라."
fi

rm -f "$TARGET"
ln -s "$SOURCE" "$TARGET"
echo "연결 완료: $TARGET -> $SOURCE"
