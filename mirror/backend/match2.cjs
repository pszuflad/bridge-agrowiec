const D = require('better-sqlite3');
const fs = require('fs');
const db = new D('data.db', { readonly: true });
const all = (s) => db.prepare(s).all();

const mo9 = all(`SELECT id, kod, kod_dostawcy, ean,
                   CASE WHEN link_zdjecia IS NULL OR link_zdjecia='' THEN 0 ELSE 1 END has_img,
                   substr(link_zdjecia,1,40) lz
                 FROM products WHERE dostawca='MO9'`);
const byKD = new Map();
for (const r of mo9) if (r.kod_dostawcy) byKD.set(String(r.kod_dostawcy), r);
console.log('MO9 produktow:', mo9.length, '| z kod_dostawcy:', byKD.size);

const raw = fs.readFileSync('urls.txt','utf8').trim().split('\n');
// format A: <kod>_<hash>.jpg
let matched = 0, notInDb = 0, sampleMatch=[], sampleMiss=[];
const seenKeys = new Set();
for (const u of raw) {
  const m = u.match(/\/bkt\/(\d{5,7})_[0-9a-f]{40}\.jpg/);
  if (!m) continue;
  const kod = m[1];
  seenKeys.add(kod);
  if (byKD.has(kod)) { matched++; if(sampleMatch.length<3) sampleMatch.push(kod+' -> prod id '+byKD.get(kod).id+' (obecnie img='+byKD.get(kod).has_img+')'); }
  else { notInDb++; if(sampleMiss.length<3) sampleMiss.push(kod); }
}
console.log('\nURLi z kluczem <kod>_: pasuje do MO9 =', matched, '| brak w MO9 =', notInDb, '| unik kluczy =', seenKeys.size);
console.log('przyklady dopasowan:'); sampleMatch.forEach(s=>console.log('  '+s));
console.log('przyklady brakow (kod z pliku, nie ma w MO9):', sampleMiss.join(', '));

// ile z dopasowanych MO9 NIE ma jeszcze zdjecia / ma grasdorf
let noImg=0, grasdorf=0, other=0;
for (const u of raw) {
  const m = u.match(/\/bkt\/(\d{5,7})_[0-9a-f]{40}\.jpg/);
  if (!m) continue;
  const p = byKD.get(m[1]); if(!p) continue;
  if (!p.has_img) noImg++;
  else if (p.lz.includes('grasdorf')) grasdorf++;
  else other++;
}
console.log(`\nZ dopasowanych: bez zdjecia=${noImg}, konflikt-grasdorf=${grasdorf}, inne-zrodlo=${other}`);
db.close();
