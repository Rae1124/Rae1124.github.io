const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto, createHash } = require('node:crypto');

function emailBackend(options = {}) {
  const environment = {
    SMTP_ENABLED: 'true',
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '465',
    SMTP_USER: 'sender@example.test',
    SMTP_PASSWORD: 'smtp-password-must-not-leak',
    SMTP_FROM_EMAIL: 'sender@example.test',
    ...options.environment,
  };
  const student = {
    id: 'student-1',
    role: 'student',
    active: true,
    email: options.email || 'student@example.test',
    first_name: 'Student',
  };
  const staff = { id: 'staff-1', role: options.role || 'idoffice', active: true };
  const application = {
    id: 'request-1',
    student_user_id: student.id,
    application_no: 'ID-2026-001',
    status: options.status || 'Processing',
  };
  const tables = {
    users: [student, staff],
    sessions: options.anonymous
      ? []
      : [
          {
            id: 'session-1',
            user_id: staff.id,
            token_hash: createHash('sha256').update('test-session').digest('hex'),
          },
        ],
    id_requests: [application],
    notifications: [],
    application_status_history: [],
    activity_logs: [],
  };
  const sent = [],
    logs = [],
    transports = [],
    rpcCalls = [];
  let handler;
  let messageCount = 0;
  const db = {
    from(table) {
      const filters = [];
      let operation = 'select',
        payload;
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          filters.push((row) => row[key] === value);
          return query;
        },
        in(key, values) {
          filters.push((row) => values.includes(row[key]));
          return query;
        },
        is() {
          return query;
        },
        gt() {
          return query;
        },
        update(value) {
          operation = 'update';
          payload = value;
          return query;
        },
        insert(value) {
          operation = 'insert';
          payload = value;
          return query;
        },
        execute() {
          let rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
          if (operation === 'insert') {
            rows = [{ id: 'notice-' + ++messageCount, email_attempts: 0, ...payload }];
            tables[table].push(...rows);
          } else if (operation === 'update') {
            if (
              options.recordFailure &&
              table === 'notifications' &&
              payload.email_status === 'sent'
            )
              return { data: null, error: { code: 'DB_ERROR' } };
            rows.forEach((row) => Object.assign(row, payload));
          }
          return { data: rows.map((row) => ({ ...row })), error: null };
        },
        async maybeSingle() {
          const result = query.execute();
          return { ...result, data: result.data?.[0] || null };
        },
        async single() {
          return query.maybeSingle();
        },
        then(resolve, reject) {
          return Promise.resolve(query.execute()).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, parameters) {
      rpcCalls.push({ name, parameters });
      if (options.statusWriteError) return { data: null, error: { code: '40001' } };
      application.status = parameters.next_status;
      const notification = {
        id: 'notice-' + ++messageCount,
        request_id: application.id,
        user_id: student.id,
        title: `Application ${parameters.next_status}`,
        message: `${application.application_no} is now ${parameters.next_status}. ${parameters.status_remarks}`,
        email_status: ['Ready for Issuance', 'Documents Required'].includes(parameters.next_status)
          ? 'pending'
          : 'not_requested',
        email_attempts: 0,
        email_attempted_at: null,
      };
      for (const previous of tables.notifications) {
        if (
          previous.request_id === application.id &&
          ['pending', 'sending', 'failed', 'not_configured'].includes(previous.email_status)
        )
          previous.email_status = 'skipped';
      }
      tables.notifications.push(notification);
      return { data: notification.id, error: null };
    },
  };
  let source = '';
  for (const file of [
    '_shared/data-security.ts',
    '_shared/status-email.ts',
    'id-system-api/index.ts',
  ]) {
    const path = 'supabase/functions/' + file;
    if (fs.existsSync(path))
      source +=
        fs
          .readFileSync(path, 'utf8')
          .replace(/^import[\s\S]*?;\r?\n/gm, '')
          .replace(/^export /gm, '') + '\n';
  }
  vm.runInNewContext(stripTypeScriptTypes(source), {
    createClient: () => db,
    nodemailer: {
      createTransport(settings) {
        transports.push(settings);
        return {
          async sendMail(message) {
            if (options.smtpFailure)
              throw Object.assign(new Error('private SMTP response ' + environment.SMTP_PASSWORD), {
                code: 'EAUTH',
              });
            sent.push(message);
            if (options.supersedeDuringSend) tables.notifications[0].email_status = 'skipped';
            return { accepted: [student.email], rejected: [], messageId: message.messageId };
          },
          close() {},
        };
      },
    },
    Deno: {
      env: { get: (key) => environment[key] },
      serve: (callback) => {
        handler = callback;
      },
    },
    Request,
    Response,
    URL,
    TextEncoder,
    Uint8Array,
    crypto: webcrypto,
    atob,
    btoa,
    console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
  });
  return {
    sent,
    logs,
    transports,
    tables,
    rpcCalls,
    application,
    environment,
    async call(path, body = {}, method = 'PUT') {
      const response = await handler(
        new Request('https://example.test/id-system-api' + path, {
          method,
          headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      return { status: response.status, body: await response.json() };
    },
  };
}

test('ready status emails only the owning student, using TLS and the recorded remarks', async () => {
  const backend = emailBackend();
  const response = await backend.call('/requests/request-1/status', {
    status: 'Ready for Issuance',
    remarks: 'Collect your ID at the ID Office, 9 AM to 4 PM.',
    email: 'attacker@example.test',
    to: 'attacker@example.test',
  });
  assert.equal(response.status, 200);
  assert.equal(backend.sent.length, 1);
  const message = backend.sent[0];
  assert.equal(message.to.address, 'student@example.test');
  assert.match(message.subject, /ready/i);
  assert.match(message.text, /ID-2026-001/);
  assert.match(message.text, /Collect your ID at the ID Office, 9 AM to 4 PM/);
  assert.equal(message.attachments, undefined);
  assert.equal(message.cc, undefined);
  assert.equal(message.bcc, undefined);
  assert.equal(backend.transports[0].secure, true);
  assert.equal(backend.transports[0].tls.rejectUnauthorized, true);
  assert.equal(backend.tables.notifications[0].email_status, 'sent');
});

test('documents-required email includes the Registrar instructions and portal link', async () => {
  const backend = emailBackend({ role: 'registrar', status: 'Under Review' });
  await backend.call('/requests/request-1/status', {
    status: 'Documents Required',
    remarks: 'Please provide a clear affidavit of loss.',
  });
  assert.equal(backend.sent.length, 1);
  assert.match(backend.sent[0].subject, /documents/i);
  assert.match(backend.sent[0].text, /Please provide a clear affidavit of loss/);
  assert.match(backend.sent[0].text, /https:\/\/rae1124.github.io\//);
});

test('all other application statuses keep in-app notifications without email', async () => {
  for (const status of [
    'Draft',
    'Submitted',
    'Under Review',
    'Approved',
    'Rejected',
    'Processing',
    'Issued',
    'Cancelled',
  ]) {
    const backend = emailBackend({ role: 'admin', status: 'Documents Required' });
    const response = await backend.call('/requests/request-1/status', { status });
    assert.equal(response.status, 200);
    assert.equal(backend.tables.notifications.length, 1);
    assert.equal(backend.sent.length, 0, status);
  }
});

test('unauthorized or invalid transitions never queue or send an email', async () => {
  for (const options of [
    { anonymous: true },
    { role: 'student' },
    { role: 'registrar' },
    { status: 'Submitted' },
  ]) {
    const backend = emailBackend(options);
    const response = await backend.call('/requests/request-1/status', {
      status: 'Ready for Issuance',
    });
    assert.ok(response.status >= 400);
    assert.equal(backend.rpcCalls.length, 0);
    assert.equal(backend.sent.length, 0);
  }
});

test('a failed or conflicting status write cannot announce that the ID is ready', async () => {
  const backend = emailBackend({ statusWriteError: true });
  const response = await backend.call('/requests/request-1/status', {
    status: 'Ready for Issuance',
  });
  assert.equal(response.status, 409);
  assert.equal(backend.sent.length, 0);
  assert.equal(backend.application.status, 'Processing');
});

test('saving the same status again does not send a duplicate email', async () => {
  const backend = emailBackend({ role: 'admin' });
  await backend.call('/requests/request-1/status', { status: 'Ready for Issuance' });
  await backend.call('/requests/request-1/status', { status: 'Ready for Issuance' });
  assert.equal(backend.sent.length, 1);
  assert.equal(backend.tables.notifications.length, 1);
});

test('SMTP failure preserves the application update and records a safe retry status', async () => {
  const backend = emailBackend({ smtpFailure: true });
  const response = await backend.call('/requests/request-1/status', {
    status: 'Ready for Issuance',
  });
  assert.equal(response.status, 200);
  assert.equal(backend.application.status, 'Ready for Issuance');
  assert.equal(backend.tables.notifications[0].email_status, 'failed');
  assert.equal(backend.tables.notifications[0].email_error_code, 'EAUTH');
  assert.doesNotMatch(
    JSON.stringify([response, backend.logs, backend.tables.notifications]),
    /smtp-password-must-not-leak/,
  );
});

test('unconfigured SMTP records an unsent notification without trying to connect', async () => {
  const backend = emailBackend({ environment: { SMTP_ENABLED: 'false' } });
  const response = await backend.call('/requests/request-1/status', {
    status: 'Ready for Issuance',
  });
  assert.equal(response.status, 200);
  assert.equal(backend.tables.notifications[0].email_status, 'not_configured');
  assert.equal(backend.transports.length, 0);
});

test('mailbox lists and header injection in student email cannot redirect notifications', async () => {
  for (const email of [
    'student@example.test,attacker@example.test',
    'student@example.test\r\nBcc: attacker@example.test',
    'Student <student@example.test>',
  ]) {
    const backend = emailBackend({ email });
    await backend.call('/requests/request-1/status', { status: 'Ready for Issuance' });
    assert.equal(backend.sent.length, 0);
    assert.equal(backend.tables.notifications[0].email_error_code, 'INVALID_RECIPIENT');
  }
});

test('only an Administrator can retry an email and a sent message is not resent', async () => {
  for (const role of ['student', 'registrar', 'idoffice']) {
    const backend = emailBackend({ role });
    const response = await backend.call('/notifications/notice-1/retry-email', {}, 'POST');
    assert.equal(response.status, 403);
  }
  const backend = emailBackend({ role: 'admin' });
  await backend.call('/requests/request-1/status', { status: 'Ready for Issuance' });
  const response = await backend.call('/notifications/notice-1/retry-email', {}, 'POST');
  assert.equal(response.status, 200);
  assert.equal(backend.sent.length, 1);
});

test('retrying an old notification cannot send outdated application instructions', async () => {
  const backend = emailBackend({ role: 'admin', environment: { SMTP_ENABLED: 'false' } });
  await backend.call('/requests/request-1/status', { status: 'Ready for Issuance' });
  backend.application.status = 'Issued';
  const response = await backend.call('/notifications/notice-1/retry-email', {}, 'POST');
  assert.equal(response.status, 200);
  assert.equal(backend.tables.notifications[0].email_status, 'skipped');
  assert.equal(backend.sent.length, 0);
});

test('concurrent retries claim one delivery and cannot email a non-target status', async () => {
  const backend = emailBackend({ role: 'admin', environment: { SMTP_ENABLED: 'false' } });
  await backend.call('/requests/request-1/status', { status: 'Ready for Issuance' });
  backend.environment.SMTP_ENABLED = 'true';
  await Promise.all([
    backend.call('/notifications/notice-1/retry-email', {}, 'POST'),
    backend.call('/notifications/notice-1/retry-email', {}, 'POST'),
  ]);
  assert.equal(backend.sent.length, 1);
  assert.equal(backend.tables.notifications[0].email_attempts, 1);
  await backend.call('/requests/request-1/status', { status: 'Issued' });
  const secondNotice = backend.tables.notifications[1];
  await backend.call(`/notifications/${secondNotice.id}/retry-email`, {}, 'POST');
  assert.equal(backend.sent.length, 1);
});

test('failed deliveries observe cooldown and attempt limits', async () => {
  const options = { role: 'admin', smtpFailure: true };
  const backend = emailBackend(options);
  await backend.call('/requests/request-1/status', { status: 'Ready for Issuance' });
  options.smtpFailure = false;
  const waiting = await backend.call('/notifications/notice-1/retry-email', {}, 'POST');
  assert.equal(waiting.body.email.status, 'retry_later');
  assert.equal(backend.sent.length, 0);
  const notification = backend.tables.notifications[0];
  notification.email_attempted_at = '2026-01-01T00:00:00.000Z';
  await backend.call('/notifications/notice-1/retry-email', {}, 'POST');
  assert.equal(backend.sent.length, 1);
  assert.equal(notification.email_attempts, 2);
  notification.email_status = 'failed';
  notification.email_attempts = 5;
  notification.email_attempted_at = '2026-01-01T00:00:00.000Z';
  const exhausted = await backend.call('/notifications/notice-1/retry-email', {}, 'POST');
  assert.equal(exhausted.body.email.status, 'exhausted');
  assert.equal(backend.sent.length, 1);
});

test('accepted SMTP with a failed database receipt is reported as uncertain, not failed', async () => {
  const backend = emailBackend({ recordFailure: true });
  const response = await backend.call('/requests/request-1/status', {
    status: 'Ready for Issuance',
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.email.status, 'unknown');
  assert.equal(backend.sent.length, 1);
  assert.equal(backend.tables.notifications[0].email_status, 'sending');
});

test('SMTP configuration cannot downgrade TLS or use blocked submission ports', async () => {
  for (const environment of [
    { SMTP_PORT: '587' },
    { SMTP_PORT: '25' },
    { SMTP_PASSWORD: '' },
    { SMTP_FROM_EMAIL: 'a@example.test,b@example.test' },
  ]) {
    const backend = emailBackend({ environment });
    await backend.call('/requests/request-1/status', { status: 'Ready for Issuance' });
    assert.equal(backend.transports.length, 0);
    assert.equal(backend.tables.notifications[0].email_error_code, 'SMTP_CONFIGURATION');
  }
});

test('a superseded delivery claim cannot report a receipt that was not recorded', async () => {
  const backend = emailBackend({ supersedeDuringSend: true });
  const response = await backend.call('/requests/request-1/status', {
    status: 'Ready for Issuance',
  });
  assert.equal(response.body.email.status, 'unknown');
  assert.equal(backend.tables.notifications[0].email_status, 'skipped');
  assert.equal(backend.sent.length, 1);
});
