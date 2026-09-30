const test = require('node:test');
const assert = require('node:assert/strict');
const { requestProductionApi, endpointFor } = require('../electron/api-client');
test('service identifiers map only to fixed production Edge Function URLs', () => {
  assert.equal(endpointFor('main'), 'https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-api');
  assert.equal(endpointFor('documents'), 'https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-documents');
  assert.equal(endpointFor('staff-login'), 'https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-staff-login');
  assert.throws(() => endpointFor('https://evil.example'), /service/i);
});
test('valid request uses fixed endpoint and bearer token', async () => {
  let seen;
  const fakeFetch = async (url, init) => { seen = {url, init}; return {ok:true, status:200, json:async()=>({ok:true})}; };
  const out = await requestProductionApi({service:'main', path:'/requests', method:'POST', body:{x:1}, token:'abc'}, fakeFetch);
  assert.deepEqual(out, {ok:true});
  assert.equal(seen.url, 'https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-api/requests');
  assert.equal(seen.init.headers.Authorization, 'Bearer abc');
  assert.equal(seen.init.body, JSON.stringify({x:1}));
});
test('network failures use approved connection error', async () => {
  const fakeFetch = async () => { throw new TypeError('network down'); };
  await assert.rejects(requestProductionApi({service:'main', path:'/requests', method:'GET'}, fakeFetch), /Unable to connect to the Online Students ID Replacement System\. Please check your internet connection and try again\./);
});
test('non-2xx JSON error becomes normal Error message', async () => {
  const fakeFetch = async () => ({ok:false, status:403, json:async()=>({error:'Access denied.'})});
  await assert.rejects(requestProductionApi({service:'main', path:'/requests', method:'GET'}, fakeFetch), /Access denied\./);
});
