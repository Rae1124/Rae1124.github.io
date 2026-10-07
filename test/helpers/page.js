const { JSDOM } = require('jsdom');
const { loadClient } = require('./client');

const tick = () => new Promise((resolve) => setImmediate(resolve));

async function createPage({
  desktop = false,
  role = 'student',
  signedIn = true,
  respond = () => undefined,
} = {}) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://rae1124.github.io',
    runScripts: 'outside-only',
  });
  const window = dom.window;
  const calls = [];
  const alerts = [];
  const openedDocuments = [];
  const previews = [];
  const user = { role, first_name: 'Test', last_name: 'User', student_id: '2026-001' };
  if (signedIn) window.localStorage.setItem('idrs_token', 'test-session');
  for (const name of [
    'content',
    'logout',
    'back',
    'f',
    'af',
    'reason',
    'photo',
    'docBody',
    'docModal',
    'add',
    'cancel',
  ]) {
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        throw Error(`Implicit element global: ${name}`);
      },
    });
  }
  const request = async (input) => {
    const call = { method: 'GET', ...input };
    calls.push(call);
    const result = await respond(call);
    if (result !== undefined) return result;
    if (call.path === '/auth/me') return { user };
    if (call.path === '/auth/setup-status') return { adminExists: true };
    if (call.path === '/requests') return { requests: [] };
    if (call.path === '/users') return { users: [] };
    if (call.path === '/notices') return { notices: [] };
    if (call.path === '/activity-logs') return { logs: [] };
    return {};
  };
  window.alert = (message) => alerts.push(message);
  window.prompt = () => null;
  window.open = () => {
    const preview = {
      opener: 'parent',
      closed: false,
      location: {
        replace(url) {
          preview.url = url;
        },
      },
      close() {
        this.closed = true;
      },
    };
    previews.push(preview);
    return preview;
  };
  if (desktop) {
    window.desktopApi = { request, openSignedDocument: async (url) => openedDocuments.push(url) };
  } else {
    window.fetch = async (url, options = {}) => {
      const service = url.includes('id-system-documents')
        ? 'documents'
        : url.includes('id-system-staff-login')
          ? 'staff-login'
          : 'main';
      const endpoint = {
        main: 'id-system-api',
        documents: 'id-system-documents',
        'staff-login': 'id-system-staff-login',
      }[service];
      try {
        const data = await request({
          service,
          path: url.split(endpoint)[1],
          method: options.method || 'GET',
          token: options.headers?.Authorization?.replace('Bearer ', ''),
          body: options.body ? JSON.parse(options.body) : undefined,
        });
        return { ok: true, json: async () => data };
      } catch (error) {
        return { ok: false, json: async () => ({ error: error.message }) };
      }
    };
  }
  const modules = await loadClient(dom, desktop ? 'renderer/index.html' : 'index.html');
  await tick();
  const document = window.document;
  return {
    dom,
    window,
    document,
    calls,
    alerts,
    openedDocuments,
    previews,
    modules,
    async navigate(view) {
      document.querySelector(`.side [data-view="${view}"]`).click();
      await tick();
    },
    async submit(selector) {
      await document.querySelector(selector).onsubmit({ preventDefault() {} });
      await tick();
    },
  };
}

module.exports = { createPage, tick };
