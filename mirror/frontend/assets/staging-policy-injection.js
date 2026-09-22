/* Bridge staging policy v2: explicit review, without accepting a product. */
(()=>{
  'use strict';
  if(window.__bridgeStagingPolicyUI)return;
  window.__bridgeStagingPolicyUI=true;
  const base='/panel/api/staging',nativeFetch=window.fetch.bind(window);
  const css=document.createElement('style');
  css.textContent=`
  .bs-review-btn{border:1px solid #b7791f;border-radius:6px;padding:5px 9px;margin:4px;font:500 12px inherit;color:#92400e;background:#fffbeb;cursor:pointer}
  .bs-dialog{box-sizing:border-box;margin:auto;width:min(650px,calc(100vw - 24px));max-height:85vh;overflow:auto;border:1px solid #cbd5e1;border-radius:12px;padding:24px;background:#fff;color:#172033;box-shadow:0 15px 70px #0005;font:14px/1.55 Inter,Arial,sans-serif}
  .bs-dialog::backdrop{background:#0f172a99}.bs-dialog h2{font-size:21px;font-weight:650;margin:0 0 12px}.bs-dialog p{margin:10px 0;overflow-wrap:anywhere}
  .bs-dialog label{display:flex;gap:10px;align-items:flex-start;border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin:10px 0;cursor:pointer;overflow-wrap:anywhere}
  .bs-dialog input{margin-top:5px;flex-shrink:0}.bs-dialog footer{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;flex-wrap:wrap}
  .bs-dialog button{border:1px solid #94a3b8;border-radius:6px;padding:8px 14px;cursor:pointer}.bs-dialog button.bs-save{background:#b77721;color:white;border-color:#b77721}.bs-dialog button:disabled{opacity:.5;cursor:default}
  .bs-dialog .bs-error{color:#b91c1c}.dark .bs-dialog{background:#172033;color:#f8fafc}.dark .bs-dialog label{border-color:#64748b}.dark .bs-review-btn{background:#332514;color:#fcd58b}`;
  document.head.append(css);
  function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
  function headers(){
    const h={'Content-Type':'application/json'};
    try{const store=localStorage.getItem('bridge_remember')==='1'?localStorage:sessionStorage;const t=store.getItem('bridge_auth_token');if(t)h.Authorization='Bearer '+t;}catch{}
    return h;
  }
  function dialog(title){
    document.querySelector('.bs-dialog')?.remove();
    const d=el('dialog',null,'bs-dialog');d.setAttribute('aria-label',title);d.append(el('h2',title));
    d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();return d;
  }
  function notice(message){
    const d=dialog('Nie zapisano zmian');d.append(el('p',message));
    const f=el('footer'),b=el('button','Zamknij');b.onclick=()=>d.close();f.append(b);d.append(f);
  }
  // Existing bulk acceptance must visibly explain why nothing was saved.
  window.fetch=async(...args)=>{
    const response=await nativeFetch(...args);
    const url=typeof args[0]==='string'?args[0]:args[0]?.url||'';
    if(/\/api\/staging\/accept(?:\?|$)/.test(url)&&!response.ok){
      response.clone().json().then(v=>notice(v.message||v.error||'Odśwież staging i spróbuj ponownie.')).catch(()=>{});
    }
    return response;
  };
  async function api(url,options={}){
    const r=await nativeFetch(url,{credentials:'include',headers:headers(),...options});
    const v=await r.json();if(!r.ok)throw Error(v.message||v.error||'Nie udało się zapisać decyzji.');return v;
  }
  async function review(id){
    const d=dialog('Sprawdź dopasowanie opony'),loading=el('p','Wczytywanie…');d.append(loading);
    try{
      const v=await api(`${base}/${id}/review`);if(!d.isConnected)return;loading.remove();
      d.append(el('p',v.nazwa),el('p','Dane dostawcy: '+[v.incoming.marka,v.incoming.model,v.incoming.rozmiar,v.incoming.dot&&'DOT '+v.incoming.dot,'EAN '+(v.incoming.ean||'brak')].filter(Boolean).join(' · ')));
      d.append(el('p',v.matchIssue||v.powod));
      const f=el('footer'),close=el('button','Zamknij');close.onclick=()=>d.close();f.append(close);
      if(v.matchIssue&&!v.duplicateSource){
        d.append(el('p','Wybierz świadomie właściwą oponę lub osobny produkt. Zapisanie wyboru nie zatwierdza jeszcze produktu w katalogu.'));
        const form=el('div');let choice=null;
        const save=el('button','Zapisz wybór','bs-save');save.disabled=true;
        function option(value,label){const l=el('label'),r=el('input');r.type='radio';r.name='bs-target';r.value=value;r.onchange=()=>{choice=value;save.disabled=false;};l.append(r,el('span',label));form.append(l);}
        for(const c of v.candidates)option(c.kod,`${c.kod}: ${c.nazwa} · ${c.rozmiar||'brak rozmiaru'} · DOT ${c.dot||'brak'}`);
        option('__new__','To osobna opona. Przygotuj ją jako nowy produkt.');
        d.append(form);
        if(v.eanIssue)d.append(el('p','EAN nadal wymaga poprawy w edycji zgłoszenia.','bs-error'));
        const error=el('p',null,'bs-error');error.setAttribute('role','alert');d.append(error);
        save.onclick=async()=>{
          save.disabled=true;close.disabled=true;
          try{await api(`${base}/${id}/resolve`,{method:'POST',body:JSON.stringify({action:choice==='__new__'?'new':'link',targetCode:choice==='__new__'?undefined:choice})});location.reload();}
          catch(e){error.textContent=e.message;save.disabled=false;close.disabled=false;}
        };
        f.append(save);
      }else if(v.duplicateSource)d.append(el('p','Nie wybieramy automatycznie jednego z różnych wierszy. Trzeba sprawdzić i poprawić cennik dostawcy.'));
      d.append(f);
    }catch(e){loading.textContent=e.message;const close=el('button','Zamknij');close.onclick=()=>d.close();d.append(close);}
  }
  let queued=false;
  function scan(){
    queued=false;
    for(const row of document.querySelectorAll('tr[data-testid^="row-staging-"]')){
      if(row.querySelector('.bs-review-btn'))continue;
      if(!/Sprawdź dopasowanie|Wybierz właściwą oponę|Wymaga sprawdzenia pliku/.test(row.textContent))continue;
      const id=Number(row.dataset.testid.replace('row-staging-',''));if(!Number.isFinite(id))continue;
      const b=el('button','Rozstrzygnij','bs-review-btn');b.type='button';b.onclick=e=>{e.stopPropagation();review(id);};
      row.lastElementChild?.append(b);
    }
  }
  new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(scan);}}).observe(document.body,{childList:true,subtree:true});
  scan();
})();
