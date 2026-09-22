// Pomocniczy skrypt uruchamiany jako osobny proces (przez execSync z mo9_agrorami.cjs).
// Powód: parseFile() w dispatcherze MUSI być synchroniczne (woła je sync helper `nq()`
// w index.cjs, bez await), a pobranie danych z API Agrorami jest z natury asynchroniczne
// (fetch + generateCustomerToken). Ten skrypt robi cała robotę w swoim procesie,
// czeka na wynik, i wypisuje go jako JSON na stdout — proces rodzica czyta go synchronicznie.
'use strict';

const path = require('path');
const api = require(path.join(__dirname, 'mo9_agrorami_api.cjs'));

(async () => {
  try {
    const result = await api.fetchAll();
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (e) {
    process.stderr.write(String(e && e.stack ? e.stack : e));
    process.exit(1);
  }
})();
