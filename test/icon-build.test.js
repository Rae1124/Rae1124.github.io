const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
test('original artwork converts to multi-size Windows icon', () => {
  assert.ok(fs.existsSync('scripts/prepare-icon.js'), 'icon converter missing');
  execFileSync(process.execPath, ['scripts/prepare-icon.js']);
  const b = fs.readFileSync('build/icon.ico');
  assert.equal(b.readUInt16LE(0), 0);
  assert.equal(b.readUInt16LE(2), 1);
  assert.ok(b.readUInt16LE(4) >= 3);
  const sizes = [];
  for (let i = 0; i < b.readUInt16LE(4); i++) {
    sizes.push(b[6 + i * 16] || 256);
    const len = b.readUInt32LE(6 + i * 16 + 8),
      off = b.readUInt32LE(6 + i * 16 + 12);
    assert.ok(off + len <= b.length);
  }
  assert.ok(sizes.includes(256));
  assert.ok(sizes.includes(32));
});
