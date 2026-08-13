// Uspójnienie nazwa/model/bieznik — APPLY z historią + manual_overrides
// Tryb: node apply_uspojnienie.cjs [--dry]
const Database = require('better-sqlite3');
const fs = require('fs');
const DRY = process.argv.includes('--dry');
const db = new Database('data.db');

const plan_uspoj = JSON.parse(fs.readFileSync('plan_uspojnienie.json', 'utf8'));
const plan_full  = JSON.parse(fs.readFileSync('plan_full.json', 'utf8'));

const grupaA = plan_uspoj.grupaA;        // model := bieznik
const grupaB = plan_uspoj.grupaB;        // nazwa auto-replace OK {kod, stara_nazwa/nazwa, nowa_nazwa, ...}

const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
const KTO = 'Anna';
const ZR = 'uspojnienie-nazwa-model-2026-07-22';

const getProd = db.prepare('SELECT kod, dostawca, nazwa, model, bieznik FROM products WHERE kod = ?');
const updModel = db.prepare('UPDATE products SET model = ? WHERE kod = ?');
const updBiez  = db.prepare('UPDATE products SET bieznik = ? WHERE kod = ?');
const updNazwa = db.prepare('UPDATE products SET nazwa = ? WHERE kod = ?');
const insHist = db.prepare(`INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)`);
const insOv = db.prepare(`INSERT INTO manual_overrides (supplier_kod,supplier_product_id,field_name,override_value,reason,created_by,created_at,acknowledged_source_value) VALUES (?,?,?,?,?,?,?,?)`);

let cModel=0, cNazwa=0, cBiez=0, cOv=0, cMiss=0;
const errors=[];

function ovExists(sk, spid, field){
  const r = db.prepare('SELECT 1 FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=? AND field_name=?').get(sk, spid, field);
  return !!r;
}

const run = db.transaction(() => {
  // ---- GRUPA A: model := model_new (ujednolicony bieznik) ----
  for (const r of grupaA) {
    const p = getProd.get(r.kod);
    if (!p) { cMiss++; errors.push('MISS A '+r.kod); continue; }
    const nowa = r.model_new;
    const stara = p.model||'';
    if (!nowa || stara === nowa) continue; // juz spojne
    insHist.run(now, r.kod, p.nazwa, 'model', stara, nowa, ZR, KTO);
    updModel.run(nowa, r.kod);
    if (!ovExists(p.dostawca, r.kod, 'model')) { insOv.run(p.dostawca, r.kod, 'model', nowa, 'ochrona-uspojnienie-2026-07-22', 1, now, stara); cOv++; }
    cModel++;
  }
  // ---- GRUPA B (102 OK): nazwa := nazwa_new ----
  for (const r of grupaB) {
    const p = getProd.get(r.kod);
    if (!p) { cMiss++; errors.push('MISS B '+r.kod); continue; }
    const nowa = r.nazwa_new;
    const stara = p.nazwa;
    if (!nowa || nowa === stara) continue;
    insHist.run(now, r.kod, stara, 'nazwa', stara, nowa, ZR, KTO);
    updNazwa.run(nowa, r.kod);
    if (!ovExists(p.dostawca, r.kod, 'nazwa')) { insOv.run(p.dostawca, r.kod, 'nazwa', nowa, 'ochrona-uspojnienie-2026-07-22', 1, now, stara); cOv++; }
    cNazwa++;
  }
  // ---- CONTINENTAL: bieznik+model := nowy (z nazwy) ----
  for (const r of plan_full.conti_model_biez) {
    const p = getProd.get(r.kod);
    if (!p) { cMiss++; errors.push('MISS CONTI '+r.kod); continue; }
    const nowy = r.nowy;
    // bieznik
    if ((p.bieznik||'') !== nowy) {
      insHist.run(now, r.kod, p.nazwa, 'bieznik', p.bieznik||'', nowy, ZR, KTO);
      updBiez.run(nowy, r.kod);
      if (!ovExists(p.dostawca, r.kod, 'bieznik')) { insOv.run(p.dostawca, r.kod, 'bieznik', nowy, 'ochrona-uspojnienie-2026-07-22', 1, now, p.bieznik||''); cOv++; }
      cBiez++;
    }
    // model
    if ((p.model||'') !== nowy) {
      insHist.run(now, r.kod, p.nazwa, 'model', p.model||'', nowy, ZR, KTO);
      updModel.run(nowy, r.kod);
      if (!ovExists(p.dostawca, r.kod, 'model')) { insOv.run(p.dostawca, r.kod, 'model', nowy, 'ochrona-uspojnienie-2026-07-22', 1, now, p.model||''); cOv++; }
      cModel++;
    }
  }
  // ---- LINGLONG / MRL / MIRAGE: nazwa := nowa_nazwa ----
  const nazwaGroups = [...plan_full.linglong_nazwa, ...plan_full.mrl_nazwa, ...plan_full.mirage_nazwa];
  for (const r of nazwaGroups) {
    const p = getProd.get(r.kod);
    if (!p) { cMiss++; errors.push('MISS NAZWA '+r.kod); continue; }
    const nowa = r.nowa_nazwa; const stara = p.nazwa;
    if (!nowa || nowa === stara) continue;
    insHist.run(now, r.kod, stara, 'nazwa', stara, nowa, ZR, KTO);
    updNazwa.run(nowa, r.kod);
    if (!ovExists(p.dostawca, r.kod, 'nazwa')) { insOv.run(p.dostawca, r.kod, 'nazwa', nowa, 'ochrona-uspojnienie-2026-07-22', 1, now, stara); cOv++; }
    cNazwa++;
  }
  // ---- ALLIANCE RC -> ROW CROP: bieznik+model ----
  for (const r of plan_full.alliance_rc) {
    const p = getProd.get(r.kod);
    if (!p) { cMiss++; errors.push('MISS ALLIANCE '+r.kod); continue; }
    const nowy = r.nowy_biez;
    if ((p.bieznik||'') !== nowy) {
      insHist.run(now, r.kod, p.nazwa, 'bieznik', p.bieznik||'', nowy, ZR, KTO);
      updBiez.run(nowy, r.kod);
      if (!ovExists(p.dostawca, r.kod, 'bieznik')) { insOv.run(p.dostawca, r.kod, 'bieznik', nowy, 'ochrona-uspojnienie-2026-07-22', 1, now, p.bieznik||''); cOv++; }
      cBiez++;
    }
    if ((p.model||'') !== nowy) {
      insHist.run(now, r.kod, p.nazwa, 'model', p.model||'', nowy, ZR, KTO);
      updModel.run(nowy, r.kod);
      if (!ovExists(p.dostawca, r.kod, 'model')) { insOv.run(p.dostawca, r.kod, 'model', nowy, 'ochrona-uspojnienie-2026-07-22', 1, now, p.model||''); cOv++; }
      cModel++;
    }
  }

  if (DRY) throw new Error('DRY_ROLLBACK');
});

try { run(); }
catch(e){ if (e.message !== 'DRY_ROLLBACK') throw e; }

console.log(JSON.stringify({ dry: DRY, model_upd: cModel, nazwa_upd: cNazwa, bieznik_upd: cBiez, overrides: cOv, missing: cMiss, errors: errors.slice(0,10) }, null, 1));
db.close();
