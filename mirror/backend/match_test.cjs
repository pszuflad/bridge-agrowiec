const D = require('better-sqlite3');
const fs = require('fs');
const db = new D('data.db', { readonly: true });
const all = (s, ...p) => db.prepare(s).all(...p);

// kod_dostawcy dla MO9 (Agro-Rami)
const mo9 = all(`SELECT id, kod, kod_dostawcy, ean, nazwa, rozmiar, model, marka,
                        CASE WHEN link_zdjecia IS NULL OR link_zdjecia='' THEN 0 ELSE 1 END has_img,
                        substr(link_zdjecia,1,60) lz
                 FROM products WHERE dostawca='MO9'`);
console.log('MO9 produktow:', mo9.length);
const kd = new Set(mo9.map(r => String(r.kod_dostawcy)).filter(Boolean));
console.log('MO9 unikalnych kod_dostawcy:', kd.size);
console.log('przyklady kod_dostawcy MO9:', [...kd].slice(0,10).join(', '));

// wczytaj pelne hashe z pliku (nie prefiksy) - sprawdz czy pelny hash == cokolwiek, oraz czy 6-cyfrowy prefiks pasuje
// Zamiast tego: policz ile URLi ma pelny prefiks 6-cyfrowy zgodny z kod_dostawcy
const raw = fs.readFileSync('urls.txt','utf8').trim().split('\n');
console.log('\nURLi w pliku:', raw.length);
let hit6 = 0, sample=[];
for (const u of raw) {
  const m = u.match(/image_(\d{6})/);  // dokladnie 6 cyfr na poczatku hasza
  if (m && kd.has(m[1])) { hit6++; if(sample.length<5) sample.push(m[1]+' <- '+u.slice(-50)); }
}
console.log('URLi z 6-cyfrowym prefiksem == kod_dostawcy MO9:', hit6);
sample.forEach(s=>console.log('  '+s));

// odwrotnie: czy hash moze byc md5/sha nazwy? sprawdz dlugosc
const lens = {};
for (const u of raw){ const m=u.match(/image_([0-9a-f]+)\.jpg/); if(m){const l=m[1].length; lens[l]=(lens[l]||0)+1;} }
console.log('\ndlugosci hashy:', JSON.stringify(lens));
db.close();
