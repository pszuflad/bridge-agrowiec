const Database = require("better-sqlite3");
const db = new Database("data.db", { readonly: true });
const dost = db.prepare("SELECT kod, czestotliwosc_minuty, ostatni_import, aktywny FROM dostawcy WHERE kod IN ('MO3','MO4','MO9')").all();
console.log(JSON.stringify(dost, null, 2));
console.log("--- min/max data staging MO9 ---");
console.log(db.prepare("SELECT MIN(utworzono) mn, MAX(utworzono) mx FROM staging_items WHERE dostawca=?").get("MO9"));
