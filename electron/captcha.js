'use strict';
const {captchaWindowOptions}=require('./window-options');
const CAPTCHA_URL='https://rae1124.github.io/desktop-captcha.html';
let activePromise=null;

function isValidCaptchaToken(value){return typeof value==='string'&&value.length>=20&&value.length<=4096&&!/\s/.test(value)}

function openCaptchaChallenge(parentWindow,deps={}){
  if(activePromise)return activePromise;
  const electron=deps.electron||require('electron');
  const {BrowserWindow,ipcMain}=electron;
  activePromise=new Promise((resolve,reject)=>{
    let settled=false;
    const win=new BrowserWindow({...captchaWindowOptions(),parent:parentWindow});
    const finish=(fn,value,close=true)=>{
      if(settled)return;settled=true;
      ipcMain.removeListener('desktop:captcha-complete',onComplete);
      ipcMain.removeListener('desktop:captcha-cancel',onCancel);
      if(close&&!win.isDestroyed())win.close();
      fn(value);
    };
    const onComplete=(event,token)=>{
      if(event.sender!==win.webContents)return;
      if(!isValidCaptchaToken(token)){finish(reject,new Error('Human verification returned an invalid token.'));return}
      finish(resolve,token);
    };
    const onCancel=(event)=>{if(event.sender===win.webContents)finish(reject,new Error('Human verification was cancelled.'))};
    ipcMain.on('desktop:captcha-complete',onComplete);
    ipcMain.on('desktop:captcha-cancel',onCancel);
    win.webContents.on('will-navigate',(event,url)=>{if(url!==CAPTCHA_URL)event.preventDefault()});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
    win.webContents.on('did-fail-load',(_event,_code,_desc,url,isMainFrame)=>{if(isMainFrame&&url===CAPTCHA_URL)finish(reject,new Error('Human verification could not load. Check your connection and try again.'))});
    win.on('closed',()=>{if(!settled)finish(reject,new Error('Human verification was cancelled.'),false)});
    Promise.resolve(win.loadURL(CAPTCHA_URL)).then(()=>{if(!win.isDestroyed())win.show()}).catch(()=>finish(reject,new Error('Human verification could not load. Check your connection and try again.')));
  }).finally(()=>{activePromise=null});
  return activePromise;
}

module.exports={CAPTCHA_URL,isValidCaptchaToken,openCaptchaChallenge};
