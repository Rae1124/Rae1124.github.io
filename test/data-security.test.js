const { loadClient } = require('./helpers/client');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('node:crypto');
const { JSDOM } = require('jsdom');
const tick = () => new Promise((r) => setImmediate(r));

function server(name, role = 'student', options = {}) {
  const user = {
    id: 'owner-1',
    role,
    active: true,
    username: 'test',
    first_name: 'Student',
    last_name: 'Example',
    email: 'private@example.test',
    address: 'Private address',
    contact_number: 'Private phone',
    password_hash: 'private-hash',
    internal_note: 'must stay private',
  };
  const request = {
    id: 'request-1',
    student_user_id: options.owner || 'owner-1',
    application_no: 'ID-001',
    status: options.status || 'Submitted',
    reason: 'Lost ID',
    description: 'Private reason',
    updated_at: '2026-10-06',
    users: {
      first_name: 'Student',
      last_name: 'Example',
      student_id: '123',
      email: 'private@example.test',
      address: 'Private address',
    },
  };
  const queries = [],
    writes = [],
    signed = [];
  let handle;
  const db = {
    from(table) {
      const filters = [];
      let selection = '*';
      const query = { table, filters };
      queries.push(query);
      const q = {
        select(s) {
          selection = s;
          query.selection = s;
          return q;
        },
        eq(k, v) {
          filters.push([k, v]);
          return q;
        },
        in(k, v) {
          filters.push([k, v]);
          return q;
        },
        is() {
          return q;
        },
        gt() {
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        update(data) {
          writes.push({ table, data });
          return q;
        },
        insert(data) {
          writes.push({ table, data });
          return q;
        },
        async maybeSingle() {
          if (table === 'sessions')
            return { data: options.anonymous ? null : { id: 'session', user_id: 'owner-1' } };
          if (table === 'users') return { data: user };
          if (table === 'id_requests') return { data: request };
          if (table === 'documents') return { data: { id: 'doc-1', request_id: 'request-1' } };
          return { data: null };
        },
        async single() {
          return { data: request, error: null };
        },
        then(resolve) {
          let data =
            table === 'users'
              ? [user]
              : table === 'id_requests'
                ? [request]
                : table === 'documents'
                  ? [
                      {
                        id: 'doc-1',
                        storage_path: options.documentPath || 'owner-1/1-document-proof.pdf',
                        kind: 'document',
                      },
                    ]
                  : [];
          resolve({ data, error: null, count: 1 });
        },
      };
      return q;
    },
    rpc: async () => ({ data: 'ID-001' }),
    storage: {
      from: () => ({
        info: async (path) => ({
          data: { size: 100, contentType: path.endsWith('.png') ? 'image/png' : 'application/pdf' },
          error: null,
        }),
        createSignedUrl: async (path, ttl) => {
          signed.push({ path, ttl });
          return { data: { signedUrl: 'https://example.test/file?token=secret' } };
        },
      }),
    },
  };
  let source = fs
    .readFileSync('supabase/functions/' + name + '/index.ts', 'utf8')
    .replace(/^import[\s\S]*?;\r?\n/gm, '');
  const shared = 'supabase/functions/_shared/data-security.ts';
  if (fs.existsSync(shared))
    source = fs.readFileSync(shared, 'utf8').replace(/^export /gm, '') + '\n' + source;
  vm.runInNewContext(stripTypeScriptTypes(source), {
    createClient: () => db,
    Deno: { env: { get: () => 'server-secret' }, serve: (f) => (handle = f) },
    Request,
    Response,
    URL,
    URLSearchParams,
    TextEncoder,
    Uint8Array,
    crypto: webcrypto,
    atob,
    btoa,
    console,
  });
  return {
    queries,
    writes,
    signed,
    async call(path, method = 'GET', body) {
      const response = await handle(
        new Request('https://example.test/' + name + path, {
          method,
          headers: {
            ...(options.anonymous ? {} : { Authorization: 'Bearer valid-token' }),
            'Content-Type': 'application/json',
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
      return { status: response.status, headers: response.headers, data: await response.json() };
    },
  };
}
test('self profile response uses an explicit field list and cannot be cached', async () => {
  const b = server('id-system-api');
  const r = await b.call('/auth/me');
  assert.equal(r.status, 200);
  assert.equal(r.data.user.first_name, 'Student');
  assert.equal(r.data.user.internal_note, undefined);
  assert.equal(r.data.user.password_hash, undefined);
  assert.match(r.headers.get('cache-control'), /no-store/);
});
test('user administration omits addresses and personal contact fields', async () => {
  const b = server('id-system-api', 'admin');
  const r = await b.call('/users');
  assert.equal(r.status, 200);
  assert.equal(r.data.users[0].first_name, 'Student');
  assert.equal(r.data.users[0].address, undefined);
  assert.equal(r.data.users[0].contact_number, undefined);
  assert.equal(r.data.users[0].internal_note, undefined);
});
test('student cannot retrieve other users or administrative logs', async () => {
  for (const path of ['/users', '/activity-logs']) {
    const b = server('id-system-api');
    const r = await b.call(path);
    assert.equal(r.status, 403);
    assert.equal(r.data.users, undefined);
  }
});
test('anonymous requests return no profile or application records', async () => {
  for (const path of ['/auth/me', '/requests', '/users']) {
    const b = server('id-system-api', 'student', { anonymous: true });
    const r = await b.call(path);
    assert.ok(r.status >= 400);
    assert.equal(r.data.user, undefined);
    assert.equal(r.data.requests, undefined);
  }
});
test('application lists limit student ownership and ID Office processing statuses', async () => {
  const student = server('id-system-api');
  await student.call('/requests');
  assert.ok(
    student.queries
      .find((q) => q.table === 'id_requests')
      .filters.some(([key, value]) => key === 'student_user_id' && value === 'owner-1'),
  );
  const office = server('id-system-api', 'idoffice');
  const r = await office.call('/requests');
  const query = office.queries.find((q) => q.table === 'id_requests');
  const filter = query.filters.find(([key]) => key === 'status');
  assert.ok(filter, 'ID Office list must filter by processing status');
  assert.deepEqual(Array.from(filter[1]), [
    'Approved',
    'Processing',
    'Ready for Issuance',
    'Issued',
  ]);
  assert.equal(r.data.requests[0].users.email, undefined);
  assert.equal(r.data.requests[0].description, undefined);
});
test('students cannot attach a different student upload to their own application', async () => {
  const b = server('id-system-api');
  const r = await b.call('/requests', 'POST', {
    reason: 'Lost ID',
    description: 'A valid description',
    document: {
      path: 'another-user/1-document-proof.pdf',
      name: 'proof.pdf',
      kind: 'document',
      contentType: 'application/pdf',
      size: 100,
    },
    photo: {
      path: 'owner-1/2-photo-id.png',
      name: 'id.png',
      kind: 'photo',
      contentType: 'image/png',
      size: 100,
    },
  });
  assert.equal(r.status, 403);
  assert.equal(b.writes.filter((x) => x.table === 'id_requests').length, 0);
});
test('valid owned uploads retain the working application submission flow', async () => {
  const b = server('id-system-api');
  const r = await b.call('/requests', 'POST', {
    reason: 'Lost ID',
    description: 'A valid description',
    document: {
      path: 'owner-1/1-document-proof.pdf',
      name: 'proof.pdf',
      kind: 'document',
      contentType: 'application/pdf',
      size: 100,
    },
    photo: {
      path: 'owner-1/2-photo-id.png',
      name: 'id.png',
      kind: 'photo',
      contentType: 'image/png',
      size: 100,
    },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.request.application_no, 'ID-001');
  assert.equal(b.writes.filter((x) => x.table === 'documents').length, 2);
});
test('document access rejects another student and unapproved ID Office requests', async () => {
  for (const [role, options] of [
    ['student', { owner: 'another-user' }],
    ['idoffice', { status: 'Submitted' }],
  ]) {
    const b = server('id-system-documents', role, options);
    const r = await b.call('?request_id=request-1');
    assert.equal(r.status, 403);
    assert.equal(b.signed.length, 0);
  }
});
test('authorized document viewing uses short-lived links and no cache', async () => {
  const b = server('id-system-documents', 'registrar');
  const r = await b.call('?request_id=request-1');
  assert.equal(r.status, 200);
  assert.ok(b.signed[0].ttl <= 120);
  assert.match(r.headers.get('cache-control'), /no-store/);
});
test('document listings do not pre-create signed links for the updated clients', async () => {
  const b = server('id-system-documents', 'registrar');
  const r = await b.call('?request_id=request-1&metadata_only=true');
  assert.equal(r.status, 200);
  assert.equal(b.signed.length, 0);
  assert.equal(r.data.documents[0].view_url, undefined);
});
test('an existing document row cannot expose a file from another student folder', async () => {
  const b = server('id-system-documents', 'student', {
    documentPath: 'other-student/1-document-proof.pdf',
  });
  const r = await b.call('?request_id=request-1');
  assert.equal(r.status, 200);
  assert.equal(b.signed.length, 0);
  assert.equal(r.data.documents[0].view_url, null);
});

for (const file of ['app.js', 'renderer/index.html'])
  test(file + ': account text and notification content cannot inject HTML', async (t) => {
    const attack = '<img src=x onerror="alert(1)"><script>evil()</script>';
    const dom = new JSDOM('<div id="root"></div>', {
      url: 'https://rae1124.github.io',
      runScripts: 'outside-only',
    });
    t.after(() => dom.window.close());
    const w = dom.window;
    w.localStorage.setItem('idrs_token', 'session');
    const result = (path) =>
      path === '/auth/me'
        ? { user: { role: 'student', first_name: attack, last_name: 'Example', address: attack } }
        : path === '/notices'
          ? { notices: [{ title: attack, message: attack }] }
          : {};
    if (file.startsWith('renderer/')) w.desktopApi = { request: async (q) => result(q.path) };
    else
      w.fetch = async (url) => ({
        ok: true,
        json: async () => result(url.split('/id-system-api')[1]),
      });
    await loadClient(dom, file);
    await tick();
    assert.equal(w.document.querySelectorAll('img,script').length, 0);
    assert.ok(w.document.body.textContent.includes(attack));
    w.document.querySelector('[data-view="Notifications"]').click();
    await tick();
    assert.equal(w.document.querySelectorAll('img,script').length, 0);
    assert.ok(w.document.getElementById('content').textContent.includes(attack));
  });
