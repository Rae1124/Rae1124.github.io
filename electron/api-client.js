'use strict';

const { normalizeApiRequest } = require('./security');
const API_BASE='https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/';
const SERVICE_MAP=Object.freeze({main:API_BASE+'id-system-api',documents:API_BASE+'id-system-documents','staff-login':API_BASE+'id-system-staff-login'});
const CONNECTION_ERROR='Unable to connect to the Online Students ID Replacement System. Please check your internet connection and try again.';

function serviceUrl(service){const value=SERVICE_MAP[service];if(!value)throw new Error('Invalid API service.');return value}
async function requestProductionApi(input,fetchImpl=globalThis.fetch){
  const request=normalizeApiRequest(input);
  const headers={'Content-Type':'application/json'};
  if(request.token)headers.Authorization='Bearer '+request.token;
  const init={method:request.method,headers};
  if(request.body!==undefined&&request.body!==null&&request.method!=='GET')init.body=JSON.stringify(request.body);
  let response;try{response=await fetchImpl(serviceUrl(request.service)+request.path,init)}catch{throw new Error(CONNECTION_ERROR)}
  let data={};try{const text=await response.text();data=text?JSON.parse(text):{}}catch{data={}}
  return {ok:Boolean(response.ok),status:Number(response.status)||0,data};
}
module.exports={API_BASE,SERVICE_MAP,CONNECTION_ERROR,serviceUrl,requestProductionApi};
