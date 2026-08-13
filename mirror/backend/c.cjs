const d=require('better-sqlite3')('data.db',{readonly:true});
// mapowanie pol historii -> pola manual_overrides (import uzywa nazw pol produktu)
// nasze skryptowe zrodla (bez auto-override):
const zrodla = ['fix-dot-rok','fix-indeks-nazwa','fix-kategoria','fix-szerokosc','fix-zero-indeks','przypisanie-zastosowanie','szacunek-waga','czyszczenie-anomalii','regula-DOT-nazwa'];
const ph = zrodla.map(()=>'?').join(',');
const rows = d.prepare(`SELECT DISTINCT kod_produktu, pole FROM history WHERE data LIKE '2026-07-22%' AND zrodlo IN (${ph})`).all(...zrodla);
console.log('unikalne (kod,pole) do ochrony:', rows.length);
// ile juz ma override
const findOv = d.prepare("SELECT 1 FROM manual_overrides WHERE supplier_product_id=? AND field_name=? LIMIT 1");
let has=0, miss=0; const missByPole={};
for(const r of rows){
  if(findOv.get(r.kod_produktu, r.pole)) has++;
  else { miss++; missByPole[r.pole]=(missByPole[r.pole]||0)+1; }
}
console.log('juz chronione:', has, '| bez ochrony:', miss);
console.log('brakujace wg pola:', JSON.stringify(missByPole,null,0));
d.close();