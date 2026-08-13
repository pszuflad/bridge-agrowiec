// Patch index.cjs: drizzle field kodImportu + wywolanie assignKodImportu w acceptStaging
const fs = require('fs');
const F = 'index.cjs';
let s = fs.readFileSync(F, 'utf8');
let changes = [];

// 1) drizzle: dodaj kodImportu:q("kod_importu") na koncu def tabeli products
const dr_old = 'zastosowanie:q("zastosowanie")}),zZ=$t(he).omit({id:!0})';
const dr_new = 'zastosowanie:q("zastosowanie"),kodImportu:q("kod_importu")}),zZ=$t(he).omit({id:!0})';
if (s.includes(dr_new)) changes.push('1 drizzle: juz');
else if (s.includes(dr_old)) { s = s.replace(dr_old, dr_new); changes.push('1 drizzle: OK'); }
else changes.push('1 drizzle: NIE ZNALEZIONO');

// 2) acceptStaging: wywolaj assignKodImportu przed zapisem (o?update:insert)
const ac_old = '}catch(_be){}o?X.update(he).set(a).where(se(he.id,o.id)).run():X.insert(he).values(a).run();';
const ac_new = '}catch(_be){}try{__BRIDGE_EXT.assignKodImportu(Qi,a,o)}catch(_be){}o?X.update(he).set(a).where(se(he.id,o.id)).run():X.insert(he).values(a).run();';
if (s.includes('assignKodImportu(Qi,a,o)')) changes.push('2 accept: juz');
else if (s.includes(ac_old)) { s = s.replace(ac_old, ac_new); changes.push('2 accept: OK'); }
else changes.push('2 accept: NIE ZNALEZIONO');

fs.writeFileSync(F, s);
console.log('Zmiany:', changes.join(' | '));
