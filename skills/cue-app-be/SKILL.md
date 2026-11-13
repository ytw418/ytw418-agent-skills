---
name: cue-app-be
description: FE 개발자가 BE 저장소 cue-app(bhsn-ai/cue-app, Kotlin Spring 멀티모듈)에 API·엔티티·Flyway 마이그레이션을 직접 넣고 PR 을 올릴 때 BE 팀(금희성·이재현) 방식대로 한다 — 같은 도메인 코드 본뜨기, 레이어·트랜잭션·권한 어노테이션, 마이그레이션 번호 선점, Kotest 테스트와 CI 명령, 설계 결정 기록(설계 문서 열린 질문·ADR), 기획과 어긋날 때 처리, PR 제목·본문·AI 리뷰 답글. 사용자가 'BE 작업도 같이', '백엔드 초안 잡아', 'cue-app PR', 'BE API 만들어', '백엔드 마이그레이션 추가', 'BE 규칙대로', '프론트랑 백엔드 둘 다' 등을 요청할 때 사용한다. FE 쪽 가짜 응답 선개발은 api-temp-patch, Jira 흐름은 jira-bhsn 을 함께 쓴다.
---

# cue-app BE 작업 (cue-app-be)

FE 담당자가 cue-app 에 BE 초안을 올릴 때의 규칙. BE 팀은 하네스 파일(CLAUDE.md·AGENTS.md·.claude)이 없고, 규칙은 `.gemini/styleguide.md`(사실상 규약서)·Confluence·PR 관행에 있다. 2026-11-12 ALLIBEE-1840 표준 템플릿(BE ALLIBEE-1952) 때 조사해 정리했다.

## 1. 시작

- 워크트리: `git -C ~/Desktop/bhsn/cue-app fetch origin && git -C ~/Desktop/bhsn/cue-app worktree add ../cue-app-<번호> -b feature/<티켓>-<slug> origin/develop`. 메인 체크아웃·`~/src/cue-app`(다른 세션 bootRun 일 수 있음)은 건드리지 않는다.
- 먼저 읽는다: `.gemini/styleguide.md`, 같은 도메인의 Controller·Application·Service·Repository·테스트, `docs/design/<도메인>*.md`. **같은 도메인의 기존 코드를 본떠 짠다** — 새 패턴을 만들지 않는다.
- 도메인 작성자를 `git log --format='%an' -- <도메인 경로> | sort | uniq -c` 로 확인해 둔다(리뷰어 후보).

## 2. 코드 규칙

- 모듈: `app-infra` → `app-apiclients` → `app-domain` → `app-interfaces`/`batch`/`consumer`. Controller → Application(`@Component`, 오케스트레이션) → Service(`@Service`, 도메인) → Repository.
- 트랜잭션: 쓰기는 메서드 `@Transactional` 하나로 끝내고, 변환·업로드·외부 호출은 트랜잭션 밖에 둔다. 실패하면 올린 파일을 직접 지운다.
- 멀티테넌트: 엔티티는 `tenant_id`·`workspace_id` 를 갖고 조회에 격리 조건을 건다. 다른 워크스페이스 id·삭제 행은 404 로 같게 답한다(존재 숨김). 전 워크스페이스 공용 데이터는 `tenant_id = 0`, `workspace_id = 0` 행이다(sample_contracts 선례).
- API: 클래스 `@RequestMapping("/리소스")`, 메서드 경로는 `/v1` 접미사, 응답은 `AppResponse`·`AppListResponse`·`AppEmptyResponse` + `toSuccessResponse()`. `@Operation` 설명은 한국어로 길게 쓴다(오류 코드·읽기 전용 허용 이유까지).
- 권한: `@PreAuthorize("hasAuthority('$REPOSITORY')")` 조회, `'$WORKSPACE'` 관리, 슈퍼어드민은 `SuperAdminPermissions.SuperAdmin.SUPER_ADMIN`. 클래스에 `@RequiresWorkspaceCapability(WRITE)`, GET 은 메서드에 `@AllowedWhenReadOnly(READ)`. 쓰기 매핑은 둘 중 하나가 반드시 붙어야 한다(`WorkspaceCapabilityCoverageTest`). 슈퍼어드민 API 는 `app-interfaces/.../superadmin/<도메인>/SuperAdmin*Controller`, 경로 `/super-admin/...`, 클래스 `@AllowedWhenReadOnly(SUPER_ADMIN)`.
- 오류: `exceptionFactory.requestExceptionOf`(400)·`notFoundExceptionOf`(404)·`forbiddenExceptionOf`(403) + `ErrorMessageKeys.kt` 키 + `message_{ko,en,ja}.properties` 세 언어.
- 판정은 이미 있는 기준과 맞춘다 — 예: 플랜은 `PAID_PLAN_TYPES`·`NON_BILLABLE_PLAN_TYPES` 가 있지만 FE `isFreePlan`(구독 없음·FREE)과 어긋나면 FE 가 열어 준 화면에서 403 이 난다. 어느 쪽에 맞췄는지 주석 한 줄.
- 한 줄 120자, 와일드카드 import 금지(ktlint·detekt 없음, `.editorconfig` 만).
- **주석은 테스트로 바꾼다**(금희성 조언, 2026-11-13): 동작을 설명하는 주석(입력 → 결과, 404·400 같은 오류 조건, 건너뛰기·무시 규칙, 플랜별 응답 차이)은 지우고 그 내용을 테스트 이름과 케이스로 옮긴다. 테스트로 드러낼 수 없는 이유·제약(왜 이 순서인지, 트랜잭션을 왜 여기서 끊는지, 외부 시스템·관례 때문에 이렇게 한 이유)만 주석으로 남긴다. AI 에게 맡길 때는 "주석을 테스트코드로 치환 가능한 건 주석 삭제하고 테스트코드로 작성"이라고 요청한다. `@Operation`·`@Schema` 설명은 API 문서라 주석이 아니다 — 그대로 둔다.

## 3. 마이그레이션

- 위치 `app-domain/flyway/migration/<스키마>/V<n>__설명.sql`, 번호는 스키마마다 따로. **번호 충돌이 자주 난다**(develop app 에 V80·V84·V85 중복). 고르기 전에 원격 브랜치를 본다:
  `git fetch origin && for b in $(git branch -r --format='%(refname:short)' | grep -v HEAD); do git ls-tree --name-only "$b" app-domain/flyway/migration/app/ 2>/dev/null; done | sort -u | tail -5` → 가장 큰 번호 + 1. 머지 직전에 다시 확인한다.
- 관례: IDENTITY PK, 감사 4컬럼 + `deleted_at`, enum 은 VARCHAR, FK 없음, 모든 컬럼 `COMMENT ON`. 기존 행 백필 필요 여부를 머리 주석에 쓴다.
- PR 본문에 `## 마이그레이션`(무엇이 바뀌고 백필이 있는지)·`## 배포 주의`(구버전 API·배치·컨슈머와 동시에 돌아도 되는지)를 둔다.

## 4. 테스트·검증

- **로컬에서 DB·Kafka·docker·앱 서버를 띄우지 않는다.** BE 팀은 코드와 테스트 코드만으로 개발하고 실제 동작은 dev 에 올려 확인한다(금희성 확인, 2026-11-12). 로컬 검증은 아래 gradle 테스트까지다.
- Kotest `ShouldSpec` + MockK(+ `Arb`/`checkAll` 선호), 클래스당 테스트 파일 하나, `context` 는 메서드 이름. 생성자에 의존성을 더하면 기존 테스트의 생성 부분과 `clearMocks` 도 고친다.
- CI 는 `./gradlew integrationClasses test` 하나(통합 테스트는 컴파일만). 로컬은 무거운 작업을 한 번에 하나만:
  ```bash
  ./gradlew integrationClasses :app-domain:test --tests '*<클래스>Test' :app-interfaces:test --tests '*WorkspaceCapabilityCoverageTest' \
    --no-daemon --max-workers=2 -Dorg.gradle.jvmargs="-Xms256m -Xmx2g -XX:MaxMetaspaceSize=512m" -Pkotlin.compiler.execution.strategy=in-process
  ```
  첫 컴파일은 10분 넘게 걸린다 — 백그라운드로 돌리고 끝난 것을 확인한 뒤 다음 무거운 작업을 한다. 결과 수치(건수·실패 0)를 PR `## 확인` 에 적는다.

## 5. 결정 기록

- 설계는 `docs/design/<도메인>-*.md` 에 절을 더한다: 근거 티켓 → 무엇을 저장하는가 → 번호 매긴 결정 + 이유(기각한 안 포함) → 확장 경로("지금은 만들지 않음") → **열린 질문 표(항목 / 기본안 / 바뀌면)**.
- 큰 구조 결정은 Confluence PD 'ADR 목록 (cue-app)'(1392345127) 형식: 결정 하나에 ADR 하나, 맥락·대안·결정·결과, 바뀌면 새 ADR + 옛 것은 '대체됨'.
- 기획·디자인과 어긋나거나 더 나은 안이 있으면: 기본안으로 진행하고 ① 설계 문서 열린 질문 ② PR `## 확인 필요` ③ Jira 티켓 코멘트(담당 PO·BE 를 멘션, 사용자가 허락한 경우만) 세 곳에 같은 내용을 남긴다. **확정 안 된 사용자 노출 문구는 BE 메시지에 넣지 않는다.**

## 6. 커밋·PR

- 커밋·PR 제목: `[<티켓>] 한국어 서술문(~한다)` (예: `[ALLIBEE-1952] 앨리비 표준 템플릿 목록·본문 API 를 추가한다`). base 는 `develop`. 한 PR = 한 티켓, 무관한 변경은 뺀다.
- 본문(PR 템플릿 없음): `## 배경`(정책서·디자인·FE PR 링크) / `## 변경` / `## 확인`(테스트 수치) / `## 마이그레이션` / `## 배포 주의` / `## 확인 필요`.
- gemini-code-assist·Codex·CodeRabbit 리뷰가 자동으로 달린다. 코멘트마다 "반영(커밋 SHA)" 또는 "미반영 + 근거"로 답한다(`wip`·`draft` 라벨이면 gemini 가 건너뛴다).
- FE 가 올린 BE PR 은 본인 코드 밖 변경이라 리뷰어를 지정한다(도메인 작성자 + 금희성). **직접 머지하지 않는다** — BE 확인 뒤 BE 가 develop 에 머지한다(PR #891 선례).

## 7. 배포·FE 연동

- PR 미리보기 환경은 없다. dev 는 수동 배포이고 BE 가 develop·에픽을 `tmp/dev-YYMMDD` 에 합쳐 올린다 — dev 에서 보려면 BE 에 요청한다. dev Swagger: `https://dev2.bhsn.it/api/cue/swagger-ui/index.html`.
- 그 전까지 FE 는 api-temp-patch 스킬로 생성 코드를 BE 가 낼 모양대로 먼저 고치고 가짜 응답으로 화면을 만든다. FE 가 가정한 함수 이름 = BE 컨트롤러 메서드 이름이다.

## 출처

Confluence L 'BE 개발팀 운영 가이드'(1277329412), PD 'ADR 목록 (cue-app)'(1392345127), L 'AI 코드 리뷰 현황·개발 표준 논의 #1'(1306689558) · `.gemini/styleguide.md`·`.gemini/config.yaml` · PR #1071(본문 형식) #1026(대형 PR·배포 주의) #1056·#1003(마이그레이션 번호) #1032(테스트 리뷰) #1020(미확정 문구) #891(외부 기여) · `.github/workflows/test-action.yml`.
