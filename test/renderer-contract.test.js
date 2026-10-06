const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setImmediate(r));
async function page(bridge={},rememberedToken){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test',runScripts:'outside-only'});const w=dom.window;
 if(rememberedToken)w.localStorage.setItem('idrs_token',rememberedToken);w.desktopApi={request:async()=>({}),...bridge};w.alert=()=>{};w.eval(fs.readFileSync('renderer/app.js','utf8'));await tick();return dom;
}
test('desktop password and remark dialogs accept/cancel without browser prompt',async()=>{
 const dom=await page();const w=dom.window;
 const p=w.eval("desktopPrompt('Remark','default')");w.document.getElementById('desktopPromptInput').value='Reviewed';w.document.getElementById('desktopPromptForm').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(await p,'Reviewed');
 const q=w.eval("desktopPrompt('Temporary password','',true)");assert.equal(w.document.getElementById('desktopPromptInput').type,'password');w.document.getElementById('desktopPromptCancel').click();assert.equal(await q,null);dom.window.close();
});
test('offline application view shows connection error instead of permanent loading',async()=>{
 const message='Unable to connect to the Online Students ID Replacement System. Please check your internet connection and try again.';
 const dom=await page({request:async q=>{if(q.path==='/auth/login')return {token:'session',user:{role:'student',first_name:'Test',last_name:'Student'}};throw Error(message);}});const w=dom.window;
 w.document.getElementById('id').value='student';w.document.getElementById('pw').value='Password123';await w.document.getElementById('f').onsubmit({preventDefault(){}});
 const unhandled=[];const listener=e=>unhandled.push(e);process.on('unhandledRejection',listener);
 w.document.querySelector('[data-v="My Applications"]').click();await tick();
 process.off('unhandledRejection',listener);assert.match(w.document.getElementById('content').textContent,/Unable to connect/);dom.window.close();
});
test('Registrar can approve or reject an application under review',async()=>{
 const dom=await page({requestCaptcha:async()=>'token',request:async q=>{
 if(q.path==='/auth/login')return {requiresCaptcha:true};
 if(q.service==='staff-login')return {token:'session',user:{role:'registrar',first_name:'Test',last_name:'Registrar'}};
 if(q.path==='/requests')return {requests:[{id:'r1',application_no:'IDR-1',reason:'Lost ID',status:'Under Review',updated_at:'2026-09-30'}]};return {};
 }});const w=dom.window;
 w.document.getElementById('id').value='staff';w.document.getElementById('pw').value='Password123';await w.document.getElementById('f').onsubmit({preventDefault(){}});await w.document.getElementById('verifyHuman').onclick();await w.document.getElementById('f').onsubmit({preventDefault(){}});await tick();
 w.document.querySelector('[data-v="Applications"]').click();await tick();assert.ok(w.document.querySelector('[data-status="Approved"]'),'Approve missing');assert.ok(w.document.querySelector('[data-status="Rejected"]'),'Reject missing');assert.ok(w.document.querySelector('[data-status="Documents Required"]'));dom.window.close();
});

test('offline startup preserves remembered session and explains the connection failure',async()=>{
 const dom=await page({request:async()=>{throw Error('Unable to connect to the Online Students ID Replacement System. Please check your internet connection and try again.')}},'remembered');
 assert.equal(dom.window.localStorage.getItem('idrs_token'),'remembered');assert.match(dom.window.document.body.textContent,/Unable to connect/);dom.window.close();
});
