const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mainWindowOptions, captchaWindowOptions } = require('../electron/window-options');
const { normalizeApiRequest, isApprovedSignedDocumentUrl } = require('../electron/security');
test('main BrowserWindow uses hardened renderer settings',()=>{const options=mainWindowOptions({packaged:true});assert.equal(options.title,'Online Students ID Replacement System');assert.equal(options.webPreferences.nodeIntegration,false);assert.equal(options.webPreferences.contextIsolation,true);assert.equal(options.webPreferences.sandbox,true);assert.equal(options.webPreferences.devTools,false);assert.equal(path.basename(options.webPreferences.preload),'preload.js');});
test('captcha BrowserWindow uses isolated dedicated preload',()=>{const options=captchaWindowOptions();assert.equal(options.webPreferences.nodeIntegration,false);assert.equal(options.webPreferences.contextIsolation,true);assert.equal(options.webPreferences.sandbox,true);assert.equal(path.basename(options.webPreferences.preload),'captcha-preload.js');assert.equal(options.modal,true);});
test('malformed IPC-facing inputs are rejected before external effects',()=>{assert.throws(()=>normalizeApiRequest({service:'unknown',path:'/x'}),/service/i);assert.throws(()=>normalizeApiRequest({service:'main',path:'https://evil.example/x'}),/path/i);assert.equal(isApprovedSignedDocumentUrl(123),false);assert.equal(isApprovedSignedDocumentUrl('https://example.com/a.pdf'),false);});
