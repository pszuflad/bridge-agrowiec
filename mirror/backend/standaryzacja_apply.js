const Database = require('better-sqlite3');
const db = new Database('data.db');

const rows = db.prepare("SELECT dostawca, kod, nazwa, bieznik, model FROM products WHERE nazwa LIKE '%grip%ex%lt%100%' OR nazwa LIKE '%ridemax%fl%693%' OR nazwa LIKE '%agrimax%sirio%' OR nazwa LIKE '%forestech%' OR nazwa LIKE '%farmpro%' OR nazwa LIKE '%farm%pro%' OR bieznik LIKE '%steel%belted%' OR bieznik LIKE '%high%speed%'").all();

function applyRules(text) {
  let s = text;
  let sb = false, hs = false;
  s = s.replace(/\bGRIPEX\b/gi, 'GRIP EX');
  if (/steel\s*belted/i.test(s)) { sb = true; s = s.replace(/\s*steel\s*belted\b/gi, ''); }
  if (/high\s*speed/i.test(s)) { hs = true; s = s.replace(/\s*high\s*speed\b/gi, ''); }
  s = s.replace(/\s+/g, ' ').trim();
  return {text: s, sb, hs};
}

function fixFarmPro(text) {
  return text.replace(/\bfarm\s*pro\b/gi, 'FARM PRO');
}

const update = db.prepare("UPDATE products SET nazwa = ?, bieznik = ?, model = ? WHERE kod = ?");
let count = 0;
const applied = [];

const tx = db.transaction(() => {
  for (const r of rows) {
    let newBieznik = fixFarmPro(r.bieznik);
    let newModel = fixFarmPro(r.model || '');
    let newNazwa = fixFarmPro(r.nazwa);

    const rB = applyRules(newBieznik);
    const rM = applyRules(newModel);
    newBieznik = rB.text;
    newModel = rM.text;
    const sb = rB.sb || rM.sb;
    const hs = rB.hs || rM.hs;

    const rN = applyRules(newNazwa);
    newNazwa = rN.text;

    const hasSbSuffix = /\bSB\b/.test(newNazwa);
    const hasHsSuffix = /\bHS\b/.test(newNazwa);

    let suffix = '';
    if (sb && !hasSbSuffix) suffix += ' SB';
    if (hs && !hasHsSuffix) suffix += ' HS';
    newNazwa = (newNazwa.trim() + suffix).replace(/\s+/g,' ').trim();

    if (newBieznik !== r.bieznik || newModel !== (r.model||'') || newNazwa !== r.nazwa) {
      update.run(newNazwa, newBieznik, newModel, r.kod);
      count++;
      applied.push({kod: r.kod, new_nazwa: newNazwa, new_bieznik: newBieznik});
    }
  }
});
tx();

console.log('Zaktualizowano rekordow:', count);

// Weryfikacja - sprawdzmy czy zostaly jakies nieusuniete STEEL BELTED / HIGH SPEED / GRIPEX / FarmPro-niejednolite (ignorujac STBT)
const remaining = db.prepare("SELECT kod, nazwa, bieznik FROM products WHERE (bieznik LIKE '%steel%belted%' OR bieznik LIKE '%high%speed%' OR bieznik LIKE '%GRIPEX%' OR (bieznik LIKE '%farm%pro%' AND bieznik NOT LIKE '%FARM PRO%'))").all();
console.log('Pozostale niestandaryzowane (powinno byc 0):', remaining.length);
if (remaining.length) console.log(JSON.stringify(remaining, null, 1));

// Sprawdzmy podwojne spacje / trailing spaces w zmienionych
const doubleSpace = db.prepare("SELECT kod, nazwa, bieznik, model FROM products WHERE nazwa LIKE '%  %' OR bieznik LIKE '%  %' OR model LIKE '%  %' OR nazwa LIKE ' %' OR nazwa LIKE '% ' OR bieznik LIKE ' %' OR bieznik LIKE '% '").all();
console.log('Rekordy z podwojna spacja/trailing space (globalnie, powinno byc niska liczba juz istniejaca wczesniej):', doubleSpace.length);

db.close();
