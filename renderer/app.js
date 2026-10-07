import { createAuth } from '../auth.js';
import { requestApi, requestDocuments } from '../api.js';
import { sessionState, clearToken } from '../state.js';
import { escapeHTML, isApprovedDocumentUrl, roleLabel, fileToBase64 } from '../utils.js';
const root = document.getElementById('root');
function menu() {
  if (sessionState.user.role === 'student')
    return ['Dashboard', 'Apply for ID', 'My Applications', 'Notifications'];
  if (sessionState.user.role === 'admin')
    return ['Dashboard', 'All Requests', 'Users', 'Activity Logs'];
  return ['Dashboard', 'Applications'];
}
function app() {
  root.innerHTML = `<div class="app"><div class="topbar"><div><h1>Student ID Replacement System</h1><small>${escapeHTML(sessionState.user.first_name)} ${escapeHTML(sessionState.user.last_name)} · ${roleLabel(sessionState.user.role)}</small></div><button class="outline" id="logout">Logout</button></div><div class="layout"><aside class="side">${menu()
    .map(
      (x) =>
        `<button data-v="${x}" class="${sessionState.view === x ? 'active' : ''}">${x}</button>`,
    )
    .join('')}</aside><main class="content" id="content"></main></div></div>`;
  logout.onclick = async () => {
    try {
      await requestApi('/auth/logout', { method: 'POST' });
    } catch {}
    clearToken();
    authentication.showLogin();
  };
  document.querySelectorAll('[data-v]').forEach(
    (b) =>
      (b.onclick = () => {
        sessionState.view = b.dataset.v;
        app();
      }),
  );
  renderView();
}
async function renderView() {
  const target = document.getElementById('content');
  target.innerHTML = '<div class="panel">Loading…</div>';
  try {
    if (sessionState.user.role === 'student') return await studentView();
    if (sessionState.user.role === 'admin') return await adminView();
    return await staffView();
  } catch (e) {
    if (!target.isConnected) return;
    const message = document.createElement('div');
    message.className = 'msg error';
    message.setAttribute('role', 'alert');
    message.textContent = e.message;
    target.replaceChildren(message);
  }
}
async function studentView() {
  if (sessionState.view === 'Dashboard') {
    content.innerHTML = `<h2>Student Dashboard</h2><div class="stats"><div class="stat"><span>Student ID</span><b>${escapeHTML(sessionState.user.student_id || '-')}</b></div><div class="stat"><span>Program</span><b style="font-size:13px">${escapeHTML(sessionState.user.program || '-')}</b></div><div class="stat"><span>Year</span><b>${escapeHTML(sessionState.user.year_level || '-')}</b></div><div class="stat"><span>Section</span><b>${escapeHTML(sessionState.user.section || '-')}</b></div></div><div class="panel"><h3>Profile</h3><div class="profileGrid"><div><span>Name</span><b>${escapeHTML(sessionState.user.first_name)} ${escapeHTML(sessionState.user.middle_name || '')} ${escapeHTML(sessionState.user.last_name)}</b></div><div><span>Email</span><b>${escapeHTML(sessionState.user.email)}</b></div><div><span>Contact</span><b>${escapeHTML(sessionState.user.contact_number || '-')}</b></div><div><span>Address</span><b>${escapeHTML(sessionState.user.address || '-')}</b></div></div></div>`;
    return;
  }
  if (sessionState.view === 'Apply for ID') return applicationForm();
  if (sessionState.view === 'Notifications') {
    const d = await requestApi('/notices');
    content.innerHTML = `<h2>Notifications</h2><div class="panel">${d.notices.length ? d.notices.map((n) => `<div style="padding:10px 0;border-bottom:1px solid #eee"><b>${escapeHTML(n.title)}</b><div class="muted">${escapeHTML(n.message)}</div></div>`).join('') : 'No notifications yet.'}</div>`;
    return;
  }
  return requestTable(false);
}
function applicationForm() {
  content.innerHTML = `<h2>Apply for ID Replacement</h2><div class="panel"><form class="form" id="af"><label>Reason<select id="reason"><option>Lost ID</option><option>Damaged ID</option></select></label><label>Description<textarea id="desc" required placeholder="Describe what happened (at least 10 characters)"></textarea></label><label>Affidavit of Loss (PDF/JPG/PNG, max 5MB)<input id="doc" type="file" accept=".pdf,.jpg,.jpeg,.png" required></label><label>ID Photo (JPG/PNG, max 5MB)<input id="photo" type="file" accept="image/jpeg,image/png" required></label><div id="m"></div><button class="primary">Submit Application</button></form></div>`;
  af.onsubmit = async (e) => {
    e.preventDefault();
    m.innerHTML = '';
    try {
      const df = doc.files[0],
        pf = photo.files[0];
      if (!df || !pf) throw new Error('Upload both required files.');
      const du = await requestApi('/files', {
        method: 'POST',
        body: JSON.stringify({
          filename: df.name,
          contentType: df.type,
          base64: await fileToBase64(df),
          kind: 'document',
        }),
      });
      const pu = await requestApi('/files', {
        method: 'POST',
        body: JSON.stringify({
          filename: pf.name,
          contentType: pf.type,
          base64: await fileToBase64(pf),
          kind: 'photo',
        }),
      });
      const d = await requestApi('/requests', {
        method: 'POST',
        body: JSON.stringify({
          reason: reason.value,
          description: desc.value,
          document: { ...du, kind: 'document' },
          photo: { ...pu, kind: 'photo' },
        }),
      });
      m.innerHTML = `<div class="msg success">Application ${escapeHTML(d.request.application_no)} submitted successfully.</div>`;
      af.reset();
    } catch (e) {
      m.innerHTML = `<div class="msg error">${escapeHTML(e.message)}</div>`;
    }
  };
}
async function requestTable(staff = true) {
  const d = await requestApi('/requests');
  const admin = sessionState.user.role === 'admin';
  const showStudent = staff || admin;
  content.innerHTML = `<div class="sectionHead"><h2>${showStudent ? 'Applications' : 'My Applications'}</h2></div><div class="panel" style="overflow:auto"><table class="table"><thead><tr><th>Application</th><th>Student</th><th>Reason</th><th>Status</th><th>Updated</th><th>Documents</th>${staff ? '<th>Actions</th>' : ''}</tr></thead><tbody>${d.requests.length ? d.requests.map((r) => `<tr><td><b>${escapeHTML(r.application_no)}</b></td><td>${r.users ? `${escapeHTML(r.users.first_name)} ${escapeHTML(r.users.last_name)}<br><small>${escapeHTML(r.users.student_id || '')}</small>` : 'Me'}</td><td>${escapeHTML(r.reason)}</td><td><span class="badge">${escapeHTML(r.status)}</span></td><td>${new Date(r.updated_at).toLocaleString()}</td><td><button class="outline" data-docs="${escapeHTML(r.id)}" data-app="${escapeHTML(r.application_no)}">View Documents</button></td>${staff ? `<td><div class="actions">${actionButtons(r)}</div></td>` : ''}</tr>`).join('') : `<tr><td colspan="7">No applications found.</td></tr>`}</tbody></table></div>`;
  document
    .querySelectorAll('[data-status]')
    .forEach((b) => (b.onclick = () => changeStatus(b.dataset.id, b.dataset.status)));
  document
    .querySelectorAll('[data-docs]')
    .forEach((b) => (b.onclick = () => showDocuments(b.dataset.docs, b.dataset.app)));
}
function actionButtons(r) {
  const role = sessionState.user.role;
  if (role === 'registrar') {
    if (r.status === 'Submitted')
      return `<button class="outline" data-id="${escapeHTML(r.id)}" data-status="Under Review">Under Review</button>`;
    if (['Under Review', 'Documents Required'].includes(r.status))
      return `${r.status === 'Under Review' ? `<button class="outline" data-id="${escapeHTML(r.id)}" data-status="Documents Required">Request Docs</button>` : ''}<button class="primary" data-id="${escapeHTML(r.id)}" data-status="Approved">Approve</button><button class="danger" data-id="${escapeHTML(r.id)}" data-status="Rejected">Reject</button>`;
  }
  if (role === 'idoffice') {
    if (r.status === 'Approved')
      return `<button class="primary" data-id="${escapeHTML(r.id)}" data-status="Processing">Start Processing</button>`;
    if (r.status === 'Processing')
      return `<button class="primary" data-id="${escapeHTML(r.id)}" data-status="Ready for Issuance">Mark Ready</button>`;
    if (r.status === 'Ready for Issuance')
      return `<button class="primary" data-id="${escapeHTML(r.id)}" data-status="Issued">Mark Issued</button>`;
  }
  return '';
}
async function showDocuments(requestId, appNo) {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="modal" id="docModal"><div class="modalBox"><div class="sectionHead"><div><span class="eyebrow">APPLICATION ${escapeHTML(appNo)}</span><h2>Uploaded Documents</h2></div><button class="outline" id="closeDocs">Close</button></div><div id="docBody"><div class="panel">Loading documents…</div></div></div></div>`,
  );
  closeDocs.onclick = () => docModal.remove();
  try {
    const d = await requestDocuments(
      `?request_id=${encodeURIComponent(requestId)}&metadata_only=true`,
    );
    docBody.innerHTML = d.documents.length
      ? `<div class="docList">${d.documents.map((x) => `<div class="docItem"><div class="docTop"><div><div class="docName">${x.kind === 'photo' ? 'ID Photo' : 'Affidavit of Loss'} — ${escapeHTML(x.file_name)}</div><div class="docMeta">${escapeHTML(x.content_type)} · ${(Number(x.size_bytes || 0) / 1024).toFixed(1)} KB</div><div class="docStatus">${escapeHTML(x.verified ? 'Verified' : x.invalid_reason ? 'Invalid: ' + x.invalid_reason : 'Not yet reviewed')}</div></div><div class="actions">${x.can_view || x.view_url ? `<button class="outline" data-view="${escapeHTML(x.id)}">View</button>` : '<span class="muted">Preview unavailable</span>'}${['registrar', 'admin'].includes(sessionState.user.role) ? `<button class="primary" data-verify="${escapeHTML(x.id)}">Verify</button><button class="danger" data-invalid="${escapeHTML(x.id)}">Mark Invalid</button>` : ''}</div></div></div>`).join('')}</div>`
      : '<div class="panel">No uploaded documents found.</div>';
    document.querySelectorAll('[data-view]').forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          const preview = window.desktopApi ? null : window.open('about:blank', '_blank');
          if (preview) preview.opener = null;
          try {
            const result = await requestDocuments(
              `?request_id=${encodeURIComponent(requestId)}&document_id=${encodeURIComponent(b.dataset.view)}`,
            );
            const url = result.documents?.[0]?.view_url;
            if (!isApprovedDocumentUrl(url))
              throw Error('Document preview is unavailable. Please try again.');
            if (window.desktopApi) await window.desktopApi.openSignedDocument(url);
            else if (preview) preview.location.replace(url);
            else throw Error('Allow document previews in your browser and try again.');
          } catch (e) {
            if (preview) preview.close();
            alert(e.message);
          } finally {
            if (b.isConnected) b.disabled = false;
          }
        }),
    );
    document
      .querySelectorAll('[data-verify]')
      .forEach((b) => (b.onclick = () => reviewDocument(b.dataset.verify, true, requestId, appNo)));
    document
      .querySelectorAll('[data-invalid]')
      .forEach(
        (b) => (b.onclick = () => reviewDocument(b.dataset.invalid, false, requestId, appNo)),
      );
  } catch (e) {
    docBody.innerHTML = `<div class="msg error">${escapeHTML(e.message)}</div>`;
  }
}
async function reviewDocument(id, verified, requestId, appNo) {
  let reason = '';
  if (!verified) {
    reason = (await desktopPrompt('Why is this document invalid?', '')) || '';
    if (!reason.trim()) return;
  }
  try {
    await requestDocuments('', {
      method: 'PUT',
      body: JSON.stringify({ document_id: id, verified, invalid_reason: reason }),
    });
    docModal.remove();
    showDocuments(requestId, appNo);
  } catch (e) {
    alert(e.message);
  }
}
async function changeStatus(id, status) {
  const remarks = await desktopPrompt(`Remarks for ${status}:`, status);
  if (remarks === null) return;
  try {
    await requestApi(`/requests/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, remarks }),
    });
    requestTable(true);
  } catch (e) {
    alert(e.message);
  }
}
async function staffView() {
  if (sessionState.view === 'Dashboard') {
    const d = await requestApi('/requests');
    content.innerHTML = `<h2>${roleLabel(sessionState.user.role)} Dashboard</h2><div class="stats"><div class="stat"><span>Total Requests</span><b>${d.requests.length}</b></div><div class="stat"><span>Submitted</span><b>${d.requests.filter((x) => x.status === 'Submitted').length}</b></div><div class="stat"><span>Approved</span><b>${d.requests.filter((x) => x.status === 'Approved').length}</b></div><div class="stat"><span>Issued</span><b>${d.requests.filter((x) => x.status === 'Issued').length}</b></div></div>`;
    return;
  }
  return requestTable(true);
}
async function adminView() {
  if (sessionState.view === 'Dashboard') {
    const [r, u] = await Promise.all([requestApi('/requests'), requestApi('/users')]);
    content.innerHTML = `<h2>Administrator Dashboard</h2><div class="stats"><div class="stat"><span>Users</span><b>${u.users.length}</b></div><div class="stat"><span>Requests</span><b>${r.requests.length}</b></div><div class="stat"><span>Approved</span><b>${r.requests.filter((x) => x.status === 'Approved').length}</b></div><div class="stat"><span>Issued</span><b>${r.requests.filter((x) => x.status === 'Issued').length}</b></div></div>`;
    return;
  }
  if (sessionState.view === 'All Requests') return requestTable(false);
  if (sessionState.view === 'Activity Logs') {
    const d = await requestApi('/activity-logs');
    content.innerHTML = `<h2>Activity Logs</h2><div class="panel" style="overflow:auto"><table class="table"><tr><th>Date</th><th>Role</th><th>Action</th><th>Description</th></tr>${d.logs.map((x) => `<tr><td>${new Date(x.created_at).toLocaleString()}</td><td>${escapeHTML(x.role || '-')}</td><td>${escapeHTML(x.action)}</td><td>${escapeHTML(x.description)}</td></tr>`).join('')}</table></div>`;
    return;
  }
  return usersView();
}
async function usersView() {
  const d = await requestApi('/users');
  content.innerHTML = `<div class="sectionHead"><h2>User Management</h2><button class="primary" id="add">Add Staff Account</button></div><div class="panel" style="overflow:auto"><table class="table"><tr><th>User</th><th>Role</th><th>Status</th><th>Actions</th></tr>${d.users.map((u) => `<tr><td><b>${escapeHTML(u.first_name)} ${escapeHTML(u.last_name)}</b><br><small>${escapeHTML(u.username)} · ${escapeHTML(u.email)}</small></td><td>${roleLabel(u.role)}</td><td>${u.active ? 'Active' : 'Inactive'}</td><td><div class="actions"><button class="outline" data-reset="${escapeHTML(u.id)}">Reset Password</button><button class="${u.active ? 'danger' : 'outline'}" data-toggle="${escapeHTML(u.id)}" data-active="${Boolean(u.active)}">${u.active ? 'Deactivate' : 'Activate'}</button></div></td></tr>`).join('')}</table></div>`;
  add.onclick = staffModal;
  document
    .querySelectorAll('[data-reset]')
    .forEach((b) => (b.onclick = () => resetPassword(b.dataset.reset)));
  document
    .querySelectorAll('[data-toggle]')
    .forEach((b) => (b.onclick = () => toggleUser(b.dataset.toggle, b.dataset.active === 'true')));
}
function staffModal() {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="modal" id="mod"><div class="modalBox"><h2>Add Staff Account</h2><form class="form" id="sf"><div class="formGrid"><label>First Name<input id="sfn" required></label><label>Last Name<input id="sln" required></label><label>Username<input id="sun" required></label><label>Email<input id="sem" type="email" required></label><label>Role<select id="srole"><option value="registrar">Registrar</option><option value="idoffice">ID Office</option><option value="admin">Administrator</option></select></label><label>Temporary Password<input id="spw" type="password" required></label></div><div id="sm"></div><div class="actions"><button class="outline" type="button" id="cancel">Cancel</button><button class="primary">Create Staff Account</button></div></form></div></div>`,
  );
  cancel.onclick = () => mod.remove();
  sf.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await requestApi('/users/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: sfn.value,
          lastName: sln.value,
          username: sun.value,
          email: sem.value,
          role: srole.value,
          temporaryPassword: spw.value,
        }),
      });
      mod.remove();
      usersView();
    } catch (e) {
      sm.innerHTML = `<div class="msg error">${escapeHTML(e.message)}</div>`;
    }
  };
}
async function resetPassword(id) {
  const p = await desktopPrompt('Enter a temporary password:', '', true);
  if (!p) return;
  try {
    await requestApi(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ temporaryPassword: p }),
    });
    alert('Temporary password saved.');
  } catch (e) {
    alert(e.message);
  }
}
async function toggleUser(id, active) {
  try {
    await requestApi(`/users/${id}`, { method: 'PUT', body: JSON.stringify({ active: !active }) });
    usersView();
  } catch (e) {
    alert(e.message);
  }
}
export function desktopPrompt(label, initial = '', secret = false) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modalBox" role="dialog" aria-modal="true" aria-labelledby="desktopPromptLabel"><form class="form" id="desktopPromptForm"><label id="desktopPromptLabel"></label><input id="desktopPromptInput" autocomplete="off"><div class="actions"><button class="outline" type="button" id="desktopPromptCancel">Cancel</button><button class="primary" type="submit">Continue</button></div></form></div>';
    modal.querySelector('label').textContent = label;
    const input = modal.querySelector('input');
    input.type = secret ? 'password' : 'text';
    input.value = initial;
    const finish = (value) => {
      modal.remove();
      resolve(value);
    };
    modal.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      finish(input.value);
    };
    modal.querySelector('#desktopPromptCancel').onclick = () => finish(null);
    modal.onkeydown = (e) => {
      if (e.key === 'Escape') finish(null);
    };
    document.body.append(modal);
    input.focus();
  });
}
const authentication = createAuth(app);
void authentication.start();
