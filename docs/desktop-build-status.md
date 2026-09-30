# Desktop continuation status — 30 September 2026

Product: **Online Students ID Replacement System**
Branch: `feature/native-electron-desktop`
Original baseline: `a81378f1c8023194cf6fe11b5c220617b500d6a3`

## Implemented

- Bundled local frontend, exact approved name and original ID-card/checkmark artwork.
- Restricted production API bridge and signed document opening.
- Sandboxed Electron windows, IPC main-frame verification and navigation guards.
- Separate hosted staff CAPTCHA flow; Student login remains CAPTCHA-free.
- In-app text-entry dialogs for remarks, document invalidation and temporary passwords.
- Windows installer/portable build configuration and GitHub Actions workflow.
- Review fixes: offline views show errors; connection failures preserve remembered sessions; Registrar can approve/reject Under Review applications.

## Evidence

- `npm test`: 20 passing, 0 failing.
- `node --check`: main process, CAPTCHA coordinator and renderer passed.
- `git diff --check`: passed.
- Independent review: no Critical issue; both Important issues reproduced and fixed with failing-then-passing tests.
- `npm run build:win -- --dir`: succeeded on Linux. Output is a PE32+ Windows x64 GUI executable; app.asar includes the bundled renderer, Electron modules and approved icon.
- Full `npm run build:win`: stopped at NSIS with `spawn wine ENOENT`. No completed installer/portable release is claimed.
- GitHub push was rejected by automatic approval review because explicit permission for the external repository write is required. No remote changes were made.

## Remaining

1. Authorize pushing the desktop branch to `Rae1124/Rae1124.github.io` and publishing the root CAPTCHA page to the existing Pages site.
2. Run the native Windows GitHub Actions build; inspect both installer and portable artifacts.
3. Test install/uninstall, packaged launch, live CAPTCHA and all role workflows using the smoke-test checklist.

## Implementation decisions

- Used behavioral tests where source-string checks would miss defects. Cost: differs from the plan's literal test outlines.
- Retained the approved file:// renderer with restrictive CSP and sender checks. Cost: a custom-protocol design remains separate work.
- Replaced unsupported browser prompt() with async in-app dialogs. Cost: small desktop-only UI addition.
- Left native Windows and live backend smoke tests explicitly pending. Cost: this is not a fully validated release until they pass.

No minor review findings were deferred. The production backend and existing website files were not modified.
