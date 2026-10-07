const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('Windows packaging includes the bundled app, installer and portable targets', () => {
  assert.ok(fs.existsSync('package.json'), 'desktop package missing');
  const config = JSON.parse(fs.readFileSync('package.json'));
  assert.equal(config.productName, 'Student ID Replacement System');
  assert.equal(config.main, 'electron/main.js');
  assert.deepEqual(config.build.win.target, [
    { target: 'nsis', arch: ['x64'] },
    { target: 'portable', arch: ['x64'] },
  ]);
  assert.equal(config.build.nsis.artifactName, 'Student-ID-Replacement-System-Setup.${ext}');
  assert.equal(config.build.portable.artifactName, 'Student-ID-Replacement-System-Portable.${ext}');
  for (const filename of [
    'renderer/index.html',
    'app.js',
    'ui.css',
    'views/student.js',
    'views/staff.js',
    'views/admin.js',
  ]) {
    assert.ok(fs.existsSync(filename), filename);
  }
});
