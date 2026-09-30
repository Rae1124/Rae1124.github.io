const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('desktop package metadata and Windows targets match the approved design', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.productName, 'Online Students ID Replacement System');
  assert.equal(pkg.main, 'electron/main.js');
  assert.ok(pkg.devDependencies?.electron);
  assert.ok(pkg.devDependencies?.['electron-builder']);
  assert.equal(pkg.build?.win?.icon, 'build/icon.ico');
  const targets = (pkg.build?.win?.target || []).map(t => typeof t === 'string' ? t : t.target);
  assert.deepEqual(targets, ['nsis', 'portable']);
  assert.equal(pkg.build?.nsis?.artifactName, 'Online-Students-ID-Replacement-System-Setup.${ext}');
  assert.equal(pkg.build?.portable?.artifactName, 'Online-Students-ID-Replacement-System-Portable.${ext}');
});
