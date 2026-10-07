import { requestApi } from '../api.js';
import { sessionState } from '../state.js';
import { isDesktop, promptForText } from '../platform.js';
import { escapeHTML } from '../utils.js';
import { renderPageHeader, renderTable, renderStatusBadge } from '../ui.js';
import { showDocuments } from './documents.js';

export async function renderRequestTable(content, showActions) {
  const { requests } = await requestApi('/requests');
  const title =
    showActions || sessionState.user.role === 'admin' ? 'Applications' : 'My Applications';
  const columns = ['Application', 'Student', 'Reason', 'Status', 'Updated', 'Documents'];
  if (showActions) columns.push('Actions');
  content.innerHTML =
    renderPageHeader(title) +
    renderTable(
      columns,
      requests.map((request) => renderRequestRow(request, showActions)),
      'No applications found.',
    );
  content.querySelectorAll('[data-status]').forEach((button) => {
    button.onclick = () => changeStatus(content, button.dataset.id, button.dataset.status);
  });
  content.querySelectorAll('[data-docs]').forEach((button) => {
    button.onclick = () => showDocuments(button.dataset.docs, button.dataset.app);
  });
}

function renderRequestRow(request, showActions) {
  const student = request.users;
  const studentLabel = student
    ? `${escapeHTML(student.first_name)} ${escapeHTML(student.last_name)}<br><small>${escapeHTML(student.student_id || '')}</small>`
    : 'Me';
  return `<tr>
    <td><b>${escapeHTML(request.application_no)}</b></td>
    <td>${studentLabel}</td>
    <td>${escapeHTML(request.reason)}</td>
    <td>${renderStatusBadge(request.status)}</td>
    <td>${escapeHTML(new Date(request.updated_at).toLocaleString())}</td>
    <td><button class="outline" data-docs="${escapeHTML(request.id)}" data-app="${escapeHTML(request.application_no)}">View Documents</button></td>
    ${showActions ? `<td><div class="actions">${renderStatusActions(request)}</div></td>` : ''}
  </tr>`;
}

function getStatusActions(status, role) {
  if (role === 'registrar') {
    if (status === 'Submitted') return [['Under Review', 'Under Review', 'outline']];
    const reviewActions = [
      ['Approved', 'Approve', 'primary'],
      ['Rejected', 'Reject', 'danger'],
    ];
    if (status === 'Under Review') {
      // Retain the existing platform-specific review choices during this refactor.
      return [
        ['Documents Required', 'Request Docs', 'outline'],
        ...(isDesktop ? reviewActions : []),
      ];
    }
    if (status === 'Documents Required') return reviewActions;
  }
  if (role === 'idoffice') {
    const actions = {
      Approved: ['Processing', 'Start Processing', 'primary'],
      Processing: ['Ready for Issuance', 'Mark Ready', 'primary'],
      'Ready for Issuance': ['Issued', 'Mark Issued', 'primary'],
    };
    return Object.hasOwn(actions, status) ? [actions[status]] : [];
  }
  return [];
}

function renderStatusActions(request) {
  return getStatusActions(request.status, sessionState.user.role)
    .map(
      ([status, label, className]) =>
        `<button class="${className}" data-id="${escapeHTML(request.id)}" data-status="${escapeHTML(status)}">${label}</button>`,
    )
    .join('');
}

async function changeStatus(content, requestId, status) {
  const input = await promptForText(`Remarks for ${status}:`, status);
  if (isDesktop && input === null) return;
  // The web currently uses the status as remarks for an empty or cancelled prompt.
  const remarks = isDesktop ? input : input || status;
  try {
    await requestApi(`/requests/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, remarks }),
    });
    void renderRequestTable(content, true);
  } catch (error) {
    alert(error.message);
  }
}
