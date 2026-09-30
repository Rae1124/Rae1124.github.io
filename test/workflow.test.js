const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Windows desktop CI installs locked dependencies, tests, prepares icon, builds both exes, and uploads them',()=>{
  const file=path.join(root,'.github','workflows','build-desktop.yml');
  assert.ok(fs.existsSync(file),'build-desktop.yml must exist');
  const yml=fs.readFileSync(file,'utf8');
  assert.match(yml,/windows-latest/);
  assert.match(yml,/actions\/setup-node@v4/);
  assert.match(yml,/npm ci/);
  assert.match(yml,/npm test/);
  assert.match(yml,/npm run prepare:icon/);
  assert.match(yml,/npm run build:win/);
  assert.match(yml,/Online-Students-ID-Replacement-System-Setup\.exe/);
  assert.match(yml,/Online-Students-ID-Replacement-System-Portable\.exe/);
  assert.match(yml,/dist\/win-unpacked/);
  assert.match(yml,/actions\/upload-artifact@v4/);
});
