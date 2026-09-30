const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {mainWindowOptions,captchaWindowOptions}=require('../electron/window-options');
const {normalizeApiRequest,isApprovedSignedDocumentUrl}=require('../electron/security');

test('main BrowserWindow options use hardened Electron webPreferences',()=>{const dev=mainWindowOptions({packaged:false});assert.equal(dev.title,'Online Students ID Replacement System');assert.equal(dev.webPreferences.nodeIntegration,false);assert.equal(dev.webPreferences.contextIsolation,true);assert.equal(dev.webPreferences.sandbox,true);assert.equal(dev.webPreferences.devTools,true);assert.ok(dev.webPreferences.preload.endsWith(path.join('electron','preload.js')));const prod=mainWindowOptions({packaged:true});assert.equal(prod.webPreferences.devTools,false)});

test('CAPTCHA BrowserWindow options are isolated and use the dedicated preload',()=>{const opts=captchaWindowOptions();assert.equal(opts.webPreferences.nodeIntegration,false);assert.equal(opts.webPreferences.contextIsolation,true);assert.equal(opts.webPreferences.sandbox,true);assert.equal(opts.webPreferences.devTools,false);assert.ok(opts.webPreferences.preload.endsWith(path.join('electron','captcha-preload.js')));assert.equal(opts.modal,true)});

test('malformed IPC-shaped inputs are rejected before external effects',()=>{assert.throws(()=>normalizeApiRequest({service:'unknown',path:'/x',method:'GET'}),/service/i);assert.throws(()=>normalizeApiRequest({service:'main',path:'https://evil.example/',method:'GET'}),/path/i);assert.equal(isApprovedSignedDocumentUrl(42),false);assert.equal(isApprovedSignedDocumentUrl('https://evil.example/file.pdf'),false)});
