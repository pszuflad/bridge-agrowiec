// Patch v2: po obliczeniach wysokosci, nadpisz result.szerokosc stringiem szerokoscRaw
// żeby bundle (`Number(_)` przy zapisie do staging) dostał string zachowujący precyzję.
// Kolumna products.szerokosc będzie TEXT, więc Number() nie jest już wołany — cast nie zaboli.

const fs = require('fs');
const F = '/home/admin/private_apps/bridge/parsers/tyre_params.cjs';
const src = fs.readFileSync(F, 'utf8');

const oldBlock = `  if (result.szerokosc !== null && size) {
    const rawMatch = size.match(/(\\d+(?:[.,]\\d+)?)/);
    if (rawMatch) {
      result.szerokoscRaw = rawMatch[1].replace(',', '.');
    }
  }

  return result;
}`;

const newBlock = `  if (result.szerokosc !== null && size) {
    const rawMatch = size.match(/(\\d+(?:[.,]\\d+)?)/);
    if (rawMatch) {
      result.szerokoscRaw = rawMatch[1].replace(',', '.');
      // POPRAWKA 2026-08-19 (v3): nadpisuje result.szerokosc stringiem 1:1 z rozmiaru
      // (10.0, 14.9, 800, 10.00). Kolumna products.szerokosc jest teraz TEXT.
      // wysokoscBokuCm/wysokoscRzeczywistaCm sa juz policzone powyzej z floata,
      // wiec ta zmiana ich nie ruszy. Zachowujemy zera koncowe zgodnie z prosba Anny.
      result.szerokosc = result.szerokoscRaw;
    }
  }

  return result;
}`;

if (!src.includes(oldBlock)) {
  console.error('BLAD: block nie znaleziony');
  process.exit(1);
}
const out = src.replace(oldBlock, newBlock);
fs.writeFileSync(F, out, 'utf8');

const { execSync } = require('child_process');
execSync(`node --check ${F}`);
console.log('OK: node --check pass');

// Test
delete require.cache[F];
const p = require(F);
const cases = [
  '10.0/75x15.3', '14.9x28', '13.6x24', '800/70R32', '23.5R25',
  '15.0/55x17', '16x6-8', '10.00/75x15.3', '30.5L-32', '12,00x24'
];
for (const c of cases) {
  const r = p.parseSize(c);
  console.log(`${c.padEnd(20)} → szerokosc="${r.szerokosc}" (typ:${typeof r.szerokosc}), wysokoscBokuCm=${r.wysokoscBokuCm}, wysokoscRzeczywistaCm=${r.wysokoscRzeczywistaCm}`);
}
