const Database = require('better-sqlite3');
const db = new Database('/home/admin/private_apps/bridge/data.db', { readonly: true });
const rows = db.prepare(`SELECT kod, bieznik FROM products WHERE dostawca='MO9' AND bieznik IS NOT NULL`).all();
// szeroki wzorzec kandydatow: litera z grupy + cyfra + opcjonalne gwiazdki, z lub bez myslnika/spacji
const pattern = /\b([LEGRCI])\s?-?\s?(\d)(\*{1,2})?\b/gi;
let all = [];
for (const r of rows) {
  const matches = [...r.bieznik.matchAll(pattern)];
  if (matches.length) all.push({kod: r.kod, bieznik: r.bieznik, tokens: matches.map(m=>m[0])});
}
console.log('Wszystkie mozliwe trafienia (do recznej weryfikacji falszywych):', all.length);
all.forEach(a => console.log(a.kod, '|', JSON.stringify(a.bieznik), '| tokeny:', a.tokens.join(', ')));
db.close();
