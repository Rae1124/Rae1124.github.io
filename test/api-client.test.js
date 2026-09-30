const {test}=require('node:test');const assert=require('node:assert/strict');
test('API bridge keeps calls on fixed production endpoints and passes auth/body',async()=>{
 const {requestProductionApi:r}=require('../electron/api-client');
 for(const [service,path,url] of [ ['main','/requests','https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-api/requests'],['documents','?request_id=x','https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-documents?request_id=x'],['staff-login','','https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-staff-login']]){
  const result=await r({service,path,method:'POST',token:'opaque',body:{a:1}},async(u,o)=>{assert.equal(u,url);assert.equal(o.headers.Authorization,'Bearer opaque');assert.equal(o.body,'{"a":1}');assert.equal(o.redirect,'error');return new Response('{"ok":true}');});assert.deepEqual(result,{ok:true});
 }
});
test('network, backend, and malformed JSON responses never become a false success',async()=>{
 const {requestProductionApi:r}=require('../electron/api-client');const q={service:'main',path:'/requests'};
 await assert.rejects(r(q,async()=>{throw Error('socket detail')}),/Unable to connect to the Online Students ID Replacement System/);
 await assert.rejects(r(q,async()=>new Response('{"error":"Not authorized"}',{status:401})),/Not authorized/);
 await assert.rejects(r(q,async()=>new Response('<html>oops</html>')),/invalid response/);
 let calls=0;await assert.rejects(r({service:'main',path:'https://evil.com'},async()=>{calls++;}));assert.equal(calls,0);
});
