const d=require('better-sqlite3')('data.db',{readonly:true});
const cols = d.prepare("PRAGMA table_info(products)").all().map(c=>c.name);
console.log('kolumny ~ rozmiar/alt/cal:', cols.filter(c=>/rozmiar|alt|cal|equiv|odpow/i.test(c)).join(', '));
console.log('\nWSZYSTKIE kolumny:');
console.log(cols.join(', '));
d.close();
