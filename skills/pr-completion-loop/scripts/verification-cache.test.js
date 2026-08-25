#!/usr/bin/env node

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const script = join(__dirname, 'verification-cache.js');

function run(command, args, options = {}) {
    return execFileSync(command, args, { encoding: 'utf8', ...options }).trim();
}

function git(root, ...args) {
    return run('git', args, { cwd: root });
}

function commit(root, message) {
    git(root, 'add', '.');
    git(root, 'commit', '-qm', message);
}

function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'verification-cache-'));
    git(root, 'init', '-q');
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'Test');
    writeFileSync(join(root, 'README.md'), 'base\n');
    commit(root, 'base');
    git(root, 'branch', 'base');
    return root;
}

function invoke(root, operation, args = []) {
    return spawnSync(
        process.execPath,
        [script, operation, '--base', 'base', '--state-file', join(root, 'state.json'), ...args],
        { cwd: root, encoding: 'utf8' },
    );
}

const root = fixture();

try {
    mkdirSync(join(root, 'apps', 'cue', 'src', 'routes'), { recursive: true });
    writeFileSync(join(root, 'apps', 'cue', 'src', 'routes', '+page.svelte'), '<main>first</main>\n');
    commit(root, 'ui');

    const plan = invoke(root, 'plan');
    assert.equal(plan.status, 0, plan.stderr);
    const gateNames = JSON.parse(plan.stdout).gates.map((gate) => gate.name);
    assert.deepEqual(gateNames, ['browser-scenario', 'focused-test', 'screenshot']);

    const checkArgs = [
        '--gate',
        'browser-scenario',
        '--command',
        'verify cue route',
        '--environment',
        'cue-local',
    ];
    const miss = invoke(root, 'check', checkArgs);
    assert.equal(miss.status, 1);
    assert.match(miss.stdout, /MISS browser-scenario/);

    const record = invoke(root, 'record', [...checkArgs, '--status', 'passed']);
    assert.equal(record.status, 0, record.stderr);
    assert.match(record.stdout, /RECORDED browser-scenario: passed/);

    const hit = invoke(root, 'check', checkArgs);
    assert.equal(hit.status, 0, hit.stderr);
    assert.match(hit.stdout, /HIT browser-scenario/);

    writeFileSync(join(root, 'README.md'), 'documentation only\n');
    commit(root, 'docs');
    const hitAfterDocs = invoke(root, 'check', checkArgs);
    assert.equal(hitAfterDocs.status, 0, hitAfterDocs.stderr);
    assert.match(hitAfterDocs.stdout, /HIT browser-scenario/);

    writeFileSync(join(root, 'apps', 'cue', 'src', 'routes', '+page.svelte'), '<main>second</main>\n');
    commit(root, 'ui changed');
    const missAfterUi = invoke(root, 'check', checkArgs);
    assert.equal(missAfterUi.status, 1);
    assert.match(missAfterUi.stdout, /MISS browser-scenario/);

    const missForChangedCommand = invoke(root, 'check', [
        '--gate',
        'browser-scenario',
        '--command',
        'verify another route',
        '--environment',
        'cue-local',
    ]);
    assert.equal(missForChangedCommand.status, 1);

    const skipped = invoke(root, 'check', [
        '--gate',
        'harness-test',
        '--command',
        'npm run test:harness',
    ]);
    assert.equal(skipped.status, 0, skipped.stderr);
    assert.match(skipped.stdout, /SKIP harness-test/);
} finally {
    rmSync(root, { recursive: true, force: true });
}

const browserRoot = fixture();

try {
    mkdirSync(join(browserRoot, 'scripts', 'browser'), { recursive: true });
    writeFileSync(join(browserRoot, 'scripts', 'browser', 'capture.js'), 'console.log("capture")\n');
    commit(browserRoot, 'browser harness');
    const plan = invoke(browserRoot, 'plan');
    assert.equal(plan.status, 0, plan.stderr);
    const gateNames = JSON.parse(plan.stdout).gates.map((gate) => gate.name);
    assert.deepEqual(gateNames, ['harness-test', 'playwright-capture']);
} finally {
    rmSync(browserRoot, { recursive: true, force: true });
}

console.log('verification-cache 테스트 성공: 경로 분류, cache hit/miss, 문서 변경 재사용');
