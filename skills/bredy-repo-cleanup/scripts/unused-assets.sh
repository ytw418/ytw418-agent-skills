#!/usr/bin/env bash
# 참조 없는 이미지·폰트 후보를 찾는다(읽기 전용). 지우지 않는다.
# 사용: unused-assets.sh <repo> <dir...>     예) unused-assets.sh ~/Desktop/pro/bredy_app assets design store-assets
# 판정: 파일 이름(basename)이 다른 추적 파일 어디에도 없으면 UNUSED.
#   - name@2x.png / name@3x.png 는 RN 이 name.png 로 찾으므로 name.png 를 기준으로 본다.
#   - 경로를 문자열로 조합하는 코드(`/images/${x}`, require(`./${x}`))가 있는 폴더는 DYNAMIC 으로 따로 알린다.
set -euo pipefail
repo=${1:?repo 경로}; shift
cd "$repo"
[ $# -gt 0 ] || { echo "폴더를 하나 이상 넘긴다" >&2; exit 2; }

git ls-files -- "$@" | grep -Ei '\.(png|jpe?g|gif|webp|svg|ico|otf|ttf|woff2?|mp4)$' | while read -r f; do
  b=$(basename "$f")
  base=$(echo "$b" | sed -E 's/@[23]x\././')
  hits=$(git grep -l -F -e "$b" -e "$base" -- . ':!package-lock.json' 2>/dev/null | grep -v -F -x "$f" | head -1 || true)
  if [ -z "$hits" ]; then printf 'UNUSED %6sK %s\n' "$(du -k "$f" | cut -f1)" "$f"; fi
done

echo "--- 경로를 문자열로 조합하는 곳(이 폴더의 UNUSED 는 사람이 확인)"
git grep -n -E '(require|import)\(`[^`]*\$\{|["'\''`]/?(images|assets|designer|brand|public)/[^"'\''`]*\$\{' -- '*.ts' '*.tsx' '*.js' '*.mjs' 2>/dev/null | head -20 || true
