// Naprawa EAN dla MO7 (Nokian): 264 rekordy mają zaokrąglony ean=6419440000000
// (skutek notacji naukowej Excela). Parser (po poprawce common.cjs z 2026-07-06)
// zwraca teraz zdrowe, unikalne EAN-13. Dopasowujemy po polu `kod` (T-kod dostawcy,
// stabilny i zgodny między DB a parserem) i aktualizujemy WYŁĄCZNIE kolumny EAN.
// Wzorzec zgodny z rebuild_all.cjs (targetowany UPDATE, bez ponownego tk/staging).
const fs=require('fs');
const DISPATCHER=require('/home/admin/private_apps/bridge/parsers/dispatcher.cjs');
const ADAPTER=require('/home/admin/private_apps/bridge/parsers/adapter.cjs');
const Database=require('better-sqlite3');

const APPLY=process.argv.includes('--apply');

// Walidacja sumy kontrolnej EAN-13 (i akceptacja EAN-8/UPC-12/GTIN-14 jak w apce)
function eanChecksumValid(ean){
  const s=String(ean||'').replace(/\D/g,'');
  if(![8,12,13,14].includes(s.length)) return false;
  const digits=s.split('').map(Number);
  const check=digits.pop();
  let sum=0;
  // waga naprzemienna od prawej: 3,1,3,1...
  for(let i=digits.length-1,w=3;i>=0;i--,w=(w===3?1:3)) sum+=digits[i]*w;
  const calc=(10-(sum%10))%10;
  return calc===check;
}

(async()=>{
  const url='https://agroopony.eu/imports/CennikNokianCSV.csv';
  const res=await fetch(url);
  if(!res.ok){throw new Error('HTTP '+res.status+' pobierając cennik');}
  const buf=Buffer.from(await res.arrayBuffer());
  fs.mkdirSync('/tmp/csv_cache',{recursive:true});
  const tmp='/tmp/csv_cache/MO7.csv';
  fs.writeFileSync(tmp,buf);
  const parsed=DISPATCHER.parseByKod('MO7',tmp);
  const surowe=ADAPTER.recordsToSurowe('MO7',parsed.records||[]);
  const byKod=new Map();
  for(const s of surowe) byKod.set(s.kod, s);
  console.log('MODE:', APPLY?'APPLY':'DRY-RUN');
  console.log('Parser: '+surowe.length+' rekordów, distinct EAN='+new Set(surowe.map(s=>s.ean).filter(Boolean)).size);

  const db=new Database('/home/admin/private_apps/bridge/data.db');
  const dbRows=db.prepare("SELECT id,kod,ean FROM products WHERE dostawca='MO7'").all();
  console.log('DB MO7 rows: '+dbRows.length);

  const plan=[];
  let unmatched=0, noEan=0, invalidChk=0;
  for(const r of dbRows){
    const s=byKod.get(r.kod);
    if(!s){unmatched++; continue;}
    const ean=(s.ean==null||s.ean==='')?null:String(s.ean).trim();
    if(!ean){noEan++;}
    let isValid=0, status='ok';
    if(ean){
      isValid=eanChecksumValid(ean)?1:0;
      if(!isValid){invalidChk++; status='invalid_checksum';}
    } else {
      status='brak';
    }
    plan.push({
      id:r.id, kod:r.kod, oldEan:r.ean,
      ean, ean_raw:ean, ean_is_valid: ean?isValid:null,
      ean_source_status: status,
      ean_candidates: ean?JSON.stringify([ean]):null
    });
  }
  console.log('Plan: '+plan.length+' do aktualizacji, unmatched='+unmatched+', bezEAN='+noEan+', invalidChecksum='+invalidChk);
  console.log('Distinct nowych EAN w planie: '+new Set(plan.map(p=>p.ean).filter(Boolean)).size);
  console.log('Przykłady:');
  for(const p of plan.slice(0,5)) console.log('  ['+p.id+'] '+p.kod+': '+p.oldEan+' -> '+p.ean+' (valid='+p.ean_is_valid+', status='+p.ean_source_status+')');

  if(!APPLY){ db.close(); console.log('\n(DRY-RUN — nic nie zapisano. Uruchom z --apply aby wdrożyć.)'); return; }

  const upd=db.prepare("UPDATE products SET ean=?, ean_raw=?, ean_is_valid=?, ean_source_status=?, ean_candidates=? WHERE id=?");
  const tx=db.transaction(()=>{
    for(const p of plan) upd.run(p.ean, p.ean_raw, p.ean_is_valid, p.ean_source_status, p.ean_candidates, p.id);
  });
  tx();
  console.log('\nAPPLY: zaktualizowano '+plan.length+' rekordów.');
  const chk=db.prepare("SELECT COUNT(*) c, COUNT(DISTINCT ean) de, SUM(ean_is_valid) valid, SUM(CASE WHEN ean_source_status='ok' THEN 1 ELSE 0 END) okstatus FROM products WHERE dostawca='MO7'").get();
  console.log('WERYFIKACJA MO7: '+JSON.stringify(chk));
  db.close();
})().catch(e=>{console.error('ERR',e);process.exit(1)});
