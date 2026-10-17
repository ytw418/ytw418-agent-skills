#!/bin/zsh
# usage: pw.sh <playwright-cli 명령...>  — 결과(### Result)만 출력
source "${0:A:h}/env.sh"
pwc "$@" | sed -n '/### Result/,/### Ran/p' | sed '1d;$d'
