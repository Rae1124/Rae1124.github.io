# Windows release verification

Automated checks are run by `npm test`. Windows packaging is separate from interactive acceptance testing. Do not mark the following complete without actually exercising the packaged application.

- [x] Native Windows CI passes and includes the installer, portable EXE and unpacked app.
- [x] Installer installs, creates Desktop/Start Menu shortcuts, launches the portal screen, closes and uninstalls on the Windows runner.
- [ ] Visually confirm supplied icon on the user's Windows device.
- [x] Portable EXE launches the portal screen and closes normally on the Windows runner.
- [ ] Confirm launch on the user's Windows 10/11 x64 PC.
- [ ] UI opens from bundled renderer while offline; attempted backend actions show connection error.
- [ ] Student registration, login, two-file application submission, history, notifications, logout.
- [ ] Registrar CAPTCHA, login, signed document view, verify/invalid, remarks and review transitions.
- [ ] ID Office CAPTCHA, login, Processing → Ready for Issuance → Issued.
- [ ] Administrator CAPTCHA, login, staff creation, password reset, activation, logs.
- [ ] Session remember/logout behavior and expired CAPTCHA recovery.
- [ ] Unexpected navigation/popups stay blocked.

Prerequisite: publish root `desktop-captcha.html` at https://rae1124.github.io/desktop-captcha.html. This page uses the existing Turnstile public site key. Keep the secret only in the existing server-side staff-login function. No new database is required.

Native packaging: https://github.com/Rae1124/Rae1124.github.io/actions/runs/36732468122

Packaged runtime smoke test: https://github.com/Rae1124/Rae1124.github.io/actions/runs/36809889875 — passed on 1 October 2026 using the exact previously built artifact. Windows UI Automation detected the actual portal heading, rather than merely checking for a running process. No live records were created or modified. Unchecked items still require live account/device verification.
