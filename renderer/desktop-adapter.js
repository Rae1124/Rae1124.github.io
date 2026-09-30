(function(){
  const PRODUCT_NAME='Online Students ID Replacement System';
  const ENDPOINTS=[
    ['https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-api','main'],
    ['https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-documents','documents'],
    ['https://rpaaagfgyauqeyrqollr.supabase.co/functions/v1/id-system-staff-login','staff-login'],
  ];

  function applyBranding(){
    const title=document.querySelector('.topbar h1');
    if(title) title.textContent=PRODUCT_NAME;
    const hero=document.querySelector('.hero h1');
    if(hero) hero.textContent=PRODUCT_NAME;
    const footer=document.querySelector('.footer');
    if(footer) footer.textContent=PRODUCT_NAME;
  }
  function parseEndpoint(raw){
    for(const [prefix,service] of ENDPOINTS){
      if(raw===prefix)return {service,path:''};
      if(raw.startsWith(prefix+'/')||raw.startsWith(prefix+'?'))return {service,path:raw.slice(prefix.length)};
    }
    throw new Error('Desktop blocked an unapproved network destination.');
  }
  function readHeader(headers,name){
    if(!headers)return '';
    if(typeof headers.get==='function')return headers.get(name)||headers.get(name.toLowerCase())||'';
    const key=Object.keys(headers).find(k=>k.toLowerCase()===name.toLowerCase());
    return key?String(headers[key]):'';
  }
  if(window.desktopApi){
    window.fetch=async function(input,init={}){
      const raw=typeof input==='string'?input:(input&&input.url);
      if(typeof raw!=='string')throw new Error('Desktop blocked an invalid network request.');
      const target=parseEndpoint(raw);
      const method=String(init.method||'GET').toUpperCase();
      const authorization=readHeader(init.headers,'Authorization');
      const token=authorization.startsWith('Bearer ')?authorization.slice(7):'';
      let body;
      if(init.body!=null){if(typeof init.body!=='string')throw new Error('Desktop API requests must use JSON bodies.');body=JSON.parse(init.body)}
      const result=await window.desktopApi.request({service:target.service,path:target.path,method,body,token});
      return {ok:Boolean(result.ok),status:Number(result.status)||0,json:async()=>result.data||{},text:async()=>JSON.stringify(result.data||{})};
    };
    window.open=function(url){window.desktopApi.openSignedDocument(String(url)).catch(()=>{});return null};
  }
  new MutationObserver(()=>requestAnimationFrame(applyBranding)).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',applyBranding);
})();
