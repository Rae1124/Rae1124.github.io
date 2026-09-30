const test = require('node:test');
const assert = require('node:assert/strict');
const {isApprovedExternalUrl,isApprovedSignedDocumentUrl,normalizeApiRequest}=require('../electron/security');

test('signed document URLs are restricted to the exact Supabase project storage signed-object path',()=>{
  assert.equal(isApprovedSignedDocumentUrl('https://rpaaagfgyauqeyrqollr.supabase.co/storage/v1/object/sign/student-id-files/a/b.pdf?token=abc'),true);
  assert.equal(isApprovedSignedDocumentUrl('https://rpaaagfgyauqeyrqollr.supabase.co/storage/v1/object/public/student-id-files/a.pdf'),false);
  assert.equal(isApprovedSignedDocumentUrl('https://rpaaagfgyauqeyrqollr.supabase.co.evil.example/storage/v1/object/sign/student-id-files/a.pdf?token=x'),false);
  assert.equal(isApprovedSignedDocumentUrl('javascript:alert(1)'),false);
  assert.equal(isApprovedSignedDocumentUrl('file:///C:/secret.txt'),false);
});

test('external navigation rejects arbitrary and dangerous schemes',()=>{
  assert.equal(isApprovedExternalUrl('https://rae1124.github.io/'),true);
  assert.equal(isApprovedExternalUrl('https://example.com/'),false);
  assert.equal(isApprovedExternalUrl('javascript:alert(1)'),false);
  assert.equal(isApprovedExternalUrl('file:///C:/Windows/System32'),false);
});

test('normalizeApiRequest accepts only known services, methods, bounded tokens, safe relative paths and JSON bodies',()=>{
  assert.deepEqual(normalizeApiRequest({service:'main',path:'/requests',method:'POST',body:{reason:'Lost ID'},token:'abc'}),{service:'main',path:'/requests',method:'POST',body:{reason:'Lost ID'},token:'abc'});
  assert.throws(()=>normalizeApiRequest({service:'evil',path:'/x',method:'GET'}),/service/i);
  assert.throws(()=>normalizeApiRequest({service:'main',path:'https://evil.example/x',method:'GET'}),/path/i);
  assert.throws(()=>normalizeApiRequest({service:'main',path:'/../secret',method:'GET'}),/path/i);
  assert.throws(()=>normalizeApiRequest({service:'main',path:'/x',method:'DELETE'}),/method/i);
  assert.throws(()=>normalizeApiRequest({service:'main',path:'/x',method:'GET',token:'x'.repeat(2049)}),/token/i);
  const circular={};circular.self=circular;
  assert.throws(()=>normalizeApiRequest({service:'main',path:'/x',method:'POST',body:circular}),/body/i);
});
