'use strict';

const PROJECT_HOST = 'rpaaagfgyauqeyrqollr.supabase.co';
const CAPTCHA_HOST = 'rae1124.github.io';
const ALLOWED_SERVICES = new Set(['main','documents','staff-login']);
const ALLOWED_METHODS = new Set(['GET','POST','PUT']);
const MAX_TOKEN_LENGTH = 2048;
const MAX_PATH_LENGTH = 2048;
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function safeUrl(value){
  if(typeof value !== 'string' || value.length < 1 || value.length > 8192) return null;
  try { return new URL(value); } catch { return null; }
}

function isApprovedExternalUrl(value){
  const url = safeUrl(value);
  return !!url && url.protocol === 'https:' && url.hostname === CAPTCHA_HOST;
}

function isApprovedSignedDocumentUrl(value){
  const url = safeUrl(value);
  if(!url || url.protocol !== 'https:' || url.hostname !== PROJECT_HOST) return false;
  return url.pathname.startsWith('/storage/v1/object/sign/student-id-files/');
}

function validatePath(path){
  if(typeof path !== 'string' || path.length > MAX_PATH_LENGTH) throw new Error('Invalid API path.');
  if(path.includes('://') || path.includes('\\') || path.includes('\r') || path.includes('\n') || path.includes('..')) throw new Error('Invalid API path.');
  if(path !== '' && !path.startsWith('/') && !path.startsWith('?')) throw new Error('Invalid API path.');
  return path;
}

function validateBody(body){
  if(body === undefined || body === null) return body;
  let encoded;
  try { encoded = JSON.stringify(body); } catch { throw new Error('Invalid API body.'); }
  if(encoded === undefined) throw new Error('Invalid API body.');
  if(Buffer.byteLength(encoded, 'utf8') > MAX_BODY_BYTES) throw new Error('API body is too large.');
  return body;
}

function normalizeApiRequest(input){
  if(!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid API request.');
  const service = String(input.service || '');
  if(!ALLOWED_SERVICES.has(service)) throw new Error('Invalid API service.');
  const method = String(input.method || 'GET').toUpperCase();
  if(!ALLOWED_METHODS.has(method)) throw new Error('Invalid API method.');
  const path = validatePath(input.path ?? '');
  const token = input.token == null ? '' : String(input.token);
  if(token.length > MAX_TOKEN_LENGTH || /[\r\n]/.test(token)) throw new Error('Invalid bearer token.');
  const body = validateBody(input.body);
  return {service, path, method, body, token};
}

module.exports = {PROJECT_HOST,CAPTCHA_HOST,MAX_BODY_BYTES,isApprovedExternalUrl,isApprovedSignedDocumentUrl,normalizeApiRequest};
