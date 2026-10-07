const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPage, tick } = require('./helpers/page');

const sampleRequest = {
  id: 'request-1',
  application_no: 'IDR-001',
  reason: 'Lost ID',
  status: 'Under Review',
  updated_at: '2026-10-07T00:00:00Z',
};
const sampleDocument = {
  id: 'document-1',
  kind: 'document',
  file_name: 'affidavit.pdf',
  content_type: 'application/pdf',
  size_bytes: 100,
  can_view: true,
};
const approvedUrl =
  'https://rpaaagfgyauqeyrqollr.supabase.co/storage/v1/object/sign/student-id-files/owner/file.pdf?token=signed';

for (const desktop of [false, true]) {
  const platform = desktop ? 'desktop' : 'web';

  test(`${platform}: registration and initial setup preserve their payloads`, async (context) => {
    const page = await createPage({
      desktop,
      signedIn: false,
      respond: (call) => (call.path === '/auth/setup-status' ? { adminExists: false } : undefined),
    });
    context.after(() => page.dom.window.close());
    const student = {
      studentId: '2026-001',
      firstName: 'Test',
      middleName: 'M',
      lastName: 'Student',
      email: 'student@example.test',
      contactNumber: '0123',
      address: 'Test address',
      program: 'Bachelor of Science in Information Technology',
      yearLevel: '1st Year',
      section: 'A',
      password: 'Password123',
    };
    page.document.getElementById('registerButton').click();
    for (const [name, value] of Object.entries(student))
      page.document.getElementById(name).value = value;
    page.document.getElementById('confirmPassword').value = 'different';
    await page.submit('#profileForm');
    assert.match(page.document.getElementById('formMessage').textContent, /Passwords do not match/);
    assert.equal(page.calls.filter((call) => call.path === '/auth/register-student').length, 0);
    page.document.getElementById('confirmPassword').value = student.password;
    await page.submit('#profileForm');
    assert.deepEqual(
      JSON.parse(
        JSON.stringify(page.calls.find((call) => call.path === '/auth/register-student').body),
      ),
      student,
    );
    assert.match(page.document.getElementById('formMessage').textContent, /Profile created/);
    [...page.document.querySelectorAll('#loginLinks button')]
      .find((button) => button.textContent === 'Set Up Administrator')
      .click();
    const administrator = {
      firstName: 'Initial',
      middleName: '',
      lastName: 'Admin',
      username: 'initial.admin',
      email: 'admin@example.test',
      password: 'Password123',
    };
    for (const [name, value] of Object.entries(administrator))
      page.document.getElementById(name).value = value;
    page.document.getElementById('confirmPassword').value = administrator.password;
    await page.submit('#profileForm');
    assert.deepEqual(
      JSON.parse(JSON.stringify(page.calls.find((call) => call.path === '/auth/setup-admin').body)),
      administrator,
    );
    assert.ok(page.document.getElementById('loginForm'));
  });

  test(`${platform}: application uploads remain ordered and submit the same fields`, async (context) => {
    const page = await createPage({
      desktop,
      respond: (call) => {
        if (call.path === '/files')
          return {
            path: `owner/${call.body.filename}`,
            name: call.body.filename,
            contentType: call.body.contentType,
            size: 5,
          };
        if (call.path === '/requests' && call.method === 'POST') return { request: sampleRequest };
      },
    });
    context.after(() => page.dom.window.close());
    await page.navigate('Apply for ID');
    const form = page.document.getElementById('applicationForm');
    form.elements.namedItem('reason').value = 'Damaged ID';
    form.elements.namedItem('description').value = 'The card was damaged.';
    for (const [name, filename, type, bytes] of [
      ['affidavit', 'affidavit.pdf', 'application/pdf', '%PDF-'],
      ['photo', 'photo.png', 'image/png', 'photo'],
    ]) {
      Object.defineProperty(form.elements.namedItem(name), 'files', {
        value: [new page.window.File([bytes], filename, { type })],
      });
    }
    await page.submit('#applicationForm');
    const writes = page.calls.filter((call) => call.method === 'POST');
    assert.deepEqual(
      writes.map((call) => call.path),
      ['/files', '/files', '/requests'],
    );
    assert.deepEqual(
      writes.slice(0, 2).map((call) => call.body.kind),
      ['document', 'photo'],
    );
    assert.equal(writes[0].body.base64, Buffer.from('%PDF-').toString('base64'));
    assert.equal(writes[2].body.reason, 'Damaged ID');
    assert.equal(writes[2].body.description, 'The card was damaged.');
    assert.equal(writes[2].body.document.path, 'owner/affidavit.pdf');
    assert.equal(writes[2].body.photo.path, 'owner/photo.png');
    assert.ok(writes.every((call) => call.token === 'test-session'));
    assert.match(
      page.document.getElementById('applicationMessage').textContent,
      /IDR-001 submitted successfully/,
    );
    assert.equal(form.elements.namedItem('description').value, '');
  });

  test(`${platform}: empty tables align with the columns for every role`, async (context) => {
    for (const [role, view, count] of [
      ['student', 'My Applications', 6],
      ['registrar', 'Applications', 7],
      ['idoffice', 'Applications', 7],
      ['admin', 'All Requests', 6],
    ]) {
      const page = await createPage({ desktop, role });
      context.after(() => page.dom.window.close());
      await page.navigate(view);
      assert.equal(page.document.querySelectorAll('th').length, count);
      assert.equal(page.document.querySelector('tbody td').colSpan, count);
      assert.equal(page.document.querySelectorAll('.pageSubtitle').length, 1);
      assert.ok(page.document.querySelector('.panel.tablePanel'));
    }
  });

  test(`${platform}: registrar actions and cancelled remarks keep existing semantics`, async (context) => {
    const page = await createPage({
      desktop,
      role: 'registrar',
      respond: (call) => (call.path === '/requests' ? { requests: [sampleRequest] } : undefined),
    });
    context.after(() => page.dom.window.close());
    await page.navigate('Applications');
    assert.equal(Boolean(page.document.querySelector('[data-status="Approved"]')), desktop);
    assert.equal(Boolean(page.document.querySelector('[data-status="Rejected"]')), desktop);
    assert.ok(page.document.querySelector('.badge.status-under-review'));
    const pending = page.document.querySelector('[data-status="Documents Required"]').onclick();
    if (desktop) page.document.getElementById('promptCancel').click();
    await pending;
    await tick();
    const writes = page.calls.filter((call) => call.method === 'PUT');
    assert.equal(writes.length, desktop ? 0 : 1);
    if (!desktop) assert.equal(writes[0].body.remarks, 'Documents Required');
  });

  test(`${platform}: document viewing requests a fresh approved signed URL`, async (context) => {
    let viewUrl = approvedUrl;
    const page = await createPage({
      desktop,
      respond: (call) => {
        if (call.path === '/requests') return { requests: [sampleRequest] };
        if (call.service === 'documents')
          return {
            documents: [
              {
                ...sampleDocument,
                ...(call.path.includes('document_id=') ? { view_url: viewUrl } : {}),
              },
            ],
          };
      },
    });
    context.after(() => page.dom.window.close());
    await page.navigate('My Applications');
    await page.document.querySelector('[data-docs]').onclick();
    assert.ok(page.calls.find((call) => call.path.endsWith('&metadata_only=true')));
    assert.equal(page.document.querySelector('[data-verify]'), null);
    assert.equal(page.document.querySelector('a[href]'), null);
    await page.document.querySelector('#documentBody [data-view]').onclick();
    assert.equal(desktop ? page.openedDocuments[0] : page.previews[0].url, approvedUrl);
    if (!desktop) assert.equal(page.previews[0].opener, null);
    viewUrl = 'https://unapproved.example/file.pdf';
    await page.document.querySelector('#documentBody [data-view]').onclick();
    assert.match(page.alerts.at(-1), /preview is unavailable/);
    assert.equal(
      desktop ? page.openedDocuments.length : page.previews.filter((preview) => preview.url).length,
      1,
    );
    if (!desktop) assert.equal(page.previews.at(-1).closed, true);
  });

  test(`${platform}: staff administration preserves creation, activation and reset requests`, async (context) => {
    const account = {
      id: 'staff-1',
      first_name: 'Existing',
      last_name: 'Staff',
      username: 'staff',
      email: 'staff@example.test',
      role: 'registrar',
      active: true,
    };
    const page = await createPage({
      desktop,
      role: 'admin',
      respond: (call) => (call.path === '/users' ? { users: [account] } : undefined),
    });
    context.after(() => page.dom.window.close());
    await page.navigate('Users');
    page.document.getElementById('addStaffButton').click();
    const staff = {
      firstName: 'New',
      lastName: 'Staff',
      username: 'new.staff',
      email: 'new@example.test',
      role: 'idoffice',
      temporaryPassword: 'Password123',
    };
    for (const [name, value] of Object.entries(staff))
      page.document.getElementById(name).value = value;
    await page.submit('#staffForm');
    assert.deepEqual(
      JSON.parse(JSON.stringify(page.calls.find((call) => call.path === '/users/staff').body)),
      staff,
    );
    await page.document.querySelector('[data-toggle]').onclick();
    await tick();
    assert.equal(page.calls.find((call) => call.path === '/users/staff-1').body.active, false);
    page.window.prompt = () => 'Temporary123';
    const pending = page.document.querySelector('[data-reset]').onclick();
    if (desktop) {
      page.document.getElementById('promptInput').value = 'Temporary123';
      await page.submit('#promptForm');
    }
    await pending;
    assert.equal(
      page.calls.find((call) => call.path === '/users/staff-1/reset-password').body
        .temporaryPassword,
      'Temporary123',
    );
    assert.ok(page.alerts.includes('Temporary password saved.'));
  });

  test(`${platform}: pending view responses cannot replace the newly selected page`, async (context) => {
    let resolveNotices;
    const page = await createPage({
      desktop,
      respond: (call) =>
        call.path === '/notices'
          ? new Promise((resolve) => {
              resolveNotices = resolve;
            })
          : undefined,
    });
    context.after(() => page.dom.window.close());
    await page.navigate('Notifications');
    await page.navigate('Dashboard');
    resolveNotices({ notices: [{ title: 'Old page', message: 'Delayed response' }] });
    await tick();
    assert.equal(page.document.querySelector('#content h2').textContent, 'Student Dashboard');
    assert.equal(page.document.querySelector('.noticeItem'), null);
  });
}
