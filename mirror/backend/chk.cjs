const Database = require('better-sqlite3');
const db = new Database('data.db', { readonly: true });
// sprawdz podejrzane rekordy z INNE wczesniej
const kods = ['MO2_GLO00131','MO8_0209500','MO1_19110117','MO1_19110112','MO3_6508015AA-324','MO8_0198800'];
for (const k of kods){
  const r = db.prepare('SELECT kod, rozmiar, szerokosc, profil, srednica FROM products WHERE kod=?').get(k);
  console.log(JSON.stringify(r));
}
db.close();