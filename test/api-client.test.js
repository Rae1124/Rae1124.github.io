const test=require('node:test');
const assert=require('node:assert/strict');
const {serviceUrl,requestProductionApi}=require('../electron/api-client');
const BASE='https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/';

test('service identifiers map only to fixed production Edge Function URLs',()=>{
  assert.equal(serviceUrl('main'),BASE+'id-system-api');
  assert.equal(serviceUrl('documents'),BASE+'id-system-documents');
  assert.equal(serviceUrl('staff-login'),BASE+'id-system-staff-login');
  assert.throws(()=>serviceUrl('https://evil.example'),/service/i);
});

test('requestProductionApi maps a valid request without accepting arbitrary URLs',async()=>{
  let seen;
  const fakeFetch=async(url,init)=>{seen={url,init};return {ok:true,status:200,text:async()=>JSON.stringify({requests:[]})}};
  const result=await requestProductionApi({service:'main',path:'/requests',method:'GET',token:'tok'},fakeFetch);
  assert.equal(seen.url,BASE+'id-system-api/requests');
  assert.equal(seen.init.headers.Authorization,'Bearer tok');
  assert.deepEqual(result,{ok:true,status:200,data:{requests:[]}});
  await assert.rejects(()=>requestProductionApi({service:'main',path:'https://evil.example',method:'GET'},fakeFetch),/path/i);
});

test('HTTP errors stay response-shaped while network failures use approved connection copy',async()=>{
  const httpFail=async()=>({ok:false,status:403,text:async()=>JSON.stringify({error:'Access denied.'})});
  assert.deepEqual(await requestProductionApi({service:'main',path:'/requests',method:'GET'},httpFail),{ok:false,status:403,data:{error:'Access denied.'}});
  const networkFail=async()=>{throw new Error('socket down')};
  await assert.rejects(()=>requestProductionApi({service:'main',path:'/requests',method:'GET'},networkFail),/Unable to connect to the Online Students ID Replacement System\. Please check your internet connection and try again\./);
});
