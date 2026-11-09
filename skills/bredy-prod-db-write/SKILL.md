---
name: bredy-prod-db-write
description: 브리디 운영 DB(Supabase 'bredy')의 데이터를 몇 행 고친다 — 혜택·뱃지 재부여(창립 브리더 등), 잘못 들어간 값 수정, 특정 행 상태 되돌리기처럼 관리자 화면에 기능이 없는 일. 읽기 전용 계정으로 대상 행을 찾아 보여 주고, 쓰기 계정으로 트랜잭션 미리보기(ROLLBACK)를 한 뒤, 바뀔 행 수가 예상과 같을 때만 COMMIT 하고 다시 조회해 확인한다. 사용자가 '운영 DB 고쳐', '운영 데이터 수정', '○○님 혜택 다시 줘', '창립 브리더 다시 부여', '뱃지 되돌려', '운영에서 이 값 바꿔줘' 등을 요청할 때 사용한다. 스키마 변경(마이그레이션)·dev DB·대량 정리·백업 복원에는 쓰지 않는다.
---

# 브리디 운영 DB 데이터 수정

운영 사용자 데이터는 되돌리기 어렵다. **조회 → 보여 주기 → 미리보기 → 확인 → 실행 → 재조회** 순서를 건너뛰지 않는다.
DB 안전 규칙(breeder_web·bredy_app `AGENTS.md`)이 이 스킬보다 우선한다. 훅이 막으면 우회하지 말고 보고한다.

## 하지 않는 것
- 스키마 변경(`ALTER`·`DROP`·`CREATE`·`TRUNCATE`), WHERE 없는 `UPDATE`·`DELETE`, 조건 없는 대량 변경 → 스크립트가 막는다. 스키마는 마이그레이션 파일 + `migrate deploy` 로만 한다.
- 백업 복원, `prisma migrate resolve`, 시드 → 사용자가 직접 한다.
- 수십 행 넘는 변경 → 먼저 `cd ~/Desktop/pro/breeder_web && npm run db:backup -- prod` 로 백업하고 사용자 확인을 받는다.

## 접속 주소
| 용도 | 파일 | 계정 |
|---|---|---|
| 조회 | `~/.config/bredy-backup/prod.url` | `backup_reader`(읽기 전용) |
| 쓰기 | `~/.config/bredy-backup/prod-write.url` (chmod 600) | 운영 `postgres` (DIRECT 5432) |

`prod-write.url` 이 없으면 사용자에게 Supabase 운영 프로젝트 DB 주소(Session pooler 5432)를 받아 만든다. 비밀번호에 `@` 등이 있으면 URL 인코딩한다. 주소·비밀번호는 출력하지 않는다(`sed -E 's#(://[^:]+):[^@]*@#\1:***@#'` 로 가림).

## 절차

1. **대상 찾기 (읽기 전용)** — 이름·id 로 행을 찾고, 변경 원인도 코드에서 확인한다(예: 크론이 회수했으면 다시 회수되지 않게 할 방법).
   ```bash
   psql "$(cat ~/.config/bredy-backup/prod.url)" -X -A -F ' | ' -c 'select ... where ...;'
   ```
2. **SQL 파일 작성** — `$(mktemp -d)/change.sql`(공용 `/tmp` 고정 이름 금지). WHERE 는 id 로 좁히고 현재 상태 조건을 붙여 두 번 실행해도 안전하게 한다. `RETURNING` 은 쓰지 않는다(스크립트가 붙인다).
3. **미리보기** — 항상 ROLLBACK 된다.
   ```bash
   python3 -I ~/.claude/skills/bredy-prod-db-write/scripts/prod_sql.py <change.sql>
   ```
4. **확인 받기** — 사용자가 **이번 메시지에서** 그 변경을 직접 지시했으면(예: "이 사람 혜택 다시 줘", "니가 실행해") 바로 5로 간다. 아니면 바뀔 행 수·대상(이름·id)·전후 값·이유를 보여 주고 명시적인 "예"를 받는다. 삭제(DELETE)는 지시가 있어도 건수와 내용을 보여 주고 "예"를 받는다.
5. **실행** — 미리보기의 합계를 `--expect` 로 넘긴다. 다르면 자동 ROLLBACK.
   ```bash
   python3 -I ~/.claude/skills/bredy-prod-db-write/scripts/prod_sql.py <change.sql> --apply --expect <N>
   ```
   `RESULT=COMMITTED` 가 나와야 성공이다. 실행 기록은 `~/bredy-backups/prod/sql-log/<UTC시각>.log`.
6. **재조회** — 1의 조회로 값이 바뀌었는지 보고, 화면에 보이는 값이면 운영 API(`https://bredy.app/api/...`)로도 확인한다.
7. **보고** — 바꾼 행(테이블·id·전후 값), 확인 결과, 함께 생기는 일(이미 간 알림 등)과 하지 않은 일을 적는다.

## 예: 회수된 창립 브리더 다시 주기 (2026-11-09)
11/8 유지 조건 크론(`breeder_web/libs/server/foundingBreederRetention.ts`)은 `source='AUTO_SIGNUP'` 자리만 회수한다. `MANUAL_ADMIN` 으로 바꾸면 예외가 되어 다시 회수되지 않는다. 번호는 그대로 둔다.
```sql
update "BreederProgramMembership"
set status = 'ACTIVE', "revokedAt" = null, source = 'MANUAL_ADMIN', "updatedAt" = now()
where id = <행 id> and "userId" = <회원 id> and "programType" = 'FOUNDING_BREEDER' and status = 'REVOKED';
```
대상 찾기:
```sql
select u.id, u.name, m.id as mid, m.status, m.source, m."foundingNo", m."revokedAt"
from "User" u left join "BreederProgramMembership" m on m."userId" = u.id and m."programType" = 'FOUNDING_BREEDER'
where u.name like '%닉네임%';
```

## 스크립트 점검
스크립트를 고치면 `python3 -I scripts/prod_sql.py --self-test` 를 돌린다.
