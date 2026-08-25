---
name: figma-browser-verification
description: Verify authenticated local web UI against exact Figma nodes with reproducible screenshots, visual comparison, fix-and-recheck loops, and explicit evidence. Use after Figma-driven frontend changes or when asked to compare a running page with Figma. Do not use for code-only review without a runnable UI.
---

# Figma Browser Verification

Treat browser verification as a completion gate, not a final glance. A UI task is complete only when the intended authenticated state was reached, the correct Figma node and browser state were captured under matching conditions, material differences were resolved, and the final state was captured again.

Use the `figma` skill for the exact design node. Choose authenticated browser control according to the rules below; this workflow is not tied to Playwright. Use browser page screenshots, never desktop or whole-window screenshots, as comparison evidence.

Default to the user's real Chrome session for local interactive verification when the Chrome extension connection is available. Use isolated Playwright Chromium for deterministic repeat capture, disposable authentication, CI-like checks, or when Chrome is unavailable. When the user explicitly chooses either browser, preserve that choice.

## Required inputs

Resolve these from the task, Jira, Figma, the running app, and the repository before verification:

- exact Figma frame or component URL, including the intended variant and state;
- exact target route, app port, workspace, language, and required test data;
- scenarios and expected behavior, including loading, empty, error, hover, modal, or responsive states that materially changed;
- ticket key or another stable evidence label.

Do not compare against a nearby frame, a Figma file overview, or a different variant because it is easier to access. If the exact design state is genuinely ambiguous, report that ambiguity instead of selecting one silently.

## Verification state machine

Use these states and preserve them across pauses:

```text
DESIGN_READY -> APP_READY -> AUTH_CHECK -> STATE_READY -> CAPTURED
     -> COMPARED -> FIXED -> RECHECKED -> PASS
```

Possible exits are `BLOCKED_AUTH`, `BLOCKED_DATA`, `BLOCKED_SPEC`, and `FAIL`. Authentication absence is a checkpoint, not a product failure.

## 1. Lock the Figma reference

1. Fetch design context for the exact node.
2. Fetch its Figma screenshot.
3. Record node ID, frame dimensions, variant/state, and the visible behavior or copy that matters.
4. Inspect planning text or annotations attached to that node.
5. Save the reference image under `artifacts/<label>/visual/<scenario>/reference.png` when the tool provides a local or downloadable image. Otherwise retain the returned image as the comparison reference and note that overlay generation is unavailable.

The frame dimensions define the primary browser viewport unless the design explicitly represents only a component crop. For component designs, capture both the contextual viewport and the corresponding element crop.

## 2. Acquire an authenticated browser safely

Respect an explicit browser choice from the user. Use the first viable path:

1. **Existing Chrome session:** Prefer the user's open Chrome for local interactive verification. It preserves the real profile, login, extensions, fonts, and browser settings. Read and follow [references/existing-chrome.md](references/existing-chrome.md).
2. **Opaque env login:** The user has authorized automatic login to the local Cue development app using the dedicated `E2E_EMAIL` and `E2E_PASSWORD` values in the gitignored `apps/cue/.env`. A local automation runtime may read those named variables and pass variable references directly to the normal login form without emitting, echoing, interpolating into commands, or returning their values to the model.
3. **Playwright Chromium capture:** For a deterministic or isolated route screenshot, use the repository runner below. It performs the opaque env login in an isolated browser, restricts credential submission to HTTPS loopback URLs, and does not persist auth state. This is the fallback or repeatability path, not a substitute for explicitly requested Chrome verification.
4. **User handoff:** Ask the user to log in only when no authenticated session exists and the selected tool cannot inject the env values opaquely.

```bash
npm run visual:cue:capture -- \
  --base-url https://localhost:5174 \
  --path '/ko/{workspace}/esign/' \
  --viewport 1440x1024 \
  --wait-for '[data-testid="stable-page-marker"]' \
  --dismiss-selector '[aria-label="개발 도구 닫기"]' \
  --output artifacts/<label>/visual/<scenario>/actual-01.png
```

Use `--dismiss-selector` only for an unrelated overlay that exposes a real user-visible close control. The runner clicks that control and records the selector in screenshot metadata; do not hide or remove product DOM with injected JavaScript or CSS. Use `--capture-selector` when the Figma reference is an element or app-root crop, but first inspect the saved result because fixed-position sibling overlays may still paint over an element screenshot.

For interactions beyond navigation, reuse an existing focused Playwright scenario or create a task-scoped scenario that uses the same env variables through Cue's test setup. Browser extension and Computer Use may instead drive the existing Chrome session. Do not add a development-only login button, auth bypass, hardcoded credential, or client-side env exposure to the application.

For Browser extension or Computer Use opaque login, keep credential loading and field filling inside the local runtime. Never print the parsed env object or credential fields. Pass variables directly to the email and password controls, submit through the normal login UI, clear runtime references, and immediately verify the redirect. If the selected surface cannot do this without exposing values, do not attempt it; use the Playwright runner or hand off to the user.

For every path:

1. Open the exact target URL and wait for initial navigation to settle.
2. Confirm both the final route and a page-specific visible marker. A localhost page merely responding is not proof that the target state loaded.
3. Treat any of the following as `AUTH_REQUIRED`:
   - final URL contains `/sign-in/`, `/login/`, or an authentication callback;
   - the app redirects away from the requested protected route;
   - the relevant auth or refresh request returns 401 or 403;
   - the expected page marker is absent and the sign-in UI is present.
4. On `AUTH_REQUIRED`, try the next viable authentication path above while preserving the target URL, scenario, and `returnUrl`.
5. If user handoff is required, ask them to sign in in the same browser and tell you when it is ready. After they respond, re-check the final URL and page marker, then resume the same scenario from `AUTH_CHECK`.

Never read or copy cookies, storage tokens, saved passwords, or credential values into model-visible context. Automatic env login is authorized only for the named local Cue development origin; do not reuse that authorization for preview, stage, production, or another service. Do not bypass authentication by injecting application state. Do not call an auth pause a failed regression.

If the initial browser was chosen automatically and lacks authentication, follow the browser-control skill's supported browser-selection recovery before asking the user to sign in.

## 3. Reproduce the exact state

Before capture:

- set the viewport to the Figma frame's width and height and keep browser zoom at 100%;
- navigate through the real interaction path rather than mutating DOM or application state with JavaScript;
- verify the expected URL, selected navigation state, copy, data preconditions, and open panel/modal/tab;
- wait for relevant network requests, fonts, images, transitions, skeletons, and spinners to settle;
- check console and relevant network failures, distinguishing baseline noise from failures caused by the changed flow;
- use stable role, label, test ID, or product-owned attribute selectors instead of screen coordinates when possible.

If required data cannot be created safely or the backend does not expose it, exit `BLOCKED_DATA` with the exact missing precondition. Do not substitute a visually convenient but semantically different state.

## 4. Capture valid evidence

Create an evidence directory:

```text
artifacts/<label>/visual/<scenario>/
  reference.png
  actual-01.png
  overlay-01.png
  diff-01.png
  side-by-side-01.png
  actual-final.png
  overlay-final.png
  diff-final.png
  comparison.txt
```

Capture rules:

- use a page or element screenshot from the controlled browser;
- default to the current viewport, not `fullPage`; use full-page capture only when the Figma reference is explicitly a full page;
- do not include browser chrome, DevTools, unrelated tabs, the desktop, or another monitor;
- dismiss an unrelated development overlay through its real close control and record that action; do not remove it by mutating DOM or injecting capture-only CSS;
- capture after confirming the scenario state, not immediately after navigation or click;
- name the scenario and iteration deterministically; never overwrite the reference or earlier iteration;
- inspect the saved screenshot itself before comparing it. Confirm dimensions, target route/state, absence of login UI, and absence of accidental overlays such as tooltips or focus rings unless they are the intended state.

When both images exist locally, run:

```bash
~/.codex/skills/figma-browser-verification/scripts/compare-visuals.sh \
  <reference.png> <actual.png> <output-directory> [label] [ssim-threshold]
```

The script intentionally rejects dimension mismatches. Correct the viewport or capture target instead of resizing evidence after capture.

The script also writes `ssim_score`, `ssim_threshold` (default `0.995`), and `verdict` (`PASS_SKIP_IMAGES` or `REVIEW_IMAGES`) to `comparison.txt`. Read this score before opening any image — see the gating rule in step 5.

## 5. Compare and classify differences

On the first comparison for a scenario, always inspect all five images regardless of `ssim_score` — a small missing control can leave the aggregate score high, and you do not yet know what differs. On a recheck iteration after an `IMPLEMENTATION` fix (step 6), read `ssim_score` and `verdict` from `comparison.txt` first: if `verdict=PASS_SKIP_IMAGES`, treat the targeted difference as resolved without opening the side-by-side, overlay, or diff image, then move on. If `verdict=REVIEW_IMAGES`, inspect the images as below.

Inspect the reference, actual, side-by-side, overlay, and difference image. Compare in this order:

1. page hierarchy, major regions, scroll position, and responsive layout;
2. component geometry, alignment, spacing, and sizing;
3. typography, wrapping, weight, and color;
4. icons, borders, radii, shadows, backgrounds, and state styling;
5. copy, data state, selected navigation, disabled/loading/error behavior;
6. focus, hover, keyboard, and transition behavior when relevant.

Classify every material difference as one of:

- `IMPLEMENTATION`: source code should change;
- `RUNTIME_DATA`: content differs but layout must still be assessed;
- `ENVIRONMENT`: font rendering, scrollbar, OS, or browser noise;
- `SPEC_AMBIGUITY`: Figma, Jira, and product behavior disagree;
- `CAPTURE_ERROR`: wrong viewport, node, route, state, crop, timing, or authentication.

Do not use a pixel metric as the sole pass criterion. Dynamic data and font rasterization can change pixels without representing a product defect. Conversely, a low aggregate difference can hide a material missing control.

## 6. Fix and re-check

For `IMPLEMENTATION` differences within the authorized task:

1. identify the owning source or shared component;
2. apply the smallest coherent fix using repository conventions;
3. run focused formatting, type, lint, or unit checks appropriate to the touched files;
4. reload or navigate from a clean scenario entry point;
5. repeat authentication and state checks;
6. capture a new numbered iteration and compare again.

Repeat until material implementation differences are gone. Use three fix-and-compare iterations as the default stopping condition; after that, report the unresolved delta and likely cause rather than silently thrashing. A new auth pause does not consume an iteration.

After the last source change, always produce a fresh `actual-final` comparison. Evidence captured before the final edit cannot prove the final result.

## Completion contract

Report `PASS` only when all are true:

- exact Figma node, variant, and dimensions were recorded;
- authenticated target route and intended data state were confirmed;
- valid browser screenshots were inspected and compared;
- behavior requirements were exercised, not only the static image;
- relevant console and network failures were checked;
- material differences were fixed or explicitly accepted as known variance;
- final evidence was captured after the last change.

Summarize with this compact evidence table:

| Scenario | Figma node | Route | Viewport | Result | Evidence | Remaining variance |
|---|---|---|---|---|---|---|

Use only `PASS`, `PASS_WITH_KNOWN_VARIANCE`, `BLOCKED_AUTH`, `BLOCKED_DATA`, `BLOCKED_SPEC`, or `FAIL`. Never say “looks good” without naming the compared node, state, viewport, and evidence.
