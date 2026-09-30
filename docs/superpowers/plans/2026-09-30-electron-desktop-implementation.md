# Online Students ID Replacement System Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows Electron desktop version of the existing Online Students ID Replacement System with a bundled renderer, secure staff CAPTCHA flow, existing Supabase backend integration, the approved application icon, and both installer and portable `.exe` outputs.

**Architecture:** The existing production frontend is copied into a local `renderer/` bundle. Because a `file://` renderer cannot safely rely on browser CORS behavior for the current Edge Functions, all production API calls and signed-document opening are routed through narrow Electron preload/IPC bridges to the main process, which owns the approved Supabase endpoints. Staff CAPTCHA remains hosted at `https://rae1124.github.io/desktop-captcha.html` so Cloudflare continues validating the production hostname; only the resulting short-lived token returns to the local renderer.

**Tech Stack:** Electron, Node.js, built-in `node:test`, electron-builder v26, GitHub Actions Windows runner, existing HTML/CSS/JavaScript frontend, existing Supabase Edge Functions, Cloudflare Turnstile.

**Spec:** `docs/superpowers/specs/2026-09-30-electron-desktop-design.md`

## Global Constraints

- Product name is exactly **Online Students ID Replacement System**.
- Target platform is Windows 10/11 x64.
- Main renderer must be bundled locally; it must not load the full GitHub Pages application as the main UI.
- Existing production Supabase project and Edge Function endpoints remain unchanged.
- Staff roles remain `registrar`, `idoffice`, and `admin`; Student login remains CAPTCHA-free.
- Staff CAPTCHA must be server-validated with the existing Turnstile `staff_login` action and production GitHub Pages hostname.
- No Supabase service-role key or Turnstile secret may be stored in the repository, renderer, preload, or packaged application.
- Existing private document storage and signed-view-URL behavior must remain intact.
- Use the user-provided ID-card/checkmark artwork as the Windows app icon without redesigning it.
- Produce both `Online-Students-ID-Replacement-System-Setup.exe` and `Online-Students-ID-Replacement-System-Portable.exe`.
- Automatic updates, full offline mode, code signing, macOS, and Linux installers are out of scope.

## Review Focus

- **No network / Edge Function unavailable:** the local UI stays open and presents the approved connection error instead of reporting success.
- **Unexpected renderer navigation or popup:** Electron blocks it; only approved external links are handed to the operating system browser.
- **Malicious or malformed IPC request:** main process rejects unknown service names, methods, oversized/invalid payloads, and arbitrary URLs.
- **CAPTCHA window navigates away or returns an invalid token:** authentication does not continue and the token is never persisted/logged.
- **Signed document URL is not the approved Supabase storage host/path:** desktop refuses to open it externally.

---

### Task 1: Add Desktop Project Metadata, Test Harness, and Renderer Snapshot

**Files:**
- Create: `package.json`
- Create: `test/package-config.test.js`
- Create: `test/renderer-contract.test.js`
- Create: `renderer/index.html`
- Create: `renderer/app.js`
- Create: `renderer/ui.css`
- Create: `renderer/ui-enhance.js`
- Create: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Consumes: current root `index.html`, `app.js`, `ui.css`, and `ui-enhance.js` as the production UI baseline.
- Produces: a self-contained `renderer/` frontend and npm commands `test`, `start`, `build:win`, and `prepare:icon` used by later tasks and CI.

- [ ] **Step 1: Write failing package/config tests**

Create `test/package-config.test.js` using `node:test` and `node:assert/strict`. Assert that `package.json` eventually has:
- `productName === 'Online Students ID Replacement System'`
- `main === 'electron/main.js'`
- Electron and electron-builder development dependencies
- Windows `nsis` and `portable` x64 targets
- NSIS artifact name `Online-Students-ID-Replacement-System-Setup.${ext}`
- portable artifact name `Online-Students-ID-Replacement-System-Portable.${ext}`
- icon path `build/icon.ico`

- [ ] **Step 2: Run package test and verify RED**

Run: `node --test test/package-config.test.js`
Expected: FAIL because `package.json` does not exist yet.

- [ ] **Step 3: Write failing renderer contract tests**

Create `test/renderer-contract.test.js`. Assert that `renderer/index.html`, `renderer/app.js`, `renderer/ui.css`, and `renderer/ui-enhance.js` exist; renderer title/visible branding uses `Online Students ID Replacement System`; the three production function slugs still appear; no `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, or hard-coded secret appears; and local renderer does not embed the production Turnstile script directly.

- [ ] **Step 4: Run renderer test and verify RED**

Run: `node --test test/renderer-contract.test.js`
Expected: FAIL because `renderer/` does not exist.

- [ ] **Step 5: Create the package and renderer snapshot**

Create `package.json` with Node test scripts and electron-builder v26 configuration. Copy the current production frontend into `renderer/`; change desktop-visible product copy from the old “Replacement & Issuance” title to **Online Students ID Replacement System** while preserving role workflows and redesigned UI. Remove direct Turnstile loading from the local desktop `renderer/index.html`; Task 4 supplies the hosted CAPTCHA bridge.

- [ ] **Step 6: Add repository hygiene and desktop instructions stub**

Add `node_modules/`, `dist/`, and generated `build/icon.ico` to `.gitignore`. Expand `README.md` with desktop prerequisites and commands without claiming a build exists yet.

- [ ] **Step 7: Run tests and verify GREEN**

Run: `node --test test/package-config.test.js test/renderer-contract.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json test renderer .gitignore README.md
git commit -m "build: scaffold bundled Electron desktop app"
```

---

### Task 2: Implement Restricted Desktop API and Document Bridges

**Files:**
- Create: `electron/security.js`
- Create: `electron/preload.js`
- Create: `electron/api-client.js`
- Create: `test/security.test.js`
- Create: `test/api-client.test.js`
- Modify: `renderer/app.js`

**Interfaces:**
- Consumes: production API slugs `id-system-api`, `id-system-documents`, `id-system-staff-login` and the renderer state/token model.
- Produces:
  - `isApprovedExternalUrl(url: string): boolean`
  - `isApprovedSignedDocumentUrl(url: string): boolean`
  - `normalizeApiRequest(input): { service, path, method, body, token }`
  - preload API `window.desktopApi.request(input): Promise<object>`
  - preload API `window.desktopApi.openSignedDocument(url): Promise<boolean>`

- [ ] **Step 1: Write failing security tests**

Test that random HTTPS sites, `javascript:`, `file:` destinations, and look-alike Supabase hosts are rejected; exact approved Supabase signed storage URLs are accepted only for the project host and storage signed-object path.

- [ ] **Step 2: Run security test and verify RED**

Run: `node --test test/security.test.js`
Expected: FAIL because `electron/security.js` does not exist.

- [ ] **Step 3: Implement URL and request validation**

In `electron/security.js`, centralize the fixed project hostname and allowlists. In `electron/api-client.js`, accept only service identifiers `main`, `documents`, `staff-login`, safe relative paths, methods `GET|POST|PUT`, JSON-compatible bodies, and bearer token strings. Map service identifiers internally to the three fixed HTTPS Edge Function URLs; never accept a renderer-supplied base URL.

- [ ] **Step 4: Write failing API-client tests**

Assert valid requests map to the exact current Edge Function URLs and malformed service names/paths/methods are rejected. Include the Review Focus case that arbitrary URLs cannot be smuggled through `path`.

- [ ] **Step 5: Run API-client test and verify RED, then implement minimum client**

Run: `node --test test/api-client.test.js`
Expected before implementation: FAIL.

Implement `requestProductionApi(input, fetchImpl = fetch)` so non-2xx JSON errors become normal `Error` messages and network failures become exactly:
`Unable to connect to the Online Students ID Replacement System. Please check your internet connection and try again.`

- [ ] **Step 6: Expose the narrow preload bridge and adapt renderer networking**

`electron/preload.js` exposes only `request`, `requestCaptcha` (wired in Task 4), and `openSignedDocument`. In `renderer/app.js`, replace direct `fetch()` calls with `window.desktopApi.request()` when the bridge exists; retain the existing direct-fetch functions only as a web fallback inside the renderer snapshot for testability. Replace desktop `window.open()` for document signed URLs with `openSignedDocument()`.

- [ ] **Step 7: Run Task 2 tests**

Run: `node --test test/security.test.js test/api-client.test.js test/renderer-contract.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add electron renderer/app.js test
git commit -m "feat: add restricted desktop API bridge"
```

---

### Task 3: Build the Hardened Electron Main Window

**Files:**
- Create: `electron/window-options.js`
- Create: `electron/main.js`
- Create: `test/window-security.test.js`
- Modify: `electron/security.js`

**Interfaces:**
- Consumes: Task 2 preload path, URL validators, API request handler, and signed-document validator.
- Produces:
  - `mainWindowOptions({ packaged }): BrowserWindowConstructorOptions`
  - `captchaWindowOptions(): BrowserWindowConstructorOptions`
  - packaged application boot from `renderer/index.html`
  - IPC handlers for `desktop:api-request` and `desktop:open-signed-document`

- [ ] **Step 1: Write failing BrowserWindow security tests**

Assert both window option builders set `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`; main preload is `electron/preload.js`; CAPTCHA preload is `electron/captcha-preload.js`; packaged main window disables DevTools.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/window-security.test.js`
Expected: FAIL because window-option module is missing.

- [ ] **Step 3: Implement window options and main lifecycle**

Create the main `BrowserWindow` with the approved icon and title, load only local `renderer/index.html`, set the Windows AppUserModelID before opening windows, block `will-navigate`, deny unapproved `window.open`, and send approved normal external links to `shell.openExternal`. Prevent drag-and-drop navigation. Register IPC handlers using only Task 2 validation/client functions.

- [ ] **Step 4: Add malformed IPC tests to `test/window-security.test.js`**

Test validator-facing functions with unknown service, arbitrary URL, non-string signed URL, and excessive CAPTCHA/request payload inputs. Expected behavior: reject before any external request/open occurs.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test test/window-security.test.js test/security.test.js test/api-client.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add electron test/window-security.test.js
git commit -m "feat: harden Electron desktop shell"
```

---

### Task 4: Add Hosted Turnstile CAPTCHA Window and Staff Login Bridge

**Files:**
- Create: `desktop-captcha.html`
- Create: `electron/captcha-preload.js`
- Create: `electron/captcha.js`
- Create: `test/captcha.test.js`
- Modify: `electron/main.js`
- Modify: `electron/preload.js`
- Modify: `renderer/app.js`

**Interfaces:**
- Consumes: existing public Turnstile site key, approved production page URL, existing staff-login Edge Function, Task 3 CAPTCHA BrowserWindow options.
- Produces:
  - `CAPTCHA_URL = 'https://rae1124.github.io/desktop-captcha.html'`
  - `isValidCaptchaToken(value): boolean`
  - `openCaptchaChallenge(parentWindow): Promise<string>`
  - preload method `window.desktopApi.requestCaptcha(): Promise<string>`

- [ ] **Step 1: Write failing CAPTCHA contract tests**

Assert `desktop-captcha.html` includes the existing public site key, `action:'staff_login'`, explicit Turnstile rendering, and calls only `window.captchaBridge.complete(token)`/`cancel()`. Assert no token is written to `localStorage`, `sessionStorage`, cookies, console logs, or query parameters. Assert `CAPTCHA_URL` is exact.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/captcha.test.js`
Expected: FAIL because CAPTCHA desktop files do not exist.

- [ ] **Step 3: Implement hosted page and CAPTCHA preload**

Create a minimal production-hosted verification page that always displays Turnstile and reports completion/cancellation through the dedicated preload bridge. The CAPTCHA preload exposes only `complete(token)` and `cancel()`.

- [ ] **Step 4: Implement CAPTCHA main-process coordinator**

`openCaptchaChallenge()` creates one modal child window, loads only `CAPTCHA_URL`, blocks all unexpected navigation/popups, accepts completion IPC only from that CAPTCHA window’s `webContents`, validates a non-empty bounded token, resolves once, and closes/clears references on success, cancel, or window close. Do not log the token.

- [ ] **Step 5: Adapt desktop staff login UX**

For `registrar`, `idoffice`, and `admin`, replace the local embedded Turnstile area with a visible **Verify I’m Human** action/status that calls `requestCaptcha()`, stores the token only in in-memory `S.captchaToken`, enables Login after success, and clears/requires a new challenge after any failed login. Student login continues through the normal `/auth/login` flow without CAPTCHA.

- [ ] **Step 6: Add staff-vs-student tests and verify GREEN**

Extend `test/renderer-contract.test.js` to assert Student login never calls `requestCaptcha`, staff login calls the bridge and still posts the token to `staff-login`, and the token is cleared after failure.

Run: `node --test test/captcha.test.js test/renderer-contract.test.js test/window-security.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add desktop-captcha.html electron renderer/app.js test
git commit -m "feat: add secure desktop Turnstile flow"
```

---

### Task 5: Add Approved Icon Asset and Windows Packaging

**Files:**
- Create: `build/icon-source.png` (from the user-provided image)
- Create: `scripts/prepare-icon.js`
- Create: `test/icon-build.test.js`
- Modify: `package.json`
- Create: `package-lock.json`

**Interfaces:**
- Consumes: user-provided attached PNG artwork.
- Produces: generated `build/icon.ico`; electron-builder configuration for NSIS and portable x64 packages.

- [ ] **Step 1: Add the original approved artwork unchanged as `build/icon-source.png`**

Use the exact current-conversation image bytes as the source asset. Do not regenerate or redesign the icon.

- [ ] **Step 2: Write failing icon/build tests**

Assert source PNG exists and is non-empty; `prepare:icon` writes `build/icon.ico`; package config points Windows/icon/shortcut settings at `build/icon.ico`; NSIS creates desktop and Start Menu shortcuts; package targets are exactly NSIS + portable x64.

- [ ] **Step 3: Run test and verify RED**

Run: `node --test test/icon-build.test.js`
Expected: FAIL because icon preparation is not implemented.

- [ ] **Step 4: Implement icon conversion**

Use a pinned icon-conversion dependency in `scripts/prepare-icon.js` to produce a valid multi-resolution Windows `.ico` from `icon-source.png`. Never modify the source PNG.

- [ ] **Step 5: Install locked dependencies and run icon preparation**

Run: `npm install`
Run: `npm run prepare:icon`
Expected: `build/icon.ico` exists and is non-zero size.

- [ ] **Step 6: Run packaging/config tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add build/icon-source.png scripts package.json package-lock.json test .gitignore
git commit -m "build: configure Windows desktop packaging"
```

---

### Task 6: Add Native Windows CI Build and Produce Executables

**Files:**
- Create: `.github/workflows/build-desktop.yml`
- Create: `test/workflow.test.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–5 package scripts and build configuration.
- Produces: downloadable GitHub Actions artifacts containing the exact installer and portable `.exe` files.

- [ ] **Step 1: Write failing workflow test**

Assert workflow uses `windows-latest`, Node setup, `npm ci`, `npm test`, `npm run prepare:icon`, `npm run build:win`, and uploads both exact executable filenames plus `win-unpacked` where available.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/workflow.test.js`
Expected: FAIL because workflow is missing.

- [ ] **Step 3: Implement the Windows build workflow**

Trigger with `workflow_dispatch` and relevant desktop-source pushes. Use the lockfile, fail on test/build failure, build x64 NSIS and portable targets on Windows, and upload one desktop-build artifact containing:
- `dist/Online-Students-ID-Replacement-System-Setup.exe`
- `dist/Online-Students-ID-Replacement-System-Portable.exe`
- `dist/win-unpacked/**`

- [ ] **Step 4: Update README with final desktop usage**

Document local development, rebuild commands, installer vs portable behavior, internet requirements, CAPTCHA behavior, and where to download GitHub Actions artifacts.

- [ ] **Step 5: Run the complete local static/unit suite**

Run: `npm test`
Expected: 0 failures.

- [ ] **Step 6: Commit and trigger CI**

```bash
git add .github/workflows/build-desktop.yml test/workflow.test.js README.md
git commit -m "ci: build Windows desktop executables"
```

Trigger the desktop workflow for the resulting commit.

- [ ] **Step 7: Verify native Windows workflow**

Evidence required before completion claim:
- test job passes
- electron-builder job passes
- workflow artifact contains both exact `.exe` names

If CI fails, inspect Windows logs and fix through a new red/green test where applicable before rerunning.

---

### Task 7: Packaged-App Smoke Test and Release Verification

**Files:**
- Create: `docs/desktop-smoke-test.md`
- Modify: `README.md` only if verification uncovers required operational guidance.

**Interfaces:**
- Consumes: Windows binaries from Task 6.
- Produces: recorded smoke-test checklist and final evidence that the release meets the approved acceptance criteria.

- [ ] **Step 1: Download and inspect the CI artifact**

Confirm both executables have the approved filenames and icon, and `win-unpacked` launches the bundled `renderer/index.html` rather than navigating the main window to GitHub Pages.

- [ ] **Step 2: Run installer/portable smoke checklist on Windows**

Record outcomes for:
- installer install, Start Menu/Desktop shortcut, launch, uninstall
- portable launch without installation
- Student registration/login/request upload/history/notifications/logout
- Registrar CAPTCHA/login/document review/status transitions/logout
- ID Office CAPTCHA/login/Processing→Ready→Issued/logout
- Administrator CAPTCHA/login/user management/activity logs/logout
- signed document viewing
- failed-network error copy
- unexpected navigation/popup blocked

- [ ] **Step 3: Run final automated verification from the release commit**

Run: `npm test`
Expected: 0 failures.

Check the most recent Windows workflow: all jobs `completed/success` and artifacts present.

- [ ] **Step 4: Record verification**

Create `docs/desktop-smoke-test.md` with build commit SHA, workflow run ID, artifact names, tested Windows version, and pass/fail result for each item. Do not mark untested manual items as passed.

- [ ] **Step 5: Commit verification documentation**

```bash
git add docs/desktop-smoke-test.md README.md
git commit -m "docs: record desktop release verification"
```

The implementation is complete only after the automated suite, native Windows packaging workflow, artifact inspection, and required smoke tests have fresh passing evidence.