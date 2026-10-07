const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
function fixture() {
  const ipc = new EventEmitter();
  let win;
  class Window extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      win = this;
      this.dead = false;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: 'https://rae1124.github.io/desktop-captcha.html' };
      this.webContents.setWindowOpenHandler = (f) => (this.popup = f);
    }
    isDestroyed() {
      return this.dead;
    }
    loadURL(u) {
      this.url = u;
      return Promise.resolve();
    }
    close() {
      this.dead = true;
      this.emit('closed');
    }
  }
  const ses = {
    setPermissionRequestHandler() {},
    setPermissionCheckHandler() {},
    webRequest: { onBeforeRequest() {} },
    clearStorageData: async () => {},
    clearCache: async () => {},
  };
  return {
    deps: { BrowserWindow: Window, ipcMain: ipc, session: { fromPartition: () => ses } },
    ipc,
    get win() {
      return win;
    },
    event() {
      return { sender: win.webContents, senderFrame: win.webContents.mainFrame };
    },
  };
}
test('CAPTCHA accepts bounded tokens and blocks unrelated resource URLs', () => {
  const { isValidCaptchaToken: v, isCaptchaResourceAllowed: a } = require('../electron/captcha');
  assert.equal(v('token.abc_DEF-123'), true);
  for (const x of ['', null, {}, 'a'.repeat(2049), 'bad token']) assert.equal(v(x), false);
  assert.equal(a('https://challenges.cloudflare.com/turnstile/v0/api.js'), true);
  assert.equal(a('https://rae1124.github.io/desktop-captcha.html'), true);
  assert.equal(a('https://evil.com'), false);
  assert.equal(a('https://rae1124.github.io/other.html'), false);
});
test('CAPTCHA rejects foreign frames, resolves once, closes and removes listeners', async () => {
  const { openCaptchaChallenge } = require('../electron/captcha');
  const f = fixture();
  const p = openCaptchaChallenge(null, f.deps);
  assert.equal(f.win.url, 'https://rae1124.github.io/desktop-captcha.html');
  f.ipc.emit('captcha:complete', { sender: {}, senderFrame: {} }, 'forged');
  assert.equal(f.win.dead, false);
  f.ipc.emit('captcha:complete', f.event(), 'token-ok');
  assert.equal(await p, 'token-ok');
  assert.equal(f.win.dead, true);
  assert.equal(f.ipc.listenerCount('captcha:complete'), 0);
});
test('CAPTCHA cancellation and invalid completion fail closed', async () => {
  const { openCaptchaChallenge } = require('../electron/captcha');
  for (const bad of [null, 'a'.repeat(2049)]) {
    const f = fixture();
    const p = openCaptchaChallenge(null, f.deps);
    f.ipc.emit('captcha:complete', f.event(), bad);
    await assert.rejects(p, /Invalid verification/);
  }
  const f = fixture();
  const p = openCaptchaChallenge(null, f.deps);
  f.win.close();
  await assert.rejects(p, /cancelled/);
});
