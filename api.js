import { apiEndpoints } from './config.js';
import { sessionState } from './state.js';

const requestErrors = {
  main: 'Request failed',
  documents: 'Document request failed',
  'staff-login': 'Staff login failed',
};

async function request(service, path, options = {}) {
  const token = service === 'staff-login' ? '' : sessionState.token;
  if (window.desktopApi) {
    return window.desktopApi.request({
      service,
      path,
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : undefined,
      ...(service === 'staff-login' ? {} : { token }),
    });
  }
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(apiEndpoints[service] + path, { ...options, headers });
  let data = {};
  try {
    data = await response.json();
  } catch {}
  if (!response.ok) throw new Error(data.error || requestErrors[service]);
  return data;
}

export function requestApi(path, options) {
  return request('main', path, options);
}

export function requestDocuments(query = '', options) {
  return request('documents', query, options);
}

export function requestStaffLogin(payload) {
  return request('staff-login', '', { method: 'POST', body: JSON.stringify(payload) });
}
