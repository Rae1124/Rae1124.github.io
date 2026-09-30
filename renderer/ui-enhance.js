(function(){
  const navIcons={
    'Dashboard':'⌂',
    'Applications':'▣',
    'Apply for ID':'＋',
    'My Applications':'▤',
    'Notifications':'◉',
    'All Requests':'▤',
    'Users':'♙',
    'Activity Logs':'≡'
  };
  const subtitles={
    'Applications':'Review and process student ID replacement requests.',
    'My Applications':'Track your submitted replacement requests and supporting files.',
    'Student Dashboard':'View your student information and replacement activity.',
    'Registrar Dashboard':'Review incoming applications and monitor request progress.',
    'ID Office Dashboard':'Process approved requests from preparation through issuance.',
    'Administrator Dashboard':'Monitor users, requests, and system activity.',
    'User Management':'Create and manage authorized school personnel accounts.',
    'Activity Logs':'Review important account, security, and application activity.',
    'Apply for ID Replacement':'Submit the required information and documents for your replacement ID.',
    'Notifications':'Stay updated on changes to your replacement request.'
  };
  function slug(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
  function enhance(){
    document.querySelectorAll('.side button[data-v]').forEach(btn=>{
      if(btn.querySelector('.navIcon')) return;
      const text=btn.textContent.trim();
      const icon=document.createElement('span');
      icon.className='navIcon'; icon.textContent=navIcons[text]||'•';
      const label=document.createElement('span'); label.className='navLabel'; label.textContent=text;
      btn.textContent=''; btn.append(icon,label);
    });
    document.querySelectorAll('.badge').forEach(b=>{
      [...b.classList].filter(c=>c.startsWith('status-')).forEach(c=>b.classList.remove(c));
      b.classList.add('status-'+slug(b.textContent));
    });
    const content=document.getElementById('content');
    if(content){
      const h2=content.querySelector(':scope > h2, :scope > .sectionHead h2');
      if(h2 && !content.querySelector('.pageSubtitle')){
        const text=h2.textContent.trim();
        const sub=document.createElement('p');
        sub.className='pageSubtitle';
        sub.textContent=subtitles[text]||'Manage information and actions for this section.';
        if(h2.parentElement && h2.parentElement.classList.contains('sectionHead')) h2.parentElement.insertAdjacentElement('afterend',sub);
        else h2.insertAdjacentElement('afterend',sub);
      }
      content.querySelectorAll('.panel').forEach(p=>{if(p.querySelector('table'))p.classList.add('tablePanel')});
    }
    const top=document.querySelector('.topbar');
    if(top && !top.querySelector('.brandMark')){
      const first=top.firstElementChild;
      if(first){
        first.classList.add('brandCopy');
        const mark=document.createElement('div'); mark.className='brandMark'; mark.textContent='ID';
        top.insertBefore(mark,first);
      }
    }
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(enhance));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',enhance);
  enhance();
})();