'use strict';
const path = require('node:path');
const PRODUCT_NAME = 'Online Students ID Replacement System';
function mainWindowOptions({packaged=false}={}) {
  return { width:1380, height:860, minWidth:980, minHeight:640, show:false, title:PRODUCT_NAME, backgroundColor:'#f4f7fb', icon:path.join(__dirname,'..','build','icon.ico'), webPreferences:{ preload:path.join(__dirname,'preload.js'), nodeIntegration:false, contextIsolation:true, sandbox:true, devTools:!packaged, webSecurity:true } };
}
function captchaWindowOptions() {
  return { width:430, height:420, resizable:false, minimizable:false, maximizable:false, modal:true, show:false, title:'Human Verification', backgroundColor:'#ffffff', webPreferences:{ preload:path.join(__dirname,'captcha-preload.js'), nodeIntegration:false, contextIsolation:true, sandbox:true, devTools:false, webSecurity:true } };
}
module.exports = { PRODUCT_NAME, mainWindowOptions, captchaWindowOptions };
