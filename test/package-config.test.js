const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('Windows packaging includes the bundled app, installer and portable targets', () => {
  assert.ok(fs.existsSync('package.json'), 'desktop package missing');
  const p = JSON.parse(fs.readFileSync('package.json'));
  assert.equal(p.productName, 'Online Students ID Replacement System');
  assert.equal(p.main, 'electron/main.js');
  assert.deepEqual(p.build.win.target, [
    { target: 'nsis', arch: ['x64'] },
    { target: 'portable', arch: ['x64'] },
  ]);
  assert.equal(p.build.nsis.artifactName, 'Online-Students-ID-Replacement-System-Setup.${ext}');
  assert.equal(
    p.build.portable.artifactName,
    'Online-Students-ID-Replacement-System-Portable.${ext}',
  );
  for (const f of ['renderer/index.html', 'renderer/app.js', 'ui.css', 'renderer/ui-enhance.js'])
    assert.ok(fs.existsSync(f), f);
});
