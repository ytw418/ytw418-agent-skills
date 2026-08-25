#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const args = process.argv.slice(2);

function valueOf(name) {
    const index = args.indexOf(name);
    if (index === -1 || !args[index + 1]) {
        throw new Error(`${name} 값이 필요합니다.`);
    }
    return args[index + 1];
}

function run(command, commandArgs) {
    return execFileSync(command, commandArgs, { encoding: 'utf8' }).trim();
}

function fail(message, details = []) {
    console.error(`PR 스크린샷 저장 방식 검증 실패: ${message}`);
    for (const detail of details) console.error(`- ${detail}`);
    process.exit(1);
}

let pr;
let repo;

try {
    pr = valueOf('--pr');
    repo = valueOf('--repo');
} catch (error) {
    fail(error.message);
}

const requireAttachment = args.includes('--require-attachment');
const explicitBaseIndex = args.indexOf('--base');
const explicitBase = explicitBaseIndex === -1 ? null : args[explicitBaseIndex + 1];

let prData;
try {
    prData = JSON.parse(
        run('gh', ['pr', 'view', pr, '--repo', repo, '--json', 'body,comments,baseRefName']),
    );
} catch (error) {
    fail(`PR #${pr} 정보를 읽지 못했습니다: ${error.message}`);
}

const base = explicitBase || `origin/${prData.baseRefName}`;
let historyPaths;
try {
    historyPaths = run('git', ['log', '--format=', '--name-only', `${base}..HEAD`])
        .split('\n')
        .map((path) => path.trim())
        .filter(Boolean);
} catch (error) {
    fail(`${base} 이후 커밋 경로를 읽지 못했습니다: ${error.message}`);
}

const evidenceDirectory = /(^|\/)(\.github\/pr-assets|pr-assets|screenshots?)(\/|$)/i;
const imagePathExtension = /\.(avif|gif|jpe?g|png|webp)$/i;
const trackedEvidenceImages = [...new Set(historyPaths)].filter(
    (path) => evidenceDirectory.test(path) && imagePathExtension.test(path),
);

if (trackedEvidenceImages.length > 0) {
    fail('PR 증빙용 이미지가 Git 커밋 히스토리에 포함되어 있습니다.', trackedEvidenceImages);
}

const comments = (prData.comments || []).map((comment) => comment.body || '');
const prContent = [prData.body || '', ...comments].join('\n');
const repositoryEvidenceLinks = prContent
    .split('\n')
    .filter(
        (line) =>
            evidenceDirectory.test(line) && /\.(avif|gif|jpe?g|png|webp)(?:[?#)\s]|$)/i.test(line),
    );

if (repositoryEvidenceLinks.length > 0) {
    fail('PR 본문 또는 댓글이 저장소의 증빙용 이미지 경로를 참조합니다.', repositoryEvidenceLinks);
}

const attachmentPattern = /https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+/i;
if (requireAttachment && !attachmentPattern.test(prContent)) {
    fail('PR 본문 또는 댓글에서 GitHub user-attachments 스크린샷을 찾지 못했습니다.');
}

console.log(
    `PR 스크린샷 저장 방식 검증 성공: PR #${pr}, base=${base}, attachment=${attachmentPattern.test(prContent)}`,
);
