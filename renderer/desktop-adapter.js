(function(){
  const PRODUCT_NAME='Online Students ID Replacement System';
  function applyBranding(){
    const title=document.querySelector('.topbar h1');
    if(title) title.textContent=PRODUCT_NAME;
    const hero=document.querySelector('.hero h1');
    if(hero) hero.textContent=PRODUCT_NAME;
    const footer=document.querySelector('.footer');
    if(footer) footer.textContent=PRODUCT_NAME;
  }
  new MutationObserver(()=>requestAnimationFrame(applyBranding)).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',applyBranding);
})();
