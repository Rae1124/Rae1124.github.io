export const sessionState = {
  user: null,
  token: localStorage.getItem('idrs_token') || sessionStorage.getItem('idrs_token') || '',
  currentView: 'Dashboard',
};

export function saveToken(token, remember) {
  sessionState.token = token;
  (remember ? localStorage : sessionStorage).setItem('idrs_token', token);
  (remember ? sessionStorage : localStorage).removeItem('idrs_token');
}

export function clearToken() {
  sessionState.token = '';
  sessionState.user = null;
  document.querySelectorAll('.modal').forEach((modal) => modal.remove());
  localStorage.removeItem('idrs_token');
  sessionStorage.removeItem('idrs_token');
}
