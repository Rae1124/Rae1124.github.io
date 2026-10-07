'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'captchaBridge',
  Object.freeze({
    complete: (token) => ipcRenderer.send('captcha:complete', token),
    cancel: () => ipcRenderer.send('captcha:cancel'),
  }),
);
