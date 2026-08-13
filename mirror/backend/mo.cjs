const d=require('better-sqlite3')('data.db',{readonly:true});
for(const t of ['manual_overrides','nazwa_pamiec','waga_pamiec']){
  console.log(`\n=== ${t} ===`);
  console.log('kolumny:', d.prepare(`PRAGMA table_info(${t})`).all().map(c=>`${c.name}(${c.type})`).join(', '));
  console.log('rekordow:', d.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n);
  const s=d.prepare(`SELECT * FROM ${t} LIMIT 3`).all();
  for(const r of s) console.log('  ', JSON.stringify(r).slice(0,300));
}
d.close();