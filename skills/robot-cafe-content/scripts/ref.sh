#!/bin/zsh
# usage: ref.sh <패턴>  — 마지막 스냅샷에서 패턴과 맞는 첫 요소의 ref 를 출력
grep -m1 -E "$1" /tmp/rc_snap.yml | grep -o 'ref=[a-z0-9]*' | cut -d= -f2
