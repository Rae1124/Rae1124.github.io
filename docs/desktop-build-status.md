# Desktop build status — 1 October 2026

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
- Native Windows build succeeded: https://github.com/Rae1124/Rae1124.github.io/actions/runs/36732468122
- Windows runner: all 20 tests passed; icon preparation, installer build, portable build, executable existence checks and artifact upload succeeded.
- Built commit: `c3f564482cf788ec244a5fb97664f71ae8733b1f`; its tree matches the locally reviewed source.
- Artifact: https://github.com/Rae1124/Rae1124.github.io/actions/runs/36732468122/artifacts/11105975143 (401,530,060 bytes; expires 30 October 2026).
- Artifact contains `Online-Students-ID-Replacement-System-Setup.exe`, `Online-Students-ID-Replacement-System-Portable.exe` and `win-unpacked/`.
- User authorized repository writes. Source uploaded to feature/native-electron-desktop; CAPTCHA page published on main at commit `870641b924598a96b972af1a25e1bc327f71fd34`. Pages deployment succeeded; HTTP 200 and exact source match verified on 30 September.
- Local Linux installer attempt lacked Wine; the successful native Windows build supersedes that local build limitation.

## Packaged Windows runtime verification

Run: https://github.com/Rae1124/Rae1124.github.io/actions/runs/36809889875 — success on 1 October 2026. Tested the exact artifact from build 36732468122 without rebuilding or changing the executable.

- Portable launch: actual `Choose your portal` screen detected through Windows UI Automation.
- Portable closes normally.
- Silent per-user installation completes and installed executable exists.
- Desktop and Start Menu shortcuts exist.
- Installed app launch: actual portal screen detected through Windows UI Automation.
- Installed app closes normally.
- Uninstall removes the executable and both shortcuts.

Scope: Windows GitHub-hosted runner, fresh profile, no live account operations. Icon appearance, live CAPTCHA completion, student/staff workflows and Windows 10-specific compatibility were not tested by this run.

## Remaining

1. Download and extract the Windows artifact; run Setup.exe to install, or Portable.exe to run without installation.
2. Test live student/staff logins, CAPTCHA completion and role workflows on the user's Windows PC. Installation, launch and uninstall have now passed automated Windows runner checks; Windows 10 and the user's device remain untested.

## Implementation decisions

- Used behavioral tests where source-string checks would miss defects. Cost: differs from the plan's literal test outlines.
- Retained the approved file:// renderer with restrictive CSP and sender checks. Cost: a custom-protocol design remains separate work.
- Replaced unsupported browser prompt() with async in-app dialogs. Cost: small desktop-only UI addition.
- Left interactive Windows and live backend smoke tests explicitly pending. Cost: this is not a fully validated release until they pass.

No minor review findings were deferred. The production backend and existing website UI files were not modified; the desktop CAPTCHA page was added.
