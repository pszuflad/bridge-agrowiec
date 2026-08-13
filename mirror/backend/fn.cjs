const d=require('better-sqlite3')('data.db',{readonly:true});
console.log('=== field_name w manual_overrides (rozklad) ===');
for(const r of d.prepare("SELECT field_name, COUNT(*) n FROM manual_overrides GROUP BY field_name ORDER BY n DESC").all())
  console.log(`  ${r.field_name.padEnd(22)} ${r.n}`);
d.close();