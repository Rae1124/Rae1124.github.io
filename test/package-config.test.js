const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('desktop package metadata and Windows targets match approved design', () => {
  const pkgPath = path.join(root, 'package.json');
  assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.equal(pkg.productName, 'Online Students ID Replacement System');
  assert.equal(pkg.main, 'electron/main.js');
  assert.ok(pkg.devDependencies?.electron, 'electron devDependency missing');
  assert.ok(pkg.devDependencies?.['electron-builder'], 'electron-builder devDependency missing');
  assert.equal(pkg.scripts?.test, 'node --test test/*.test.js');
  assert.equal(pkg.scripts?.start, 'electron .');
  assert.equal(pkg.scripts?.['build:win'], 'electron-builder --win nsis portable --x64');
  assert.equal(pkg.scripts?.['prepare:icon'], 'node scripts/prepare-icon.js');
  assert.equal(pkg.build?.productName, 'Online Students ID Replacement System');
  assert.equal(pkg.build?.win?.icon, 'build/icon.ico');
  const targets = pkg.build?.win?.target || [];
  assert.deepEqual(targets, [
    { target: 'nsis', arch: ['x64'] },
    { target: 'portable', arch: ['x64'] },
  ]);
  assert.equal(pkg.build?.nsis?.artifactName, 'Online-Students-ID-Replacement-System-Setup.${ext}');
  assert.equal(pkg.build?.portable?.artifactName, 'Online-Students-ID-Replacement-System-Portable.${ext}');
});
