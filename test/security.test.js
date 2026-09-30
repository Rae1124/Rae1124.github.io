const test = require('node:test');
const assert = require('node:assert/strict');
const { isApprovedExternalUrl, isApprovedSignedDocumentUrl, normalizeApiRequest } = require('../electron/security');
test('only approved external URLs are accepted', () => {
  assert.equal(isApprovedExternalUrl('https://rae1124.github.io/desktop-captcha.html'), true);
  assert.equal(isApprovedExternalUrl('https://example.com/'), false);
  assert.equal(isApprovedExternalUrl('javascript:alert(1)'), false);
  assert.equal(isApprovedExternalUrl('file:///etc/passwd'), false);
  assert.equal(isApprovedExternalUrl('https://rpaaagfgyauqeyrqollr.supabase.co.evil.example/x'), false);
});
test('signed documents must use exact Supabase host, bucket, and signed-object path', () => {
  assert.equal(isApprovedSignedDocumentUrl('https://rpaaagfgyauqeyrqollr.supabase.co/storage/v1/object/sign/student-id-files/a.pdf?token=abc'), true);
  assert.equal(isApprovedSignedDocumentUrl('https://rpaaagfgyauqeyrqollr.supabase.co/storage/v1/object/public/student-id-files/a.pdf'), false);
  assert.equal(isApprovedSignedDocumentUrl('https://evil.example/storage/v1/object/sign/student-id-files/a.pdf?token=abc'), false);
  assert.equal(isApprovedSignedDocumentUrl('https://rpaaagfgyauqeyrqollr.supabase.co/storage/v1/object/sign/other-bucket/a.pdf?token=abc'), false);
});
test('API request normalization rejects arbitrary URLs and unsafe methods', () => {
  assert.deepEqual(normalizeApiRequest({service:'main', path:'/requests', method:'GET'}), {service:'main', path:'/requests', method:'GET', body:undefined, token:''});
  assert.throws(() => normalizeApiRequest({service:'evil', path:'/x', method:'GET'}), /service/i);
  assert.throws(() => normalizeApiRequest({service:'main', path:'https://evil.example/x', method:'GET'}), /path/i);
  assert.throws(() => normalizeApiRequest({service:'main', path:'/x', method:'DELETE'}), /method/i);
});
