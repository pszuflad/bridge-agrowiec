// Patch: ACK override - konflikt pokazuje sie raz, potem cicho dopoki plik sie nie zmieni
const fs = require('fs');
const F = 'index.cjs';
let s = fs.readFileSync(F, 'utf8');
const before = s.length;
let changes = [];

// ---------- 1) drizzle Yt: dodaj pole acknowledgedSourceValue ----------
const yt_old = 'createdAt:q("created_at").notNull()}),VZ=$t(Yt).omit({id:!0}';
const yt_new = 'createdAt:q("created_at").notNull(),acknowledgedSourceValue:q("acknowledged_source_value")}),VZ=$t(Yt).omit({id:!0}';
if (s.includes(yt_new)) { changes.push('1 drizzle: juz'); }
else if (s.includes(yt_old)) { s = s.replace(yt_old, yt_new); changes.push('1 drizzle: OK'); }
else { changes.push('1 drizzle: NIE ZNALEZIONO'); }

// ---------- 2) Gq: pomin konflikt gdy surowa wartosc pliku == acknowledgedSourceValue ----------
// stary rdzen petli:
const gq_old = 'let r={...e},a=[];for(let s of i){let o=e[s.fieldName];o!=null&&String(o)!==s.overrideValue&&a.push(s.fieldName),r[s.fieldName]=s.overrideValue}return{pozycja:r,naruszono:a}}';
// nowy: zbieramy tez surowe wartosci konfliktowych pol (_srcVals) i pomijamy juz zaakceptowane
const gq_new = 'let r={...e},a=[],_srcVals={};for(let s of i){let o=e[s.fieldName];if(o!=null&&String(o)!==s.overrideValue){if(s.acknowledgedSourceValue==null||String(o)!==String(s.acknowledgedSourceValue)){a.push(s.fieldName);_srcVals[s.fieldName]=String(o);}}r[s.fieldName]=s.overrideValue}return{pozycja:r,naruszono:a,srcVals:_srcVals}}';
if (s.includes(gq_new)) { changes.push('2 Gq: juz'); }
else if (s.includes(gq_old)) { s = s.replace(gq_old, gq_new); changes.push('2 Gq: OK'); }
else { changes.push('2 Gq: NIE ZNALEZIONO'); }

// ---------- 3) AKTYWNY import (@~1438262): przechwyc srcVals do snapshotu pozycji stagingu ----------
// aktywna sciezka uzywa: ,{pozycja:l,naruszono:p}=Gq(t,{...u,kod:_overrideKey}),
const imp_old = '{pozycja:l,naruszono:p}=Gq(t,{...u,kod:_overrideKey}),';
const imp_new = '{pozycja:l,naruszono:p,srcVals:_pSrc}=Gq(t,{...u,kod:_overrideKey}),';
if (s.includes(imp_new)) { changes.push('3 import-destr: juz'); }
else if (s.includes(imp_old)) { s = s.replace(imp_old, imp_new); changes.push('3 import-destr: OK'); }
else { changes.push('3 import-destr: NIE ZNALEZIONO'); }

// wstrzyknij _pSrc do snapshotu konfliktowej pozycji: znajdz w bloku istniejacej pozycji budowe konfliktu
// "konflikt z poprawka Marty (" -> tam mamy p (naruszono). Dodamy zapis d._srcConflict do snapshotJson.
// snapshotJson dla istniejacej zmiany budowany jako snapshotJson:JSON.stringify(d) w gałęzi update.
// Znajdujemy: v.push(`konflikt z poprawka Marty (${p.join(", ")})`)
const conf_old = 'v.push(`konflikt z poprawka Marty (${p.join(", ")})`)';
const conf_new = '(v.push(`konflikt z poprawka Marty (${p.join(", ")})`),d._srcConflict=_pSrc||{})';
if (s.includes(conf_new)) { changes.push('4 conf-mark: juz'); }
else if (s.includes(conf_old)) { s = s.replace(conf_old, conf_new); changes.push('4 conf-mark: OK'); }
else { changes.push('4 conf-mark: NIE ZNALEZIONO'); }

// ---------- 5) acceptStaging: przy akceptacji zapisz ACK dla pol z _srcConflict ----------
// wstrzykniemy na poczatku acceptStaging, po pobraniu n i sprawdzeniu snapshotu
const acc_anchor = 'let r={};if(n.snapshotJson)try{r=JSON.parse(n.snapshotJson)}catch{}';
const acc_inject = acc_anchor + 'try{if(r&&r._srcConflict&&typeof r._srcConflict==="object"){for(let[_fn,_sv] of Object.entries(r._srcConflict)){let _ov=U.getOverridesFor(n.dostawca,n.kod).find(x=>x.fieldName===_fn);if(_ov){U.upsertOverride({supplierKod:n.dostawca,supplierProductId:n.kod,fieldName:_fn,overrideValue:_ov.overrideValue,reason:_ov.reason??null,createdBy:_ov.createdBy??e,createdAt:_ov.createdAt??i,acknowledgedSourceValue:String(_sv)});}}}}catch(_ackErr){}';
if (s.includes('r._srcConflict&&typeof r._srcConflict')) { changes.push('5 accept-ack: juz'); }
else if (s.includes(acc_anchor)) { s = s.replace(acc_anchor, acc_inject); changes.push('5 accept-ack: OK'); }
else { changes.push('5 accept-ack: NIE ZNALEZIONO'); }

// ---------- 6) upsertOverride: obsluz acknowledgedSourceValue w update i insert ----------
const up_old = 'upsertOverride(t){let e=X.select().from(Yt).where(A`supplier_kod = ${t.supplierKod} AND supplier_product_id = ${t.supplierProductId} AND field_name = ${t.fieldName}`).get();return e?(X.update(Yt).set({overrideValue:t.overrideValue,reason:t.reason??null,createdBy:t.createdBy??null,createdAt:t.createdAt}).where(se(Yt.id,e.id)).run(),X.select().from(Yt).where(se(Yt.id,e.id)).get()):X.insert(Yt).values(t).returning().get()}';
const up_new = 'upsertOverride(t){let e=X.select().from(Yt).where(A`supplier_kod = ${t.supplierKod} AND supplier_product_id = ${t.supplierProductId} AND field_name = ${t.fieldName}`).get();let _ackSet=t.acknowledgedSourceValue!==void 0?{acknowledgedSourceValue:t.acknowledgedSourceValue}:{};return e?(X.update(Yt).set({overrideValue:t.overrideValue,reason:t.reason??null,createdBy:t.createdBy??null,createdAt:t.createdAt,..._ackSet}).where(se(Yt.id,e.id)).run(),X.select().from(Yt).where(se(Yt.id,e.id)).get()):X.insert(Yt).values(t).returning().get()}';
if (s.includes('_ackSet=t.acknowledgedSourceValue')) { changes.push('6 upsert: juz'); }
else if (s.includes(up_old)) { s = s.replace(up_old, up_new); changes.push('6 upsert: OK'); }
else { changes.push('6 upsert: NIE ZNALEZIONO'); }

fs.writeFileSync(F, s);
console.log('Zmiany:', changes.join(' | '));
console.log('Rozmiar:', before, '->', s.length, '(delta', s.length - before, ')');
