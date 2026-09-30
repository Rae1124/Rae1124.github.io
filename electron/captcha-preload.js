'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('captchaBridge',Object.freeze({
  complete:(token)=>ipcRenderer.send('desktop:captcha-complete',token),
  cancel:()=>ipcRenderer.send('desktop:captcha-cancel'),
}));
