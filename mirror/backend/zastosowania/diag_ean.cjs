'use strict';
const D = require('better-sqlite3');
const db = new D('/home/admin/private_apps/bridge/data.db', { readonly: true });

const eans = ['8903094036141','8903094019205','8903094040728','8903094048830','8903094019465','4251438402201','4251438410022','8059971044003','8808956624132','8907375026494','8907375026586','8907375000272','8907375025626','8907375029525','8907375047345','8907375024452','8907375027699','4251438411661','8907375047338','7291050008635','8059971000320','8059971000170','8059971000160'];

const rows = [];
const seen = new Set();
for (const e of eans) {
  const r = db.prepare("SELECT id,kod,nazwa,marka,model,bieznik,rozmiar,szerokosc,profil,srednica,konstrukcja,rozmiar_alternatywny,dostawca,kod_dostawcy FROM products WHERE TRIM(ean)=? OR TRIM(ean_raw)=?").all(e, e);
  for (const x of r) { if (!seen.has(x.id)) { seen.add(x.id); rows.push(x); } }
}

console.log('=== DIAGNOSTYKA ' + rows.length + ' produktow ===\n');
for (const p of rows) {
  console.log(`KOD ${p.kod} (${p.dostawca}, kod_dost=${p.kod_dostawcy})`);
  console.log(`   nazwa:      ${JSON.stringify(p.nazwa)}`);
  console.log(`   rozmiar:    ${JSON.stringify(p.rozmiar)}  | szer=${JSON.stringify(p.szerokosc)} profil=${JSON.stringify(p.profil)} srednica=${JSON.stringify(p.srednica)} konstr=${JSON.stringify(p.konstrukcja)}`);
  console.log(`   rozmiar_alt:${JSON.stringify(p.rozmiar_alternatywny)}  | model=${JSON.stringify(p.model)} bieznik=${JSON.stringify(p.bieznik)}`);
  console.log('');
}

// wyszukaj slowo "uniwersalne" w nazwie w calej bazie
const uni = db.prepare("SELECT COUNT(*) c FROM products WHERE LOWER(nazwa) LIKE '%uniwersaln%'").get().c;
console.log('=== produkty ze slowem "uniwersaln*" w NAZWIE (cala baza):', uni);
const uniEx = db.prepare("SELECT kod,nazwa FROM products WHERE LOWER(nazwa) LIKE '%uniwersaln%' LIMIT 10").all();
uniEx.forEach(p => console.log('   ', p.kod, '=>', JSON.stringify(p.nazwa)));

// wyszukaj dziwne rozmiary typu 374R1 / MRL
console.log('\n=== rozmiary z "374" lub "MRL" (cala baza) ===');
const mrl = db.prepare("SELECT kod,nazwa,rozmiar,szerokosc,profil,srednica FROM products WHERE rozmiar LIKE '%374%' OR rozmiar LIKE '%MRL%' OR nazwa LIKE '%374R1%' OR nazwa LIKE '%MRL%' LIMIT 15").all();
mrl.forEach(p => console.log('   ', p.kod, '| rozmiar=' + JSON.stringify(p.rozmiar), '| szer=' + p.szerokosc, 'prof=' + p.profil, 'sred=' + p.srednica, '| nazwa=' + JSON.stringify(p.nazwa)));

db.close();
