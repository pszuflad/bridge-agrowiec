const Database = require('better-sqlite3');
const path = process.argv[2] || '/home/admin/private_apps/bridge/data.db';
const db = new Database(path);
db.pragma('journal_mode = WAL');

function condMatch(p,c){const v=String(c.wartosc??"").trim().toLowerCase();if(!v)return true;switch(c.typ){case"dostawca":return String(p.dostawca??"").toLowerCase()===v;case"kategoria":return String(p.kategoria??"").toLowerCase().includes(v);case"marka":return String(p.marka??"").toLowerCase().includes(v);case"produkt":return String(p.kod??"").toLowerCase().includes(v)||String(p.nazwa??"").toLowerCase().includes(v);case"konstrukcja":return String(p.konstrukcja??"").toLowerCase().includes(v);case"srednica":return String(p.srednica??"").toLowerCase()===v;case"vfIf":case"vf_if":return String(p.vf_if??"").toLowerCase().includes(v);case"rozmiar":return String(p.rozmiar??"").toLowerCase().includes(v);case"bieznik":return String(p.bieznik??"").toLowerCase().includes(v);default:return true}}
function markupMatches(rule,p){if(rule.status!=="aktywny")return false;let warunki=[];try{warunki=rule.warunki?JSON.parse(rule.warunki):[]}catch{warunki=[]}if(Array.isArray(warunki)&&warunki.length>0)return warunki.every(c=>condMatch(p,c));if(rule.typ==="globalny")return true;return condMatch(p,{typ:rule.typ,wartosc:rule.zakres})}
function promoMatches(promo,p){if(promo.status!=="aktywna")return false;let warunki=[];try{warunki=promo.warunki?JSON.parse(promo.warunki):[]}catch{warunki=[]}if(Array.isArray(warunki)&&warunki.length>0)return warunki.every(c=>condMatch(p,c));const r=String(promo.zasieg??"").toLowerCase();if(!r)return false;return r.includes(String(p.marka??"").toLowerCase())||r.includes(String(p.kategoria??"").toLowerCase())}
function pickMarkup(rules,p){let r=null;const sorted=[...rules].sort((a,b)=>(b.priorytet??50)-(a.priorytet??50));for(const rule of sorted){if(!markupMatches(rule,p))continue;let warunki=[];try{warunki=rule.warunki?JSON.parse(rule.warunki):[]}catch{warunki=[]}const isSpecific=rule.typ!=="globalny"||(Array.isArray(warunki)&&warunki.length>0);if(isSpecific){r=rule;break}if(!r)r=rule}return r}
function pickPromo(promos,p){const matched=promos.filter(pr=>promoMatches(pr,p)).sort((a,b)=>(b.priorytet??50)-(a.priorytet??50));return matched[0]??null}

const markupRules = db.prepare('SELECT * FROM markups').all();
const promoRules = db.prepare('SELECT * FROM promotions').all();
console.log('Markup rules loaded:', markupRules.length, JSON.stringify(markupRules.map(r=>({id:r.id,nazwa:r.nazwa,typ:r.typ,status:r.status}))));
console.log('Promo rules loaded:', promoRules.length);

const allProducts = db.prepare('SELECT * FROM products').all();
const updateStmt = db.prepare('UPDATE products SET cena_sprzedazy=?, marza_pct=? WHERE id=?');
let changed = 0, unchanged = 0, skipped = 0;
const samples = [];

const tx = db.transaction(() => {
  for (const p of allProducts) {
    const zakup = Number(p.cena_zakupu) || 0;
    if (zakup <= 0) { skipped++; continue; }
    const mm = pickMarkup(markupRules, p);
    const pp = pickPromo(promoRules, p);
    const narz = Number(mm?.wartosc ?? 0);
    const rab = Number(pp?.rabat_pct ?? 0);
    const vat = Number(p.vat ?? 23);
    const cena = Math.round(zakup*(1+narz/100)*(1-rab/100)*(1+vat/100)*100)/100;
    const marza = zakup>0 ? Math.round((cena-zakup)/zakup*1000)/10 : 0;
    if (Math.abs(Number(p.cena_sprzedazy) - cena) > 0.005) {
      updateStmt.run(cena, marza, p.id);
      changed++;
      if (samples.length < 8) samples.push({kod:p.kod, dostawca:p.dostawca, old:p.cena_sprzedazy, nowa:cena, markup:mm?.nazwa});
    } else {
      unchanged++;
    }
  }
});
tx();

console.log('Total products:', allProducts.length, 'changed:', changed, 'unchanged:', unchanged, 'skipped(zakup<=0):', skipped);
console.log('Sample changes:', JSON.stringify(samples, null, 2));
db.close();
