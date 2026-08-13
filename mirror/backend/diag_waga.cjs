// diag_waga.cjs — rozpoznanie pozycji z waga=0 i danych do oszacowania
const Database = require('better-sqlite3');
const db = new Database('data.db', { readonly: true });

const total = db.prepare("SELECT COUNT(*) n FROM products").get().n;
const zero = db.prepare("SELECT COUNT(*) n FROM products WHERE waga=0 OR waga IS NULL").get().n;
const zeroExact = db.prepare("SELECT COUNT(*) n FROM products WHERE waga=0").get().n;
const nullCnt = db.prepare("SELECT COUNT(*) n FROM products WHERE waga IS NULL").get().n;
const withW = db.prepare("SELECT COUNT(*) n FROM products WHERE waga>0").get().n;
console.log(`total=${total} | waga>0=${withW} | waga=0=${zeroExact} | waga NULL=${nullCnt}`);

// rozklad braku wg dostawcy i kategorii
console.log('\n=== waga=0 wg dostawcy ===');
for(const r of db.prepare("SELECT dostawca, COUNT(*) n FROM products WHERE waga=0 GROUP BY dostawca ORDER BY n DESC").all())
  console.log(`  ${String(r.n).padStart(5)}  ${r.dostawca}`);

console.log('\n=== waga=0 wg kategorii ===');
for(const r of db.prepare("SELECT kategoria, COUNT(*) n FROM products WHERE waga=0 GROUP BY kategoria ORDER BY n DESC").all())
  console.log(`  ${String(r.n).padStart(5)}  ${r.kategoria}`);

// czy pozycje z waga=0 maja rozmiar?
const zNoRoz = db.prepare("SELECT COUNT(*) n FROM products WHERE waga=0 AND (rozmiar IS NULL OR rozmiar='')").get().n;
console.log(`\nwaga=0 bez rozmiaru: ${zNoRoz}`);

// przyklady par: ten sam rozmiar ma juz wage gdzie indziej?
console.log('\n=== przyklady waga=0 (pierwsze 15) ===');
for(const r of db.prepare("SELECT kod,dostawca,rozmiar,kategoria,marka,waga FROM products WHERE waga=0 LIMIT 15").all())
  console.log(`  [${r.dostawca}] ${r.kod}  roz="${r.rozmiar}" kat=${r.kategoria} marka=${r.marka}`);

// ile z waga=0 ma "blizniaka" po rozmiarze z waga>0
const twin = db.prepare(`SELECT COUNT(DISTINCT z.kod) n FROM products z
  WHERE z.waga=0 AND z.rozmiar IS NOT NULL AND z.rozmiar!=''
  AND EXISTS (SELECT 1 FROM products w WHERE w.waga>0 AND w.rozmiar=z.rozmiar)`).get().n;
console.log(`\nwaga=0 majace inny rekord z tym samym rozmiarem i waga>0: ${twin}`);

db.close();
