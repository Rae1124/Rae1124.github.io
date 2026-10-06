# Online Students ID Replacement System — Electron Desktop Design

Date: 2026-09-30
Status: Approved design, pending implementation plan

## 1. Objective

Rebuild the existing Online Students ID Replacement System as a Windows desktop application using Electron while preserving the current production backend, role workflows, document handling, and staff CAPTCHA protection.

The desktop application must bundle its frontend locally rather than simply opening the GitHub Pages website. It must produce both an installer `.exe` and a portable `.exe` for Windows 10/11 x64.

Application name: **Online Students ID Replacement System**

The user-provided ID-card/checkmark image will be used as the Windows application icon for the installer, portable executable, shortcuts, taskbar/window branding, and Start Menu entry where supported.

## 2. Existing Production System

The current web application is hosted at `https://rae1124.github.io/` and uses Supabase for backend services.

Production services to preserve:

- Main API: `id-system-api`
- Document API: `id-system-documents`
- Staff login API: `id-system-staff-login`
- Supabase project: `rpaaagfgyauqeyrqollr`
- Private document storage
- Existing users, requests, sessions, notifications, audit logs, and status history

No second database will be created. The website and desktop application will use the same backend so data stays synchronized.

## 3. Supported Roles and Features

The desktop application must preserve all existing role behavior.

### Student

- Create student profile
- Login with Student ID or school email
- View student dashboard/profile
- Submit Lost ID or Damaged ID replacement requests
- Upload supporting documents and student photo
- View own applications
- Track request status
- View notifications
- Logout

### Registrar

- Staff login with CAPTCHA
- View Registrar dashboard
- Review applications
- View uploaded documents
- Verify or mark documents invalid
- Change requests to Under Review / Documents Required / Approved / Rejected as permitted
- Logout

### ID Office

- Staff login with CAPTCHA
- View ID Office dashboard
- View approved requests and uploaded documents
- Move requests through Processing → Ready for Issuance → Issued
- Logout

### Administrator

- Staff login with CAPTCHA
- View Administrator dashboard
- View all requests
- Manage staff accounts
- Reset staff passwords
- Activate/deactivate accounts
- View Activity Logs
- Review uploaded documents where currently supported
- Logout

## 4. Desktop Architecture

The application will use Electron with a bundled renderer.

Proposed structure:

```text
/
├─ electron/
│  ├─ main.js
│  ├─ preload.js
│  ├─ captcha-preload.js
│  └─ security.js
├─ renderer/
│  ├─ index.html
│  ├─ app.js
│  ├─ ui.css
│  └─ ui-enhance.js
├─ desktop-captcha.html
├─ build/
│  ├─ icon-source.png
│  └─ icon.ico
├─ scripts/
│  └─ prepare-icon.js
├─ package.json
└─ electron-builder.yml or equivalent build configuration
```

The current production frontend will be copied into `renderer/` and adapted only where desktop-specific behavior is necessary.

The renderer will load using a local file URL and will connect to the same Supabase Edge Functions over HTTPS.

## 5. Staff CAPTCHA Design

The current Turnstile widget is configured for the production GitHub Pages hostname. A bundled Electron renderer does not have that hostname, so staff CAPTCHA must remain hosted under `rae1124.github.io`.

Desktop flow:

1. Staff enters username/email and password in the bundled desktop UI.
2. Desktop app opens a small, locked-down verification BrowserWindow.
3. The verification window loads `https://rae1124.github.io/desktop-captcha.html`.
4. That page renders Cloudflare Turnstile using the existing public site key and `action: staff_login`.
5. On successful verification, the CAPTCHA page sends the token through a narrowly scoped Electron preload bridge to the main process.
6. Main process forwards only the token to the bundled renderer through IPC.
7. Renderer sends username/email, password, selected portal, remember flag, and CAPTCHA token to the existing `id-system-staff-login` Supabase Edge Function.
8. The backend remains authoritative and performs server-side Cloudflare Siteverify validation before creating a session.

The CAPTCHA token must never be written to logs or persisted to disk.

The verification window must:

- Allow only the exact approved CAPTCHA page/origin and required Cloudflare resources
- Disable Node integration
- Enable context isolation
- Use a dedicated preload that exposes only the CAPTCHA completion/cancel actions
- Close automatically after success or cancellation
- Reject unexpected navigation

## 6. Electron Security Model

The desktop shell will follow a restrictive Electron configuration.

Required settings and controls:

- `nodeIntegration: false`
- `contextIsolation: true`
- sandbox enabled where compatible with the approved preload bridge
- no arbitrary Node.js APIs exposed to renderer code
- navigation restricted to approved destinations
- prevent renderer navigation from replacing the local application UI
- external links opened in the system default browser
- block unapproved popup windows
- disable drag-and-drop navigation
- disable developer tools in packaged production builds
- no Supabase service-role key or Turnstile secret embedded in the executable
- all privileged authentication decisions remain on Supabase Edge Functions

Allowed network destinations include only those required by the application, primarily the project’s Supabase endpoints and the approved CAPTCHA page/Cloudflare challenge resources.

## 7. Session Handling

The existing opaque backend session token model remains unchanged.

The desktop renderer may continue using local/session storage for the current custom token flow, but it must not store passwords or CAPTCHA tokens.

Logout must:

- call the backend logout endpoint where possible
- clear local/session token storage
- reset local role/user state
- return to the portal selection screen

## 8. File Upload and Document Viewing

The desktop app will continue to use the existing Supabase-backed file workflow.

Student uploads:

- PDF/JPG/PNG supporting document
- JPG/PNG ID photo
- existing size/type validation remains in force
- files upload through the current backend APIs

Staff document viewing:

- storage remains private
- signed URLs remain short-lived
- documents are opened only from approved signed URLs
- no permanent public storage URL will be introduced

The desktop app will not permanently save uploaded documents locally unless a user explicitly chooses to download/save a file in a future feature.

## 9. Connectivity Behavior

The bundled interface itself can start without internet, but production functions require internet access.

Internet-dependent operations include:

- login
- staff CAPTCHA
- registration
- request submission
- file upload/viewing
- request/status changes
- notifications
- user management
- activity logs

When connectivity is unavailable, the app will display a clear error such as:

> Unable to connect to the Online Students ID Replacement System. Please check your internet connection and try again.

The UI must not report a successful action until the backend confirms success.

## 10. Windows Packaging

Packaging tool: `electron-builder`.

Target platform:

- Windows 10/11
- x64

Required outputs:

```text
dist/
├─ Online-Students-ID-Replacement-System-Setup.exe
├─ Online-Students-ID-Replacement-System-Portable.exe
└─ win-unpacked/
```

Installer target:

- NSIS installer
- Start Menu entry
- normal uninstall support
- desktop shortcut enabled by installer configuration

Portable target:

- single portable executable
- no installation required

Automatic updates are intentionally out of scope for this first desktop release. New versions will be rebuilt manually when the web/frontend behavior changes.

## 11. Branding and Icon

Product name everywhere in the desktop build:

**Online Students ID Replacement System**

The user-provided ID-card/checkmark image will be transformed into a Windows-compatible icon asset while preserving its appearance.

The icon will be used for:

- installer executable
- portable executable
- installed application
- Start Menu shortcut
- desktop shortcut
- window/taskbar icon where supported

The source image will be resized/cropped only as required to create a valid multi-size `.ico` asset; the artwork itself will not be redesigned.

## 12. UI

The current simple/elegant production redesign remains the visual baseline.

The desktop build will retain:

- navy/blue visual system
- improved sidebar and active states
- dashboard cards
- responsive tables
- status badges
- polished buttons/forms/modals
- existing Turnstile staff-login UX, adapted to the desktop verification window

The desktop app displays the system’s own branding and controls.

## 13. Build Automation

A Windows GitHub Actions workflow will be added so the final `.exe` files can be built on a native Windows runner even when development is performed elsewhere.

The workflow will:

1. Check out the repository.
2. Install Node.js.
3. Install locked project dependencies.
4. Run automated tests/static checks.
5. Prepare the `.ico` application icon from the approved source asset.
6. Run `electron-builder` for NSIS and portable x64 targets.
7. Upload the installer and portable executables as workflow artifacts.

The workflow must fail if tests or packaging fail.

## 14. Testing Strategy

Implementation will follow test-driven development for desktop-specific behavior.

Minimum automated checks:

- desktop package metadata uses the approved product name
- main BrowserWindow uses secure webPreferences
- arbitrary navigation is blocked
- allowed external links are opened outside Electron
- CAPTCHA flow opens only the approved verification page
- CAPTCHA IPC accepts only the expected message shape and does not persist the token
- desktop renderer uses the staff CAPTCHA bridge for staff roles
- Student login remains unchanged
- existing Supabase API endpoints remain unchanged
- build configuration produces both NSIS and portable targets
- production renderer contains no service-role or Turnstile secret key

Manual smoke tests on the built Windows app:

- Student login and registration
- Student request submission with two files
- Student request history/notifications
- Registrar CAPTCHA + login + document review + status changes
- ID Office CAPTCHA + login + Processing/Ready/Issued flow
- Administrator CAPTCHA + login + user management + activity logs
- logout/relogin
- installer install/uninstall
- portable executable launch
- offline/failed-network messaging

## 15. Out of Scope for First Desktop Release

- full offline database mode
- background synchronization while offline
- automatic application updates
- a second backend/database
- payment processing
- biometric authentication
- code signing certificate purchase/signing
- macOS/Linux installers

## 16. Acceptance Criteria

The desktop rebuild is accepted when:

1. The app launches as **Online Students ID Replacement System** on Windows 10/11 x64.
2. The renderer is bundled locally rather than loading the full GitHub Pages application as its main UI.
3. Existing Student, Registrar, ID Office, and Administrator workflows function against the production Supabase backend.
4. Staff login still requires server-validated Cloudflare Turnstile verification.
5. No service-role key or Turnstile secret is shipped in the desktop package.
6. Uploaded documents remain private and staff document viewing continues through temporary signed URLs.
7. The provided image is used as the Windows application icon.
8. Both installer and portable `.exe` files are produced successfully.
9. Automated desktop tests pass before packaging.
10. A final manual smoke test confirms the core role workflows on the packaged application.
