'use strict';
const path=require('node:path');
const {isApprovedExternalUrl}=require('./security');
const preferences={nodeIntegration:false,nodeIntegrationInWorker:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false};
function mainWindowOptions({packaged=false}={}){return {width:1280,height:850,minWidth:800,minHeight:620,title:'Online Students ID Replacement System',icon:path.join(__dirname,'../build/icon.ico'),autoHideMenuBar:true,backgroundColor:'#f3f7fc',webPreferences:{...preferences,devTools:!packaged,preload:path.join(__dirname,'preload.js'),partition:'persist:student-id-desktop'}};}
function captchaWindowOptions(){return {width:480,height:440,resizable:false,modal:true,autoHideMenuBar:true,title:'Staff Security Verification',webPreferences:{...preferences,devTools:false,preload:path.join(__dirname,'captcha-preload.js')}};}
function hardenWindow(window,openExternal=async()=>{}){
 const wc=window.webContents;
 for(const name of ['will-navigate','will-frame-navigate','will-redirect','will-attach-webview'])wc.on(name,event=>event.preventDefault());
 wc.setWindowOpenHandler(({url})=>{if(isApprovedExternalUrl(url))void openExternal(url).catch(()=>{});return {action:'deny'};});
}
module.exports={mainWindowOptions,captchaWindowOptions,hardenWindow};
