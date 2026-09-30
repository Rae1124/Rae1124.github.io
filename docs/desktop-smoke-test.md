# Windows release verification

Automated checks are run by `npm test`. Windows packaging is separate from interactive acceptance testing. Do not mark the following complete without actually exercising the packaged application.

- [ ] Native Windows CI passes and includes the installer, portable EXE and unpacked app.
- [ ] Installer installs, creates shortcuts, launches with supplied icon, and uninstalls.
- [ ] Portable EXE launches on Windows 10/11 x64.
- [ ] UI opens from bundled renderer while offline; attempted backend actions show connection error.
- [ ] Student registration, login, two-file application submission, history, notifications, logout.
- [ ] Registrar CAPTCHA, login, signed document view, verify/invalid, remarks and review transitions.
- [ ] ID Office CAPTCHA, login, Processing → Ready for Issuance → Issued.
- [ ] Administrator CAPTCHA, login, staff creation, password reset, activation, logs.
- [ ] Session remember/logout behavior and expired CAPTCHA recovery.
- [ ] Unexpected navigation/popups stay blocked.

Prerequisite: publish root `desktop-captcha.html` at https://rae1124.github.io/desktop-captcha.html. This page uses the existing Turnstile public site key. Keep the secret only in the existing server-side staff-login function. No new database is required.

This development environment is Linux; native interactive Windows validation is pending unless a later result is recorded here.
