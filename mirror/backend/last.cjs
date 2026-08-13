const d=require('better-sqlite3')('data.db');
const now=new Date().toISOString().replace('T',' ').slice(0,19);
const nowIso=new Date().toISOString();
const KOD='MO3_38090R54AAIIRC152D14', ALT='14.9R54'; // z pliku: rozmiar bazowy 380/90R54 -> alt 14.9R54
const p=d.prepare("SELECT kod,nazwa,rozmiar,rozmiar_alternatywny,dostawca FROM products WHERE kod=?").get(KOD);
if(!p){ console.log('NADAL BRAK', KOD); process.exit(0); }
console.log('znaleziono:', p.kod, 'rozmiar', p.rozmiar, '| teraz alt:', JSON.stringify(p.rozmiar_alternatywny));
const tx=d.transaction(()=>{
  d.prepare("UPDATE products SET rozmiar_alternatywny=? WHERE kod=?").run(ALT, KOD);
  d.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)")
   .run(now,KOD,p.nazwa,'rozmiar_alternatywny',p.rozmiar_alternatywny==null?'':String(p.rozmiar_alternatywny),ALT,'fix-rozmiar-alt','Anna');
  const ex=d.prepare("SELECT id FROM manual_overrides WHERE supplier_product_id=? AND field_name='rozmiarAlternatywny'").get(KOD);
  if(!ex) d.prepare(`INSERT INTO manual_overrides (supplier_kod,supplier_product_id,field_name,override_value,reason,created_by,created_at,acknowledged_source_value) VALUES (?,?,?,?,?,?,?,?)`)
   .run(p.dostawca||'MO3',KOD,'rozmiarAlternatywny',ALT,'ochrona-rozmiar-alt-2026-07-22',1,nowIso,null);
});
tx();
const after=d.prepare("SELECT rozmiar_alternatywny FROM products WHERE kod=?").get(KOD);
console.log('po zmianie alt:', after.rozmiar_alternatywny);
console.log('\nSUMA: rozmiar_alternatywny zmienione dzis:', d.prepare("SELECT COUNT(*) n FROM history WHERE data LIKE '2026-07-22%' AND zrodlo='fix-rozmiar-alt'").get().n);
console.log('overrides rozmiarAlternatywny:', d.prepare("SELECT COUNT(*) n FROM manual_overrides WHERE field_name='rozmiarAlternatywny'").get().n);
d.close();
