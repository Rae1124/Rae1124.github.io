'use strict';
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
function mainWindowOptions({packaged=false}={}){return {title:'Online Students ID Replacement System',width:1280,height:800,minWidth:960,minHeight:640,show:false,backgroundColor:'#f4f7fb',icon:path.join(ROOT,'build','icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:!packaged,webviewTag:false,allowRunningInsecureContent:false}}}
function captchaWindowOptions(){return {title:'Human Verification',width:430,height:520,minWidth:390,minHeight:480,resizable:false,modal:true,show:false,autoHideMenuBar:true,backgroundColor:'#f4f7fb',icon:path.join(ROOT,'build','icon.ico'),webPreferences:{preload:path.join(__dirname,'captcha-preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false,webviewTag:false,allowRunningInsecureContent:false}}}
module.exports={mainWindowOptions,captchaWindowOptions};
