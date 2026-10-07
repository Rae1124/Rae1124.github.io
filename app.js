import { createAuth } from './auth.js';
import { requestApi } from './api.js';
import { systemName } from './config.js';
import { isDesktop } from './platform.js';
import { sessionState, clearToken } from './state.js';
import { escapeHTML, roleLabel } from './utils.js';
import { renderNavigationItem } from './ui.js';
import { renderStudentView } from './views/student.js';
import { renderStaffView } from './views/staff.js';
import { renderAdminView } from './views/admin.js';

const root = document.getElementById('root');
const authentication = createAuth(renderApplication);

function getMenu(role) {
  if (role === 'student') return ['Dashboard', 'Apply for ID', 'My Applications', 'Notifications'];
  if (role === 'admin') return ['Dashboard', 'All Requests', 'Users', 'Activity Logs'];
  return ['Dashboard', 'Applications'];
}

function renderApplicationShell(user) {
  return `<div class="app">
    <div class="topbar">
      <div class="brandMark">ID</div>
      <div class="brandCopy">
        <h1>${systemName}</h1>
        <small>${escapeHTML(user.first_name)} ${escapeHTML(user.last_name)} · ${roleLabel(user.role)}</small>
      </div>
      <button class="outline" id="logout">Logout</button>
    </div>
    <div class="layout">
      <aside class="side">${getMenu(user.role)
        .map((view) => renderNavigationItem(view, sessionState.currentView))
        .join('')}</aside>
      <main class="content" id="content"></main>
    </div>
  </div>`;
}

function renderApplication() {
  root.innerHTML = renderApplicationShell(sessionState.user);
  document.getElementById('logout').onclick = async () => {
    try {
      await requestApi('/auth/logout', { method: 'POST' });
    } catch {}
    clearToken();
    authentication.showLogin();
  };
  root.querySelectorAll('.side [data-view]').forEach((button) => {
    button.onclick = () => {
      sessionState.currentView = button.dataset.view;
      renderApplication();
    };
  });
  void renderView(document.getElementById('content'));
}

async function renderView(content) {
  content.innerHTML = '<div class="panel">Loading…</div>';
  try {
    if (sessionState.user.role === 'student') return await renderStudentView(content);
    if (sessionState.user.role === 'admin') return await renderAdminView(content);
    return await renderStaffView(content);
  } catch (error) {
    // Keep the desktop's connection-error presentation separate from the web behavior.
    if (!isDesktop) throw error;
    if (!content.isConnected) return;
    const message = document.createElement('div');
    message.className = 'msg error';
    message.setAttribute('role', 'alert');
    message.textContent = error.message;
    content.replaceChildren(message);
  }
}

void authentication.start();
