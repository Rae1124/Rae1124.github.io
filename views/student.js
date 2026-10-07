import { requestApi } from '../api.js';
import { sessionState } from '../state.js';
import { escapeHTML, fileToBase64 } from '../utils.js';
import { renderField, renderMessage, renderPageHeader, renderStats } from '../ui.js';
import { renderRequestTable } from './requests.js';

export async function renderStudentView(content) {
  if (sessionState.currentView === 'Dashboard') {
    content.innerHTML = renderDashboard(sessionState.user);
    return;
  }
  if (sessionState.currentView === 'Apply for ID') return showApplicationForm(content);
  if (sessionState.currentView === 'Notifications') {
    const { notices } = await requestApi('/notices');
    content.innerHTML = `${renderPageHeader('Notifications')}
      <div class="panel">${notices.length ? notices.map(renderNotice).join('') : 'No notifications yet.'}</div>`;
    return;
  }
  return renderRequestTable(content, false);
}

function renderDashboard(user) {
  const statistics = [
    ['Student ID', user.student_id || '-'],
    ['Program', user.program || '-', true],
    ['Year', user.year_level || '-'],
    ['Section', user.section || '-'],
  ];
  const profile = [
    ['Name', `${user.first_name ?? ''} ${user.middle_name || ''} ${user.last_name ?? ''}`],
    ['Email', user.email],
    ['Contact', user.contact_number || '-'],
    ['Address', user.address || '-'],
  ];
  return `${renderPageHeader('Student Dashboard')}${renderStats(statistics)}
    <div class="panel"><h3>Profile</h3><div class="profileGrid">
      ${profile.map(([label, value]) => `<div><span>${escapeHTML(label)}</span><b>${escapeHTML(value)}</b></div>`).join('')}
    </div></div>`;
}

function renderNotice(notice) {
  return `<div class="noticeItem"><b>${escapeHTML(notice.title)}</b>
    <div class="muted">${escapeHTML(notice.message)}</div></div>`;
}

function renderApplicationForm() {
  const fields = [
    { name: 'reason', label: 'Reason', options: ['Lost ID', 'Damaged ID'] },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      required: true,
      placeholder: 'Describe what happened (at least 10 characters)',
    },
    {
      name: 'affidavit',
      label: 'Affidavit of Loss (PDF/JPG/PNG, max 5MB)',
      type: 'file',
      accept: '.pdf,.jpg,.jpeg,.png',
      required: true,
    },
    {
      name: 'photo',
      label: 'ID Photo (JPG/PNG, max 5MB)',
      type: 'file',
      accept: 'image/jpeg,image/png',
      required: true,
    },
  ];
  return `${renderPageHeader('Apply for ID Replacement')}
    <div class="panel"><form class="form" id="applicationForm">
      ${fields.map(renderField).join('')}
      <div id="applicationMessage"></div>
      <button class="primary">Submit Application</button>
    </form></div>`;
}

async function uploadFile(file, kind) {
  return requestApi('/files', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      base64: await fileToBase64(file),
      kind,
    }),
  });
}

function showApplicationForm(content) {
  content.innerHTML = renderApplicationForm();
  const form = content.querySelector('#applicationForm');
  const message = content.querySelector('#applicationMessage');
  form.onsubmit = async (event) => {
    event.preventDefault();
    message.innerHTML = '';
    try {
      const affidavitFile = form.elements.namedItem('affidavit').files[0];
      const photoFile = form.elements.namedItem('photo').files[0];
      if (!affidavitFile || !photoFile) throw new Error('Upload both required files.');
      const documentUpload = await uploadFile(affidavitFile, 'document');
      const photoUpload = await uploadFile(photoFile, 'photo');
      const { request } = await requestApi('/requests', {
        method: 'POST',
        body: JSON.stringify({
          reason: form.elements.namedItem('reason').value,
          description: form.elements.namedItem('description').value,
          document: { ...documentUpload, kind: 'document' },
          photo: { ...photoUpload, kind: 'photo' },
        }),
      });
      message.innerHTML = renderMessage(
        `Application ${request.application_no ?? ''} submitted successfully.`,
        'success',
      );
      form.reset();
    } catch (error) {
      message.innerHTML = renderMessage(error.message);
    }
  };
}
