const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const captcha=require('../electron/captcha');

test('desktop CAPTCHA uses the exact production-hosted URL and bounded token validation',()=>{
  assert.equal(captcha.CAPTCHA_URL,'https://rae1124.github.io/desktop-captcha.html');
  assert.equal(captcha.isValidCaptchaToken('a'.repeat(40)),true);
  assert.equal(captcha.isValidCaptchaToken(''),false);
  assert.equal(captcha.isValidCaptchaToken('short'),false);
  assert.equal(captcha.isValidCaptchaToken('x'.repeat(4097)),false);
  assert.equal(captcha.isValidCaptchaToken('x\n'.repeat(30)),false);
});

test('hosted CAPTCHA page renders Turnstile explicitly for staff_login and never persists the token',()=>{
  const file=path.join(root,'desktop-captcha.html');
  assert.ok(fs.existsSync(file),'desktop-captcha.html must exist');
  const html=fs.readFileSync(file,'utf8');
  assert.match(html,/0x4AAAAAAFKA_EpytVI2BhzZ/);
  assert.match(html,/turnstile\.render/);
  assert.match(html,/action:\s*['"]staff_login['"]/);
  assert.match(html,/window\.captchaBridge\.complete\(token\)/);
  assert.match(html,/window\.captchaBridge\.cancel\(\)/);
  assert.doesNotMatch(html,/localStorage|sessionStorage|document\.cookie|console\.log|URLSearchParams/);
});

test('CAPTCHA preload exposes only completion and cancellation operations',()=>{
  const preload=fs.readFileSync(path.join(root,'electron','captcha-preload.js'),'utf8');
  assert.match(preload,/captchaBridge/);
  assert.match(preload,/complete/);
  assert.match(preload,/cancel/);
  assert.doesNotMatch(preload,/desktopApi|requestProductionApi|openExternal/);
});
