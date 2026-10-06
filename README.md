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

Publish `desktop-captcha.html` at https://rae1124.github.io/desktop-captcha.html before distributing the desktop build. All roles use one **School Login** screen. After a valid staff username/email and password are entered, staff select **Verify I’m Human**, complete verification, and select **Login**; a restricted verification window returns a short-lived token to the existing staff-login backend. Students do not complete CAPTCHA. Tokens are not saved. Existing staff login server configuration and production hostname checks must remain in place.

## Source layout

- Root `index.html`, `app.js`, `ui.css`, `ui-enhance.js`: existing website.
- `renderer/`: bundled desktop snapshot; update deliberately when website behavior changes.
- `electron/`: sandboxed windows, IPC sender validation, fixed backend endpoints and signed-document URL validation.
- `build/icon-source.png`: exact approved artwork; `npm run prepare:icon` creates a multi-size ICO.
- `test/`: Node tests, including renderer login behavior and invalid IPC/network inputs.

Desktop text-entry dialogs replace unsupported browser prompts. Existing backend permissions remain authoritative. No privileged Supabase key or Turnstile secret belongs in this repository.

See [Windows smoke-test checklist](docs/desktop-smoke-test.md) for verification still required before declaring the release fully tested.

## Unified login (1.1.1)

The website and desktop app identify the account role on the server. Students sign in using their Student ID or email; staff use their username or email. The account's stored role determines the dashboard. No portal selection is required.

`id-system-api` returns `requiresCaptcha` for staff credentials without issuing a session. `id-system-staff-login` validates Turnstile before issuing staff sessions and supports older clients that still send a portal. Deploy both functions from `supabase/functions/` before publishing the updated clients. Existing opaque-session authentication and database permissions remain in effect.

The application upload and document viewer use **Affidavit of Loss**. The document payload remains `kind: document`, so existing uploaded records remain readable; PDF/JPG/PNG and the 5 MB per-file limit are retained.

## Data protection

The server determines each account's permissions. Student lists contain only their own applications, and ID Office lists and document access are restricted to the issuance stages. Personal profiles and user administration responses have separate explicit field lists. API responses are marked `no-store`.

Names, remarks, filenames, notifications and other stored text are escaped before display. Document lists load metadata; opening a document requests a new signed URL that expires after two minutes. Application submission verifies file ownership and stored metadata. Uploaded file content must match its PDF, JPEG or PNG signature.

Account details displayed on a page can be inspected by that signed-in user. Browser developer tools are not an access-control boundary; authorization and data minimization are enforced on the server. Server secrets stay in environment variables, and passwords are never included in responses.

The October 6, 2026 dependency audit reports no high or critical findings after updating `js-yaml` and `http-cache-semantics`. Eight moderate findings remain in the `sprintf-js` build-tool dependency chain. These development dependencies are not bundled in the installed application. The audit does not replace live account workflow testing or a full security assessment.
