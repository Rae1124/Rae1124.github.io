# Online Students ID Replacement System

The production web client remains hosted on GitHub Pages. A Windows Electron desktop client is being developed on the `desktop-electron` branch.

## Desktop development

Prerequisites: Node.js 22+ and Windows 10/11 x64 for packaging.

- `npm test` — run desktop contract/security tests.
- `npm start` — launch the Electron desktop client after dependencies are installed.
- `npm run prepare:icon` — generate the Windows `.ico` from the approved source artwork.
- `npm run build:win` — build the NSIS installer and portable Windows executables.

The desktop app uses the existing Supabase production backend and therefore requires an internet connection for authentication, data, document operations, and staff CAPTCHA verification.
