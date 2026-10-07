# Student email notifications

The backend sends email only when an application changes to:

- **Ready for Issuance:** tells the student that the replacement ID can be collected.
- **Documents Required:** tells the student that the Registrar requires additional documents.

Both messages include the application number, the saved staff remarks, and the
website login link. The recipient is the application's student account email,
read from the database. API callers cannot choose the recipient. Emails contain
no attachments, document links, passwords, or full student profiles.

The website and Windows application already call this backend, so neither needs
a new screen or installer to use email notifications. Other application updates
continue to produce in-app notifications only. This does not add a document
resubmission workflow; students should follow the Registrar's instructions.

## Configure the sender

Use an SMTP provider that supports **implicit TLS on port 465**. Supabase Edge
Functions block outbound ports 25 and 587. TLS certificate verification is always
enabled. Provider quotas, sender verification, and domain authentication must be
configured with the chosen provider.

In the Supabase project's **Edge Functions → Secrets**, add these values:

| Secret            | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| `SMTP_ENABLED`    | `true` to send; `false` to disable delivery            |
| `SMTP_HOST`       | Provider's SMTP hostname                               |
| `SMTP_PORT`       | `465`                                                  |
| `SMTP_USER`       | SMTP username                                          |
| `SMTP_PASSWORD`   | Provider's SMTP password or application password       |
| `SMTP_FROM_EMAIL` | Single verified sender address, without a display name |

The display name is **Student ID Replacement System**. Do not put these credentials
in `config.js`, the Electron application, GitHub, screenshots, or chat. The
`supabase/.env.example` file contains placeholders for local setup only; real
environment files are ignored by Git.

Adding SMTP to Supabase **Auth settings** alone does not configure these emails:
this project's custom backend uses the Edge Function secrets above. Until the
secrets are configured and `SMTP_ENABLED=true`, no SMTP connection is attempted.

Apply the `add_status_email_delivery` migration before deploying the updated
`id-system-api` function. Deploy its `_shared/status-email.ts` and
`_shared/data-security.ts` dependencies too. Keep `verify_jwt=false` for this
existing function because its routes validate the project's opaque sessions.
SMTP must never be exposed as an unauthenticated send-email endpoint.

## Delivery and retry

The database commits the application status, status history, and in-app/email
notification in one transaction. Repeated saves of the same status do not create
another notification. Conflicting updates return HTTP 409, so the staff member
can refresh before trying again.

Email is attempted after that transaction. SMTP failure cannot roll back a valid
application update. The status endpoint returns `email.status` alongside
`success`; current clients refresh the table as before. Delivery metadata stays
on the server and is not included in the student's notification response.

The `notifications` table records:

- `email_status`: `pending`, `sending`, `sent`, `failed`, `not_configured`,
  `not_requested`, or `skipped`.
- `email_attempts` and `email_attempted_at`: delivery attempts and their timing.
- `email_sent_at`: when the SMTP server accepted the message.
- `email_error_code`: a safe error category, without raw provider replies or credentials.

`sent` means accepted by the SMTP server, not proven inbox delivery. An invalid
address, inactive student, or an application's changed owner/status prevents
delivery. Existing notifications are not automatically mailed after deployment
or after enabling SMTP.

An Administrator can retry one stored notification through:

```http
POST /functions/v1/id-system-api/notifications/{notification-id}/retry-email
Authorization: Bearer <current-administrator-session-token>
Content-Type: application/json

{}
```

Retries are manual; no scheduler or automatic retry service is installed. Inspect
delivery records in Supabase to obtain the notification ID. The endpoint accepts
neither a new recipient nor new message content. It rechecks the current owner,
student account, and application status. It never resends a `sent` notification
or sends an unrelated status. There is a one-minute cooldown and a maximum of
five SMTP attempts per notification. Missing configuration does not use an SMTP
attempt. A `sending` claim can be retried after five minutes if execution stopped.

The endpoint may report `retry_later`, `exhausted`, `not_found`, or `unknown` in
addition to stored states. `unknown` means delivery state could not be confirmed
or recorded; check the provider before retrying. SMTP and database commits cannot
be one transaction: a crash after SMTP acceptance can leave an uncertain record.
A stable Message-ID is reused, but SMTP cannot guarantee exactly-once delivery.

## Checks

Run `npm test` and `npm run format:check`. The SMTP tests exercise the real
API/notification code with simulated database and transport boundaries; no real
student emails are sent. `test/sql/status-email.sql` checks the database function
and permissions in a transaction that rolls back its test records.

After configuring the sender, use a controlled student account and mailbox to
check both notification types, the staff remarks, and inbox/spam delivery.
Student email addresses currently come from registration and are not verified
for mailbox ownership; this feature does not change that registration policy.

References: [Supabase function limits](https://supabase.com/docs/guides/functions/limits),
[Edge Function secrets](https://supabase.com/docs/guides/functions/secrets), and
[Nodemailer SMTP](https://nodemailer.com/smtp).
