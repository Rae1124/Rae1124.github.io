import { requestApi } from '../api.js';
import { sessionState } from '../state.js';
import { promptForText } from '../platform.js';
import { escapeHTML, readFormValues, roleLabel } from '../utils.js';
import {
  renderFieldGrid,
  renderMessage,
  renderPageHeader,
  renderStats,
  renderTable,
} from '../ui.js';
import { renderRequestTable } from './requests.js';

export async function renderAdminView(content) {
  if (sessionState.currentView === 'Dashboard') {
    const [requestData, userData] = await Promise.all([
      requestApi('/requests'),
      requestApi('/users'),
    ]);
    content.innerHTML = `${renderPageHeader('Administrator Dashboard')}${renderStats([
      ['Users', userData.users.length],
      ['Requests', requestData.requests.length],
      ['Approved', requestData.requests.filter((request) => request.status === 'Approved').length],
      ['Issued', requestData.requests.filter((request) => request.status === 'Issued').length],
    ])}`;
    return;
  }
  if (sessionState.currentView === 'All Requests') return renderRequestTable(content, false);
  if (sessionState.currentView === 'Activity Logs') {
    const { logs } = await requestApi('/activity-logs');
    content.innerHTML =
      renderPageHeader('Activity Logs') +
      renderTable(['Date', 'Role', 'Action', 'Description'], logs.map(renderActivityRow));
    return;
  }
  return showUsers(content);
}

function renderActivityRow(entry) {
  return `<tr>
    <td>${escapeHTML(new Date(entry.created_at).toLocaleString())}</td>
    <td>${escapeHTML(entry.role || '-')}</td>
    <td>${escapeHTML(entry.action)}</td>
    <td>${escapeHTML(entry.description)}</td>
  </tr>`;
}

function renderUserRow(user) {
  return `<tr>
    <td><b>${escapeHTML(user.first_name)} ${escapeHTML(user.last_name)}</b><br>
      <small>${escapeHTML(user.username)} · ${escapeHTML(user.email)}</small></td>
    <td>${roleLabel(user.role)}</td>
    <td>${user.active ? 'Active' : 'Inactive'}</td>
    <td><div class="actions">
      <button class="outline" data-reset="${escapeHTML(user.id)}">Reset Password</button>
      <button class="${user.active ? 'danger' : 'outline'}" data-toggle="${escapeHTML(user.id)}" data-active="${Boolean(user.active)}">${user.active ? 'Deactivate' : 'Activate'}</button>
    </div></td>
  </tr>`;
}

async function showUsers(content) {
  const { users } = await requestApi('/users');
  const addButton = '<button class="primary" id="addStaffButton">Add Staff Account</button>';
  content.innerHTML =
    renderPageHeader('User Management', addButton) +
    renderTable(['User', 'Role', 'Status', 'Actions'], users.map(renderUserRow));
  content.querySelector('#addStaffButton').onclick = () => showStaffForm(content);
  content.querySelectorAll('[data-reset]').forEach((button) => {
    button.onclick = () => resetPassword(button.dataset.reset);
  });
  content.querySelectorAll('[data-toggle]').forEach((button) => {
    button.onclick = () =>
      toggleUser(content, button.dataset.toggle, button.dataset.active === 'true');
  });
}

function showStaffForm(content) {
  const fields = [
    { name: 'firstName', label: 'First Name', required: true },
    { name: 'lastName', label: 'Last Name', required: true },
    { name: 'username', label: 'Username', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    {
      name: 'role',
      label: 'Role',
      options: [
        ['registrar', 'Registrar'],
        ['idoffice', 'ID Office'],
        ['admin', 'Administrator'],
      ],
    },
    { name: 'temporaryPassword', label: 'Temporary Password', type: 'password', required: true },
  ];
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'staffModal';
  modal.innerHTML = `<div class="modalBox"><h2>Add Staff Account</h2>
    <form class="form" id="staffForm">
      ${renderFieldGrid(fields)}
      <div id="staffMessage"></div>
      <div class="actions">
        <button class="outline" type="button" id="cancelStaff">Cancel</button>
        <button class="primary">Create Staff Account</button>
      </div>
    </form>
  </div>`;
  document.body.append(modal);
  const form = modal.querySelector('#staffForm');
  const message = modal.querySelector('#staffMessage');
  modal.querySelector('#cancelStaff').onclick = () => modal.remove();
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await requestApi('/users/staff', {
        method: 'POST',
        body: JSON.stringify(
          readFormValues(
            form,
            fields.map((field) => field.name),
          ),
        ),
      });
      modal.remove();
      void showUsers(content);
    } catch (error) {
      message.innerHTML = renderMessage(error.message);
    }
  };
}

async function resetPassword(userId) {
  const password = await promptForText('Enter a temporary password:', '', true);
  if (!password) return;
  try {
    await requestApi(`/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ temporaryPassword: password }),
    });
    alert('Temporary password saved.');
  } catch (error) {
    alert(error.message);
  }
}

async function toggleUser(content, userId, active) {
  try {
    await requestApi(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ active: !active }),
    });
    void showUsers(content);
  } catch (error) {
    alert(error.message);
  }
}
