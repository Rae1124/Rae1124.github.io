import { requestApi } from '../api.js';
import { sessionState } from '../state.js';
import { roleLabel } from '../utils.js';
import { renderPageHeader, renderStats } from '../ui.js';
import { renderRequestTable } from './requests.js';

export async function renderStaffView(content) {
  if (sessionState.currentView !== 'Dashboard') return renderRequestTable(content, true);
  const { requests } = await requestApi('/requests');
  content.innerHTML = `${renderPageHeader(`${roleLabel(sessionState.user.role)} Dashboard`)}
    ${renderStats([
      ['Total Requests', requests.length],
      ['Submitted', requests.filter((request) => request.status === 'Submitted').length],
      ['Approved', requests.filter((request) => request.status === 'Approved').length],
      ['Issued', requests.filter((request) => request.status === 'Issued').length],
    ])}`;
}
