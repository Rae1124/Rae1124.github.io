'use strict';

const PROJECT_HOST = 'rpaaagfgyauqeyrqollr.supabase.co';
const CAPTCHA_HOST = 'rae1124.github.io';
const BUCKET = 'student-id-files';
const ALLOWED_SERVICES = new Set(['main', 'documents', 'staff-login']);
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT']);
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function parseHttps(value) {
  if (typeof value !== 'string' || value.length > 8192) return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url : null; } catch { return null; }
}
function isApprovedSignedDocumentUrl(value) {
  const url = parseHttps(value);
  if (!url || url.hostname !== PROJECT_HOST) return false;
  return url.pathname.startsWith(`/storage/v1/object/sign/${BUCKET}/`);
}
function isApprovedExternalUrl(value) {
  const url = parseHttps(value);
  if (!url) return false;
  if (url.hostname === CAPTCHA_HOST && url.pathname === '/desktop-captcha.html') return true;
  return isApprovedSignedDocumentUrl(value);
}
function normalizeApiRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid API request.');
  const service = String(input.service || '');
  if (!ALLOWED_SERVICES.has(service)) throw new Error('Invalid API service.');
  const method = String(input.method || 'GET').toUpperCase();
  if (!ALLOWED_METHODS.has(method)) throw new Error('Invalid API method.');
  const path = input.path == null ? '' : String(input.path);
  if (path.length > 2048 || /^(?:[a-z]+:)?\/\//i.test(path) || path.includes('\\') || path.includes('\0')) throw new Error('Invalid API path.');
  if (service === 'main' && path && !path.startsWith('/')) throw new Error('Invalid API path.');
  if (service === 'documents' && path && !(path.startsWith('?') || path.startsWith('/'))) throw new Error('Invalid API path.');
  if (service === 'staff-login' && path) throw new Error('Invalid API path.');
  const body = input.body;
  if (body !== undefined) {
    let encoded;
    try { encoded = JSON.stringify(body); } catch { throw new Error('Invalid API body.'); }
    if (encoded === undefined || Buffer.byteLength(encoded, 'utf8') > MAX_BODY_BYTES) throw new Error('Invalid API body.');
  }
  const token = input.token == null ? '' : String(input.token);
  if (token.length > 4096 || /[\r\n]/.test(token)) throw new Error('Invalid bearer token.');
  return { service, path, method, body, token };
}
module.exports = { PROJECT_HOST, CAPTCHA_HOST, BUCKET, MAX_BODY_BYTES, isApprovedExternalUrl, isApprovedSignedDocumentUrl, normalizeApiRequest };
