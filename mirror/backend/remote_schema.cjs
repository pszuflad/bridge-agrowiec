const Database=require("better-sqlite3");
const db=new Database("/home/admin/private_apps/bridge/data.db",{readonly:true});
const tbls=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
console.log("TABELE:", tbls.join(", "));
const cols=db.prepare("PRAGMA table_info(products)").all();
console.log("KOLUMNY products:");
cols.forEach(c=>console.log("  ",c.name, c.type));
console.log("Wierszy products:", db.prepare("SELECT COUNT(*) c FROM products").get().c);
// przyklad: wez kolumny podobne do kod
const like=cols.filter(c=>/kod|dost|nazwa|import|name|supplier/i.test(c.name)).map(c=>c.name);
console.log("Kandydaci kluczowe kolumny:", like.join(", "));
// pokaz przyklad rekordu
const sample=db.prepare("SELECT * FROM products LIMIT 1").get();
console.log("PRZYKLAD:", JSON.stringify(sample).slice(0,800));
db.close();
