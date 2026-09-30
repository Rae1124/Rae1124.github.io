(function(){
  if (!window.desktopApi) return;
  const originalFetch = window.fetch.bind(window);
  const API='https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-api';
  const DOC_API='https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-documents';
  const STAFF_LOGIN_API='https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-staff-login';
  function mapUrl(url){
    const s=String(url);
    if(s.startsWith(API)) return {service:'main',path:s.slice(API.length)};
    if(s.startsWith(DOC_API)) return {service:'documents',path:s.slice(DOC_API.length)};
    if(s===STAFF_LOGIN_API) return {service:'staff-login',path:''};
    return null;
  }
  function headersObject(headers){
    if(!headers) return {};
    if(headers instanceof Headers) return Object.fromEntries(headers.entries());
    return {...headers};
  }
  window.fetch=async function(url,opt={}){
    const mapped=mapUrl(url);
    if(!mapped) return originalFetch(url,opt);
    const headers=headersObject(opt.headers);
    const auth=headers.Authorization||headers.authorization||'';
    const token=auth.startsWith('Bearer ')?auth.slice(7):'';
    let body;
    if(typeof opt.body==='string'&&opt.body){try{body=JSON.parse(opt.body)}catch{throw new Error('Invalid request body.')}}
    const data=await window.desktopApi.request({service:mapped.service,path:mapped.path,method:opt.method||'GET',body,token});
    return {ok:true,status:200,json:async()=>data};
  };
  window.open=function(url){window.desktopApi.openSignedDocument(String(url));return null};
})();
