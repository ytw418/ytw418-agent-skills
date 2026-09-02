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

const forceAttachment = args.includes('--require-attachment');
const skipAttachment = args.includes('--skip-attachment');
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

// UI에 보이는 변경은 스크린샷 첨부를 자동으로 요구한다 — 플래그를 잊어도 검사가 무력화되지 않게 한다
const uiFilePattern = /\.(svelte|tsx|jsx|vue|css|scss|less|html)$/i;
const uiChangedFiles = [...new Set(historyPaths)].filter((path) => uiFilePattern.test(path));
const requireAttachment = !skipAttachment && (forceAttachment || uiChangedFiles.length > 0);

const comments = (prData.comments || []).map((comment) => comment.body || '');
const prContent = [prData.body || '', ...comments].join('\n');
// 전용 assets 레포(ytw418/pr-assets)의 raw URL은 대상 저장소 히스토리를 오염시키지 않으므로 저장소 경로 검사에서 제외한다
const externalAssetsUrl = /https:\/\/raw\.githubusercontent\.com\/ytw418\/pr-assets\//i;
const repositoryEvidenceLinks = prContent
    .split('\n')
    .filter(
        (line) =>
            !externalAssetsUrl.test(line) &&
            evidenceDirectory.test(line) &&
            /\.(avif|gif|jpe?g|png|webp)(?:[?#)\s]|$)/i.test(line),
    );

if (repositoryEvidenceLinks.length > 0) {
    fail('PR 본문 또는 댓글이 저장소의 증빙용 이미지 경로를 참조합니다.', repositoryEvidenceLinks);
}

// user-attachments는 GitHub 웹 세션으로만 업로드 가능 — 세션이 없는 환경은 전용 assets 레포(raw URL) fallback을 허용한다
const attachmentPattern = /https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+|https:\/\/raw\.githubusercontent\.com\/ytw418\/pr-assets\/[^\s)"']+\.(?:avif|gif|jpe?g|png|webp)/i;
if (requireAttachment && !attachmentPattern.test(prContent)) {
    const reason = forceAttachment
        ? '--require-attachment 지정'
        : `UI 파일 변경 자동 감지 (${uiChangedFiles.slice(0, 5).join(', ')}${uiChangedFiles.length > 5 ? ' 외' : ''})`;
    fail(
        `PR 본문 또는 댓글에서 스크린샷 첨부(user-attachments 또는 ytw418/pr-assets raw URL)를 찾지 못했습니다. [${reason}]`,
    );
}

console.log(
    `PR 스크린샷 저장 방식 검증 성공: PR #${pr}, base=${base}, uiChange=${uiChangedFiles.length > 0}, attachmentRequired=${requireAttachment}, attachment=${attachmentPattern.test(prContent)}`,
);
