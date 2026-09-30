'use strict';
const path=require('node:path');
const {app,BrowserWindow,ipcMain,shell}=require('electron');
const {mainWindowOptions}=require('./window-options');
const {requestProductionApi}=require('./api-client');
const {isApprovedExternalUrl,isApprovedSignedDocumentUrl}=require('./security');
const {openCaptchaChallenge}=require('./captcha');

const APP_ID='ph.edu.studentid.replacement';
let mainWindow=null;

function isTrustedSender(event){
  return !!mainWindow && !mainWindow.isDestroyed() && event.sender===mainWindow.webContents;
}

function attachMainWindowGuards(win){
  win.webContents.on('will-navigate',(event)=>event.preventDefault());
  win.webContents.setWindowOpenHandler(({url})=>{
    if(isApprovedExternalUrl(url)) shell.openExternal(url).catch(()=>{});
    return {action:'deny'};
  });
  win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  win.webContents.on('before-input-event',(event,input)=>{
    if(app.isPackaged && (input.key==='F12' || (input.control && input.shift && String(input.key).toLowerCase()==='i'))) event.preventDefault();
  });
}

function registerIpc(){
  ipcMain.handle('desktop:api-request',async(event,input)=>{
    if(!isTrustedSender(event)) throw new Error('Untrusted IPC sender.');
    return requestProductionApi(input);
  });
  ipcMain.handle('desktop:captcha-request',async(event)=>{
    if(!isTrustedSender(event))throw new Error('Untrusted IPC sender.');
    return openCaptchaChallenge(mainWindow);
  });
  ipcMain.handle('desktop:open-signed-document',async(event,url)=>{
    if(!isTrustedSender(event)) throw new Error('Untrusted IPC sender.');
    if(!isApprovedSignedDocumentUrl(url)) throw new Error('Blocked document URL.');
    await shell.openExternal(url);
    return true;
  });
}

async function createMainWindow(){
  mainWindow=new BrowserWindow(mainWindowOptions({packaged:app.isPackaged}));
  attachMainWindowGuards(mainWindow);
  await mainWindow.loadFile(path.join(__dirname,'..','renderer','index.html'));
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  mainWindow.on('closed',()=>{mainWindow=null});
  return mainWindow;
}

app.setAppUserModelId(APP_ID);
app.whenReady().then(async()=>{
  registerIpc();
  await createMainWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createMainWindow()});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});

module.exports={APP_ID,attachMainWindowGuards,createMainWindow};
