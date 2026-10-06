const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto,pbkdf2Sync}=require('node:crypto');
const salt=Buffer.from('login-test-salt');
const hash='pbkdf2$210000$'+salt.toString('base64')+'$'+pbkdf2Sync('Password123',salt,210000,32,'sha256').toString('base64');

function backend(name,role,options={}) {
 const user={id:'test-user',role,active:options.active!==false,username:'test.user',email:'test@example.test',password_hash:hash};
 const sessions=[];let handler,verified=0;
 const db={from(table){
  const q={select(){return q},or(){return q},eq(){return q},limit(){return q},
   async maybeSingle(){return {data:options.missing?null:user}},
   async insert(row){if(table==='sessions')sessions.push(row);return {error:null}}};return q;
 }};
 const shared=fs.readFileSync('supabase/functions/_shared/data-security.ts','utf8').replace(/^export /gm,'');
 const source=shared+'\n'+fs.readFileSync('supabase/functions/'+name+'/index.ts','utf8').replace(/^import .*;\n/gm,'');
 const context={createClient:()=>db,Deno:{env:{get:key=>key==='TURNSTILE_SECRET_KEY'?'test-only-key':'test'},serve:fn=>handler=fn},
  Response,Request,URL,URLSearchParams,TextEncoder,Uint8Array,crypto:webcrypto,atob,btoa,console,
  fetch:async()=>{verified++;return {json:async()=>({success:options.captcha!==false,hostname:options.hostname||'rae1124.github.io',action:'staff_login'})}}};
 vm.runInNewContext(stripTypeScriptTypes(source),context);
 return {sessions,get verified(){return verified},async login(body){
  const req=new Request('https://example.test/'+name+(name==='id-system-api'?'/auth/login':''),{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://rae1124.github.io'},body:JSON.stringify({identifier:'test.user',password:'Password123',...body})});
  const response=await handler(req);return {status:response.status,data:await response.json()};
 }};
}
test('main login identifies a student without a client-selected portal',async()=>{
 const b=backend('id-system-api','student');const r=await b.login({});
 assert.equal(r.status,200);assert.equal(r.data.user.role,'student');assert.ok(r.data.token);assert.equal(b.sessions.length,1);
 assert.equal(r.data.user.password_hash,undefined);
});
for(const role of ['registrar','idoffice','admin']) {
 test('main login requires verification before issuing a '+role+' session, including legacy requests',async()=>{
  for(const body of [{},{portal:role},{portal:'student'}]) {
   const b=backend('id-system-api',role);const r=await b.login(body);
   assert.equal(b.sessions.length,0,'staff must never get a session through the student endpoint');
   assert.equal(r.data.token,undefined);
   if(body.portal!=='student'){assert.equal(r.status,200);assert.equal(r.data.requiresCaptcha,true);}
  }
 });
 test('verified staff login infers '+role+' and returns its stored role',async()=>{
  const b=backend('id-system-staff-login',role);const r=await b.login({captchaToken:'token'});
  assert.equal(r.status,200);assert.equal(r.data.user.role,role);assert.ok(r.data.token);assert.equal(b.verified,1);assert.equal(b.sessions.length,1);
 });
}
test('incorrect passwords and inactive accounts cannot progress to verification or get sessions',async()=>{
 for(const [options,body,status] of [[{}, {password:'wrong'},401],[{active:false},{},403],[{missing:true},{},401]]) {
  const b=backend('id-system-api','registrar',options);const r=await b.login(body);
  assert.equal(r.status,status);assert.equal(r.data.requiresCaptcha,undefined);assert.equal(b.sessions.length,0);
 }
});
test('staff sessions require a token verified for the correct hostname',async()=>{
 for(const [options,body] of [[{},{}],[{captcha:false},{captchaToken:'bad'}],[{hostname:'attacker.example'},{captchaToken:'bad'}]]) {
  const b=backend('id-system-staff-login','admin',options);const r=await b.login(body);
  assert.ok(r.status>=400);assert.equal(b.sessions.length,0);
 }
});
test('legacy staff portal cannot override the account role',async()=>{
 const b=backend('id-system-staff-login','registrar');const r=await b.login({portal:'admin',captchaToken:'token'});
 assert.equal(r.status,403);assert.equal(b.sessions.length,0);
});
