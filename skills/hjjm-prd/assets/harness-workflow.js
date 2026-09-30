// HJJM 실행 루프 — Workflow 도구용 스크립트.
// 사용: Workflow({ scriptPath: <이 파일>, args: { prdPath, baseSha, startedAt, maxAttempts } })
// Controller(이 스크립트) → Scheduler(웨이브) → Builder(worktree 격리) → Verifier(별도 에이전트) → 실행 원장(return)
export const meta = {
  name: 'hjjm-run',
  description: 'HJJM PRD를 이슈 DAG로 실행하고 필수 검사 통과 시 Done을 기록한다',
  phases: [
    { title: 'Controller', detail: 'PRD 파싱, 입력 식별값·이슈 DAG 기록' },
    { title: 'Build', detail: '웨이브별 병렬 Builder, 후보 SHA 보고' },
    { title: 'Verify', detail: '통합 후보 검사와 증거 수집' },
    { title: 'Done', detail: '필수 검사 일치 확인' },
  ],
}

const prdPath = args && args.prdPath
if (!prdPath) throw new Error('args.prdPath 필요')
const maxAttempts = (args && args.maxAttempts) || 3

const DAG_SCHEMA = {
  type: 'object',
  properties: {
    prdId: { type: 'string' },
    version: { type: 'string' },
    designRef: { type: 'string' },
    baseSha: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          title: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          deps: { type: 'array', items: { type: 'string' } },
          checks: { type: 'array', items: { type: 'string' } },
          acceptance: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'type', 'title', 'files', 'deps', 'checks', 'acceptance'],
      },
    },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, command: { type: 'string' }, doneRule: { type: 'string' } },
        required: ['id', 'command', 'doneRule'],
      },
    },
  },
  required: ['prdId', 'version', 'designRef', 'baseSha', 'issues', 'checks'],
}

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    issueId: { type: 'string' },
    candidateSha: { type: 'string' },
    changedFiles: { type: 'array', items: { type: 'string' } },
    outOfScopeFiles: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    blocked: { type: 'boolean' },
    blockReason: { type: 'string' },
  },
  required: ['issueId', 'candidateSha', 'changedFiles', 'outOfScopeFiles', 'summary', 'blocked'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    candidateSha: { type: 'string' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          checkId: { type: 'string' },
          ran: { type: 'boolean' },
          passed: { type: 'boolean' },
          evidence: { type: 'string' },
          failureType: { type: 'string', enum: ['none', 'product', 'environment', 'input', 'auth'] },
          hypothesis: { type: 'string' },
        },
        required: ['checkId', 'ran', 'passed', 'evidence', 'failureType'],
      },
    },
  },
  required: ['candidateSha', 'results'],
}

// ---- Controller: 입력 식별값과 DAG 기록 ----
phase('Controller')
const dag = await agent(
  `PRD 파일 ${prdPath}를 읽고 HJJM 입력 계약으로 파싱하라. 0장의 입력 식별값, 7장의 이슈 표(담당 파일은 백틱 안 경로 그대로), 8장의 검사 표를 그대로 옮긴다. 지어내지 마라.` +
    (args.baseSha ? ` 기준 SHA는 ${args.baseSha}로 고정한다.` : ''),
  { label: 'controller:parse', phase: 'Controller', schema: DAG_SCHEMA, effort: 'low' },
)
if (!dag) throw new Error('PRD 파싱 실패')

// 같은 파일 담당자 두 명 → 입력 형식 문제로 중단
const owner = {}
for (const is of dag.issues) for (const f of is.files) {
  if (owner[f] && owner[f] !== is.id) throw new Error(`입력 형식 문제: ${f} 담당 중복 (${owner[f]}, ${is.id})`)
  owner[f] = is.id
}

const ledger = {
  input: { prdId: dag.prdId, version: dag.version, designRef: dag.designRef, baseSha: dag.baseSha, startedAt: args.startedAt || null },
  issues: {},
  attempts: [],
  candidates: [],
  checks: [],
  done: false,
}
for (const is of dag.issues) ledger.issues[is.id] = { ...is, state: 'ready', attempts: 0, candidateSha: null }

// ---- Scheduler: 위상 정렬 웨이브 ----
function waves(issues) {
  const done = new Set(), out = []
  let rest = issues.slice()
  while (rest.length) {
    const ready = rest.filter(i => i.deps.every(d => done.has(d)))
    if (!ready.length) throw new Error('DAG 순환: ' + rest.map(i => i.id).join(','))
    out.push(ready)
    ready.forEach(i => done.add(i.id))
    rest = rest.filter(i => !ready.includes(i))
  }
  return out
}
const schedule = waves(dag.issues.filter(i => i.type !== '통합 QC/QA'))
log(`이슈 ${dag.issues.length}개 → ${schedule.length}개 웨이브`)

// ---- Build + Verify 루프 ----
phase('Build')
let currentBase = dag.baseSha
for (let w = 0; w < schedule.length; w++) {
  const wave = schedule[w]
  log(`웨이브 ${w + 1}: ${wave.map(i => i.id).join(', ')} (기준 ${currentBase})`)

  const built = await parallel(wave.map(is => () => buildWithRetry(is, currentBase)))
  const failed = built.filter(b => !b || b.blocked)
  if (failed.length) {
    ledger.blocked = wave.filter((_, i) => !built[i] || built[i].blocked).map(i => i.id)
    return ledger
  }
  // 웨이브 통합 후보: 선행 결과가 다음 웨이브의 기준 SHA
  const merge = await agent(
    `다음 후보 브랜치/SHA들을 ${currentBase} 위에 순서대로 통합하고 최종 SHA만 보고하라: ${built.map(b => b.candidateSha).join(', ')}. 충돌 시 blocked=true.`,
    { label: `merge:wave${w + 1}`, phase: 'Build', schema: BUILD_SCHEMA, effort: 'low' },
  )
  if (!merge || merge.blocked) { ledger.blocked = ['merge:wave' + (w + 1)]; return ledger }
  currentBase = merge.candidateSha
  ledger.candidates.push({ wave: w + 1, sha: currentBase, from: built.map(b => b.candidateSha) })
}

async function buildWithRetry(issue, base) {
  let hypothesis = ''
  for (let n = 1; n <= maxAttempts; n++) {
    ledger.issues[issue.id].attempts = n
    const b = await agent(
      `HJJM Builder. 이슈 ${issue.id} "${issue.title}" (${issue.type}). 기준 SHA ${base}에서 시작한다.
담당 파일: ${issue.files.join(', ')} — 이 파일 외에는 수정하지 마라(불가피하면 outOfScopeFiles에 적고 blocked=true).
완료 정의(수용 기준): ${issue.acceptance.join('; ')}. PRD: ${prdPath}.
${hypothesis ? '이전 시도 실패 가설: ' + hypothesis : ''}
작업 후 커밋하고 커밋 SHA를 candidateSha로 보고하라.`,
      { label: `build:${issue.id}#${n}`, phase: 'Build', schema: BUILD_SCHEMA, isolation: 'worktree' },
    )
    ledger.attempts.push({ issue: issue.id, n, result: b })
    if (!b) continue
    if (b.blocked) return b
    if (b.outOfScopeFiles.length) { b.blocked = true; b.blockReason = '담당 외 파일 수정: ' + b.outOfScopeFiles.join(','); return b }

    // 이슈 단위 필수 검사 (Verifier는 별도 에이전트)
    const v = await agent(
      `HJJM Verifier. 후보 SHA ${b.candidateSha}에 대해 다음 검사만 실제로 실행하고 결과와 증거(로그/파일 경로)를 보고하라. 스스로 코드를 고치지 마라.
검사: ${dag.checks.filter(c => issue.checks.includes(c.id) || issue.checks.includes('V-all')).map(c => `${c.id}: ${c.command} (Done 조건: ${c.doneRule})`).join('\n')}
빌드가 실패하면 종속 검사는 ran=false로 둔다. 실패 유형은 product/environment/input/auth 중 하나로 분류하고 수정 가설을 적어라.`,
      { label: `verify:${issue.id}#${n}`, phase: 'Verify', schema: VERIFY_SCHEMA },
    )
    ledger.checks.push({ issue: issue.id, n, result: v })
    if (!v) continue
    const bad = v.results.filter(r => !r.passed)
    if (!bad.length) { ledger.issues[issue.id].state = 'verified'; ledger.issues[issue.id].candidateSha = b.candidateSha; return b }

    // 실패 분류에 따른 다음 조치
    if (bad.some(r => r.failureType === 'auth')) return { ...b, blocked: true, blockReason: '권한/신원 문제: 실행 중단' }
    if (bad.some(r => r.failureType === 'input')) return { ...b, blocked: true, blockReason: '입력 형식 문제: PRD/디자인 수정 필요' }
    if (bad.every(r => r.failureType === 'environment')) { n--; hypothesis = '검사 환경 오류로 동일 후보 재검사'; continue }
    hypothesis = bad.map(r => `${r.checkId}: ${r.hypothesis || r.evidence}`).join(' | ')
    base = b.candidateSha // 제품 결함: 같은 후보 위에서 수정
  }
  return { issueId: issue.id, candidateSha: base, changedFiles: [], outOfScopeFiles: [], summary: '', blocked: true, blockReason: `최대 시도 ${maxAttempts}회 초과` }
}

// ---- 통합 후보 최종 검사 (Done 게이트) ----
phase('Verify')
const finalVerify = await agent(
  `HJJM Verifier. 통합 후보 SHA ${currentBase}에 대해 PRD ${prdPath} 8장의 검사 전부를 실행하고 결과·증거를 보고하라. 코드를 고치지 마라.
검사: ${dag.checks.map(c => `${c.id}: ${c.command} (Done 조건: ${c.doneRule})`).join('\n')}`,
  { label: 'verify:integration', phase: 'Verify', schema: VERIFY_SCHEMA, effort: 'high' },
)
const review = await agent(
  `독립 검토자. 후보 SHA ${currentBase}의 변경을 PRD ${prdPath}의 수용 기준·화면 상태·디자인 참조(${dag.designRef})와 대조하라. 불일치는 전부 적고 승인 여부를 판정하라.`,
  { label: 'review:independent', phase: 'Verify', schema: VERIFY_SCHEMA, effort: 'high' },
)

phase('Done')
const results = [...((finalVerify && finalVerify.results) || []), ...((review && review.results) || [])]
const required = dag.checks.map(c => c.id)
const passedIds = new Set(results.filter(r => r.ran && r.passed).map(r => r.checkId))
const missing = required.filter(id => !passedIds.has(id))
ledger.final = { sha: currentBase, input: ledger.input, scope: required, results }
ledger.done = missing.length === 0
if (!ledger.done) log(`Done 아님 — 미통과/미실행 검사: ${missing.join(', ')}`)
else log(`Done — SHA ${currentBase}, 입력 ${dag.prdId} v${dag.version}`)
return ledger
