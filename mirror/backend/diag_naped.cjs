const D = require('better-sqlite3');
const db = new D('/home/admin/private_apps/bridge/data.db', { readonly: true });
const rows = db.prepare("SELECT kod,dostawca,marka,model,bieznik,rozmiar,indeksy,nazwa FROM products WHERE (bieznik IS NOT NULL AND bieznik<>'') OR (model IS NOT NULL AND model<>'')").all();
console.log('rekordow:', rows.length);

// slowa-oznaczenia funkcji/osi/typu ktore NIE sa nazwa bieznika
const funcWords = ['NAPĘD','NAPED','DRIVE','FRONT','STEER','KIEROWANA','KIEROWNICZA','TRAILER','PRZYCZEPA','REAR','TYŁ','TYL','NAPEDOWA','NAPĘDOWA','OŚ','OS'];
const reFunc = new RegExp('(^|\\s)(' + funcWords.join('|') + ')(\\s|$)', 'i');

let hitB={}, hitM={}, affected=[];
for(const r of rows){
  const fb = r.bieznik && reFunc.test(r.bieznik);
  const fm = r.model && reFunc.test(r.model);
  if(fb||fm){
    const mb = r.bieznik? (r.bieznik.match(reFunc)||[])[2] : null;
    const mm = r.model? (r.model.match(reFunc)||[])[2] : null;
    const w = (mb||mm||'').toUpperCase();
    if(fb) hitB[w]=(hitB[w]||0)+1;
    if(fm) hitM[w]=(hitM[w]||0)+1;
    affected.push({kod:r.kod,dostawca:r.dostawca,bieznik:r.bieznik,model:r.model,nazwa:r.nazwa});
  }
}
console.log('\n=== slowa funkcyjne w BIEZNIK ===', hitB);
console.log('=== slowa funkcyjne w MODEL ===', hitM);
console.log('lacznie dotknietych:', affected.length);
console.log('\n=== wszystkie probki ===');
for(const a of affected) console.log(`[${a.dostawca}] ${a.kod} | model="${a.model}" | bieznik="${a.bieznik}"\n    nazwa="${a.nazwa}"`);
require('fs').writeFileSync('/home/admin/private_apps/bridge/anomalie_naped.json', JSON.stringify(affected,null,1));
