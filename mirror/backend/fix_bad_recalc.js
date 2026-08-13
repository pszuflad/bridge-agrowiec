const Database = require('better-sqlite3');
const liveDb = new Database('/home/admin/private_apps/bridge/data.db');
const bakDb = new Database('/home/admin/private_apps/bridge/data.db.bak_pre_bulk_price_recalc_20260716_154000', { readonly: true });

function condMatch(p,c){const v=String(c.wartosc??"").trim().toLowerCase();if(!v)return true;switch(c.typ){case"dostawca":return String(p.dostawca??"").toLowerCase()===v;case"kategoria":return String(p.kategoria??"").toLowerCase().includes(v);case"marka":return String(p.marka??"").toLowerCase().includes(v);case"produkt":return String(p.kod??"").toLowerCase().includes(v)||String(p.nazwa??"").toLowerCase().includes(v);case"konstrukcja":return String(p.konstrukcja??"").toLowerCase().includes(v);case"srednica":return String(p.srednica??"").toLowerCase()===v;case"vfIf":case"vf_if":return String(p.vf_if??"").toLowerCase().includes(v);case"rozmiar":return String(p.rozmiar??"").toLowerCase().includes(v);case"bieznik":return String(p.bieznik??"").toLowerCase().includes(v);default:return true}}
function markupMatches(rule,p){if(rule.status!=="aktywny")return false;let warunki=[];try{warunki=rule.warunki?JSON.parse(rule.warunki):[]}catch{warunki=[]}if(Array.isArray(warunki)&&warunki.length>0)return warunki.every(c=>condMatch(p,c));if(rule.typ==="globalny")return true;return condMatch(p,{typ:rule.typ,wartosc:rule.zakres})}
function promoMatches(promo,p){if(promo.status!=="aktywna")return false;let warunki=[];try{warunki=promo.warunki?JSON.parse(promo.warunki):[]}catch{warunki=[]}if(Array.isArray(warunki)&&warunki.length>0)return warunki.every(c=>condMatch(p,c));const r=String(promo.zasieg??"").toLowerCase();if(!r)return false;return r.includes(String(p.marka??"").toLowerCase())||r.includes(String(p.kategoria??"").toLowerCase())}
function pickMarkup(rules,p){let r=null;const sorted=[...rules].sort((a,b)=>(b.priorytet??50)-(a.priorytet??50));for(const rule of sorted){if(!markupMatches(rule,p))continue;let warunki=[];try{warunki=rule.warunki?JSON.parse(rule.warunki):[]}catch{warunki=[]}const isSpecific=rule.typ!=="globalny"||(Array.isArray(warunki)&&warunki.length>0);if(isSpecific){r=rule;break}if(!r)r=rule}return r}
function pickPromo(promos,p){const matched=promos.filter(pr=>promoMatches(pr,p)).sort((a,b)=>(b.priorytet??50)-(a.priorytet??50));return matched[0]??null}

const markupRules = liveDb.prepare("SELECT * FROM markups WHERE status='aktywny'").all();
const promoRules = liveDb.prepare('SELECT * FROM promotions').all();
console.log('Active markup rules:', JSON.stringify(markupRules.map(r=>({id:r.id,nazwa:r.nazwa}))));

const liveProducts = liveDb.prepare('SELECT * FROM products').all();
const bakByKod = new Map();
for (const row of bakDb.prepare('SELECT kod, cena_sprzedazy, marza_pct FROM products').all()) {
  bakByKod.set(row.kod, row);
}

const updateStmt = liveDb.prepare('UPDATE products SET cena_sprzedazy=?, marza_pct=? WHERE id=?');
let restored = 0, keptRuleApplied = 0, noBakRow = 0;
const samplesRestored = [];
const samplesKept = [];

const tx = liveDb.transaction(() => {
  for (const p of liveProducts) {
    const mm = pickMarkup(markupRules, p);
    const pp = pickPromo(promoRules, p);
    const hasRule = !!(mm || pp);
    if (hasRule) {
      keptRuleApplied++;
      if (samplesKept.length < 5) samplesKept.push({kod:p.kod, cena_sprzedazy:p.cena_sprzedazy, markup:mm?.nazwa});
      continue; // leave as recalculated (correct behavior)
    }
    const bak = bakByKod.get(p.kod);
    if (!bak) { noBakRow++; continue; }
    if (Math.abs(Number(p.cena_sprzedazy) - Number(bak.cena_sprzedazy)) > 0.005 || Math.abs(Number(p.marza_pct) - Number(bak.marza_pct)) > 0.05) {
      updateStmt.run(bak.cena_sprzedazy, bak.marza_pct, p.id);
      restored++;
      if (samplesRestored.length < 5) samplesRestored.push({kod:p.kod, restored_to: bak.cena_sprzedazy});
    }
  }
});
tx();

console.log('Restored to backup value (no rule matched):', restored);
console.log('Kept recalculated (rule matched):', keptRuleApplied);
console.log('No backup row found (new products):', noBakRow);
console.log('Sample restored:', JSON.stringify(samplesRestored));
console.log('Sample kept (rule applied):', JSON.stringify(samplesKept));
liveDb.close();
bakDb.close();
