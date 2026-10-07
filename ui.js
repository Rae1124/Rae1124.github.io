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
