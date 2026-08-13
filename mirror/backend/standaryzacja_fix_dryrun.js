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

const changes = [];
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

  // Sprawdz czy token SB/HS juz istnieje jako osobne slowo na koncu nazwy - jesli tak, nie dopisuj drugi raz
  const hasSbSuffix = /\bSB\b/.test(newNazwa);
  const hasHsSuffix = /\bHS\b/.test(newNazwa);

  let suffix = '';
  if (sb && !hasSbSuffix) suffix += ' SB';
  if (hs && !hasHsSuffix) suffix += ' HS';
  newNazwa = (newNazwa.trim() + suffix).replace(/\s+/g,' ').trim();

  if (newBieznik !== r.bieznik || newModel !== (r.model||'') || newNazwa !== r.nazwa) {
    changes.push({kod:r.kod, dostawca:r.dostawca, old_nazwa:r.nazwa, new_nazwa:newNazwa, old_bieznik:r.bieznik, new_bieznik:newBieznik, old_model:r.model, new_model:newModel});
  }
}
console.log('Liczba rekordow do zmiany:', changes.length, '/', rows.length);
// Sprawdzmy specjalnie MO2_38030522AL
const special = changes.find(c => c.kod === 'MO2_38030522AL');
console.log('Case MO2_38030522AL:', JSON.stringify(special, null, 1));
require('fs').writeFileSync('/tmp/changes_preview.json', JSON.stringify(changes, null, 1));
db.close();
