#!/bin/bash
# cj(Scripting Bridge 헬퍼)를 한 번 빌드하고 경로를 출력한다.
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${HOME}/.cache/user-chrome-control/cj"
mkdir -p "$(dirname "$OUT")"
if [ ! -x "$OUT" ] || [ "$DIR/cj.swift" -nt "$OUT" ]; then
  swiftc -O "$DIR/cj.swift" -o "$OUT" >&2 || { echo "swiftc 실패" >&2; exit 1; }
fi
echo "$OUT"
