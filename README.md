# Online Students ID Replacement System

This repository contains the production GitHub Pages client and the Windows Electron desktop client for the same Student ID replacement backend.

## Windows desktop application

The desktop client bundles the frontend locally inside Electron. It does **not** load the complete GitHub Pages application as its main interface. Student, Registrar, ID Office, and Administrator data still use the existing Supabase production backend, so internet access is required for authentication, requests, uploads, notifications, status changes, staff management, and document access.

Staff portals keep Cloudflare Turnstile verification. The Electron app opens the dedicated `https://rae1124.github.io/desktop-captcha.html` verification page in a locked-down child window and sends only the short-lived verification token to the existing staff-login backend.

### Development

Requirements: Node.js 22+.

```bash
npm install
npm run prepare:icon
npm test
npm start
```

The application uses the approved product name **Online Students ID Replacement System** and the supplied ID-card/checkmark artwork for Windows branding.

### Build for Windows 10/11 x64

```bash
npm install
npm run prepare:icon
npm test
npm run build:win
```

Expected build outputs:

- `dist/Online-Students-ID-Replacement-System-Setup.exe` — NSIS installer with Desktop/Start Menu shortcuts and normal uninstall support.
- `dist/Online-Students-ID-Replacement-System-Portable.exe` — portable executable that runs without installation.
- `dist/win-unpacked/` — unpacked application directory for diagnostics/smoke testing.

### GitHub Actions build

Run **Build Windows Desktop App** from the repository Actions tab, or push desktop-source changes to the `desktop-electron` branch. The workflow installs the exact dependency versions from `package.json`, prepares the `.ico`, runs the automated tests, builds both Windows targets, and uploads the `Online-Students-ID-Replacement-System-Windows` artifact.

### Security notes

- No Supabase service-role key or Turnstile secret is shipped in the desktop app.
- Desktop API traffic goes through a restricted Electron IPC bridge with fixed Supabase endpoints.
- Signed document links are opened only for the expected private Supabase storage host/path.
- Node integration is disabled, context isolation and sandboxing are enabled, arbitrary navigation/popups are blocked, and packaged DevTools are disabled.
- The app can open while offline, but online operations display a connection error until internet access returns.
