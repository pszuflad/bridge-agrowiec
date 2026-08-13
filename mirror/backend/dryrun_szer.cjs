const D=require('better-sqlite3');
const db=new D('/home/admin/private_apps/bridge/data.db',{readonly:true});
const all = db.prepare("SELECT kod,dostawca,rozmiar,szerokosc,profil,srednica FROM products WHERE rozmiar IS NOT NULL AND rozmiar<>'' AND szerokosc IS NOT NULL").all();

// Docelowa szerokosc = szerokosc opony w ORYGINALNEJ jednostce z rozmiaru (bez przeliczania).
// Wyznaczamy wg notacji:
function targetWidth(rozmiar){
  const s=String(rozmiar).replace(',','.').trim().toUpperCase().replace(/^(VF|IF)\s*/,'');
  let m;
  // AxB-D lub AxB : A=srednica calkowita, B=szerokosc (np 23x10.50-12 -> szer=10.50)
  m=s.match(/^(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)/);
  if(m){ return {w: parseFloat(m[2]), kind:'axb', note:'szer=druga liczba (B)'}; }
  // Metryczna / calowa ze slashem:  W/P ...  -> W pierwsza liczba (3-4 cyfry mm lub cale)
  m=s.match(/^(\d+(?:\.\d+)?)\s*\//);
  if(m){ return {w: parseFloat(m[1]), kind:'slash', note:'szer=pierwsza liczba (W)'}; }
  // Prosta W-D lub W R D bez slasha -> pierwsza liczba
  m=s.match(/^(\d+(?:\.\d+)?)\s*[R\-L]/);
  if(m){ return {w: parseFloat(m[1]), kind:'simple', note:'szer=pierwsza liczba'}; }
  return null;
}

let changes=[], suspicious=[];
for(const r of all){
  const t=targetWidth(r.rozmiar);
  if(!t){ continue; }
  if(Math.abs(t.w - r.szerokosc) < 0.01) continue; // juz OK
  const rec={kod:r.kod,dostawca:r.dostawca,rozmiar:r.rozmiar,szer_old:r.szerokosc,szer_new:t.w,kind:t.kind,note:t.note};
  // podejrzane: wynik <2 (za maly), >1300 (za duzy), lub rozmiar dziwny
  if(t.w<2 || t.w>1300 || /^\d\/\d/.test(String(r.rozmiar))){ suspicious.push(rec); }
  else changes.push(rec);
}
console.log('ZMIANY (pewne):', changes.length, '| PODEJRZANE (do wgladu):', suspicious.length);
console.log('\n=== ZMIANY ===');
for(const c of changes) console.log(`  [${c.dostawca}] ${c.kod}  "${c.rozmiar}": ${c.szer_old} -> ${c.szer_new}  (${c.kind})`);
console.log('\n=== PODEJRZANE (NIE zmieniam automatycznie) ===');
for(const c of suspicious) console.log(`  [${c.dostawca}] ${c.kod}  "${c.rozmiar}": ${c.szer_old} -> ${c.szer_new}?  (${c.kind})`);
require('fs').writeFileSync('/home/admin/private_apps/bridge/dryrun_szer.json', JSON.stringify({changes,suspicious},null,1));
console.log('\nzapisano dryrun_szer.json');
