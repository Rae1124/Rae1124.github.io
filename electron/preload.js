'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopApi', Object.freeze({
  request: (input) => ipcRenderer.invoke('desktop:api-request', input),
  requestCaptcha: () => ipcRenderer.invoke('desktop:captcha-request'),
  openSignedDocument: (url) => ipcRenderer.invoke('desktop:open-signed-document', url),
}));
