'use strict';
// Staging policy v2, 2026-09-22. Shared by the adapter, importer and acceptance.
const crypto = require('node:crypto');
const norm = v => String(v ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const KEYS = ['rozmiar','indeksNosnosci','indeksPredkosci','model','marka','nazwa','kodDostawcy'];
const LABEL = {rozmiar:'rozmiar',indeksNosnosci:'nośność',indeksPredkosci:'prędkość',model:'model',marka:'marka',nazwa:'nazwa',kodDostawcy:'kod dostawcy'};
const OPTIONAL = ['indeksNosnosci','indeksPredkosci','pr','tlTt','vfIf','konstrukcja','dot'];
function validateEan(value, lossy = false) {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return {raw, value:null, valid:null, error:null, status:'empty'};
  const fail = error => ({raw,value:null,valid:false,error,status:'invalid'});
  if (lossy || /[eE][+-]?\d/.test(raw)) return fail('zapis naukowy lub utracone cyfry; potrzebny pełny numer');
  // Never strip letters, take a substring, round or manufacture a candidate.
  const digits=raw.replace(/\s/g,'');
  if (!/^\d+$/.test(digits)) return fail('numer zawiera znaki inne niż cyfry');
  if (![8,12,13,14].includes(digits.length)) return fail('nieprawidłowa liczba cyfr');
  if (/^0+$/.test(digits)) return fail('numer składa się z samych zer');
  let sum=0,weight=3;
  for(let i=digits.length-2;i>=0;i--){sum+=Number(digits[i])*weight;weight=weight===3?1:3;}
  if ((10-sum%10)%10!==Number(digits.at(-1))) return fail('nieprawidłowa cyfra kontrolna');
  return {raw,value:digits,valid:true,error:null,status:'ok'};
}
function rawEan(record) {
  if (record.eanRaw !== undefined && record.eanRaw !== null) return record.eanRaw;
  if (record.ean_raw !== undefined && record.ean_raw !== null) return record.ean_raw;
  const raw=record.surowe_pola || {};
  if(raw.ean_raw !== undefined && raw.ean_raw !== null) return raw.ean_raw;
  const key=Object.keys(raw).find(k=>/^(ean|ean\s*code|eanCode)$/i.test(k));
  if(key) return raw[key];
  if(Array.isArray(raw.row)) return raw.row[1]; // Bohnenkamp
  return record.ean && typeof record.ean==='object' ? record.ean.value : record.ean;
}
function identity(r) {
  const core=['marka','model','rozmiar',...OPTIONAL].map(k=>norm(r[k]));
  // Keep a stable descriptive fallback when the supplier omits essential fields.
  if(!r.marka || !r.model || !r.rozmiar) core.push(norm(r.nazwa));
  return core;
}
function syntheticCode(supplier,r) {
  return `${supplier}_AUTO_${hash(identity(r)).slice(0,18).toUpperCase()}`;
}
function compatibility(a,b) {
  const missing=[],different=[];
  for(const k of ['marka','model','rozmiar']){
    if(!norm(a[k]) || !norm(b[k]) || ['UNKNOWN','—','-'].includes(norm(a[k])) || ['UNKNOWN','—','-'].includes(norm(b[k]))) missing.push(k);
    else if(norm(a[k])!==norm(b[k])) different.push(k);
  }
  for(const k of OPTIONAL){
    // DOT distinguishes batches even when one of them has no explicit DOT.
    if(norm(a[k])!==norm(b[k])) {
      if(!norm(a[k])||!norm(b[k]))missing.push(k);else different.push(k);
    }
  }
  return {ok:!missing.length&&!different.length,missing,different};
}
function version(p) {
  return p ? hash([p.id,...KEYS.map(k=>p[k]??null),p.ean,p.cenaZakupu,p.cenaSprzedazy,p.stan,p.status,p.dataAktualizacji]) : null;
}
function sourceKey(supplier,r) {
  return hash([supplier,r._kodSynthetic?'':r.kod,identity(r),String(rawEan(r)??'')]);
}
function fail(message) { const e=new Error(message);e.status=409;throw e; }
function install({U,db,normalize,classify,badName,ext}) {
  db.exec('CREATE TABLE IF NOT EXISTS staging_matches(supplier TEXT NOT NULL,source_key TEXT NOT NULL,product_code TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(supplier,source_key))');
  const original={add:U.addStaging.bind(U),accept:U.acceptStaging.bind(U),edit:U.updateStaging.bind(U)};
  const clear=db.prepare('DELETE FROM staging_items WHERE dostawca=? AND kod=?');
  const aliases=db.prepare('SELECT product_code FROM staging_matches WHERE supplier=? AND source_key=?');
  const find = code => U.getProductByKod(code);
  // Acceptance also assigns a cross-warehouse group used by name memory.
  // That second matching path must not undo the strict staging decision.
  ext.assignKodImportu=(database,product,existing)=>{
    const retained=existing?.kodImportu??existing?.kod_importu;
    if(retained&&/^\d{6}$/.test(String(retained))){product.kodImportu=String(retained);return;}
    const ev=validateEan(product.ean);
    const compatible=U.listProducts().filter(p=>
      p.kod!==product.kod && compatibility(product,p).ok &&
      (ev.valid ? p.ean===ev.value : !p.ean&&norm(p.nazwa)===norm(product.nazwa)));
    const groups=new Set(compatible.map(p=>String(p.kodImportu??'')).filter(v=>/^\d{6}$/.test(v)));
    if(groups.size===1){product.kodImportu=[...groups][0];return;}
    for(let n=0;n<100000;n++){
      const code=String(crypto.randomInt(100000,1000000));
      if(!database.prepare('SELECT 1 FROM products WHERE kod_importu=? LIMIT 1').get(code)){
        product.kodImportu=code;return;
      }
    }
    throw Error('Brak wolnych numerów grup produktów');
  };
  const protect = (supplier,r,code) => {
    const d={...r};
    for(const o of U.getOverridesFor(supplier,code)) d[o.fieldName]=o.overrideValue;
    return d;
  };
  U.addStaging = row => db.transaction(()=>{
    // Fresh id invalidates old browser selections. Never retain the old snapshot.
    clear.run(row.dostawca,row.kod);
    return original.add(row);
  })();
  U.updateStaging=(id,patch)=>{
    const row=U.getStaging(id);
    if(row && patch.snapshotJson){
      const snap=JSON.parse(patch.snapshotJson);
      const old=JSON.parse(row.snapshotJson||'{}');
      if(snap.ean!==old.ean || (patch.edytowanePola && JSON.parse(patch.edytowanePola).includes('ean'))){
        const v=validateEan(snap.ean);
        snap.eanRaw=v.raw;snap.eanIsValid=v.valid===null?null:Number(v.valid);
        snap.eanSourceStatus=v.status;snap._eanIssue=v.error;
        patch={...patch,eanRaw:v.raw,eanIsValid:snap.eanIsValid,eanSourceStatus:v.status,snapshotJson:JSON.stringify(snap)};
      }
    }
    return original.edit(id,patch);
  };
  function checkAcceptance(id) {
    const row=U.getStaging(id);
    if(!row) fail('Zgłoszenie zostało już zastąpione lub usunięte. Odśwież staging.');
    const snap=JSON.parse(row.snapshotJson||'{}'),current=find(row.kod);
    if(!snap._policyVersion) fail('To zgłoszenie pochodzi ze starego importu. Odśwież cennik przed akceptacją.');
    if(snap._matchIssue && !snap._resolution) fail('Najpierw rozstrzygnij dopasowanie opony przyciskiem „Rozstrzygnij”.');
    const ev=validateEan(snap.eanRaw ?? snap.ean);
    if(row.typZmiany!=='wycofana' && (snap._eanIssue || ev.error)) fail('Błędny EAN: popraw numer w edycji zgłoszenia przed akceptacją.');
    if(snap._catalogVersion!==version(current)) fail('Produkt zmienił się po utworzeniu zgłoszenia. Wczytaj aktualny cennik; stare dane nie zostały zapisane.');
    return {row,snap,current};
  }
  U.checkStagingAcceptance=checkAcceptance;
  U.acceptStaging=(id,user)=>db.transaction(()=>{
    const {row,snap,current}=checkAcceptance(id);
    if(row.typZmiany==='wycofana'){original.accept(id,user);clear.run(row.dostawca,row.kod);return;}
    let safe=protect(row.dostawca,snap,row.kod);
    const ev=validateEan(safe.ean);
    if(ev.error) fail('Zapis został zatrzymany: nieprawidłowy EAN.');
    if(!ev.value && current?.ean) safe.ean=current.ean;
    const sv=validateEan(safe.ean);
    safe.ean=sv.value;safe.eanIsValid=sv.valid===null?null:Number(sv.valid);
    safe.eanRaw=sv.raw;safe.eanSourceStatus=sv.status;
    original.edit(id,{snapshotJson:JSON.stringify(safe),nazwa:safe.nazwa||row.nazwa,
      cenaZakupuNowa:safe.cenaZakupu??row.cenaZakupuNowa,stanNowy:safe.stan??row.stanNowy,magazyn:safe.magazyn??row.magazyn,
      eanRaw:sv.raw,eanIsValid:safe.eanIsValid,eanSourceStatus:sv.status});
    original.accept(id,user);
    clear.run(row.dostawca,row.kod);
    if(snap._resolution && snap._sourceKey) db.prepare('INSERT INTO staging_matches(supplier,source_key,product_code,created_at) VALUES(?,?,?,?) ON CONFLICT(supplier,source_key) DO UPDATE SET product_code=excluded.product_code,created_at=excluded.created_at')
      .run(row.dostawca,snap._sourceKey,row.kod,new Date().toISOString());
  })();
  U.resolveStaging=(id,action,targetCode)=>{
    const row=U.getStaging(id);if(!row)fail('Zgłoszenie już nie istnieje.');
    const snap=JSON.parse(row.snapshotJson||'{}');
    if(!snap._matchIssue) fail('To zgłoszenie nie wymaga rozstrzygnięcia dopasowania.');
    if(snap._duplicateSource) fail('Dostawca przesłał sprzeczne wiersze pod tym samym kodem. Najpierw popraw plik źródłowy.');
    let current=null,code=row.kod;
    if(action==='link'){
      current=find(targetCode);
      if(!current || current.dostawca!==row.dostawca || !(snap._candidates||[]).some(p=>p.kod===current.kod)) fail('Wybierz produkt z listy kandydatów tego dostawcy.');
      code=current.kod;
    }else if(action==='new'){
      if(find(code)) code=syntheticCode(row.dostawca,snap);
      if(find(code)) fail('Produkt z takim oznaczeniem już istnieje. Wybierz właściwe dopasowanie.');
    }else fail('Nieprawidłowa decyzja.');
    const safe=protect(row.dostawca,snap,code);
    safe._resolution=action;safe._catalogVersion=version(current);
    const result=db.transaction(()=>{
      clear.run(row.dostawca,row.kod);
      return U.addStaging({...row,id:undefined,kod:code,typZmiany:safe._eanIssue?'blad':current?'zmiana_kluczowa':'nowa',
        powod:`Ręcznie rozstrzygnięto: ${action==='link'?'połącz z '+code:'dodaj osobny produkt'}`+(safe._eanIssue?' • Błędny EAN: '+safe._eanIssue:''),
        snapshotJson:JSON.stringify(safe),utworzono:new Date().toISOString()});
    })();
    return result;
  };
  function importer(supplier,incoming,options={}) {
    if(!Array.isArray(incoming)) throw new Error('Nieprawidłowy cennik');
    const time=new Date().toISOString(),products=U.listProducts().filter(p=>p.dostawca===supplier);
    const byCode=new Map(products.map(p=>[String(p.kod),p])),byEan=new Map();
    for(const p of products){const ev=validateEan(p.ean);if(ev.valid){if(!byEan.has(ev.value))byEan.set(ev.value,[]);byEan.get(ev.value).push(p);}}
    const stats={doStagingu:0,odrzuconeNieOpony:0,odrzuconeBrakDanych:0,odrzuconeSmieciMO2:0,nowe:0,zmienione:0,wycofane:0,bezZmian:0,autoZatwierdzone:0,szczegolyOdrzuconych:[]};
    const observed=new Set(),prepared=new Map(),oldQueue=new Map(U.listStaging().filter(s=>s.dostawca===supplier).map(s=>[s.kod,s]));
    for(const raw of incoming){
      if(supplier==='MO2' && /^999991$/.test(String(raw.kod||'').replace(/^MO2_/,'')) && (!raw.ean||!raw.marka||(/^\d/.test(raw.marka)&&!/[A-Za-z]{3,}/.test(raw.marka)))){stats.odrzuconeSmieciMO2++;continue;}
      const classification=classify(raw.nazwa||'',raw.kategoria);
      if(!classification.isTire){stats.odrzuconeNieOpony++;stats.szczegolyOdrzuconych.push({nazwa:raw.nazwa,powod:'nie opona ('+classification.reason+')'});continue;}
      const source={...raw},ev=validateEan(rawEan(raw),raw.ean_lossy||raw._eanLossy);
      let d=normalize({...raw,ean:null}).poz; // sizes/parameters only; strict EAN handled here
      Object.assign(d,{ean:ev.value,eanRaw:ev.raw,eanIsValid:ev.valid===null?null:Number(ev.valid),eanSourceStatus:ev.status,eanCandidates:null});
      let code=String(raw.kod||''),key=sourceKey(supplier,source),current=null,matchIssue=null,candidates=[];
      const remembered=aliases.get(supplier,key);
      if(remembered) current=byCode.get(remembered.product_code)||null;
      const synthetic=raw._kodSynthetic || !code || code.includes('_AUTO_') || (ev.value && code.replace(new RegExp('^'+supplier+'_'),'')===ev.value);
      if(!current && code && !synthetic) current=byCode.get(code)||null;
      if(!current && synthetic && code && byCode.has(code)){
        const p=byCode.get(code);if(compatibility(d,p).ok)current=p;
      }
      if(!current && ev.valid){
        candidates=byEan.get(ev.value)||[];
        const exact=candidates.filter(p=>compatibility(d,p).ok);
        if(exact.length===1) current=exact[0];
        else if(candidates.length) matchIssue=exact.length>1?'Kilka zgodnych produktów z tym EAN. Wybierz właściwą oponę.':'Ten EAN występuje w katalogu, ale cechy są inne lub niepełne. Sprawdź dopasowanie.';
      }
      if(!current && !code) code=syntheticCode(supplier,d);
      if(!current && byCode.has(code)){candidates=[byCode.get(code)];code=syntheticCode(supplier,d);matchIssue='Oznaczenie wskazuje inną oponę. Sprawdź dopasowanie.';}
      if(current){
        code=current.kod;observed.add(current.id);
        // Names deliberately unified by the user have the same protection as
        // individual manual overrides, but only after safe product matching.
        d.kodImportu=current.kodImportu;
        ext.applyNazwaPamiec(db,d);
        d=protect(supplier,d,code);
      }
      // A candidate under review must not be incorrectly marked withdrawn.
      if(matchIssue)for(const p of candidates)observed.add(p.id);
      d.kod=code;
      if(!d.ean && current?.ean) d.ean=current.ean;
      const errors=[];
      if(ev.error)errors.push(`Błędny EAN „${ev.raw}”: ${ev.error}. Numer nie zostanie zapisany.`);
      const nameError=badName(d.nazwa||'');if(nameError)errors.push('Błędny zapis nazwy: '+nameError);
      if(!d.rozmiar)errors.push('Nie wykryto rozmiaru opony.');
      if(!raw.kod && !ev.valid)errors.push('Brak kodu dostawcy i poprawnego EAN.');
      if(matchIssue)errors.push(matchIssue);
      const changes=current?KEYS.filter(k=>norm(current[k])!==norm(d[k])).map(k=>`${LABEL[k]}: ${current[k]??'brak'} → ${d[k]??'brak'}`):[];
      Object.assign(d,{_policyVersion:2,_sourceKey:key,_catalogVersion:version(current),_eanIssue:ev.error,
        _matchIssue:matchIssue,_candidates:candidates.map(p=>({kod:p.kod,nazwa:p.nazwa,marka:p.marka,model:p.model,rozmiar:p.rozmiar,dot:p.dot,ean:p.ean}))});
      const item={code,current,d,errors,changes,source};
      const previous=prepared.get(code);
      if(previous && (previous.d._duplicateSource || hash([identity(previous.d),previous.d.ean,previous.d.cenaZakupu,previous.d.stan])!==hash([identity(d),d.ean,d.cenaZakupu,d.stan]))){
        item.errors.push('Kilka różnych pozycji dostawcy wskazuje tę samą oponę. Wymaga sprawdzenia pliku.');
        d._matchIssue='Sprzeczne pozycje w jednym cenniku';d._duplicateSource=true;
      }
      prepared.set(code,item);
    }
    function stage({code,current,d,errors,changes},type){
      d._catalogVersion=version(current ? find(current.kod) : null);
      const p=current;
      U.addStaging({typZmiany:type,kod:code,nazwa:d.nazwa||p?.nazwa||'',dostawca:supplier,magazyn:d.magazyn||p?.magazyn||supplier,magazynRaw:d.magazynRaw??null,
        stanStary:p?.stan??null,stanNowy:d.stan??p?.stan??0,cenaZakupuStara:p?.cenaZakupu??null,cenaZakupuNowa:d.cenaZakupu??p?.cenaZakupu??0,
        cenaSprzedazyNowa:d.cenaSprzedazy??null,zmianaPct:p?.cenaZakupu>0?((d.cenaZakupu??p.cenaZakupu)-p.cenaZakupu)/p.cenaZakupu*100:null,
        powod:[...changes,...errors].join(' • ')||(p?'Zmiana danych':'Nowa pozycja w cenniku'),ostrzezenie:errors.join(' • ')||null,
        snapshotJson:JSON.stringify(d),eanRaw:d.eanRaw??null,eanIsValid:d.eanIsValid??null,eanSourceStatus:d.eanSourceStatus??null,eanCandidates:null,edytowanePola:null,utworzono:time});
      stats.doStagingu++;if(p)stats.zmienione++;else stats.nowe++;
    }
    return db.transaction(()=>{
      for(const old of oldQueue.values()){
        if(!prepared.has(old.kod) && old.typZmiany!=='wycofana')clear.run(supplier,old.kod);
      }
      for(const item of prepared.values()){
        const {code,current,d,errors,changes}=item;
        if(current && current.nieobecnoscPodRzad>0 && !options.reconcileOnly) U.updateProduct(current.id,{nieobecnoscPodRzad:0});
        if(!current || errors.length || changes.length){stage(item,errors.length?'blad':current?'zmiana_kluczowa':'nowa');continue;}
        // Resolved/absent differences clear ALL obsolete cases, including withdrawal.
        clear.run(supplier,code);
        const patch={};
        for(const k of ['cenaZakupu','cenaSprzedazy','marzaPct','stan','magazyn']){
          if(d[k]!=null && norm(d[k])!==norm(current[k]))patch[k]=d[k];
        }
        if(validateEan(d.ean).valid && d.ean!==current.ean)Object.assign(patch,{ean:d.ean,eanRaw:d.eanRaw,eanIsValid:1,eanSourceStatus:'ok'});
        if(Object.keys(patch).length && !options.reconcileOnly){
          patch.dataAktualizacji=time;
          ext.applyDims(patch,current.rozmiar);ext.applyLinkMemory(db,patch,current);
          U.updateProduct(current.id,patch);stats.autoZatwierdzone++;
          db.prepare('INSERT INTO historia_cen(produkt_id,kod,ean,dostawca,marka,model,rozmiar,indeks_nosnosci,indeks_predkosci,kategoria,cena_zakupu,cena_sprzedazy,stan,zarejestrowano_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(current.id,current.kod,d.ean,supplier,current.marka,current.model,current.rozmiar,current.indeksNosnosci,current.indeksPredkosci,current.kategoria,patch.cenaZakupu??current.cenaZakupu,patch.cenaSprzedazy??current.cenaSprzedazy,patch.stan??current.stan,time);
        }else stats.bezZmian++;
      }
      for(const p of products){
        if(observed.has(p.id)) {
          // Candidate ambiguity keeps its own error, not an old withdrawal.
          if(!prepared.has(p.kod) && oldQueue.get(p.kod)?.typZmiany==='wycofana')clear.run(supplier,p.kod);
          continue;
        }
        const count=(p.nieobecnoscPodRzad||0)+1;
        const old=oldQueue.get(p.kod);
        if((options.reconcileOnly && old?.typZmiany==='wycofana')||(!options.reconcileOnly && count>=3)){
          const snap={...p,_policyVersion:2,_catalogVersion:version(find(p.kod)),_withdrawal:true};
          U.addStaging({typZmiany:'wycofana',kod:p.kod,nazwa:p.nazwa,dostawca:supplier,magazyn:p.magazyn,stanStary:p.stan,stanNowy:0,cenaZakupuStara:p.cenaZakupu,cenaZakupuNowa:null,powod:'Brak w cenniku — pozycja wycofana',snapshotJson:JSON.stringify(snap),utworzono:time});
          stats.wycofane++;stats.doStagingu++;
          if(!options.reconcileOnly)U.updateProduct(p.id,{nieobecnoscPodRzad:0});
        }else if(!options.reconcileOnly)U.updateProduct(p.id,{nieobecnoscPodRzad:count});
      }
      return stats;
    })();
  }
  importer.policyVersion=2;
  return importer;
}
function registerRoutes(app,{U,we,be}) {
  app.get('/api/staging/:id/review',we,(req,res)=>{
    const row=U.getStaging(Number(req.params.id));
    if(!row)return res.status(404).json({message:'Zgłoszenie zostało zastąpione. Odśwież staging.'});
    const snap=JSON.parse(row.snapshotJson||'{}');
    res.json({id:row.id,kod:row.kod,nazwa:row.nazwa,powod:row.powod,matchIssue:snap._matchIssue||null,
      duplicateSource:!!snap._duplicateSource,eanIssue:snap._eanIssue||null,
      incoming:{marka:snap.marka,model:snap.model,rozmiar:snap.rozmiar,dot:snap.dot,ean:snap.eanRaw??snap.ean},
      candidates:snap._candidates||[]});
  });
  app.post('/api/staging/:id/resolve',we,(req,res)=>{
    try{
      const row=U.resolveStaging(Number(req.params.id),req.body?.action,req.body?.targetCode);
      be(req.user.id,req.user.imieNazwisko,'rozstrzygniecie_stagingu','staging',String(req.params.id),{action:req.body.action,kod:row.kod});
      res.json({ok:true,id:row.id,kod:row.kod});
    }catch(e){res.status(e.status||500).json({message:e.message});}
  });
}
module.exports={validateEan,rawEan,syntheticCode,compatibility,identity,norm,version,install,registerRoutes};
