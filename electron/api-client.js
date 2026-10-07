'use strict';
const { PROJECT_ORIGIN, SERVICES, normalizeApiRequest } = require('./security');
const CONNECTION_ERROR =
  'Unable to connect to the Student ID Replacement System. Please check your internet connection and try again.';
async function requestProductionApi(input, fetchImpl = fetch) {
  const q = normalizeApiRequest(input);
  const headers = { 'Content-Type': 'application/json' };
  if (q.token) headers.Authorization = 'Bearer ' + q.token;
  let response;
  try {
    response = await fetchImpl(`${PROJECT_ORIGIN}/functions/v1/${SERVICES[q.service]}${q.path}`, {
      method: q.method,
      headers,
      body: q.body === undefined ? undefined : JSON.stringify(q.body),
      redirect: 'error',
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw Error(CONNECTION_ERROR);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error('The server returned an invalid response. Please try again.');
  }
  if (!response.ok)
    throw Error(typeof data?.error === 'string' ? data.error : 'Request failed. Please try again.');
  if (!data || typeof data !== 'object')
    throw Error('The server returned an invalid response. Please try again.');
  return data;
}
module.exports = { requestProductionApi, CONNECTION_ERROR };
