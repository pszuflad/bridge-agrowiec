// MO9 Agrorami — WERSJA PRODUKCYJNA (od 2026-07-10): źródło danych = API GraphQL
// (hurtownia.agrorami.pl), NIE plik CSV z URL.
//
// KONTEKST ZMIANY: stary parser czytał publiczny plik CSV
// (https://agroopony.eu/imports/agrorami.csv), który ma kolumnę "magazyn" z
// wartościami 0/1/2 — Anna zweryfikowała (2026-07-10), że te liczby NIE odpowiadają
// prawdziwemu stanowi (porównanie po EAN z API pokazało rozbieżności). Prawdziwy stan
// magazynowy (np. "5+", "15+") jest dostępny TYLKO przez API GraphQL, w polu
// stock_availability.in_stock_real. Stąd to źródło danych zostało zmienione.
//
// DLACZEGO TEN PLIK WYGLĄDA JAK "PARSER PLIKU", A NIE ROBI FETCHA SAM:
// dispatcher.parseByKod() jest wołany synchronicznie przez nq() w index.cjs
// (BEZ await), więc parseFile() MUSI być synchroniczne. Pobranie danych z API
// Agrorami wymaga async (token + fetch), więc odpalamy to w osobnym procesie
// (mo9_agrorami_api.cjs przez _agrorami_fetch_helper.cjs) i CZEKAMY na niego
// synchronicznie przez execFileSync — tak jak zwykły "zewnętrzny proces".
// Plik CSV podany w filePath (pobrany przez L4() z URL dostawcy) jest IGNOROWANY —
// URL w tabeli suppliers został zostawiony tylko po to, żeby L4()/harmonogram nie
// przerywały się na "Brak URL" przed dotarciem do parsera; sam plik nie jest czytany.
//
// Jeśli w przyszłości trzeba wrócić do starego CSV-parsera: kod jest zachowany
// w backupie mo9_agrorami.cjs.bak_pre_api_switch_<timestamp> na serwerze.

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const DOSTAWCA = 'MO9_Agrorami';
const HELPER_PATH = path.join(__dirname, '_agrorami_fetch_helper.cjs');
const NODE_BIN = process.execPath; // ta sama wersja Node co proces główny

function parseFile(_filePath) {
  let stdout;
  try {
    stdout = execFileSync(NODE_BIN, [HELPER_PATH], {
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024, // 64MB — katalog ~1000 produktów w JSON to grubo poniżej tego
      timeout: 120000, // 2 min — pełny pull z paginacją, z marginesem na odnowę tokenu
      env: process.env
    });
  } catch (e) {
    const stderrMsg = e && e.stderr ? String(e.stderr).slice(0, 500) : '';
    throw new Error(`Agrorami API: błąd pobierania danych: ${e.message}${stderrMsg ? ' | ' + stderrMsg : ''}`);
  }

  let result;
  try {
    result = JSON.parse(stdout);
  } catch (e) {
    throw new Error(`Agrorami API: niepoprawna odpowiedź helpera (nie-JSON): ${stdout.slice(0, 300)}`);
  }

  return {
    records: result.records || [],
    errors: result.errors || [],
    odrzucone: result.odrzucone || [],
    dostawca: DOSTAWCA
  };
}

module.exports = { parseFile, DOSTAWCA };
