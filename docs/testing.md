# Testing

Run `npm test` for the automated tests and `npm run format:check` for formatting.
Tests cover login routing, staff verification, role permissions, file ownership,
response field limits, text escaping, Electron window isolation, and IPC validation.

The **Build Windows Desktop** workflow runs the tests, builds the installer and
portable application, and checks both on Windows. It verifies the School Login
screen, normal application closure, installation, shortcuts, and uninstall cleanup.

## Account workflows

Use dedicated test accounts and sample files for these checks:

1. Register a student, sign in, submit an application with an affidavit and photo,
   check its history, and sign out.
2. Sign in as Registrar, complete verification, open the submitted files, and
   approve or reject an application with remarks.
3. Sign in as ID Office, complete verification, and move an approved application
   through Processing, Ready for Issuance, and Issued.
4. Sign in as Administrator, complete verification, and check staff creation,
   activation, password reset, and activity logs.
5. Confirm that a student cannot access another student's records, and that staff
   cannot perform actions outside their assigned role.
6. Check remembered sessions, logout, expired verification, interrupted network
   requests, oversized files, and unsupported file types.

Check the installer and icon on the intended Windows 10 or Windows 11 device.
Automated runner checks do not replace testing on the user's computer or live
account verification.
