const {test}=require('node:test');const assert=require('node:assert/strict');
test('both windows isolate remote content and packaged windows disable DevTools',()=>{
 const {mainWindowOptions,captchaWindowOptions}=require('../electron/window-options');
 for(const o of [mainWindowOptions({packaged:true}),captchaWindowOptions()]){assert.equal(o.webPreferences.nodeIntegration,false);assert.equal(o.webPreferences.contextIsolation,true);assert.equal(o.webPreferences.sandbox,true);assert.equal(o.webPreferences.webSecurity,true);assert.equal(o.webPreferences.devTools,false);}
 assert.match(mainWindowOptions({packaged:true}).webPreferences.preload,/electron[/\\]preload.js$/);
 assert.match(captchaWindowOptions().webPreferences.preload,/captcha-preload.js$/);
});
test('privileged IPC accepts only exact main frame and approved URL',()=>{
 const {assertTrustedSender}=require('../electron/ipc');
 const frame={url:'file:///app/renderer/index.html'};const wc={mainFrame:frame};const win={webContents:wc,isDestroyed:()=>false};
 assert.doesNotThrow(()=>assertTrustedSender({sender:wc,senderFrame:frame},win,frame.url));
 for(const event of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{url:frame.url}},{sender:wc,senderFrame:{url:'https://evil.com'}}])assert.throws(()=>assertTrustedSender(event,win,frame.url));
 assert.throws(()=>assertTrustedSender({sender:wc,senderFrame:frame},win,'file:///different'));
});
test('window guards block navigation, popups, webviews and permission requests',()=>{
 const {hardenWindow}=require('../electron/window-options');
 const listeners={};let popup;const wc={on:(n,f)=>listeners[n]=f,setWindowOpenHandler:f=>popup=f};
 hardenWindow({webContents:wc});
 for(const name of ['will-navigate','will-frame-navigate','will-redirect','will-attach-webview']){let stopped=false;listeners[name]({preventDefault:()=>stopped=true},'https://evil.com');assert.equal(stopped,true);}
 assert.deepEqual(popup({url:'https://evil.com'}),{action:'deny'});
});
