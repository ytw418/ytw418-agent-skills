#!/usr/bin/env node

const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { mkdirSync, readFileSync, renameSync, writeFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const argv = process.argv.slice(2);
const operation = argv.shift();

function fail(message, exitCode = 2) {
    console.error(`verification-cache: ${message}`);
    process.exit(exitCode);
}

function option(name, fallback = undefined) {
    const index = argv.indexOf(name);
    if (index === -1) return fallback;
    if (!argv[index + 1]) fail(`${name} 값이 필요합니다.`);
    return argv[index + 1];
}

function git(args) {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function hash(value) {
    return createHash('sha256').update(value).digest('hex');
}

function isDocumentation(path) {
    return (
        /(^|\/)(docs?|references?|skills?)\//i.test(path) ||
        /(^|\/)(readme|changelog|contributing)(\.|$)/i.test(path) ||
        /\.(md|mdx|txt)$/i.test(path) ||
        /^\.github\/(pull_request_template|issue_template)/i.test(path)
    );
}

function gatesForPath(path) {
    if (isDocumentation(path)) return [];

    if (
        /(^|\/)scripts\/browser\//i.test(path) ||
        /(^|\/)e2e\//i.test(path) ||
        /(^|\/)playwright(?:\.[^/]+)?\.(?:js|cjs|mjs|ts)$/i.test(path)
    ) {
        return ['harness-test', 'playwright-capture'];
    }

    if (/(^|\/)(__tests__|tests?)\//i.test(path) || /\.(?:test|spec)\.[^/]+$/i.test(path)) {
        return ['affected-test'];
    }

    if (/^apps\/[^/]+\/src\/.*\.(?:svelte|tsx|jsx|css|scss|sass|less)$/i.test(path)) {
        return ['focused-test', 'browser-scenario', 'screenshot'];
    }

    if (/^apps\/[^/]+\/src\/.*\.(?:ts|js|mjs|cjs)$/i.test(path)) {
        return ['focused-test', 'static-check', 'browser-scenario'];
    }

    if (
        /(^|\/)(package\.json|[^/]*lock[^/]*|vite\.config\.[^/]+|svelte\.config\.[^/]+|tsconfig[^/]*\.json)$/i.test(
            path,
        ) ||
        /^\.github\/workflows\//i.test(path)
    ) {
        return ['static-check'];
    }

    if (/\.(?:ts|tsx|js|jsx|mjs|cjs|svelte|css|scss|sass|less)$/i.test(path)) {
        return ['focused-test', 'static-check'];
    }

    return ['static-check'];
}

function commitSha(ref) {
    try {
        return git(['rev-parse', `${ref}^{commit}`]);
    } catch (error) {
        fail(`${ref} commit을 확인하지 못했습니다: ${error.message}`);
    }
}

function changedPaths(baseSha, headSha) {
    const output = git([
        'diff',
        '--name-only',
        '--diff-filter=ACDMRTUXB',
        `${baseSha}...${headSha}`,
    ]);
    return output ? output.split('\n').filter(Boolean) : [];
}

function buildPlan(base, head) {
    const baseSha = commitSha(base);
    const headSha = commitSha(head);
    const paths = changedPaths(baseSha, headSha);
    const gatePaths = new Map();

    for (const path of paths) {
        for (const gate of gatesForPath(path)) {
            const current = gatePaths.get(gate) || [];
            current.push(path);
            gatePaths.set(gate, current);
        }
    }

    return {
        base,
        baseSha,
        head,
        headSha,
        changedPaths: paths,
        gates: [...gatePaths.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, pathsForGate]) => ({ name, paths: [...new Set(pathsForGate)].sort() })),
    };
}

function blobOid(headSha, path) {
    const output = git(['ls-tree', headSha, '--', path]);
    if (!output) return 'deleted';
    const metadata = output.slice(0, output.indexOf('\t')).split(/\s+/);
    return metadata[2] || 'unknown';
}

function defaultStatePath() {
    return resolve(git(['rev-parse', '--git-path', 'pr-completion-loop/verification-state.json']));
}

function readState(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return { schemaVersion: 1, gates: {} };
        fail(`상태 파일을 읽지 못했습니다: ${error.message}`);
    }
}

function writeState(path, state) {
    mkdirSync(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporaryPath, path);
}

function fingerprintFor(plan, gateName, command, environment) {
    const gate = plan.gates.find((candidate) => candidate.name === gateName);
    if (!gate) return null;

    const pathBlobs = gate.paths.map((path) => [path, blobOid(plan.headSha, path)]);
    const commandHash = hash(command);
    const environmentHash = hash(environment);
    const fingerprint = hash(
        JSON.stringify({
            schemaVersion: 1,
            baseSha: plan.baseSha,
            gate: gateName,
            pathBlobs,
            commandHash,
            environmentHash,
        }),
    );

    return { fingerprint, commandHash, environmentHash, paths: gate.paths };
}

if (!['plan', 'check', 'record'].includes(operation)) {
    fail('사용법: verification-cache.js <plan|check|record> [options]');
}

const base = option('--base', 'origin/develop');
const head = option('--head', 'HEAD');
const statePath = resolve(option('--state-file', defaultStatePath()));
const plan = buildPlan(base, head);

if (operation === 'plan') {
    console.log(JSON.stringify({ ...plan, statePath }, null, 2));
    process.exit(0);
}

const gate = option('--gate');
const command = option('--command');
const environment = option('--environment', 'default');
if (!gate) fail('--gate 값이 필요합니다.');
if (!command) fail('--command 값이 필요합니다.');

const fingerprint = fingerprintFor(plan, gate, command, environment);

if (operation === 'check') {
    if (!fingerprint) {
        console.log(`SKIP ${gate}: 현재 변경 경로에서 필요하지 않습니다.`);
        process.exit(0);
    }

    const state = readState(statePath);
    const cached = state.gates[gate];
    if (cached?.status === 'passed' && cached.fingerprint === fingerprint.fingerprint) {
        console.log(`HIT ${gate}: 동일 조건의 통과 결과를 재사용합니다.`);
        process.exit(0);
    }

    console.log(`MISS ${gate}: 검증이 필요합니다.`);
    process.exit(1);
}

const status = option('--status');
if (!['passed', 'failed', 'blocked'].includes(status)) {
    fail('--status는 passed, failed, blocked 중 하나여야 합니다.');
}
if (!fingerprint) fail(`${gate}는 현재 변경 경로에서 필요한 게이트가 아닙니다.`);

const state = readState(statePath);
state.schemaVersion = 1;
state.gates ||= {};
state.gates[gate] = {
    status,
    fingerprint: fingerprint.fingerprint,
    commandHash: fingerprint.commandHash,
    environmentHash: fingerprint.environmentHash,
    baseSha: plan.baseSha,
    verifiedHeadSha: plan.headSha,
    paths: fingerprint.paths,
    verifiedAt: new Date().toISOString(),
};
writeState(statePath, state);
console.log(`RECORDED ${gate}: ${status}`);
