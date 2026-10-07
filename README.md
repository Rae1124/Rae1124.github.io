# Online Students ID Replacement System

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

- `Online-Students-ID-Replacement-System-Setup.exe`: installer with Desktop and
  Start Menu shortcuts.
- `Online-Students-ID-Replacement-System-Portable.exe`: application that runs
  without installation.
- `win-unpacked/`: unpacked application files.

The **Build Windows Desktop** workflow also builds and checks these files in
GitHub Actions. Its Windows artifact contains both executables. The release is
unsigned and does not include automatic updates.

## Project structure

| Path                           | Purpose                                                  |
| ------------------------------ | -------------------------------------------------------- |
| Root HTML, JavaScript, and CSS | GitHub Pages website                                     |
| `renderer/`                    | Bundled Windows interface                                |
| `electron/`                    | Desktop windows, preload bridges, and request validation |
| `supabase/functions/`          | Backend API and shared security helpers                  |
| `build/`                       | Application icon artwork                                 |
| `scripts/`                     | Build preparation                                        |
| `test/`                        | Automated tests                                          |

Keep the website and desktop interfaces consistent when changing shared behavior.
The desktop uses its own dialogs and verification window.

## Configuration

Internet access is required for account operations, verification, uploads, and
application processing. Desktop staff verification uses
`https://rae1124.github.io/desktop-captcha.html`.

Keep privileged database credentials and the Turnstile secret on the server.
Never place them in client code. Uploaded affidavits accept PDF/JPG/PNG; ID photos
accept JPG/PNG. The maximum size is 5 MB per file.

See [Architecture](docs/architecture.md) for the application layers and access
controls, and [Testing](docs/testing.md) for account and release checks.
