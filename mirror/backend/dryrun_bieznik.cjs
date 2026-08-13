const D = require('better-sqlite3');
const db = new D('/home/admin/private_apps/bridge/data.db', { readonly: true });
const rows = db.prepare("SELECT kod,dostawca,marka,model,bieznik,rozmiar,indeks_nosnosci,indeks_predkosci,indeksy,nazwa FROM products WHERE (bieznik IS NOT NULL AND bieznik<>'') OR (model IS NOT NULL AND model<>'')").all();

// KODY WYKLUCZONE - token wyglada jak indeks ale jest czescia nazwy modelu (nie ruszac)
const SKIP_KODS = new Set(['MO9_37266']); // RIDEMAX FL 693M - 693M czesc nazwy

function clean(val){
  if(!val) return val;
  let v = val;
  // 1) usun polskie NAPED / NAPĘD (jako oddzielne slowo, dowolna wielkosc)
  v = v.replace(/\s*\bNAP[ĘE]D\b\s*/gi, ' ');
  // 2) usun koncowe TL / TT (oddzielone slowo na koncu)
  v = v.replace(/\s+(TL|TT)\s*$/i, '');
  // 3) usun podwojny indeks nosnosci/predkosci: 158/150L, 156/152L, 133A8/145A8
  //    MUSI zawierac ukosnik - inaczej ryzyko zlapania nazwy
  v = v.replace(/\s*\b\d{2,3}[A-Z]?\d?\/\d{2,3}[A-Z]?\d?\b\s*/g, ' ');
  // 4) usun pojedynczy indeks: 160J, 173D (2-3 cyfry + 1 litera + opc. cyfra) - ale tylko gdy NIE jest czescia nazwy typu 100S/800R
  //    heurystyka: usuwamy tylko gdy litera to typowy symbol predkosci (A..E, F,G,J,K,L,M,N) ORAZ token jest na koncu lub przed innym oznaczeniem
  //    Zamiast tego: usuwamy pojedynczy indeks tylko gdy odpowiada wzorcowi indeksy w kolumnie
  // (obsluga nizej per-rekord)
  // porzadkowanie spacji
  v = v.replace(/\s{2,}/g, ' ').trim();
  return v;
}

// pojedynczy indeks - usuwamy tylko konkretne przypadki potwierdzone (CARGO 5 160J)
function cleanSingleIdx(val, indeksy){
  if(!val || !indeksy) return val;
  // token indeksu z kolumny indeksy (np "160J")
  const m = String(indeksy).match(/^(\d{2,3}[A-Z]\d?)$/);
  if(m){
    const tok = m[1];
    // usun ten token jesli wystepuje jako oddzielone slowo w val
    const re = new RegExp('\\s*\\b'+tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b\\s*','g');
    if(re.test(val)) return val.replace(re,' ').replace(/\s{2,}/g,' ').trim();
  }
  return val;
}

let changes=[], skipped=[];
for(const r of rows){
  if(SKIP_KODS.has(r.kod)){ continue; }
  let nb = clean(r.bieznik);
  let nm = clean(r.model);
  nb = cleanSingleIdx(nb, r.indeksy);
  nm = cleanSingleIdx(nm, r.indeksy);
  // ZABEZPIECZENIE 1: nigdy nie zostawiaj pustego jesli oryginal byl niepusty
  if(r.bieznik && !nb){ skipped.push({kod:r.kod,powod:'bieznik->pusty',old:r.bieznik}); continue; }
  if(r.model && !nm){ skipped.push({kod:r.kod,powod:'model->pusty',old:r.model}); continue; }
  // ZABEZPIECZENIE 2: pomijaj zmiany polegajace TYLKO na przycieciu spacji (poza zakresem zadania)
  const onlyTrim = (nb === (r.bieznik||'').replace(/\s+/g,' ').trim()) && (nm === (r.model||'').replace(/\s+/g,' ').trim()) && ((r.bieznik||'').replace(/\s{2,}/g,' ').trim()===nb) && !/NAP[ĘE]D|\d\/\d|\s(TL|TT)$/i.test((r.bieznik||'')+' '+(r.model||''));
  if(onlyTrim){ skipped.push({kod:r.kod,powod:'tylko-spacja',old:(r.bieznik||'')+'|'+(r.model||'')}); continue; }
  if(nb!==r.bieznik || nm!==r.model){
    changes.push({kod:r.kod,dostawca:r.dostawca, bieznik_old:r.bieznik, bieznik_new:nb, model_old:r.model, model_new:nm, nazwa:r.nazwa, indeksy:r.indeksy});
  }
}
console.log('=== DRY-RUN: zmian:', changes.length, '| pominietych:', skipped.length, '===\n');
console.log('POMINIETE (zabezpieczenia):', JSON.stringify(skipped,null,1));
// grupuj po typie
let types={naped:0, tlTt:0, dblIdx:0, singleIdx:0};
for(const c of changes){
  const o=(c.bieznik_old||'')+' '+(c.model_old||'');
  if(/NAP[ĘE]D/i.test(o)) types.naped++;
  if(/\s(TL|TT)\s*$/i.test(c.bieznik_old||'')||/\s(TL|TT)\s*$/i.test(c.model_old||'')) types.tlTt++;
  if(/\d{2,3}[A-Z]?\d?\/\d{2,3}/.test(o)) types.dblIdx++;
}
console.log('typy (przyblizone):', types);
console.log('\n=== WSZYSTKIE ZMIANY ===');
for(const c of changes)
  console.log(`[${c.dostawca}] ${c.kod}\n  bieznik: "${c.bieznik_old}" -> "${c.bieznik_new}"\n  model:   "${c.model_old}" -> "${c.model_new}"`);
require('fs').writeFileSync('/home/admin/private_apps/bridge/dryrun_bieznik.json', JSON.stringify(changes,null,1));
console.log('\nZapisano dryrun_bieznik.json');
