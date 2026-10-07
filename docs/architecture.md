# Architecture

The website and Windows application share one backend. Each account has one role:
Student, Registrar, ID Office, or Administrator. The server uses that stored role
to authorize requests and choose the dashboard after login.

## Website

GitHub Pages serves `index.html`, `app.js`, `ui.css`, and `ui-enhance.js`.
The browser calls the Supabase Edge Functions over HTTPS. No privileged database
credentials are included in the client.

## Windows application

Electron loads the bundled pages from `renderer/`. The main process handles API
requests and document opening through a restricted preload bridge. It validates
the sender, endpoint, method, payload, and destination before allowing access.

The renderer runs with sandboxing and context isolation enabled. Node integration
is disabled, and unexpected navigation, popups, webviews, and permission requests
are blocked.

Staff verification opens `desktop-captcha.html` on the production website.
That window returns a short-lived Turnstile token through a separate preload
bridge. The server verifies the token before creating a staff session.

## Backend

The function sources are in `supabase/functions/`:

- `id-system-api`: accounts, sessions, applications, uploads, notifications, and
  staff administration.
- `id-system-staff-login`: password and Turnstile verification for staff.
- `id-system-documents`: authorized document access and review actions.
- `_shared/data-security.ts`: response field lists, file checks, and shared
  security helpers.

The functions use opaque application session tokens. Each protected request
checks its session and account status. User roles come from the database.

Students can access their own requests and files. The Registrar reviews
applications. The ID Office handles approved requests through issuance.
Administrators manage staff accounts and system records.

## Data and uploads

PostgreSQL stores accounts, sessions, applications, document metadata, status
history, notifications, and activity logs. The private storage bucket contains
uploaded files. Database tables are accessed through the server functions.

Each upload is limited to 5 MB. Affidavits accept PDF, JPEG, or PNG; ID photos
accept JPEG or PNG. The server checks the file signature and verifies ownership
before attaching an upload to an application.

Document lists return metadata. Opening a document requests a signed URL valid
for two minutes. Responses containing account or application data use
`Cache-Control: no-store`, and stored text is escaped before display.

Keep server credentials and the Turnstile secret in the server environment.
The project URL and Turnstile site key are public client configuration.
