import { systemName } from './config.js';
import { escapeHTML } from './utils.js';

const pageSubtitles = {
  Applications: 'Review and process student ID replacement requests.',
  'My Applications': 'Track your submitted replacement requests and supporting files.',
  'Student Dashboard': 'View your student information and replacement activity.',
  'Registrar Dashboard': 'Review incoming applications and monitor request progress.',
  'ID Office Dashboard': 'Process approved requests from preparation through issuance.',
  'Administrator Dashboard': 'Monitor users, requests, and system activity.',
  'User Management': 'Create and manage authorized school personnel accounts.',
  'Activity Logs': 'Review important account, security, and application activity.',
  'Apply for ID Replacement':
    'Submit the required information and documents for your replacement ID.',
  Notifications: 'Stay updated on changes to your replacement request.',
};

export function renderMessage(message, kind = 'error') {
  return `<div class="msg ${escapeHTML(kind)}">${escapeHTML(message)}</div>`;
}

export function renderField({ name, label, type = 'text', options, full = false, ...attributes }) {
  const attributeText = Object.entries(attributes)
    .filter(([, value]) => value !== false && value != null)
    .map(([key, value]) =>
      value === true ? escapeHTML(key) : `${escapeHTML(key)}="${escapeHTML(value)}"`,
    )
    .join(' ');
  const identity = `id="${escapeHTML(name)}" name="${escapeHTML(name)}"`;
  let control;
  if (options) {
    const optionMarkup = options
      .map((option) => {
        const [value, text] = Array.isArray(option) ? option : [option, option];
        return `<option value="${escapeHTML(value)}">${escapeHTML(text)}</option>`;
      })
      .join('');
    control = `<select ${identity} ${attributeText}>${optionMarkup}</select>`;
  } else if (type === 'textarea') {
    control = `<textarea ${identity} ${attributeText}></textarea>`;
  } else {
    control = `<input ${identity} type="${escapeHTML(type)}" ${attributeText}>`;
  }
  return `<label${full ? ' class="full"' : ''}>${escapeHTML(label)}${control}</label>`;
}

export function renderFieldGrid(fields) {
  return `<div class="formGrid">${fields.map(renderField).join('')}</div>`;
}

export function renderAuthShell(markup) {
  document.getElementById('root').innerHTML = `
    <div class="page">
      <section class="hero">
        <div class="seal" aria-hidden="true">ID</div>
        <span class="eyebrow">ONLINE STUDENT SERVICES</span>
        <h1>${systemName}</h1>
        <p>Submit an ID replacement request, upload the required files, and track its status.</p>
        <div class="points">
          <span>Student registration</span>
          <span>Staff review and processing</span>
          <span>Application status tracking</span>
        </div>
      </section>
      <main class="panelWrap"><div class="card">${markup}</div></main>
    </div>`;
}

export function renderAuthHeader(label) {
  return `<div class="authHead">
    <button class="back" id="backButton" type="button">Back to Login</button>
    <span class="eyebrow">${escapeHTML(label)}</span>
  </div>`;
}

export function renderPageHeader(title, actions = '') {
  const heading = `<h2>${escapeHTML(title)}</h2>`;
  const subtitle = pageSubtitles[title];
  return `${actions ? `<div class="sectionHead">${heading}${actions}</div>` : heading}
    ${subtitle ? `<p class="pageSubtitle">${escapeHTML(subtitle)}</p>` : ''}`;
}

export function renderStats(statistics) {
  return `<div class="stats">${statistics
    .map(
      ([label, value, compact]) => `
    <div class="stat"><span>${escapeHTML(label)}</span>
      <b${compact ? ' class="statText"' : ''}>${escapeHTML(value)}</b>
    </div>`,
    )
    .join('')}</div>`;
}

export function renderTable(columns, rows, emptyMessage = '') {
  const headings = columns.map((column) => `<th>${escapeHTML(column)}</th>`).join('');
  const emptyRow = emptyMessage
    ? `<tr><td colspan="${columns.length}">${escapeHTML(emptyMessage)}</td></tr>`
    : '';
  return `<div class="panel tablePanel"><table class="table">
    <thead><tr>${headings}</tr></thead>
    <tbody>${rows.length ? rows.join('') : emptyRow}</tbody>
  </table></div>`;
}

export function renderStatusBadge(status) {
  const slug = String(status || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `<span class="badge status-${slug}">${escapeHTML(status)}</span>`;
}

export function renderNavigationItem(view, currentView) {
  const iconPaths = {
    Dashboard: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
    Applications: 'M5 3h14v18H5Z M8 7h8 M8 11h8 M8 15h5',
    'Apply for ID': 'M12 4v16 M4 12h16',
    'My Applications': 'M5 3h14v18H5Z M8 7h8 M8 11h8 M8 15h5',
    Notifications: 'M5 17h14l-2-4V8a5 5 0 0 0-10 0v5Z M10 21h4',
    'All Requests': 'M5 3h14v18H5Z M8 7h8 M8 11h8 M8 15h5',
    Users: 'M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21v-3a8 8 0 0 1 16 0v3',
    'Activity Logs': 'M4 6h16 M4 12h16 M4 18h16',
  };
  return `<button data-view="${escapeHTML(view)}" class="${currentView === view ? 'active' : ''}">
    <span class="navIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${iconPaths[view] || ''}"/></svg></span>
    <span class="navLabel">${escapeHTML(view)}</span>
  </button>`;
}
