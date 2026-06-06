# Upgrading dependencies

This actor runs on the Apify platform inside the official
`apify/actor-node-playwright-chrome` Docker image. A few upgrade rules exist to
avoid a class of bug that has bitten this repo before. Read this before bumping
Playwright or Node.

## The golden rule: Playwright npm version MUST match the base image

The base image bundles a **specific Playwright version and the exact Chromium
build it expects**, pre-installed at `/pw-browsers`. If the `playwright` version
in `package.json` differs from the version baked into the image, Playwright
looks for a browser build that isn't there and crashes on launch:

```
browserType.launch: Executable doesn't exist at /pw-browsers/chromium_headless_shell-XXXX/...
```

This is why the base image is pinned to a `{node}-{playwright}` tag (e.g.
`24-1.60.0`) instead of a rolling tag like `:24` or `:latest`. Rolling tags
silently drift to a newer Chromium and break the launch.

### How to upgrade Playwright safely

1. Pick the target Playwright version, e.g. `1.61.0`.
2. **Confirm a matching base image tag exists** on Docker Hub before changing
   anything:
   `https://hub.docker.com/v2/repositories/apify/actor-node-playwright-chrome/tags?name=<node>-<playwright>`
   - If `24-1.61.0` does **not** exist yet, do **not** upgrade. npm often ships a
     Playwright release before the Docker image is published. Wait for the image.
3. Update both, together, in the same commit:
   - `.actor/Dockerfile`: `FROM apify/actor-node-playwright-chrome:24-1.61.0`
   - `package.json`: `"playwright": "1.61.0"` (pin **exact**, no `^`)
4. Regenerate the lockfile (do not hand-edit):
   `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright@1.61.0 --save-exact --package-lock-only`
5. Rebuild on Apify and run a smoke test. Confirm the log shows
   `Launching Chromium browser...` followed by a successful navigation, not a
   fatal launch error.

## Node version policy: use Active LTS, never "Current"

- Use the newest **Active LTS** Node line that has a matching image tag.
- Do **not** run a "Current" (non-LTS) Node release in production — it can ship
  breaking changes and has shorter support.
- Even-numbered Node majors become LTS in October of their release year.

History:
- Node 18, 20 — end of life, do not use.
- **Node 24 — current Active LTS (use this).**
- Node 26 — released April 2026, "Current"; becomes LTS ~October 2026. Revisit
  then; it's a one-line image bump.

Note: for this actor, Node version perf differences are negligible. The runtime
is dominated by deliberate pacing (delays between follows), network waits, and
Chromium memory — not CPU-bound JS. Upgrade Node for **security/LTS support**,
not for speed.

### How to upgrade Node

1. Confirm a `{newNode}-{currentPlaywright}` image tag exists (same Docker Hub
   check as above).
2. Change only the `FROM` line in `.actor/Dockerfile`.
3. Rebuild and confirm the `System info` log line shows the new `nodeVersion`.

## Routine dependency / security pass

Runtime deps: `apify` (Apify SDK) and `playwright`. `eslint` is dev-only and is
never shipped in the actor.

1. Check what's outdated vs. what's locked:
   `npm view apify version` etc., compare against `package-lock.json`.
2. Bump `apify` within its current major (e.g. `^3.x`) — safe minor/patch:
   `npm install apify@^3.x --package-lock-only`
   Then verify `playwright` is still pinned at the matched version.
3. Patch transitive vulnerabilities without breaking pins:
   `npm audit fix --package-lock-only` (never `--force`).
   Re-check `npm audit` shows `0 vulnerabilities` and that `playwright` is
   unchanged.
4. **eslint**: stays on 8.x intentionally. v9/v10 require migrating to flat
   config (`eslint.config.js`) and the `--ext` flag is removed — pure churn with
   zero runtime benefit. Its vulnerable transitive deps are patched via
   `npm audit fix` within the 8.x line.

## Why fatal errors must fail the run

`src/main.js` ends with a top-level `catch` that calls `Actor.fail(...)`, **not**
`Actor.exit()`. `Actor.exit()` defaults to exit code 0, which previously caused a
browser-launch crash to be misreported as a green "Succeeded" run. Keep using
`Actor.fail()` so real failures are visible.
