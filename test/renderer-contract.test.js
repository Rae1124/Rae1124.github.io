const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const renderer = name => path.join(root, 'renderer', name);
test('bundled renderer exists and uses approved product branding without embedded secrets', () => {
  for (const name of ['index.html','app.js','ui.css','ui-enhance.js']) assert.equal(fs.existsSync(renderer(name)), true, `${name} must exist`);
  const html = fs.readFileSync(renderer('index.html'), 'utf8');
  const app = fs.readFileSync(renderer('app.js'), 'utf8');
  assert.match(html, /Online Students ID Replacement System/);
  assert.match(app, /id-system-api/);
  assert.match(app, /id-system-documents/);
  assert.match(app, /id-system-staff-login/);
  const combined = html + '\n' + app;
  assert.doesNotMatch(combined, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(combined, /TURNSTILE_SECRET_KEY/);
  assert.doesNotMatch(html, /challenges\.cloudflare\.com\/turnstile/);
});
