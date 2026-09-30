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
  const adapter = read('renderer/desktop-adapter.js');
  assert.match(html, /Online Students ID Replacement System/);
  assert.match(adapter, /Online Students ID Replacement System/);
  assert.match(app, /id-system-api/);
  assert.match(app, /id-system-documents/);
  assert.match(app, /id-system-staff-login/);
  const all = [html, app, read('renderer/ui.css'), read('renderer/ui-enhance.js'), adapter].join('\n');
  assert.doesNotMatch(all, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(all, /TURNSTILE_SECRET_KEY/);
  assert.doesNotMatch(html, /challenges\.cloudflare\.com\/turnstile/);
});
