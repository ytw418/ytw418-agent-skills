---
name: pr-workflow
description: PR 생성 전 코드 리뷰와 컨벤션 점검(콘솔 로그 제거, 미사용 import 정리, px->rem, i18n 누락 처리, 테스트 시나리오, 주석 정리)을 수행하고 가능하면 gh CLI로 PR 생성까지 진행한다.
---

# PR Workflow

Allibee 프론트엔드 작업에서 PR 생성 전 품질 점검과 PR 생성을 표준화한다.

## 사용 시점

-   사용자가 PR 생성 또는 PR 준비를 요청했을 때
-   코드 정리/컨벤션 점검 후 PR까지 한 번에 처리해야 할 때

## 사전 체크리스트

0. 아래 항목을 PR 생성 전에 반드시 확인한다. 0. gh auth status
   github.com
   ✓ Logged in to github.com account ytw418 (/Users/yoonseongjun/.config/gh/hosts.yml)

1. `console.log` 제거
2. 미사용 import 정리
3. 테스트 시나리오 작성
4. 불필요/오해 소지가 있는 주석 정리
5. 스타일 단위 점검: `px`를 가능한 `rem`으로 변환
6. i18n 누락 점검: 하드코딩 문자열은 정책에 맞게 i18n 처리  
   단, `apps/contract/src/routes/[[lang=locale]]/(need-auth)/su/*` 경로는 한국어 하드코딩 허용
   스토리북 파일도 하드코딩 허용
7. taillwind css 의 leading 사용한 부분 제거
8. #000000 컬러값이나 rounded-[8px]을 rounded-lg로 바꾸는 등등 일반 css를 taillwind css 로 바꿔줘

## 실행 절차

1. 변경 범위 파악
    - `git status --short`
    - `git diff --name-only`
2. 빠른 정적 점검
    - `rg -n "console\\.log\\(" <changed-files>`
    - `npm run lint`로 미사용 import/기본 컨벤션 확인
3. 스타일/i18n 점검
    - 변경 파일 내 `px` 사용 확인 후 `rem` 전환
    - i18n 키 사용 여부 확인, 누락 시 키 추가 방식으로 수정
4. 테스트 점검
    - 변경 영향 범위 기준으로 테스트
    - 가능한 단위 테스트 또는 e2e 시나리오 근거를 PR 본문에 명시
5. 최종 검증
    - 최소 `npm run lint`
    - 가능하면 관련 테스트 실행
6. PR 생성
    - `gh auth status` 확인
    - 가능하면 `gh pr create --draft`로 Draft PR 생성
    - PR 본문에 변경 요약, 테스트, 리스크를 포함
7. 프리뷰 배포 댓글 작성
    - PR 생성 직후 **변경된 앱에 해당하는 프리뷰 댓글만** 등록한다 (프리뷰 배포 트리거).
    - 변경 앱 판별: `git diff --name-only <base>...HEAD` 경로 기준
        - `apps/contract/*` 변경 → `gh pr comment <pr-number> --body "preview:contract"`
        - `apps/cue/*` 변경 → `gh pr comment <pr-number> --body "preview:cue"`
        - 두 앱 모두 변경 → 두 댓글을 **각각 별도 댓글로** 등록
        - 공용 코드(`packages/*`, `lib/*` 등)만 변경 → 영향 받는 앱 기준으로 판단하고, 불분명하면 두 댓글 모두 등록
    - 변경과 무관한 앱의 프리뷰 댓글은 등록하지 않는다 (불필요한 CI 낭비 방지).

## PR 생성 규칙

-   PR은 항상 **Draft**로 생성한다 (`gh pr create --draft`). 리뷰 준비가 되면 사용자가 직접 Ready for review로 전환한다.
-   PR 생성 후 **변경된 앱의 프리뷰 댓글만** 등록한다 (contract 작업 → `preview:contract`, cue 작업 → `preview:cue`, 둘 다 변경 시에만 둘 다).
-   커밋 메시지는 브랜치명 / 뒷부분을 접두사로 하고 뒤에 내용은 한글로 작성
-   사용자가 별도 지시하지 않으면 현재 브랜치를 기준으로 PR을 생성한다.
-   **절대 새 브랜치를 생성하지 않는다.** 이미 사용자가 체크아웃한 작업 브랜치에서만 점검/커밋/PR 생성을 진행한다.
-   PR 생성 전 점검에서 발견한 이슈는 우선 수정하지말고 알려만 준다, 수정 불가 항목은 PR 본문에 명시한다.
-   자동 수정이 위험한 항목은 사용자에게 확인 후 진행한다.

### 기존 PR 업데이트 시 프리뷰 갱신

-   이미 생성된 PR에 커밋을 추가로 푸시한 경우, 기존 프리뷰 트리거 댓글을 현재 사용자 작성분에 한해 삭제한 뒤 새 `preview:cue` 댓글을 등록한다.
-   PR 본문/스크린샷과 일반 리뷰 댓글은 삭제하지 않는다.
-   기존 트리거 댓글이 없어도 새 댓글 등록을 계속한다.

```bash
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
pr=$(gh pr view --json number --jq .number)
login=$(gh api user --jq .login)
gh api "repos/$repo/issues/$pr/comments" --paginate \
  --jq ".[] | select(.user.login == \"$login\" and (.body | test(\"^/?preview:\"))) | .id" |
while read -r comment_id; do
  [ -n "$comment_id" ] && gh api -X DELETE "repos/$repo/issues/comments/$comment_id"
done
gh api "repos/$repo/issues/$pr/comments" -f body='preview:cue'
```

## 아래 부터 pr 양식

### 개요

<!-- 이 변경이 필요한 이유에 대한 서술 -->
<!-- 변경하지 않았을 때 발생하는 문제에 대한 서술 -->

### 변경 유형

-   [ ] 버그 수정
-   [ ] 새로운 기능 추가
-   [ ] 기존 기능 수정
-   [ ] 스타일 수정
-   [ ] 기타(문서 수정, 리팩토링 등)

### 주요 변경사항

<!-- 주요 변경사항 서술 -->

---

### 관련 태스크 / 이슈

<!-- 어떤 태스크의 작업인지 JIRA 링크를 남겨주세요. -->
<!--  해당 태스크가 어떤 작업인지 맥락을 알 수 있는 자료를 첨부해주세요. -->

### 스크린샷

<!-- 코드의 반영 내용을 시각적으로 확인할 수 있는 첨부 자료를 남겨주세요. -->
