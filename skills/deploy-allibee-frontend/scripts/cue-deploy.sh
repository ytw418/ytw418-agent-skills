#!/usr/bin/env bash
# 큐 + 리액트 큐(Cue MFE) 를 dev·demo 에 배포한다.
# 사용: cue-deploy.sh <dev|demo|dev,demo> [--dry-run]
#
# 환경마다: 리액트에 새 커밋이 있으면 MFE 발행 → 성공 확인 → 큐 배포 → 큐가 임베드한 MFE digest 확인.
# 리액트가 지난 발행과 같은 커밋이면 발행을 건너뛴다(큐는 직전 발행 이미지를 그대로 넣는다).
# demo 는 리액트 master·큐 cue/master 를 develop 으로 fast-forward 한 뒤 배포한다(ff 가 안 되면 멈춘다).
# 끝에 이번에 나간 커밋의 Jira 티켓을 뽑는다 — QA존 공지·상태 전이는 사람이 확인한 뒤 따로 한다.
set -uo pipefail

ENVS=${1:?사용: cue-deploy.sh <dev|demo|dev,demo> [--dry-run]}
DRY=${2:-}
RR=~/Desktop/bhsn/allibee-frontend-react
CR=~/Desktop/bhsn/allibee-frontend
RREPO=bhsn-ai/allibee-frontend-react
CREPO=bhsn-ai/allibee-frontend

run() { if [ "$DRY" = --dry-run ]; then echo "  (dry-run) $*"; else "$@"; fi; }
sha() { git -C "$1" rev-parse "$2"; }
last_run_sha() { gh run list -R "$1" --workflow="$2" --status success --limit 1 --json headSha -q '.[0].headSha // ""'; }

# 워크플로를 실행하고 끝날 때까지 기다린다. 성공하면 run id 를 stdout 에 남긴다.
dispatch() {
  local repo=$1 wf=$2 ref=$3 before id
  before=$(gh run list -R "$repo" --workflow="$wf" --limit 1 --json databaseId -q '.[0].databaseId // 0')
  gh workflow run "$wf" -R "$repo" --ref "$ref" >&2 || return 1
  for _ in $(seq 1 30); do
    sleep 4
    id=$(gh run list -R "$repo" --workflow="$wf" --limit 1 --json databaseId -q '.[0].databaseId // 0')
    [ "$id" != "$before" ] && break
  done
  [ "$id" = "$before" ] && { echo "run 을 찾지 못함: $wf" >&2; return 1; }
  echo "  실행: https://github.com/$repo/actions/runs/$id" >&2
  gh run watch "$id" -R "$repo" --exit-status -i 30 >/dev/null 2>&1
  local rc=$?
  echo "  결과: $(gh run view "$id" -R "$repo" --json conclusion -q .conclusion)" >&2
  [ $rc -eq 0 ] && echo "$id"
  return $rc
}

digest_of() { gh run view "$2" -R "$1" --log 2>/dev/null | grep -v 'echo' | grep "$3" | grep -oE 'sha256:[0-9a-f]{64}' | head -1; }

ff_push() {  # <repo dir> <배포 브랜치>
  local dir=$1 br=$2
  if [ "$(git -C "$dir" rev-list --count "origin/$br..origin/develop")" = 0 ]; then echo "  $br 이미 develop 과 같음"; return 0; fi
  git -C "$dir" merge-base --is-ancestor "origin/$br" origin/develop || { echo "  $br 이 develop 의 조상이 아님 — 멈춤" >&2; return 1; }
  run git -C "$dir" push -q origin "$(sha "$dir" origin/develop):refs/heads/$br" && echo "  $br → $(git -C "$dir" rev-parse --short origin/develop)"
  git -C "$dir" fetch -q origin
}

tickets() { git -C "$1" log --pretty=%s "$2" | grep -oE '[A-Z][A-Z0-9]*-[0-9]+' | grep -v '^NO-TICKET' | awk '!s[$0]++'; }

git -C "$RR" fetch -q origin --prune; git -C "$CR" fetch -q origin --prune
ALL_TICKETS=""

for ENV in ${ENVS//,/ }; do
  echo "== $ENV"
  case $ENV in
    dev)  RREF=develop; CREF=develop;    PUB=allibee-react-cue-publish-dev.yml;  DEP=cue-gcp-dev-deploy.yml ;;
    demo) RREF=master;  CREF=cue/master; PUB=allibee-react-cue-publish-demo.yml; DEP=cue-gcp-demo-deploy.yml ;;
    *) echo "모르는 환경: $ENV"; exit 1 ;;
  esac

  OLD_CUE=$(last_run_sha "$CREPO" "$DEP")
  if [ "$ENV" = demo ]; then
    ff_push "$RR" master || exit 1
    ff_push "$CR" cue/master || exit 1
  fi

  # 리액트: 마지막 성공 발행 커밋과 다르면 발행
  R_HEAD=$(sha "$RR" "origin/$RREF"); R_LAST=$(last_run_sha "$RREPO" "$PUB"); PUB_DIGEST=""
  if [ "$R_HEAD" = "$R_LAST" ]; then
    echo "-- 리액트 큐: 새 커밋 없음(${R_HEAD:0:9}) — 발행 건너뜀"
  else
    echo "-- 리액트 큐 발행 (${R_LAST:0:9} → ${R_HEAD:0:9})"; git -C "$RR" log --oneline "${R_LAST:-$R_HEAD~1}..$R_HEAD" | sed 's/^/   /'
    ALL_TICKETS+=$'\n'$(tickets "$RR" "${R_LAST:-$R_HEAD~1}..$R_HEAD")
    if [ "$DRY" != --dry-run ]; then
      PID=$(dispatch "$RREPO" "$PUB" "$RREF") || { echo "리액트 발행 실패 — 큐 배포 안 함"; exit 1; }
      PUB_DIGEST=$(digest_of "$RREPO" "$PID" 'digest')
      echo "  발행 digest: ${PUB_DIGEST:-못 찾음}"
    fi
  fi

  # 큐 배포
  C_HEAD=$(sha "$CR" "origin/$CREF")
  echo "-- 큐 배포 $CREF (${OLD_CUE:0:9} → ${C_HEAD:0:9})"
  [ -n "$OLD_CUE" ] && git -C "$CR" log --oneline "$OLD_CUE..$C_HEAD" | sed 's/^/   /' && ALL_TICKETS+=$'\n'$(tickets "$CR" "$OLD_CUE..$C_HEAD")
  if [ "$DRY" != --dry-run ]; then
    DID=$(dispatch "$CREPO" "$DEP" "$CREF") || { echo "큐 $ENV 배포 실패"; exit 1; }
    EMB=$(digest_of "$CREPO" "$DID" '임베드할 MFE 이미지')
    echo "  임베드 digest: ${EMB:-못 찾음}"
    if [ -n "$PUB_DIGEST" ]; then
      [ "$PUB_DIGEST" = "$EMB" ] && echo "  발행 digest 와 일치" || echo "  !! 발행 digest 와 다름 — 확인 필요"
    fi
  fi
done

echo "== 티켓 (QA존 공지·상태 전이 후보)"
echo "$ALL_TICKETS" | sed '/^$/d' | awk '!s[$0]++'
