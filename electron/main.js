'use strict';
const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { mainWindowOptions } = require('./window-options');
const { requestProductionApi } = require('./api-client');
const { isApprovedSignedDocumentUrl } = require('./security');
const APP_ID = 'ph.sjc.online-students-id-replacement-system';
let mainWindow = null;
function senderIsMain(event) { return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender?.id === mainWindow.webContents.id); }
function hardenMainWindow(win) {
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
  win.webContents.on('will-attach-webview', event => event.preventDefault());
}
function registerIpc() {
  ipcMain.handle('desktop:api-request', async (event,input) => { if(!senderIsMain(event)) throw new Error('Unauthorized IPC sender.'); return requestProductionApi(input); });
  ipcMain.handle('desktop:open-signed-document', async (event,url) => { if(!senderIsMain(event)) throw new Error('Unauthorized IPC sender.'); if(!isApprovedSignedDocumentUrl(url)) throw new Error('Blocked unapproved document URL.'); await shell.openExternal(url); return true; });
}
function createMainWindow() {
  const win = new BrowserWindow(mainWindowOptions({packaged:app.isPackaged}));
  mainWindow = win;
  hardenMainWindow(win);
  win.once('ready-to-show',()=>win.show());
  win.on('closed',()=>{if(mainWindow===win) mainWindow=null;});
  win.loadFile(path.join(__dirname,'..','renderer','index.html'));
  return win;
}
app.whenReady().then(()=>{ app.setAppUserModelId(APP_ID); registerIpc(); createMainWindow(); app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0) createMainWindow();}); });
app.on('window-all-closed',()=>{if(process.platform!=='darwin') app.quit();});
module.exports = { APP_ID, hardenMainWindow, createMainWindow };
