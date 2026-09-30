# PRD: 커뮤니티 게시글 신고·작성자 차단 서버화 (브리디 앱)

> 작성 예시. 현재 앱은 mailto 신고 + SecureStore 로컬 차단으로 심사 대응 중이며, 이를 서버 API로 옮기는 기능.

## 0. 입력 식별값
| 키 | 값 |
|---|---|
| prd_id | prd-20260930-post-report-block |
| version | 1 |
| 디자인 참조 | breeder_web `app/(web)/posts/[id]/PostClient.tsx` 기준 (별도 .pen 없음) |
| 기준 SHA | aaaa395 (bredy_app) / breeder_web HEAD |
| 대상 플랫폼 | android, ios (bredy_app) + api (breeder_web) |
| 작성자 · 작성일 | 윤성준 · 2026-09-30 |

## 1. 배경과 목표
- 문제: 신고가 메일로 가서 운영자가 수동 처리하고, 차단이 기기 로컬이라 재설치·기기 변경 시 사라진다.
- 목표: 신고 접수 후 24시간 내 운영자 확인이 가능하고, 차단이 계정 단위로 모든 기기에서 동일하게 적용된다.
- 비목표: 자동 제재(자동 숨김·정지), 경매 신고(이미 서버 API 있음).

## 2. 사용자와 기능
| ID | 사용자 | 기능 | 우선순위 |
|---|---|---|---|
| F-1 | 로그인 사용자 | 게시글을 사유와 함께 신고한다 | must |
| F-2 | 로그인 사용자 | 게시글 작성자를 차단하고 목록·HOT·TOP에서 숨긴다 | must |
| F-3 | 로그인 사용자 | 설정에서 차단 목록을 보고 해제한다 | should |

## 3. 화면과 상태
### S-1 게시글 상세 (`src/app/posts/[id].tsx`)
| 상태 | 표시 내용 | 디자인 프레임 | 진입 조건 |
|---|---|---|---|
| S-1.기본 | 헤더 우측 ⋯ 메뉴에 신고 / 차단 | 웹 PostClient 동일 | 로그인 + 타인 글 |
| S-1.로딩 | 신고 전송 중 버튼 스피너 | Button loading | 전송 요청 후 |
| S-1.빈 | 해당 없음 | - | - |
| S-1.오류 | 토스트 "신고를 접수하지 못했습니다" | AppToastContainer error | API 실패 |
| S-1.권한없음 | 메뉴에 신고/차단 미표시, 탭 시 로그인 모달 | 로그인 게이트 | 비로그인 |

### S-2 차단 목록 (`src/app/settings/blocked.tsx`, 신규)
| 상태 | 표시 내용 | 디자인 프레임 | 진입 조건 |
|---|---|---|---|
| S-2.기본 | 아바타·이름·해제 버튼 행 | 설정 row 스타일 | 차단 1명 이상 |
| S-2.로딩 | 스켈레톤 3행 | Skeleton | 첫 조회 |
| S-2.빈 | "차단한 사용자가 없습니다" | 설정 빈 상태 | 0명 |
| S-2.오류 | 재시도 버튼 | 공통 오류 | API 실패 |
| S-2.권한없음 | 로그인 게이트 | - | 비로그인 |

## 4. 오류 처리
| ID | 트리거 | 사용자에게 보이는 것 | 복구 동작 | 로그/보고 |
|---|---|---|---|---|
| E-1 | 신고 API 5xx/네트워크 | 오류 토스트 | 재시도 버튼 | 클라 로그 + 서버 에러 로그 |
| E-2 | 같은 글 중복 신고(409) | "이미 신고한 글입니다" | 없음 | 없음 |
| E-3 | 자기 글 신고/차단 시도 | 메뉴 미노출 | - | - |

## 5. 수용 기준 (예/아니오)
| ID | 조건 → 기대 결과 | 판정 | 검사 | 자동/수동 |
|---|---|---|---|---|
| AC-1 | 로그인 사용자가 사유를 고르고 신고하면 `POST /api/posts/:id/report`가 201을 반환하고 DB에 PostReport 1건이 생긴다 | 예/아니오 | V-int | 자동 |
| AC-2 | 같은 사용자가 같은 글을 다시 신고하면 409와 E-2 문구가 보인다 | 예/아니오 | V-int, V-e2e | 자동 |
| AC-3 | 작성자를 차단하면 게시글 목록·HOT·TOP 응답에 그 작성자 글이 포함되지 않는다 | 예/아니오 | V-int | 자동 |
| AC-4 | 차단 후 다른 기기에서 로그인해도 같은 작성자가 숨겨진다 | 예/아니오 | V-e2e | 자동 |
| AC-5 | 차단 목록에서 해제하면 다음 목록 조회에 글이 다시 보인다 | 예/아니오 | V-e2e | 자동 |
| AC-6 | 비로그인 상태에서는 신고/차단 메뉴가 보이지 않는다 | 예/아니오 | V-e2e | 자동 |
| AC-7 | S-1, S-2의 5개 상태를 캡처하면 웹 원본 스크린샷과 일치한다 | 예/아니오 | V-design | 수동 |

## 6. 추적표
| 기능 | 화면·상태 | 수용 기준 | 검사 |
|---|---|---|---|
| F-1 | S-1.기본/로딩/오류 | AC-1, AC-2, AC-6 | V-int, V-e2e |
| F-2 | S-1.기본 | AC-3, AC-4 | V-int, V-e2e |
| F-3 | S-2.* | AC-5 | V-e2e |
| F-1~3 | S-1, S-2 전 상태 | AC-7 | V-design |

## 7. 이슈 분해 (DAG)
| ID | 유형 | 제목 | 담당 파일 | 의존 | 필수 검사 | 완료 정의 |
|---|---|---|---|---|---|---|
| I-1 | 공통 계약 | Prisma `PostReport`, `UserBlock` 모델 + 마이그레이션 | breeder_web `prisma/schema.prisma` | - | V-build | 마이그레이션 적용 |
| I-2 | 공통 계약 | 앱 응답 타입 추가 | bredy_app `src/types/api.ts` | I-1 | V-build | 타입 컴파일 |
| I-3 | 업무 기능 | `POST /api/posts/[id]/report` (중복 409) | breeder_web `pages/api/posts/[id]/report.ts` | I-1 | V-int | AC-1, AC-2 |
| I-4 | 업무 기능 | `POST/DELETE /api/users/[id]/block`, `GET /api/users/me/blocks` | breeder_web `pages/api/users/[id]/block.ts`, `pages/api/users/me/blocks.ts` | I-1 | V-int | AC-3 |
| I-5 | 데이터 연동 | 목록·HOT·TOP 쿼리에서 차단 작성자 제외 | breeder_web `pages/api/posts/index.ts`, `pages/api/home/feed.ts`, `pages/api/ranking.ts` | I-4 | V-int | AC-3 |
| I-6 | 화면 구현 | 상세 화면 신고/차단 메뉴를 서버 API로 교체 | bredy_app `src/app/posts/[id].tsx`, `src/lib/api/endpoints/posts.ts` | I-2, I-3, I-4 | V-e2e | AC-1, AC-2, AC-6 |
| I-7 | 화면 구현 | 차단 목록 화면 + 설정 row | bredy_app `src/app/settings/blocked.tsx`, `src/app/settings/index.tsx` | I-2, I-4 | V-e2e | AC-5 |
| I-8 | 데이터 연동 | 로컬 차단 목록 → 서버 1회 마이그레이션 후 제거 | bredy_app `src/lib/moderation/local-user-blocks.ts` | I-4, I-7 | V-unit | AC-4 |
| I-9 | 통합 QC/QA | 통합 후보 검사 + 디자인 대조 + 독립 검토 | - | I-5, I-6, I-8 | V-all | AC-all |

## 8. 검증 계획
| ID | 검사 | 명령 또는 절차 | Done 조건 |
|---|---|---|---|
| V-build | 빌드 | `npx tsc --noEmit && npm run lint` (앱) / `npm run build` (웹) | 성공 |
| V-unit | 단위 | `npm test -- moderation` | 통과, coverage ≥ 80% |
| V-int | 통합 | 웹 `npm test -- api/posts api/users` | 전부 통과 |
| V-e2e | E2E | Android 에뮬레이터 `bredy_pixel`에서 AC-2/4/5/6 시나리오 | 통과, 재시도 0회 |
| V-a11y | 접근성 | 신고 메뉴·차단 목록 accessibilityLabel 검사 | serious/critical 0건 |
| V-sec | 보안 | 신고·차단 API withAuth 적용, 타인 계정 차단 목록 조회 403 | high/critical/secret 0건 |
| V-design | 기획·디자인 대조 | `adb exec-out screencap` 상태별 캡처 ↔ 웹 스크린샷 | 차이 0건 |
| V-review | 독립 검토 | 작성 에이전트 외 리뷰어가 PR 리뷰 | 승인 |

## 9. 미결 질문과 가정
- [ ] 질문: 신고 사유 목록을 경매 신고(`AuctionReport`)와 공유할지?
- [ ] 질문: 운영자 확인 화면은 웹 admin에 추가하는지(앱 비목표)?
- 가정: 차단은 상호가 아니라 단방향이다(차단당한 사용자는 알 수 없다).
