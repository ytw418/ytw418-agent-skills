---
name: bhsn-synapse
description: BHSN(앨리비·큐) 제품 기획·CS 에 쓸 자료를 로컬 지식 폴더 ~/Desktop/bhsn/bhsn-synapse 에 모으고, 거기서 찾아 근거와 함께 답한다. 노션 페이지를 하위 페이지·DB 까지 Markdown·CSV 로 받기(회사 자동화 크롬의 노션 로그인 사용), 회사 PostHog(posthog-bhsn MCP) 지표를 날짜별 기록으로 남기기, 컨플루언스 문서를 찾아 필요한 것을 저장하기, 폴더 README 자료 목록 갱신까지 한다. 사용자가 '시냅스', 'bhsn-synapse', '자료 모아줘', 'CS 내역 받아줘', '디스커버리 콜 다시 받아', '노션 페이지 시냅스에 넣어', '고객이 뭐라고 했는지 찾아줘', '기획 자료 찾아줘', 'PostHog 지표 저장해 둬', '컨플 문서 모아줘' 등을 요청하거나, BHSN 기획·CS 질문에 근거 자료가 필요할 때 사용한다. 브리디 자료(bredy-*), Jira 티켓 작업(jira-bhsn), 착수 검토(kickoff), PRD 작성(hjjm-prd)에는 쓰지 않는다.
---

# bhsn-synapse

BHSN 기획·CS 자료를 `~/Desktop/bhsn/bhsn-synapse/` 에 모은다. 출처 주소·ID·받은 날은 그 폴더의 `README.md` 가 기준이니 먼저 읽는다. 이 스킬 저장소는 공개라서 회사 주소·ID·고객 정보는 여기에 쓰지 않고 README 에만 쓴다.

## 찾기

1. README 의 자료 목록으로 볼 폴더를 고른다.
2. `rg -i "<키워드>" ~/Desktop/bhsn/bhsn-synapse` (없으면 `grep -rni`)로 찾고, 맞는 파일만 읽는다. CSV 는 필요한 열만 골라 본다.
3. 없거나 오래됐으면 원본에서 찾는다. 노션은 다시 받고, 컨플루언스는 Atlassian MCP `confluence_search`, 수치는 `posthog-bhsn` 으로 본다.
4. 답에는 근거 파일·원본 링크·받은 날을 붙인다. 고객 이름·연락처는 꼭 필요할 때만 쓴다.

## 모으기

넣을 때마다 README 표(위치·내용·원본·받은 날)를 고친다. 주제 폴더(`cs/`, `기획/`, `지표/`, `컨플루언스/`)는 필요할 때 만든다.

### 노션

회사 자동화 크롬(CDP 9224)에 노션이 로그인돼 있어야 한다. 풀려 있으면 `curl -X PUT "http://127.0.0.1:9224/json/new?<노션 URL>"` 로 로그인 탭을 열어 두고 사용자에게 로그인을 부탁한다(직접 로그인하지 않는다).

```sh
node ~/.claude/skills/bhsn-synapse/scripts/notion-export.mjs <노션 페이지 URL> ~/Desktop/bhsn/bhsn-synapse/<주제 폴더>
```

- 노션 자체 내보내기(Markdown & CSV, 하위 페이지 포함)를 받아 푼다. 40쪽 남짓이면 수십 초 걸린다.
- 같은 폴더에 다시 받으면 덮어쓴다. 노션에서 지우거나 이름을 바꾼 페이지까지 맞추려면 그 하위 폴더를 지우고 받는다.
- 노션 내부 API 를 쓰므로 노션이 바꾸면 깨질 수 있다. 작업이 `not_started` 에 머물면 공간·사용자 헤더 문제다(스크립트 주석 참고).

### PostHog (`posthog-bhsn`)

- 회사 PostHog 는 Claude Code MCP `posthog-bhsn`(개인 키, 읽기·쓰기)이다. 브리디 PostHog(claude.ai 커넥터)와 섞이지 않게 시작할 때 `project-get` 으로 프로젝트를 확인한다.
- 지표를 남길 때는 `지표/<YYYY-MM-DD>-<주제>.md` 에 질문, 결과 표, 다시 돌릴 HogQL 이나 인사이트 링크를 함께 쓴다.
- 쓰기(인사이트·대시보드·주석)는 사용자가 시킬 때만 한다. 기능 플래그·실험은 운영 동작이 바로 바뀌니 바꾸기 전에 확인받는다.

### 컨플루언스

- 평소에는 Atlassian MCP `confluence_search`(CQL)로 찾고 `confluence_get_page` 로 읽는다.
- 자주 쓸 문서는 `컨플루언스/<스페이스>/<제목>.md` 로 저장하고, 맨 위에 원본 URL·마지막 수정일을 적는다.

## 지킬 것

- 고객 개인정보가 들어 있으니 폴더 내용을 외부(슬랙·깃허브·웹)에 올리지 않는다. `~/Desktop/bhsn` 은 원격이 없는 로컬 git 이므로 원격을 붙이지 않는다.
- 회사 브라우저 작업은 회사 자동화 크롬(9224)에서만 하고, 자기 탭을 열었으면 닫는다.
