'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const invoke=async(channel,value)=>{const result=await ipcRenderer.invoke(channel,value);if(!result.ok)throw Error(result.error);return result.value;};
contextBridge.exposeInMainWorld('desktopApi',Object.freeze({
  request:input=>invoke('desktop:api-request',input),
  requestCaptcha:()=>invoke('desktop:request-captcha'),
  openSignedDocument:url=>invoke('desktop:open-signed-document',url)
}));
window.addEventListener('dragover',event=>event.preventDefault());
window.addEventListener('drop',event=>event.preventDefault());
