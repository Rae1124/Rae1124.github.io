# Online Students ID Replacement System

Windows 10/11 x64 desktop client using the existing school-system Supabase backend. The navy/blue interface is bundled locally. Internet is required for login, CAPTCHA, applications, uploads, and staff operations. Website and desktop use the same backend data.

## Build on Windows

Install Node.js 22 or later, open PowerShell in this project folder, then run:

```powershell
npm ci
npm test
npm run prepare:icon
npm run build:win
```

Outputs:

- `dist/Online-Students-ID-Replacement-System-Setup.exe` — installer with desktop/Start Menu shortcuts and uninstall support.
- `dist/Online-Students-ID-Replacement-System-Portable.exe` — launches without installation.
- `dist/win-unpacked/` — unpacked desktop application.

Use `npm start` after preparing the icon to run during development. Windows builds also run under **Actions → Build Windows Desktop** on relevant source pushes. Download the **Online-Students-ID-Replacement-System-Windows** artifact from a successful run. Signing and automatic updates are outside this release's scope.

## Required staff verification page

Publish `desktop-captcha.html` at https://rae1124.github.io/desktop-captcha.html before distributing the desktop build. Staff select **Verify I’m Human**; a restricted verification window returns a short-lived token to the existing staff-login backend. Students do not complete CAPTCHA. Tokens are not saved. Existing staff login server configuration and production hostname checks must remain in place.

## Source layout

- Root `index.html`, `app.js`, `ui.css`, `ui-enhance.js`: existing website.
- `renderer/`: bundled desktop snapshot; update deliberately when website behavior changes.
- `electron/`: sandboxed windows, IPC sender validation, fixed backend endpoints and signed-document URL validation.
- `build/icon-source.png`: exact approved artwork; `npm run prepare:icon` creates a multi-size ICO.
- `test/`: Node tests, including renderer login behavior and invalid IPC/network inputs.

Desktop text-entry dialogs replace unsupported browser prompts. Existing backend permissions remain authoritative. No privileged Supabase key or Turnstile secret belongs in this repository.

See [Windows smoke-test checklist](docs/desktop-smoke-test.md) for verification still required before declaring the release fully tested.
