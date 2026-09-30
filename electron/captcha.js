'use strict';
const { captchaWindowOptions } = require('./window-options');
const CAPTCHA_URL = 'https://rae1124.github.io/desktop-captcha.html';
let activeChallenge = null;
function isValidCaptchaToken(value) { return typeof value === 'string' && value.length >= 20 && value.length <= 4096 && !/[\s\x00-\x1f\x7f]/.test(value); }
function openCaptchaChallenge(parentWindow) {
  if (activeChallenge) return Promise.reject(new Error('Human verification is already open.'));
  const { BrowserWindow, ipcMain } = require('electron');
  return new Promise((resolve,reject)=>{
    const win = new BrowserWindow({...captchaWindowOptions(), parent:parentWindow});
    activeChallenge = win;
    let settled = false;
    const finish=(fn,value)=>{if(settled)return;settled=true;ipcMain.removeListener('captcha:complete',onComplete);ipcMain.removeListener('captcha:cancel',onCancel);if(activeChallenge===win)activeChallenge=null;if(!win.isDestroyed())win.close();fn(value);};
    const senderMatches=event=>event.sender?.id===win.webContents.id;
    const onComplete=(event,token)=>{if(!senderMatches(event))return;if(!isValidCaptchaToken(token))return finish(reject,new Error('Human verification returned an invalid token.'));finish(resolve,token);};
    const onCancel=event=>{if(senderMatches(event))finish(reject,new Error('Human verification was cancelled.'));};
    ipcMain.on('captcha:complete',onComplete);ipcMain.on('captcha:cancel',onCancel);
    win.webContents.on('will-navigate',(event,url)=>{if(url!==CAPTCHA_URL)event.preventDefault();});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-attach-webview',event=>event.preventDefault());
    win.webContents.on('did-fail-load',()=>finish(reject,new Error('Human verification could not load. Check your internet connection and try again.')));
    win.once('ready-to-show',()=>win.show());
    win.on('closed',()=>{if(!settled)finish(reject,new Error('Human verification was cancelled.'));});
    win.loadURL(CAPTCHA_URL);
  });
}
module.exports = { CAPTCHA_URL, isValidCaptchaToken, openCaptchaChallenge };
