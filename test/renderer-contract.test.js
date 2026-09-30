const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('bundled renderer exists and keeps production contracts without secrets', () => {
  for (const file of ['renderer/index.html','renderer/app.js','renderer/ui.css','renderer/ui-enhance.js','renderer/desktop-adapter.js']) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} must exist`);
  }
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  assert.match(html, /Online Students ID Replacement System/);
  assert.match(read('renderer/desktop-adapter.js'), /Online Students ID Replacement System/);
  assert.match(app, /id-system-api/);
  assert.match(app, /id-system-documents/);
  assert.match(app, /id-system-staff-login/);
  const all = [html, app, read('renderer/ui.css'), read('renderer/ui-enhance.js'), read('renderer/desktop-adapter.js')].join('\n');
  assert.doesNotMatch(all, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(all, /TURNSTILE_SECRET_KEY/);
  assert.doesNotMatch(html, /challenges\.cloudflare\.com\/turnstile/);
});

test('desktop adapter routes production APIs and signed documents through the preload bridge', () => {
  const adapter = read('renderer/desktop-adapter.js');
  assert.match(adapter, /window\.desktopApi\.request/);
  assert.match(adapter, /window\.desktopApi\.openSignedDocument/);
  assert.match(adapter, /id-system-api/);
  assert.match(adapter, /id-system-documents/);
  assert.match(adapter, /id-system-staff-login/);
});

test('desktop adapter blocks drag-and-drop navigation', () => {
  const adapter = read('renderer/desktop-adapter.js');
  assert.match(adapter, /dragover/);
  assert.match(adapter, /drop/);
  assert.match(adapter, /preventDefault/);
});

test('desktop CAPTCHA bridge is staff-only while Student production logic remains byte-identical',()=>{
  const app=read('renderer/app.js');
  const webApp=read('app.js');
  const adapter=read('renderer/desktop-adapter.js');
  assert.equal(app,webApp,'bundled production app logic must remain unchanged');
  assert.match(adapter,/window\.desktopApi\.requestCaptcha/);
  assert.match(adapter,/window\.turnstile/);
  assert.match(adapter,/Verify I['’]m Human/);
  assert.match(adapter,/staff-login/);
});
