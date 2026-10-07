'use strict';
const PROJECT_ORIGIN = 'https://rpaaagfgyauqeyrqollr.supabase.co';
const CAPTCHA_URL = 'https://rae1124.github.io/desktop-captcha.html';
const SERVICES = Object.freeze({
  main: 'id-system-api',
  documents: 'id-system-documents',
  'staff-login': 'id-system-staff-login',
});
const MAX_BODY_BYTES = 8 * 1024 * 1024; // A 5 MiB upload expands to ~6.7 MiB base64.
function httpsUrl(value) {
  if (typeof value !== 'string' || value.length > 16384 || /[\s\\]/.test(value)) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.hash ? u : null;
  } catch {
    return null;
  }
}
function isApprovedSignedDocumentUrl(value) {
  const u = httpsUrl(value);
  return !!(
    u &&
    u.origin === PROJECT_ORIGIN &&
    /^\/storage\/v1\/object\/sign\/[^/]+\/.+/.test(u.pathname) &&
    u.searchParams.get('token')
  );
}
function isApprovedExternalUrl(value) {
  return value === 'https://rae1124.github.io/' || isApprovedSignedDocumentUrl(value);
}
function jsonValue(value, depth = 0) {
  if (depth > 30) throw Error('Request body is too deeply nested.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((v) => jsonValue(v, depth + 1));
    return;
  }
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    Object.values(value).forEach((v) => jsonValue(v, depth + 1));
    return;
  }
  throw Error('Request body must contain only JSON values.');
}
function normalizeApiRequest(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !Object.hasOwn(SERVICES, input.service)
  )
    throw Error('Unsupported API service.');
  const { service } = input;
  const path = input.path ?? '';
  const method = input.method ?? 'GET';
  const token = input.token ?? '';
  if (
    typeof path !== 'string' ||
    path.length > 2048 ||
    /[\\\s#]/.test(path) ||
    /%(?:2e|2f|5c|25|0[ad])/i.test(path) ||
    path.includes('..') ||
    (path && !/^(\/(?!\/)|\?)/.test(path))
  )
    throw Error('Invalid API path.');
  if (service === 'main' && !/^\/[a-zA-Z0-9/_-]+(?:\?[^#]*)?$/.test(path))
    throw Error('Invalid main API path.');
  if (service === 'documents' && path && !path.startsWith('?'))
    throw Error('Invalid document API path.');
  if (service === 'staff-login' && path !== '') throw Error('Invalid staff login path.');
  if (!['GET', 'POST', 'PUT'].includes(method)) throw Error('Unsupported API method.');
  if (typeof token !== 'string' || token.length > 8192 || /[\x00-\x20\x7f]/.test(token))
    throw Error('Invalid session token.');
  let body;
  if (input.body !== undefined) {
    if (method === 'GET') throw Error('GET requests cannot have a body.');
    jsonValue(input.body);
    body = JSON.parse(JSON.stringify(input.body));
    if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES)
      throw Error('Request body is too large.');
  }
  return { service, path, method, body, token };
}
module.exports = {
  PROJECT_ORIGIN,
  CAPTCHA_URL,
  SERVICES,
  MAX_BODY_BYTES,
  isApprovedSignedDocumentUrl,
  isApprovedExternalUrl,
  normalizeApiRequest,
};
