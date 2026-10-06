'use strict';
const {randomUUID}=require('node:crypto');
const {CAPTCHA_URL}=require('./security');
const {captchaWindowOptions}=require('./window-options');
const {assertTrustedSender}=require('./ipc');
let activeChallenge=null;
function isValidCaptchaToken(value){return typeof value==='string'&&value.length>0&&value.length<=2048&&/^[A-Za-z0-9_.-]+$/.test(value);}
function isCaptchaResourceAllowed(value){try{const u=new URL(value);return !u.username&&!u.password&&!u.hash&&(value===CAPTCHA_URL||(u.origin==='https://challenges.cloudflare.com'&&u.pathname.startsWith('/')));}catch{return false;}}
function openCaptchaChallenge(parentWindow,{BrowserWindow,ipcMain,session}){
 if(activeChallenge)return Promise.reject(Error('A verification window is already open.'));
 const partition='captcha-'+randomUUID();const isolatedSession=session.fromPartition(partition);
 isolatedSession.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));isolatedSession.setPermissionCheckHandler(()=>false);
 isolatedSession.webRequest.onBeforeRequest((details,cb)=>cb({cancel:!isCaptchaResourceAllowed(details.url)}));
 const win=new BrowserWindow({...captchaWindowOptions(),parent:parentWindow||undefined,webPreferences:{...captchaWindowOptions().webPreferences,session:isolatedSession}});
 activeChallenge=win;
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error,token)=>{
   if(settled)return;settled=true;clearTimeout(timeout);
   ipcMain.removeListener('captcha:complete',complete);ipcMain.removeListener('captcha:cancel',cancel);
   activeChallenge=null;
   if(!win.isDestroyed())win.close();
   void isolatedSession.clearStorageData().catch(()=>{});void isolatedSession.clearCache().catch(()=>{});
   if(error)reject(error);else resolve(token);
  };
  const trusted=event=>{try{assertTrustedSender(event,win,CAPTCHA_URL);return true;}catch{return false;}};
  const complete=(event,token)=>{if(!trusted(event))return;if(!isValidCaptchaToken(token))return finish(Error('Invalid verification response. Please try again.'));finish(null,token);};
  const cancel=event=>{if(trusted(event))finish(Error('Verification cancelled. Please try again.'));};
  const timeout=setTimeout(()=>finish(Error('Verification timed out. Please try again.')),180000);timeout.unref?.();
  ipcMain.on('captcha:complete',complete);ipcMain.on('captcha:cancel',cancel);
  win.once('closed',()=>finish(Error('Verification cancelled. Please try again.')));
  win.webContents.on('will-navigate',(event,url)=>{if(url!==CAPTCHA_URL)event.preventDefault();});
  win.webContents.on('will-redirect',(event,url)=>{if(url!==CAPTCHA_URL)event.preventDefault();});
  win.webContents.on('will-frame-navigate',event=>{if(!isCaptchaResourceAllowed(event.url)||(event.isMainFrame&&event.url!==CAPTCHA_URL))event.preventDefault();});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('render-process-gone',()=>finish(Error('Verification window closed unexpectedly. Please try again.')));
  void win.loadURL(CAPTCHA_URL).catch(()=>finish(Error('Unable to load staff verification. Check your internet connection and try again.')));
 });
}
module.exports={CAPTCHA_URL,isValidCaptchaToken,isCaptchaResourceAllowed,openCaptchaChallenge};
