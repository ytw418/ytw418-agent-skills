---
name: worktree-setup
description: allibee-frontend worktree에서 누락된 `.env`를 메인 레포에서 복사하고, `apps/contract/vite.config.ts`에 worktree용 `server.fs.allow` 패치를 적용하며, Claude Preview 탭이 `chrome-error://chromewebdata/`에 갇혀 있으면 HTTPS URL로 수동 리다이렉트한다. 사용자가 'worktree 세팅', 'worktree setup', 'env 복사', '워크트리 초기화', 'PUBLIC_BUILD_NAME is not set', '@fs/ 403', '미리보기 안 보임', 'preview 비어있음', 'chrome-error' 등 worktree 관련 문제를 언급하거나 요청할 때 사용한다.
---

# Worktree Setup (allibee-frontend)

`git worktree add`로 새로 만든 worktree는 gitignore된 `.env` 파일이 없고, node_modules가 메인 레포로 심볼릭 링크되어 있어 Vite의 `server.fs.allow` 기본값으로는 `@fs/` 요청이 403을 낸다. 이 스킬은 그 두 가지를 수동(on-demand)으로 해결한다.

## 사용 시점

- worktree에서 `npm run dev:*` 실행 시 `Environment variable PUBLIC_BUILD_NAME is not set` 에러
- worktree에서 `@fs/ .../node_modules/...` 403 에러
- 새 worktree를 만들고 처음 초기화할 때
- 사용자가 "worktree 세팅", "env 복사", "워크트리 초기화"를 요청할 때

## 전제

- 현재 cwd가 allibee-frontend worktree 내부여야 한다.
- 메인 레포(worktree의 root)는 `git worktree list`로 자동 탐지한다.
- 메인 레포에 `apps/*/.env` 파일이 실제 값으로 채워져 있어야 한다.

## 실행 절차

### 1. 환경 감지

```bash
git rev-parse --show-toplevel
git worktree list --porcelain
```

- 현재가 worktree인지 확인한다. `git worktree list`의 첫 번째 항목(=메인 레포)의 경로를 `MAIN_REPO`로 사용한다.
- 현재 cwd가 메인 레포와 동일하면 복사할 필요 없음 → 사용자에게 알리고 종료.

### 2. `.env` 복사 (4개 앱)

대상 앱: `contract`, `cue`, `cue-admin`, `ai-factory`

각 앱에 대해:
- `$MAIN_REPO/apps/<app>/.env`가 존재하고
- 현재 worktree의 `apps/<app>/.env`가 **없을 때만** 복사한다 (덮어쓰지 않음).
- 대상 디렉토리(`apps/<app>/`)가 worktree에 없으면 해당 앱은 스킵.

```bash
for app in contract cue cue-admin ai-factory; do
  src="$MAIN_REPO/apps/$app/.env"
  dst="$PWD/apps/$app/.env"
  if [[ -f "$src" && ! -f "$dst" && -d "$(dirname "$dst")" ]]; then
    cp "$src" "$dst"
    echo "Copied apps/$app/.env"
  fi
done
```

복사된 앱 목록을 사용자에게 보고한다.

### 3. `apps/contract/vite.config.ts` fs.allow 패치

`apps/contract/vite.config.ts`가 존재하면, worktree에서 `@fs/` 요청이 심볼릭 링크된 node_modules로 해결되도록 `server.fs.allow`를 **ancestor-walk 방식**으로 주입한다.

**멱등성 규칙:**
- 파일에 `const ALLOW_ROOTS` + `while (dir !== path.dirname(dir))` 마커가 **둘 다** 있으면 이미 패치됨 → 스킵.
- 이전 버전의 잔재(구 ALLOW_ROOTS, CLAUDE_PREVIEW 블록, 하드코딩 absolute path)가 있으면 제거 후 재삽입.
- 패치가 이뤄졌는지만 로그로 알리고, diff는 출력하지 않는다 (장황해짐).

**패치 스크립트** — 아래 Node 스크립트를 `node - <vite_config_path>`로 실행한다:

```bash
node - "$PWD/apps/contract/vite.config.ts" <<'NODE_EOF'
const fs = require('node:fs');
const file = process.argv[2];
let src = fs.readFileSync(file, 'utf8');
const before = src;

// 1) Strip legacy CLAUDE_PREVIEW conditional block.
src = src.replace(
  /        server:\s*{\s*\n(?:[^\n]*\n)*?\s*https:\s*process\.env\.CLAUDE_PREVIEW[^\n]*\n(?:[^\n]*\n)*?(?=\s*proxy:)/,
  "        server: {\n            https: true,\n"
);

// 2) Strip any existing fs.allow block (both single-line and multi-line).
for (let i = 0; i < 10; i++) {
  const next = src
    .replace(/\n\s*(?:\/\/[^\n]*\n\s*){0,4}fs:\s*\{\s*\n\s*allow:\s*(?:\[[^\]]*\]|ALLOW_ROOTS|NODE_MODULES_ROOT),?\s*\n\s*\}\s*,?\s*\n/, '\n')
    .replace(/\n\s*(?:\/\/[^\n]*\n\s*){0,4}fs:\s*\{\s*allow:\s*(?:\[[^\]]*\]|ALLOW_ROOTS|NODE_MODULES_ROOT)\s*\}\s*,?\s*\n/, '\n');
  if (next === src) break;
  src = next;
}

// 3) Strip any prior NODE_MODULES_ROOT / ALLOW_ROOTS constant block.
src = src.replace(
  /\n\/\/ Git worktrees symlink[\s\S]*?\nconst NODE_MODULES_ROOT[\s\S]*?\n\}?\)\(?\)?;\n/,
  '\n'
);
src = src.replace(
  /\n\/\/ Worktree @fs\/ 403 fix:[\s\S]*?\nconst ALLOW_ROOTS[\s\S]*?\n\}\)\(\);\n/,
  '\n'
);

// 4) If ALLOW_ROOTS exists but lacks the ancestor-walk marker, strip it.
if (src.includes('const ALLOW_ROOTS') && !src.includes('while (dir !== path.dirname(dir))')) {
  src = src.replace(
    /\n\/\/ Worktree @fs\/ 403 fix[\s\S]*?\nconst ALLOW_ROOTS[\s\S]*?\n\}\)\(\);\n/,
    '\n'
  );
}

// 5) Insert import + ALLOW_ROOTS block if missing.
if (!src.includes('const ALLOW_ROOTS')) {
  src = src.replace(/^import fs from 'node:fs';\n/m, '');
  src = src.replace(/^import path from 'node:path';\n/m, '');
  src = src.replace(/^import \{ fileURLToPath \} from 'node:url';\n/m, '');
  const importBlock = [
    "import fs from 'node:fs';",
    "import path from 'node:path';",
    "import { fileURLToPath } from 'node:url';",
    '',
  ].join('\n');
  src = importBlock + src;

  const constBlock = [
    '// Worktree @fs/ 403 fix. Walks every ancestor of this file and adds any',
    '// directory that contains a node_modules to fs.allow. Handles both plain',
    '// clones (identity) and git worktrees (node_modules symlinked to main repo).',
    'const ALLOW_ROOTS = (() => {',
    '    const here = path.dirname(fileURLToPath(import.meta.url));',
    '    const roots = new Set<string>();',
    "    roots.add(path.resolve(here, '../..'));",
    "    const probes = ['@sveltejs/kit', 'vite', '@poppanator/sveltekit-svg'];",
    '    let dir = here;',
    '    while (dir !== path.dirname(dir)) {',
    "        const nm = path.join(dir, 'node_modules');",
    '        try {',
    '            if (fs.existsSync(nm)) {',
    '                roots.add(dir);',
    '                for (const probe of probes) {',
    '                    try {',
    '                        const real = fs.realpathSync(path.join(nm, probe));',
    "                        roots.add(path.resolve(real, '..', '..'));",
    '                    } catch {',
    '                        /* probe absent — skip */',
    '                    }',
    '                }',
    '            }',
    '        } catch {',
    '            /* unreadable — skip */',
    '        }',
    '        dir = path.dirname(dir);',
    '    }',
    '    return Array.from(roots);',
    '})();',
    '',
  ].join('\n');
  src = src.replace(/(\ndotenv\.config\(\);)/, '\n' + constBlock + '$1');
}

// 6) Insert the canonical fs.allow line right after `https: true,`.
src = src.replace(
  /(        server:\s*{\s*\n\s*https:\s*true,\n)/,
  `$1            fs: { allow: ALLOW_ROOTS },\n`
);

if (src !== before) {
  fs.writeFileSync(file, src);
  console.log('Patched apps/contract/vite.config.ts');
} else {
  console.log('vite.config.ts already patched, skipping');
}
NODE_EOF
```

### 4. Claude Preview 탭 리다이렉트 (선택, 상황에 따라)

Claude Preview MCP가 HTTPS dev 서버를 붙일 때, 처음에는 Chrome이 self-signed cert를 받으면서 탭이 `chrome-error://chromewebdata/`에 갇힌다. preview_start 직후 또는 "미리보기 비어있음" 증상 시 수동 리다이렉트가 필요하다.

**언제 실행하나:**
- 사용자가 "미리보기 안 보임", "프리뷰 비어있음", "chrome-error" 등을 언급할 때
- preview_start를 방금 호출했는데 화면이 렌더되지 않을 때
- 스킬 첫 실행 후, dev 서버가 막 올라와 preview 탭이 갱신 안 된 것 같을 때

**절차:**

1. `mcp__Claude_Preview__preview_list`로 실행 중인 서버의 `serverId`와 `port`를 확인한다. contract(혹은 타깃) 앱이 없으면 스킵.
2. `mcp__Claude_Preview__preview_eval`로 현재 상태를 probe:
   ```js
   ({ href: location.href, host: location.host, ready: document.readyState, bodyLen: document.body ? document.body.innerText.length : 0 })
   ```
3. 판정:
   - `host === "localhost:<port>"` AND `bodyLen > 0` → 이미 정상. 스킵.
   - `host === "chromewebdata"` 또는 `href`가 `chrome-error://`로 시작 → 리다이렉트 필요.
4. 리다이렉트 (idempotent):
   ```js
   location.href = "https://localhost:<port>/"
   ```
5. 3초 대기 후 다시 probe해서 `host`, `bodyLen`, `title`을 확인한다. `bodyLen > 0`이면 성공.
6. 여전히 `chromewebdata`이거나 `bodyLen === 0`이면:
   - `curl -sk https://localhost:<port>/`로 서버 응답 직접 확인
   - 실패 시 `mcp__Claude_Preview__preview_logs`로 vite stderr 확인 후 사용자에게 구체적 원인 보고

`preview_eval`의 반환값은 직접 읽을 수 있으므로 사용자에게 "화면 보이나요?" 같은 확인 질문은 하지 않는다 — href / readyState / bodyLen으로 self-verify한다.

### 5. 결과 보고

사용자에게 아래 형식으로 간단히 요약한다:

```
워크트리 세팅 완료 (MAIN_REPO: <경로>):
- .env 복사: contract, cue (2/4 — cue-admin/ai-factory는 이미 있거나 앱 미사용)
- vite.config.ts: 패치 적용 (또는: 이미 패치됨, 스킵)

이제 `npm run dev:contract` 등을 실행할 수 있습니다.
```

## 주의

- `.env`는 **실제 값이 메인 레포에 있어야** 복사가 의미 있다. 메인 레포 `.env`가 `.env.template` 그대로면 복사해도 동작 안 함 → 사용자에게 "메인 레포의 `apps/<app>/.env`를 먼저 채워주세요"라고 안내.
- vite.config.ts 패치는 **메인 레포에도 커밋 가능한 형태**다 (절대경로 하드코딩 없음). 다만 이 스킬은 worktree의 working copy만 수정하고 자동 커밋하지 않는다.
- 이미 vite.config.ts가 PR #3808 등으로 최신화돼 있으면 스킵된다.

## 관련 이슈

- Slack `#03_unit_common_popddev` 이태희_Agent Unit의 worktree 자동화 훅 가이드 (2026-04-21). 이 스킬은 그 훅을 **수동 스킬 형태로 단순화**한 버전이다.
- PR: [allibee-frontend#3808](https://github.com/bhsn-ai/allibee-frontend/pull/3808)
