# Client refactor notes

## Behavior changes

The following changes are visible to users or affect delivery:

1. Titles, headers, login copy, Windows application labels, shortcuts, and output
   filenames use **Student ID Replacement System**. The installer is
   `Student-ID-Replacement-System-Setup.exe`; the portable application is
   `Student-ID-Replacement-System-Portable.exe`. The application ID, session key,
   desktop partition, and existing user-data folder are retained.
2. The login description lists the implemented registration, request submission,
   staff processing, and status tracking features. It no longer claims that all
   accounts are school-managed or promises processing speed.
3. The graduation emoji becomes an `ID` mark; navigation glyphs become inline SVG;
   back navigation and document verification labels use plain text.
4. Interface text uses at least 14px, including labels, table content, metadata,
   notices, and mobile text. Headings and numeric statistics retain larger sizes.
   Wide tables scroll horizontally at all window sizes rather than clipping on
   desktop. These typography changes can increase wrapping and page height.
5. Empty request rows span six columns for students/administrators and seven for
   processing staff, matching the actual headers.
6. A delayed view response updates only the view that requested it. It cannot
   replace a newer view after navigation or logout. Document dialog handlers also
   keep explicit references to their own dialog rather than global element IDs.
7. Badges, subtitles, navigation icons, and table styling are present immediately
   when a view renders, without a subsequent enhancement pass.
8. Both entries load shared browser ES modules and one stylesheet. The web script
   URL no longer contains `?v=`. Browser/CDN cache policies now govern freshness
   without that manual suffix. Web development requires an HTTP server; Electron
   still loads its bundled local entry. The package version remains normal build
   metadata and is not displayed as interface copy.
9. Form controls now have descriptive IDs and explicit names/labels. Automated
   integrations that targeted old IDs such as `f`, `af`, or `pw` need updated
   selectors. Field order, required fields, selection options, submission values,
   endpoints, HTTP methods, and response handling are otherwise preserved.

The account roles, registration availability, 5 MB upload limits, allowed file
formats, application states, password recovery message, remember-me behavior,
CAPTCHA requirement, signed URL validation, and CSP policies are retained.
There are no backend or database changes in this refactor.

## Existing platform differences retained

- On the web, a Registrar sees **Request Docs** for an application Under Review.
  The desktop additionally shows **Approve** and **Reject** at that stage. Both
  show approval/rejection after Documents Required. Aligning these choices is a
  separate workflow change.
- Cancelling or leaving a web status-remark prompt empty currently submits the
  selected status as the remarks. Cancelling the desktop dialog aborts the
  operation. This difference is covered by regression tests, not silently changed.
- Desktop transport failures preserve remembered sessions at startup and display
  view errors. The web retains its previous startup/error behavior.
- Web prompts and document previews remain native browser interactions. Desktop
  prompts remain in-app dialogs, previews use the restricted main-process bridge,
  and staff verification uses the separate verification window.

## Server enforcement requirements

Client visibility, HTML validation, disabled buttons, JavaScript checks, CSP,
CORS, and Electron bridge validation are not authorization. Direct HTTP callers
can bypass every client rule. The table describes the checked-in function source;
external gateway settings and database constraints were not re-audited for this
refactor.

| Client hint or operation                   | Endpoint / server location                                                            | Required enforcement and current source behavior                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unified login and role dashboard           | `id-system-api /auth/login`                                                           | Verify the password, active account, and stored role. Reject mismatched legacy portal claims. Student sessions are issued directly; staff receive only a CAPTCHA challenge. Implemented.                                                                                                                                                              |
| Staff CAPTCHA and disabled Login button    | `id-system-staff-login`                                                               | Verify the token with the server secret, expected hostname and `staff_login` action; reject failed/expired/reused tokens through Siteverify. Recheck password, active account, and staff role before inserting a session. Implemented; the client timer is only presentation.                                                                         |
| Remember me, startup profile, and logout   | Session helpers, `/auth/me`, `/auth/logout`                                           | Hash opaque tokens; validate expiry, revocation, active account and authorization on every protected request. Enforce server session duration (8 hours or 7 days). Revoke on logout. Implemented. Local storage is not proof of identity.                                                                                                             |
| Open student registration                  | `/auth/register-student`                                                              | Force role `student`; validate required identity/program/year/section fields and password policy; enforce uniqueness in the database. Basic required checks and duplicate-error handling exist. Email is only checked for `@`; program/year allowlists, bounded field lengths, and enrollment/email ownership verification are not enforced here.     |
| Confirm Password                           | Registration/setup forms and account endpoints                                        | The repeated password is a client typo check. The server must validate and hash the actual submitted password regardless of confirmation. The source requires 8+ characters, uppercase, lowercase, and a number and uses salted PBKDF2.                                                                                                               |
| Initial Administrator link visibility      | `/auth/setup-status`, `/auth/setup-admin`                                             | Reject setup once any Administrator exists, including inactive ones. Implemented as a count followed by insert; first-admin creation is not an atomic single-use operation in the function. A trusted bootstrap authorization/atomic guard is needed if setup is exposed before provisioning.                                                         |
| Staff-only administration menu             | `/users`, `/users/staff`, `/users/:id`, `/users/:id/reset-password`, `/activity-logs` | Require a valid Administrator session for every request. Validate roles and allowed update fields; never accept arbitrary client role/profile fields. Implemented role checks and update allowlists. Target existence and some database write errors are not checked consistently.                                                                    |
| Temporary password and Activate/Deactivate | `/users/staff`, `/users/:id/reset-password`, `/users/:id` and session checks          | Enforce password policy, active state, and session revocation. Implemented. `must_change_password` is recorded but not enforced as a restricted first-login session. The API does not prevent deactivating/demoting the last Administrator.                                                                                                           |
| Affidavit and photo file pickers           | `POST /files`                                                                         | Require student role; validate kind, decoded bytes, file signature/MIME, and maximum 5,242,880 bytes per file. Restrict photos to JPEG/PNG and affidavits to PDF/JPEG/PNG. Sanitize paths and write under the authenticated owner without overwrite. Implemented. File extensions and `accept` attributes are only picker hints.                      |
| Request reason and description             | `POST /requests`                                                                      | Require student role, Lost ID or Damaged ID, and at least 10 trimmed description characters. Derive owner, application number, and initial Submitted status on the server. Implemented. Maximum description length is not explicitly bounded in the function.                                                                                         |
| Required uploaded files                    | `POST /requests` and private storage                                                  | Require both correctly typed uploads; verify the owner/path/kind; check actual storage metadata, existence, size and MIME rather than trusting returned client metadata. Implemented. Public storage/database access must remain restricted independently of the UI.                                                                                  |
| My Applications and staff request lists    | `GET /requests`                                                                       | Filter students to their own rows; restrict ID Office to Approved, Processing, Ready for Issuance, and Issued; return only fields needed by that role. Implemented. Hiding rows in a table would be insufficient.                                                                                                                                     |
| Status action buttons                      | `PUT /requests/:id/status`                                                            | Check current stored role and state for every transition. Registrar and ID Office transition checks exist. Administrator calls have no explicit status/transition allowlist in this function. The update does not compare the previously read status atomically, so concurrent transitions need a database guard/transaction.                         |
| Verify / Mark Invalid                      | `PUT id-system-documents`                                                             | Restrict reviewers to Registrar/Administrator; resolve the document and its request; check access; require a reason for invalidation. Implemented. The `verified` value is coerced to Boolean rather than strictly type-checked. Document verification is not currently a prerequisite for approval; enforce such a policy on the server if required. |
| View Documents and View button             | `GET id-system-documents`                                                             | Check request ownership/role/state, document-to-request membership and storage ownership before signing. Keep the bucket private and signed URLs short-lived (120 seconds). Implemented. Client URL validation is an additional defense, not permission to access a file.                                                                             |
| Notifications and activity logs            | `/notices`, `/activity-logs`                                                          | Filter notifications to the authenticated user; require Administrator for logs; derive actor identity and timestamps from the session/server, not submitted display text. Implemented. Logs and other related writes need consistent error handling.                                                                                                  |
| Displayed name and personal details        | `_shared/data-security.ts`, all data responses                                        | Return only authorized, needed fields and no password hashes/server secrets. Use private/no-store response headers. Explicit field lists and headers exist. Anything legitimately delivered to a browser can still be inspected by its signed-in user.                                                                                                |
| Login busy state and submit buttons        | All authentication/write endpoints                                                    | Enforce abuse limits and request-size bounds at the server/gateway. Client busy flags do not rate-limit attackers. No application-level rate limiting or pre-decode request-body cap is present in the checked-in functions; external gateway limits were not verified.                                                                               |
| Submission success messages                | Request, document, account, history, notification and log writes                      | Check every required write and use transactions for operations that must succeed together. Add idempotency where duplicate submissions must be prevented. Several existing multi-write routes do not roll back partial work or check every error; client success text cannot establish atomic success.                                                |

The server-side gaps above are recorded for a separate behavior/security change.
They were not altered while restructuring the client.
