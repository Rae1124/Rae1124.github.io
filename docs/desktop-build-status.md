# Desktop release verification — version 1.1.1

Product: **Online Students ID Replacement System**
Verified source: `16df1b441ac0d9486c142367325a2a7b2fb1d129`
Published merge: `30d29a696f9162d11f0db2d5203755be8f114cc5`
Date: 6 October 2026 (UTC)

## Changes

- One School Login screen for Student, Registrar, ID Office and Administrator accounts; the server chooses the dashboard from the account role.
- Staff sessions require successful CAPTCHA verification. Students keep their existing login flow.
- Affidavit of Loss labels in the website and desktop application; existing file records remain compatible.
- Explicit response field lists, role and ownership checks, private non-cacheable responses, escaped display text, and two-minute document links requested when a document is opened.
- File ownership, size, type and content-signature validation.

## Verification evidence

[Build and Windows runtime checks](https://github.com/Rae1124/Rae1124.github.io/actions/runs/37521121931) passed for the verified source above.

- All 54 automated tests passed, including role routing, staff verification, ownership restrictions, data minimization and text escaping.
- Native Windows installer and portable EXE built successfully.
- Windows UI Automation detected the actual **School Login** heading in the portable and installed application.
- Portable and installed applications closed normally.
- Per-user installation created both Desktop and Start Menu shortcuts.
- Uninstall removed the application executable and both shortcuts. Verification waits for all cleanup paths because the uninstaller can remove files and shortcuts at different times.
- The published main branch also passed its [Windows build and runtime checks](https://github.com/Rae1124/Rae1124.github.io/actions/runs/37521540686) and [Pages deployment](https://github.com/Rae1124/Rae1124.github.io/actions/runs/37521539626).
- The live website displayed the School Login screen. Anonymous backend requests could not retrieve profiles, applications or user administration data.

The build workflow now performs packaging and runtime checks together for the artifact it just produced. The separate workflow tied to the October 1 installer has been retired.

## Release files

[Verified Windows artifact](https://github.com/Rae1124/Rae1124.github.io/actions/runs/37521121931/artifacts/11439103281)

SHA-256:

- Setup EXE: `840cf98c41ae2efbda777de86bfb6f248037a5c8820d9837cd9fce2f62da4246`
- Portable EXE: `dd7b80e1c19ab92047a286f49297fd63e58579302a20d8cbe7c4c693e5575e40`

## Remaining acceptance checks

Live student/staff account workflows, CAPTCHA completion, the supplied icon on the user's device, and Windows 10 compatibility still require interactive verification. No real student records were created or modified during these checks. The installer is unsigned and does not include automatic updates.

After dependency updates, the recorded audit has no high or critical findings. Eight moderate findings remain in the development-only `sprintf-js` dependency chain; these packages are not bundled into the installed application. Passing these checks is not a full security assessment.
