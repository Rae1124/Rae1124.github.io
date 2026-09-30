'use strict';
const {app,BrowserWindow,ipcMain,shell,session}=require('electron');
const path=require('node:path');const {pathToFileURL}=require('node:url');
const {mainWindowOptions,hardenWindow}=require('./window-options');
const {requestProductionApi}=require('./api-client');
const {isApprovedSignedDocumentUrl}=require('./security');
const {registerHandler}=require('./ipc');
const rendererPath=path.join(__dirname,'../renderer/index.html');
const rendererUrl=pathToFileURL(rendererPath).href;
let mainWindow;
app.setName('Online Students ID Replacement System');
app.setAppUserModelId('ph.school.online-students-id-replacement');
function createMainWindow(){
 mainWindow=new BrowserWindow(mainWindowOptions({packaged:app.isPackaged}));
 hardenWindow(mainWindow,url=>shell.openExternal(url));
 const ses=mainWindow.webContents.session;
 ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 ses.setPermissionCheckHandler(()=>false);
 ses.on('will-download',event=>event.preventDefault());
 mainWindow.on('closed',()=>{mainWindow=null;});
 void mainWindow.loadFile(rendererPath);
}
app.whenReady().then(()=>{
 registerHandler(ipcMain,'desktop:api-request',()=>mainWindow,rendererUrl,requestProductionApi);
 registerHandler(ipcMain,'desktop:open-signed-document',()=>mainWindow,rendererUrl,async url=>{
  if(!isApprovedSignedDocumentUrl(url))throw Error('This document URL is not approved.');
  await shell.openExternal(url);return true;
 });
 registerHandler(ipcMain,'desktop:request-captcha',()=>mainWindow,rendererUrl,async()=>{
  const {openCaptchaChallenge}=require('./captcha');return openCaptchaChallenge(mainWindow,{BrowserWindow,ipcMain,session});
 });
 createMainWindow();
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createMainWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
