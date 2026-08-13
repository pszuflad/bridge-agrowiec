const D=require('better-sqlite3');
const db=new D('/home/admin/private_apps/bridge/data.db',{readonly:true});

// 1) pozycje ze slowem DOT w nazwie
const withDot = db.prepare("SELECT COUNT(*) c FROM products WHERE UPPER(nazwa) LIKE '%DOT%'").get();
console.log('nazwa zawiera DOT:', withDot.c);

// 2) jak wygladaja - probki nazw + obecna wartosc dot
const samp = db.prepare("SELECT kod,dostawca,nazwa,dot FROM products WHERE UPPER(nazwa) LIKE '%DOT%' LIMIT 40").all();
console.log('\n=== PROBKI (nazwa | dot) ===');
for(const r of samp) console.log(`[${r.dostawca}] ${r.kod}\n   nazwa="${r.nazwa}"\n   dot="${r.dot}"`);

// 3) rozklad obecnych wartosci dot dla tych z DOT w nazwie
const dist = db.prepare("SELECT dot, COUNT(*) c FROM products WHERE UPPER(nazwa) LIKE '%DOT%' GROUP BY dot ORDER BY c DESC").all();
console.log('\n=== rozklad kolumny dot (gdzie nazwa ma DOT) ===');
for(const r of dist) console.log(`   dot="${r.dot}" -> ${r.c}`);

// 4) czy DOT wystepuje jako oddzielne slowo (a nie czesc innego, np. "dotyczy")
const wordDot = db.prepare("SELECT COUNT(*) c FROM products WHERE nazwa GLOB '*[!A-Za-z]DOT[!A-Za-z]*' OR nazwa GLOB 'DOT[!A-Za-z]*' OR nazwa GLOB '*[!A-Za-z]DOT'").get();
console.log('\nDOT jako oddzielne slowo:', wordDot.c);

// 5) rozklad wszystkich wartosci dot w calej bazie (co juz tam bywa)
const distAll = db.prepare("SELECT dot, COUNT(*) c FROM products GROUP BY dot ORDER BY c DESC LIMIT 15").all();
console.log('\n=== rozklad kolumny dot w CALEJ bazie ===');
for(const r of distAll) console.log(`   dot="${r.dot}" -> ${r.c}`);
