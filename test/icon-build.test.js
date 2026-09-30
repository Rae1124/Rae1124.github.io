const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('approved source icon exists and packaging points to Windows ico',()=>{
  const source=path.join(root,'build','icon-source.png');
  assert.ok(fs.existsSync(source),'approved source artwork must exist');
  assert.ok(fs.statSync(source).size>0,'source artwork must not be empty');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.build.win.icon,'build/icon.ico');
  assert.equal(pkg.build.nsis.createDesktopShortcut,true);
  assert.equal(pkg.build.nsis.createStartMenuShortcut,true);
  assert.deepEqual(pkg.build.win.target,[{target:'nsis',arch:['x64']},{target:'portable',arch:['x64']}]);
  assert.equal(pkg.scripts['prepare:icon'],'node scripts/prepare-icon.js');
});

test('icon preparation script exists and writes build/icon.ico from the approved PNG',()=>{
  const script=path.join(root,'scripts','prepare-icon.js');
  assert.ok(fs.existsSync(script),'prepare-icon.js must exist');
  const text=fs.readFileSync(script,'utf8');
  assert.match(text,/icon-source\.png/);
  assert.match(text,/icon\.ico/);
  assert.match(text,/png-to-ico/);
});
