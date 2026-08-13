// Uzupełnia wagi dla pozycji nadal bez wagi wg kaskady kluczy.
// Pewne (spread<=10%): rozmiar+marka+model -> rozmiar+model -> rozmiar+PR -> sam rozmiar.
// Niepewne: MEDIANA wg samego rozmiaru = SZACUNEK (oznaczony w reason).
// Każda ustawiona waga dostaje manual_overrides (import-safe). Zaokrąglenie do 1 kg.
const Database = require("better-sqlite3");
const db = new Database("/home/admin/private_apps/bridge/data.db");

const N = s => (s || "").toString().toLowerCase().replace(/\s+/g, "").replace(/[×x]/g, "x").replace(/[,]/g, ".").replace(/tl|tt/g, "").trim();
const NS = s => (s || "").toString().toLowerCase().trim();
const median = arr => { const a = [...arr].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

const withW = db.prepare("SELECT rozmiar, marka, model, pr, waga FROM products WHERE waga>0 AND rozmiar IS NOT NULL AND rozmiar!=''").all();
function build(keyFn) { const m = {}; for (const r of withW) { const k = keyFn(r); if (!k) continue; (m[k] = m[k] || []).push(r.waga); } return m; }
const kSMM = build(r => N(r.rozmiar) && NS(r.marka) && NS(r.model) ? N(r.rozmiar) + "|" + NS(r.marka) + "|" + NS(r.model) : null);
const kSM = build(r => N(r.rozmiar) && NS(r.model) ? N(r.rozmiar) + "|" + NS(r.model) : null);
const kSPR = build(r => N(r.rozmiar) && r.pr != null && r.pr !== "" ? N(r.rozmiar) + "|pr" + NS(r.pr) : null);
const kS = build(r => N(r.rozmiar) || null);
function tight(m, k) { const a = m[k]; if (!a || !a.length) return null; const mn = Math.min(...a), mx = Math.max(...a); return (mx > 0 && (mx - mn) / mx <= 0.10) ? a.reduce((x, y) => x + y, 0) / a.length : null; }

const noW = db.prepare("SELECT id, kod, dostawca, nazwa, rozmiar, marka, model, pr FROM products WHERE (waga IS NULL OR waga=0)").all();
const nowIso = new Date().toISOString();
const updProd = db.prepare("UPDATE products SET waga=? WHERE id=?");
const findOv = db.prepare("SELECT id FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=? AND field_name='waga'");
const insOv = db.prepare(`INSERT INTO manual_overrides (supplier_kod,supplier_product_id,field_name,override_value,reason,created_by,created_at,acknowledged_source_value) VALUES (?,?,'waga',?,?,1,?,NULL)`);

let pewne = 0, szac = 0, brak = 0, ovNew = 0;
const run = db.transaction(() => {
  for (const r of noW) {
    let w = tight(kSMM, N(r.rozmiar) + "|" + NS(r.marka) + "|" + NS(r.model));
    if (w == null) w = tight(kSM, N(r.rozmiar) + "|" + NS(r.model));
    if (w == null && r.pr != null && r.pr !== "") w = tight(kSPR, N(r.rozmiar) + "|pr" + NS(r.pr));
    if (w == null) w = tight(kS, N(r.rozmiar));
    let reason;
    if (w != null) { reason = "waga wg klucza rozmiar (2026-07-20, import-safe)"; pewne++; }
    else {
      const arr = kS[N(r.rozmiar)];
      if (arr && arr.length) { w = median(arr); reason = "SZACUNEK: mediana wg rozmiaru (2026-07-20, import-safe)"; szac++; }
      else { brak++; continue; }
    }
    w = Math.round(w * 10) / 10; // do 0.1 kg
    updProd.run(w, r.id);
    if (!findOv.get(r.dostawca, r.kod)) { insOv.run(r.dostawca, r.kod, String(w), reason, nowIso); ovNew++; }
  }
});
run();
console.log("Kandydatów:", noW.length);
console.log("Waga PEWNA (spread<=10%):", pewne);
console.log("Waga SZACOWANA (mediana rozmiaru):", szac);
console.log("Bez rozmiaru w bazie (puste):", brak);
console.log("Nowe overrides:", ovNew);
db.close();
