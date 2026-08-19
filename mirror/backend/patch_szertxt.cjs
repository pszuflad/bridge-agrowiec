// Patch: dodaj pole `szerokoscRaw` do wyniku parseSize (surowy string z rozmiaru).
// Bezpieczne: nie zmienia istniejących pól, tylko dokłada.

const fs = require('fs');
const F = '/home/admin/private_apps/bridge/parsers/tyre_params.cjs';
const src = fs.readFileSync(F, 'utf8');

// 1) Dodaj pole `szerokoscRaw: null` do inicjalizacji `result`.
const initOld = `  const result = {
    rozmiar: size,
    szerokosc: null,
    profil: null,
    srednica: null,
    konstrukcja: null,
    wysokoscRzeczywistaCm: null,
    wysokoscBokuCm: null
  };`;
const initNew = `  const result = {
    rozmiar: size,
    szerokosc: null,
    szerokoscRaw: null,
    profil: null,
    srednica: null,
    konstrukcja: null,
    wysokoscRzeczywistaCm: null,
    wysokoscBokuCm: null
  };`;

if (!src.includes(initOld)) {
  console.error('BLAD: init struct nie znaleziony');
  process.exit(1);
}
let out = src.replace(initOld, initNew);

// 2) Na końcu parseSize (przed `return result;`) — jeśli szerokosc jest liczbą,
// wyciągnij surowy string pierwszej liczby z `size`.
const returnOld = `  return result;
}

`;
const returnNew = `  // POPRAWKA 2026-08-19 (v2): Anna wymaga zachowania oryginalnego zapisu pierwszej
  // liczby z rozmiaru — z zerami koncowymi (10.0, 10.00). result.szerokosc to float
  // (potrzebny do widthCm/wysokoscBokuCm), wiec dodajemy osobne pole szerokoscRaw
  // jako string 1:1 z rozmiaru. Trafi do kolumny products.szerokosc (TEXT).
  if (result.szerokosc !== null && size) {
    const rawMatch = size.match(/(\\d+(?:[.,]\\d+)?)/);
    if (rawMatch) {
      result.szerokoscRaw = rawMatch[1].replace(',', '.');
    }
  }

  return result;
}

`;

if (!out.includes(returnOld)) {
  console.error('BLAD: return result nie znaleziony');
  process.exit(1);
}
out = out.replace(returnOld, returnNew);

fs.writeFileSync(F, out, 'utf8');

// Test syntaxu
const { execSync } = require('child_process');
try {
  execSync(`node --check ${F}`);
  console.log('OK: node --check pass');
} catch (e) {
  console.error('BLAD: syntax check nie powiodl sie');
  console.error(e.stderr && e.stderr.toString());
  process.exit(1);
}

// Test funkcjonalny
const p = require(F);
const cases = ['10.0/75x15.3', '14.9x28', '13.6x24', '800/70R32', '23.5R25', '15.0/55x17', '16x6-8', '10.00/75x15.3'];
for (const c of cases) {
  const r = p.parseSize(c);
  console.log(`${c.padEnd(20)} → szerokosc=${r.szerokosc}, szerokoscRaw="${r.szerokoscRaw}"`);
}
