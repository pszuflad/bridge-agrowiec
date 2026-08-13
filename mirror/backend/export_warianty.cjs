const D=require('better-sqlite3');
const db=new D('/home/admin/private_apps/bridge/data.db',{readonly:true});
const rows = db.prepare("SELECT bieznik, marka, dostawca, rozmiar, COUNT(*) c FROM products WHERE bieznik IS NOT NULL AND bieznik<>'' GROUP BY bieznik, marka ORDER BY marka, bieznik").all();

// licznik pozycji per (bieznik,marka) i przykladowe rozmiary/dostawcy
const info = {}; // key marka||bieznik -> {count, rozmiary:Set, dostawcy:Set}
for(const r of rows){
  const k = (r.marka||'?')+'||'+r.bieznik;
  if(!info[k]) info[k]={marka:r.marka||'?', bieznik:r.bieznik, count:0, rozmiary:new Set(), dostawcy:new Set()};
  info[k].count += r.c;
  if(r.rozmiar) info[k].rozmiary.add(r.rozmiar);
  if(r.dostawca) info[k].dostawcy.add(r.dostawca);
}
// pelne dane per bieznik: dolicz wszystkie pozycje (nie tylko z group powyzej bo rozmiar rozbija)
const cnt2 = db.prepare("SELECT bieznik,marka,COUNT(*) c FROM products WHERE bieznik IS NOT NULL AND bieznik<>'' GROUP BY bieznik,marka").all();
const realCount={}; for(const r of cnt2) realCount[(r.marka||'?')+'||'+r.bieznik]=r.c;

// === GRUPOWANIE ===
// Klucz normalizacyjny: marka + zredukowana forma (usun spacje/myslniki, zera wiodace w segmentach num)
function normKey(s){ return s.toUpperCase().replace(/[\s\-]+/g,'').replace(/([A-Z])0+(\d)/g,'$1$2'); }
// TYP A: te same po normKey
const grpA={};
for(const k in info){
  const v=info[k];
  const nk = v.marka+'##'+normKey(v.bieznik);
  (grpA[nk]=grpA[nk]||[]).push(v);
}
// TYP B: krotki jest prefiksem dluzszego (ta sama marka) - grupuj po najkrotszym prefiksie
const allByMarka={};
for(const k in info){ const v=info[k]; (allByMarka[v.marka]=allByMarka[v.marka]||[]).push(v); }

const outA=[]; // grupy separatorowe (>1 wariant)
for(const nk in grpA){
  const arr = grpA[nk];
  const uniqB = [...new Set(arr.map(x=>x.bieznik))];
  if(uniqB.length>1){
    outA.push({typ:'A-separator', marka:arr[0].marka, warianty:arr.map(x=>({b:x.bieznik,c:realCount[x.marka+'||'+x.bieznik]||x.count,r:[...x.rozmiary].slice(0,3).join(', ')}))});
  }
}
// TYP B: dla kazdej marki znajdz pary prefiks
const outB=[];
const seenB=new Set();
for(const marka in allByMarka){
  const list = allByMarka[marka];
  const names = [...new Set(list.map(x=>x.bieznik))];
  // grupuj: dla kazdej krotkiej nazwy zbierz dluzsze zaczynajace sie od "krotka "
  for(const short of names){
    if(!/^[A-Z0-9][A-Z0-9\-\s]*$/i.test(short)) continue;
    const longs = names.filter(n=>n!==short && n.startsWith(short+' '));
    if(longs.length>0){
      const key=marka+'##'+short;
      if(seenB.has(key)) continue; seenB.add(key);
      const members=[short,...longs];
      outB.push({typ:'B-prefiks', marka, warianty:members.map(b=>{
        const v=info[marka+'||'+b];
        return {b, c:realCount[marka+'||'+b]||0, r:v?[...v.rozmiary].slice(0,3).join(', '):''};
      })});
    }
  }
}
console.log('TYP A grup:', outA.length, '| TYP B grup:', outB.length);
require('fs').writeFileSync('/home/admin/private_apps/bridge/warianty_export.json', JSON.stringify({A:outA,B:outB},null,1));
console.log('zapisano warianty_export.json');
