const { loadClient } = require('./helpers/client');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function page(file, role = 'student', options = {}) {
  const calls = [];
  let captcha;
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://rae1124.github.io',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  const request = async (q) => {
    calls.push(q);
    if (q.path === '/auth/setup-status') return { adminExists: true };
    if (q.path === '/auth/login') {
      if (options.login) return options.login(q);
      if (role !== 'student') return { requiresCaptcha: true };
      return { token: 'student-session', user: { role, first_name: 'Test', last_name: 'Student' } };
    }
    if (q.service === 'staff-login') {
      if (options.staff) return options.staff(q);
      return { token: 'staff-session', user: { role, first_name: 'Test', last_name: 'Staff' } };
    }
    if (q.path === '/requests') return { requests: [] };
    if (q.path === '/users') return { users: [] };
    if (q.path === '/auth/logout') return { success: true };
    throw Error('Unexpected request: ' + q.path);
  };
  if (file.startsWith('renderer/'))
    w.desktopApi = { request, requestCaptcha: options.captcha || (async () => 'verified-token') };
  else {
    w.fetch = async (url, opt = {}) => {
      const service = url.includes('id-system-staff-login') ? 'staff-login' : 'main';
      const path = service === 'main' ? url.split('/id-system-api')[1] : '';
      try {
        const data = await request({
          service,
          path,
          body: opt.body ? JSON.parse(opt.body) : undefined,
        });
        return { ok: true, json: async () => data };
      } catch (e) {
        return { ok: false, json: async () => ({ error: e.message }) };
      }
    };
    w.turnstile = {
      render: (_el, settings) => {
        captcha = settings;
        return 'widget';
      },
      remove: () => {},
      reset: () => {},
    };
  }
  w.alert = () => {};
  await loadClient(dom, file);
  await tick();
  const submit = () => w.document.getElementById('f').onsubmit({ preventDefault() {} });
  const credentials = () => {
    w.document.getElementById('id').value = 'test.user';
    w.document.getElementById('pw').value = 'Password123';
  };
  const verify = async () => {
    if (w.desktopApi) await w.document.getElementById('verifyHuman').onclick();
    else captcha.callback('verified-token');
  };
  return { dom, w, calls, submit, credentials, verify, getCaptcha: () => captcha };
}

for (const file of ['app.js', 'renderer/app.js']) {
  test(file + ': opens one login and routes a student without CAPTCHA', async (t) => {
    const p = await page(file);
    t.after(() => p.dom.window.close());
    assert.ok(p.w.document.getElementById('f'), 'unified login must be the initial screen');
    assert.equal(p.w.document.querySelector('[data-role]'), null);
    p.credentials();
    await p.submit();
    await tick();
    assert.match(p.w.document.querySelector('#content h2').textContent, /Student Dashboard/);
    const login = p.calls.find((q) => q.path === '/auth/login');
    assert.equal(login.body.portal, undefined, 'role must come from the server');
    assert.equal(p.calls.filter((q) => q.service === 'staff-login').length, 0);
    assert.equal(p.w.sessionStorage.getItem('idrs_token'), 'student-session');
  });
  for (const [role, title, menu] of [
    ['registrar', 'Registrar Dashboard', 'Applications'],
    ['idoffice', 'ID Office Dashboard', 'Applications'],
    ['admin', 'Administrator Dashboard', 'Users'],
  ]) {
    test(file + ': routes ' + role + ' after required verification', async (t) => {
      const p = await page(file, role);
      t.after(() => p.dom.window.close());
      assert.ok(p.w.document.getElementById('f'), 'unified login must be the initial screen');
      p.credentials();
      p.w.document.getElementById('rem').checked = true;
      await p.submit();
      await tick();
      assert.equal(
        p.w.localStorage.getItem('idrs_token'),
        null,
        'challenge must not create a session',
      );
      assert.equal(p.w.document.getElementById('content'), null);
      assert.equal(p.w.document.getElementById('loginBtn').disabled, true);
      await p.verify();
      await p.submit();
      await tick();
      assert.equal(p.w.document.querySelector('#content h2').textContent, title);
      assert.ok(p.w.document.querySelector('[data-v="' + menu + '"]'));
      const login = p.calls.find((q) => q.service === 'staff-login');
      assert.equal(login.body.portal, undefined);
      assert.equal(login.body.captchaToken, 'verified-token');
      assert.equal(p.w.localStorage.getItem('idrs_token'), 'staff-session');
      await p.w.document.getElementById('logout').onclick();
      assert.ok(p.w.document.getElementById('f'));
      assert.equal(p.w.document.querySelector('[data-role]'), null);
    });
  }
  test(
    file + ': changed credentials discard pending verification and late completion',
    async (t) => {
      let resolve;
      const p = await page(file, 'registrar', { captcha: () => new Promise((r) => (resolve = r)) });
      t.after(() => p.dom.window.close());
      assert.ok(p.w.document.getElementById('f'));
      p.credentials();
      await p.submit();
      await tick();
      let pending,
        oldCaptcha = p.getCaptcha();
      if (p.w.desktopApi) pending = p.verify();
      const id = p.w.document.getElementById('id');
      id.value = 'different.user';
      id.dispatchEvent(new p.w.Event('input'));
      if (p.w.desktopApi) {
        resolve('stale-token');
        await pending;
      } else oldCaptcha.callback('stale-token');
      await p.submit();
      await tick();
      assert.equal(p.calls.filter((q) => q.service === 'staff-login').length, 0);
      assert.equal(p.w.document.getElementById('loginBtn').disabled, true);
      assert.equal(p.w.sessionStorage.getItem('idrs_token'), null);
    },
  );
  test(file + ': invalid credentials keep the user at login', async (t) => {
    const p = await page(file, 'student', {
      login: () => {
        throw Error('Invalid credentials.');
      },
    });
    t.after(() => p.dom.window.close());
    assert.ok(p.w.document.getElementById('f'));
    p.credentials();
    await p.submit();
    assert.match(p.w.document.getElementById('m').textContent, /Invalid credentials/);
    assert.equal(p.w.document.getElementById('loginBtn').disabled, false);
    assert.equal(p.w.localStorage.getItem('idrs_token'), null);
  });
  test(file + ': rejected staff verification does not save a session', async (t) => {
    const p = await page(file, 'admin', {
      staff: () => {
        throw Error('Human verification failed or expired.');
      },
    });
    t.after(() => p.dom.window.close());
    assert.ok(p.w.document.getElementById('f'));
    p.credentials();
    await p.submit();
    await p.verify();
    await p.submit();
    assert.match(p.w.document.getElementById('m').textContent, /verification failed/);
    assert.equal(p.w.document.getElementById('loginBtn').disabled, true);
    assert.equal(p.w.sessionStorage.getItem('idrs_token'), null);
  });
}
