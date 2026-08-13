// DRY-RUN: przypisanie wagi wg klucza ROZMIAR dla pozycji nadal bez wagi.
// Analizuje rozrzut wag w obrębie rozmiaru, żeby ocenić bezpieczeństwo.
const Database = require("better-sqlite3");
const db = new Database("/home/admin/private_apps/bridge/data.db", { readonly: true });

// normalizacja rozmiaru do klucza
function normRozmiar(s) {
  return (s || "").toString().toLowerCase()
    .replace(/\s+/g, "").replace(/[×x]/g, "x").replace(/[,]/g, ".")
    .replace(/tl|tt/g, "").trim();
}

// zbuduj rozkład wag per rozmiar z produktów, które MAJĄ wagę
const withW = db.prepare("SELECT rozmiar, nazwa, waga FROM products WHERE waga IS NOT NULL AND waga>0 AND rozmiar IS NOT NULL AND rozmiar!=''").all();
const bySize = {};
for (const r of withW) {
  const k = normRozmiar(r.rozmiar);
  if (!k) continue;
  if (!bySize[k]) bySize[k] = [];
  bySize[k].push(r.waga);
}

// pozycje nadal bez wagi
const noW = db.prepare("SELECT id, nazwa, rozmiar FROM products WHERE (waga IS NULL OR waga=0)").all();

let hasSizeMatch = 0, noSizeAtAll = 0, noSizeInDb = 0;
let tight = 0, loose = 0, single = 0;
const samples = [];
const looseSamples = [];

for (const r of noW) {
  const k = normRozmiar(r.rozmiar);
  if (!k) { noSizeAtAll++; continue; }
  const arr = bySize[k];
  if (!arr || arr.length === 0) { noSizeInDb++; continue; }
  hasSizeMatch++;
  const min = Math.min(...arr), max = Math.max(...arr);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const spreadPct = max > 0 ? (max - min) / max * 100 : 0;
  if (arr.length === 1) single++;
  if (spreadPct <= 15) tight++;
  else { loose++; if (looseSamples.length < 12) looseSamples.push({ nazwa: r.nazwa, rozmiar: r.rozmiar, n: arr.length, min, max, spread: spreadPct.toFixed(0) + "%" }); }
  if (samples.length < 10) samples.push({ nazwa: r.nazwa.slice(0, 45), rozmiar: r.rozmiar, n: arr.length, min, max, avg: avg.toFixed(0), spread: spreadPct.toFixed(0) + "%" });
}

console.log("=== Pozycje nadal bez wagi:", noW.length, "===");
console.log("Mają dopasowanie po rozmiarze:", hasSizeMatch);
console.log("  - z tym samym rozmiarem rozrzut wag <=15% (bezpieczne):", tight);
console.log("  - rozrzut >15% (ryzykowne):", loose);
console.log("  - rozmiar występuje tylko raz w bazie (1 wzorzec):", single);
console.log("Brak rozmiaru w rekordzie:", noSizeAtAll);
console.log("Rozmiar nie występuje wśród produktów z wagą:", noSizeInDb);
console.log("\n=== przykłady ===");
samples.forEach(s => console.log(`  ${s.rozmiar} | n=${s.n} min=${s.min} max=${s.max} avg=${s.avg} spread=${s.spread}  <=  ${s.nazwa}`));
console.log("\n=== przykłady DUŻY rozrzut (>15%) ===");
looseSamples.forEach(s => console.log(`  ${s.rozmiar} | n=${s.n} min=${s.min} max=${s.max} spread=${s.spread}  <=  ${s.nazwa}`));
db.close();
