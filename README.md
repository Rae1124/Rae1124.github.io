# Student ID Replacement System

A school ID replacement service for students, the Registrar, the ID Office, and
Administrators. The website and Windows application use the same accounts and
application records.

[Open the website](https://rae1124.github.io/)

## Features

- One login screen with access determined by the account role.
- Student registration, ID replacement requests, file uploads, status tracking,
  and notifications.
- Registrar review and ID Office processing through issuance.
- Staff account management and activity logs for Administrators.
- CAPTCHA verification for staff sign-in.

## Development

Use Node.js 22 or later.

```sh
npm ci
npm test
npm run format:check
npm run prepare:icon
npm start
```

Run `npm run format` to format the source files.

## Windows build

On Windows, run:

```sh
npm run prepare:icon
npm run build:win
```

The `dist/` directory contains:

- `Student-ID-Replacement-System-Setup.exe`: installer with Desktop and
  Start Menu shortcuts.
- `Student-ID-Replacement-System-Portable.exe`: application that runs
  without installation.
- `win-unpacked/`: unpacked application files.

The **Build Windows Desktop** workflow also builds and checks these files in
GitHub Actions. Its Windows artifact contains both executables. The release is
unsigned and does not include automatic updates.

## Project structure

| Path                           | Purpose                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| Root HTML, JavaScript, and CSS | Shared client modules and GitHub Pages entry               |
| `renderer/`                    | Windows HTML entry using the shared modules and stylesheet |
| `electron/`                    | Desktop windows, preload bridges, and request validation   |
| `supabase/functions/`          | Backend API and shared security helpers                    |
| `build/`                       | Application icon artwork                                   |
| `scripts/`                     | Build preparation                                          |
| `test/`                        | Automated tests                                            |

The website and desktop load the same ES modules. `app.js` handles navigation;
`api.js` selects HTTP or the desktop bridge; `auth.js` owns login and verification;
`views/` contains the role views and request/document workflows. `ui.js` renders
common fields, tables, navigation, and status badges. The desktop retains its own
dialogs and verification window through `platform.js`.

Serve the website over HTTP while developing; do not open its HTML directly from
the filesystem. For example, run `python -m http.server 3000` from the project root.
The packaged Electron application continues to load its bundled HTML locally.

## Configuration

Internet access is required for account operations, verification, uploads, and
application processing. Desktop staff verification uses
`https://rae1124.github.io/desktop-captcha.html`.

Keep privileged database credentials and the Turnstile secret on the server.
Never place them in client code. Uploaded affidavits accept PDF/JPG/PNG; ID photos
accept JPG/PNG. The maximum size is 5 MB per file.

See [Architecture](docs/architecture.md) for the application layers and access
controls, and [Testing](docs/testing.md) for account and release checks.

See [Client refactor notes](docs/client-refactor.md) for the behavior changes and
endpoint-by-endpoint server enforcement requirements.
