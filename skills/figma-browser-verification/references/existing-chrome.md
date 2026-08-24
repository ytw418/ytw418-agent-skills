# Existing Chrome verification

Use this mode when the user wants the real browser, the existing Chrome profile matters, or local interactive behavior must be checked under the user's actual extensions, fonts, cookies, and browser settings.

## Connection contract

1. Load and follow `chrome:control-chrome`; select the Chrome browser family explicitly.
2. Name the browser session before opening or claiming tabs.
3. Inspect only open tabs whose URL matches the target local origin. Claim the matching tab when one exists; otherwise create a new tab in the same Chrome session.
4. Do not launch a separate Chrome process, use a temporary profile, attach through an unconfigured remote-debugging port, or silently substitute Chromium.
5. Reuse the same browser and tab bindings for the verification loop. A new turn does not invalidate them.

The Chrome extension connection is the harness boundary. A repository Node script cannot reliably control an already-running ordinary Chrome profile unless Chrome was deliberately launched with a compatible debugging interface. Keep the repository Playwright runner as the isolated-browser path.

## Authentication

Navigate to the protected route first. If Chrome already has a valid Cue session, preserve it and continue without reading credentials.

If the route redirects to sign-in:

1. Preserve the intended target route and scenario.
2. For local Cue only, load `E2E_EMAIL` and `E2E_PASSWORD` from gitignored `apps/cue/.env` inside the local browser-control runtime. Do not print the env object, the parsed values, or field contents.
3. Do not add a harness-specific confirmation prompt. Proceed immediately when the active browser-control policy permits it; obtain only a confirmation that the active tool policy explicitly requires at action time.
4. Pass the in-memory variables directly to the normal email and password fields, submit through the visible login UI, then clear runtime references.
5. Confirm both the post-login route and a page-specific marker. Never infer success from a filled form or a 200 response alone.

Do not inspect Chrome cookies, saved passwords, local storage, or profile files. Do not use this authorization on preview, stage, production, or another origin.

## Browser state and evidence

- Use the browser viewport capability only when the Figma frame requires an exact breakpoint or dimension. Record the override and restore it after verification unless the user asked to keep it.
- Navigate and interact through stable roles, labels, test IDs, or product-owned attributes.
- Close unrelated overlays through their visible close controls. Do not remove product DOM or inject capture-only CSS.
- Capture with the controlled Chrome tab's screenshot API so browser chrome, the desktop, other tabs, and other monitors are excluded.
- Inspect each saved image before comparison. A successful screenshot call is not proof of the correct route, authentication, state, crop, or timing.
- Record browser family as `Chrome`, the final route, viewport, visible state marker, screenshot path, and any dismissed overlay in scenario metadata.

Save screenshot bytes directly from the browser-control runtime to the task evidence directory with owner-only permissions. Keep early failures as numbered evidence and produce a new `actual-final.png` after the last source or state change.

## When to also run isolated Chromium

Add the Playwright Chromium runner when one of these matters:

- exact repeatability across iterations;
- a fresh, disposable authentication state;
- viewport matrix or CI-like execution;
- diagnosing whether behavior depends on the user's Chrome profile or extensions;
- generating the final comparison again without touching the user's active tabs.

Classify a Chrome-only versus Chromium-only discrepancy as `ENVIRONMENT` until the responsible profile setting, extension, browser version, or application behavior is identified.
