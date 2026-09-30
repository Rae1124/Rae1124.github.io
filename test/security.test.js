const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');
test('signed documents reject arbitrary sites, schemes, credentials and non-signed paths',()=>{
 assert.ok(fs.existsSync('electron/security.js'),'security module missing');
 const {isApprovedSignedDocumentUrl:allow}=require('../electron/security');
 assert.equal(allow('https://rpaaagfgyauqeyrqollr.supabase.co/storage/v1/object/sign/private/doc.pdf?token=abc'),true);
 for(const url of [null,{},'javascript:alert(1)','file:///etc/passwd','https://evil.com/storage/v1/object/sign/a?token=x','https://rpaaagfgyauqeyrqollr.supabase.co.evil.com/storage/v1/object/sign/a?token=x','https://user@rpaaagfgyauqeyrqollr.supabase.co/storage/v1/object/sign/a?token=x','https://rpaaagfgyauqeyrqollr.supabase.co/storage/v1/object/public/a','https://rpaaagfgyauqeyrqollr.supabase.co/storage/v1/object/sign/a','https://rpaaagfgyauqeyrqollr.supabase.co:444/storage/v1/object/sign/a?token=x']) assert.equal(allow(url),false,String(url));
});
test('request validator stops URL, path, header and payload injection',()=>{
 const {normalizeApiRequest:n}=require('../electron/security');
 for(const input of [null,{}, {service:'evil'}, {service:'main',path:'https://evil.com'}, {service:'main',path:'//evil.com'}, {service:'main',path:'/../auth'}, {service:'main',path:'/%2e%2e/x'}, {service:'main',path:'/x\\foo'}, {service:'main',path:'/x#fragment'}, {service:'main',path:'/requests',method:'DELETE'}, {service:'main',path:'/requests',token:'a\r\nb'}, {service:'main',path:'/requests',method:'POST',body:'x'.repeat(8*1024*1024)}, {service:'staff-login',path:'/evil',method:'POST'}, {service:'documents',path:'/evil'}, {service:'main',path:'/requests',method:'POST',body:()=>{}}, {service:'main',path:'/requests',method:'POST',body:{x:Infinity}}]) assert.throws(()=>n(input));
 assert.deepEqual(n({service:'documents',path:'?request_id=abc'}),{service:'documents',path:'?request_id=abc',method:'GET',body:undefined,token:''});
});
