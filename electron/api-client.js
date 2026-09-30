'use strict';
const { normalizeApiRequest } = require('./security');
const ENDPOINTS = Object.freeze({
  main: 'https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-api',
  documents: 'https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-documents',
  'staff-login': 'https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-staff-login'
});
const CONNECTION_ERROR = 'Unable to connect to the Online Students ID Replacement System. Please check your internet connection and try again.';
function endpointFor(service) {
  const endpoint = ENDPOINTS[service];
  if (!endpoint) throw new Error('Invalid API service.');
  return endpoint;
}
async function requestProductionApi(input, fetchImpl = globalThis.fetch) {
  const req = normalizeApiRequest(input);
  const url = endpointFor(req.service) + req.path;
  const headers = { 'Content-Type': 'application/json' };
  if (req.token) headers.Authorization = `Bearer ${req.token}`;
  const init = { method: req.method, headers };
  if (req.body !== undefined && req.method !== 'GET') init.body = JSON.stringify(req.body);
  let response;
  try { response = await fetchImpl(url, init); } catch { throw new Error(CONNECTION_ERROR); }
  let data = {};
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}).`);
  return data;
}
module.exports = { ENDPOINTS, CONNECTION_ERROR, endpointFor, requestProductionApi };
