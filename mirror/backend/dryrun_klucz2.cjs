// DRY-RUN: lepsze klucze dopasowania wagi dla 292 pozycji bez wagi.
// Testuje klucze: rozmiar+marka+model, rozmiar+model, rozmiar+PR, rozmiar (spread<=15%).
const Database = require("better-sqlite3");
const db = new Database("/home/admin/private_apps/bridge/data.db", { readonly: true });

const N = s => (s || "").toString().toLowerCase().replace(/\s+/g, "").replace(/[×x]/g, "x").replace(/[,]/g, ".").replace(/tl|tt/g, "").trim();
const NS = s => (s || "").toString().toLowerCase().trim();

const withW = db.prepare("SELECT rozmiar, marka, model, pr, waga FROM products WHERE waga>0 AND rozmiar IS NOT NULL AND rozmiar!=''").all();

// buduj indeksy wg różnych kluczy -> Set wag
function build(keyFn) {
  const m = {};
  for (const r of withW) {
    const k = keyFn(r); if (!k) continue;
    if (!m[k]) m[k] = [];
    m[k].push(r.waga);
  }
  return m;
}
const kSMM = build(r => N(r.rozmiar) && NS(r.marka) && NS(r.model) ? N(r.rozmiar) + "|" + NS(r.marka) + "|" + NS(r.model) : null);
const kSM  = build(r => N(r.rozmiar) && NS(r.model) ? N(r.rozmiar) + "|" + NS(r.model) : null);
const kSPR = build(r => N(r.rozmiar) && (r.pr != null && r.pr !== "") ? N(r.rozmiar) + "|pr" + NS(r.pr) : null);
const kS   = build(r => N(r.rozmiar) || null);

function pick(m, k) { // zwraca wagę tylko jeśli jednoznaczna lub rozrzut<=10%
  const arr = m[k]; if (!arr || !arr.length) return null;
  const min = Math.min(...arr), max = Math.max(...arr);
  if (max > 0 && (max - min) / max <= 0.10) return arr.reduce((a, b) => a + b, 0) / arr.length;
  return null;
}

const noW = db.prepare("SELECT id, nazwa, rozmiar, marka, model, pr FROM products WHERE (waga IS NULL OR waga=0)").all();
let bySMM = 0, bySM = 0, bySPR = 0, byS = 0, none = 0;
const chosen = {};
for (const r of noW) {
  let w = pick(kSMM, N(r.rozmiar) + "|" + NS(r.marka) + "|" + NS(r.model)); let via = "rozmiar+marka+model";
  if (w == null) { w = pick(kSM, N(r.rozmiar) + "|" + NS(r.model)); via = "rozmiar+model"; }
  if (w == null && r.pr != null && r.pr !== "") { w = pick(kSPR, N(r.rozmiar) + "|pr" + NS(r.pr)); via = "rozmiar+PR"; }
  if (w == null) { w = pick(kS, N(r.rozmiar)); via = "rozmiar(spread<=10%)"; }
  if (w == null) { none++; continue; }
  if (via.startsWith("rozmiar+marka")) bySMM++;
  else if (via === "rozmiar+model") bySM++;
  else if (via === "rozmiar+PR") bySPR++;
  else byS++;
}
console.log("=== 292 pozycje bez wagi — dopasowanie lepszymi kluczami ===");
console.log("rozmiar+marka+model (spread<=10%):", bySMM);
console.log("rozmiar+model:", bySM);
console.log("rozmiar+PR:", bySPR);
console.log("sam rozmiar (spread<=10%):", byS);
console.log("RAZEM da się bezpiecznie:", bySMM + bySM + bySPR + byS);
console.log("Nadal bez wiarygodnej wagi:", none);
db.close();
