#!/usr/bin/env node

const assert = require('node:assert/strict');
const { chmodSync, mkdtempSync, mkdirSync, writeFileSync } = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const script = join(__dirname, 'check-pr-screenshot-storage.js');

function run(command, args, options = {}) {
    return execFileSync(command, args, { encoding: 'utf8', ...options }).trim();
}

function fixture({ trackedImage = false, body = '', comments = [] }) {
    const root = mkdtempSync(join(tmpdir(), 'pr-screenshot-storage-'));
    const bin = join(root, 'bin');
    mkdirSync(bin);
    run('git', ['init', '-q'], { cwd: root });
    run('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    run('git', ['config', 'user.name', 'Test'], { cwd: root });
    writeFileSync(join(root, 'README.md'), 'base\n');
    run('git', ['add', 'README.md'], { cwd: root });
    run('git', ['commit', '-qm', 'base'], { cwd: root });
    run('git', ['branch', 'base'], { cwd: root });
    writeFileSync(join(root, 'README.md'), 'head\n');
    if (trackedImage) {
        mkdirSync(join(root, '.github', 'pr-assets'), { recursive: true });
        writeFileSync(join(root, '.github', 'pr-assets', 'screen.png'), 'png');
    }
    run('git', ['add', '.'], { cwd: root });
    run('git', ['commit', '-qm', 'head'], { cwd: root });

    const gh = join(bin, 'gh');
    writeFileSync(
        gh,
        `#!/bin/sh\nprintf '%s' '${JSON.stringify({ body, comments: comments.map((item) => ({ body: item })), baseRefName: 'base' }).replaceAll("'", "'\\''")}'\n`,
    );
    chmodSync(gh, 0o755);
    return { root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } };
}

function check(options, extraArgs = []) {
    const { root, env } = fixture(options);
    return spawnSync(process.execPath, [script, '--pr', '1', '--repo', 'owner/repo', '--base', 'base', ...extraArgs], {
        cwd: root,
        env,
        encoding: 'utf8',
    });
}

const valid = check(
    { body: '### 스크린샷\n![화면](https://github.com/user-attachments/assets/12345678-abcd-1234-abcd-1234567890ab)' },
    ['--require-attachment'],
);
assert.equal(valid.status, 0, valid.stderr);

const tracked = check({ trackedImage: true });
assert.equal(tracked.status, 1);
assert.match(tracked.stderr, /Git 커밋 히스토리/);

const repositoryLink = check({ body: '![화면](https://github.com/owner/repo/blob/abc/.github/pr-assets/screen.png?raw=true)' });
assert.equal(repositoryLink.status, 1);
assert.match(repositoryLink.stderr, /저장소의 증빙용 이미지 경로/);

const missingAttachment = check({ body: '### 스크린샷\n없음' }, ['--require-attachment']);
assert.equal(missingAttachment.status, 1);
assert.match(missingAttachment.stderr, /user-attachments/);

console.log('check-pr-screenshot-storage 테스트 성공: 4개 시나리오');
