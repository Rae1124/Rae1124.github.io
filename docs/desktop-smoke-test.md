# Windows release verification

Version: **1.1.1**

Automated tests and packaged runtime verification run together in **Build Windows Desktop**. The runtime checks use the installer and portable EXE built by that same run.

- [x] All 54 automated checks pass on the Windows runner.
- [x] Native packaging produces an installer, portable EXE and unpacked application.
- [x] Portable EXE opens the School Login screen and closes normally.
- [x] Installer completes per-user installation and creates Desktop/Start Menu shortcuts.
- [x] Installed EXE opens the School Login screen and closes normally.
- [x] Uninstall removes the executable and both shortcuts.
- [ ] Visually confirm the supplied icon on the user's Windows device.
- [ ] Confirm launch on the user's Windows 10/11 x64 PC.
- [ ] Check offline startup and connection-error handling on that device.
- [ ] Complete student registration, login, two-file submission, history, notifications and logout using test accounts.
- [ ] Complete Registrar CAPTCHA, login, document viewing and review transitions.
- [ ] Complete ID Office CAPTCHA, login and Processing → Ready for Issuance → Issued.
- [ ] Complete Administrator CAPTCHA, login, staff creation, password reset, activation and logs.
- [ ] Verify remembered sessions, logout, expired CAPTCHA recovery and blocked unexpected navigation in the packaged application.

[Successful build and packaged runtime checks](https://github.com/Rae1124/Rae1124.github.io/actions/runs/37521121931), 6 October 2026 (UTC). Windows accessibility detected the actual School Login heading. No live account records were created or modified. Unchecked items require interactive account or device verification.

The desktop verification page is published at https://rae1124.github.io/desktop-captcha.html. Keep its Turnstile secret only in the server environment. The public site key is intentionally available to the client.
