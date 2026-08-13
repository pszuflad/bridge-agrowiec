// Patch: dodaje endpoint GET /api/selly/csv-status do selly/routes.cjs
// Wskaznik codziennej synchronizacji CSV (plik generowany o 6:00 do folderu Selly-pull).
const fs = require('fs');
const path = require('path');

const ROUTES = '/home/admin/private_apps/bridge/selly/routes.cjs';
const src = fs.readFileSync(ROUTES, 'utf8');

const MARKER = "  console.log('[Selly] Zarejestrowano endpointy /api/selly/*');";
if (src.includes('/api/selly/csv-status')) {
  console.log('JUZ ISTNIEJE - pomijam');
  process.exit(0);
}
if (!src.includes(MARKER)) {
  console.error('BLAD: nie znaleziono markera rejestracji. Przerywam.');
  process.exit(1);
}

const ENDPOINT = `
  // ---- Status codziennego eksportu CSV (Selly pull) ----
  // Plik generowany cronem ~6:00 przez generate_selly_export.cjs
  app.get('/api/selly/csv-status', auth, (req, res) => {
    try {
      const CSV_PATH = '/home/admin/domains/agritires.eu/public_html/panel/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv';
      const CSV_URL  = 'https://agritires.eu/panel/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv';
      const fsx = require('fs');
      if (!fsx.existsSync(CSV_PATH)) {
        return res.json({ ok: false, exists: false, status: 'blad', powod: 'Brak pliku CSV', url: CSV_URL });
      }
      const st = fsx.statSync(CSV_PATH);
      // liczba wierszy bez naglowka - liczymy znaki nowej linii
      let wiersze = 0;
      try {
        const buf = fsx.readFileSync(CSV_PATH);
        for (let i = 0; i < buf.length; i++) { if (buf[i] === 10) wiersze++; }
        // plik ma CRLF i konczy sie \\r\\n; naglowek to 1 linia -> dane = wiersze-1
        wiersze = Math.max(0, wiersze - 1);
      } catch (e) { wiersze = null; }

      const mtime = st.mtime;
      const teraz = new Date();
      const dzisiaj = mtime.getFullYear() === teraz.getFullYear()
        && mtime.getMonth() === teraz.getMonth()
        && mtime.getDate() === teraz.getDate();
      const wiekMin = Math.round((teraz - mtime) / 60000);

      // OK = wygenerowany dzisiaj i niepusty
      const okStatus = dzisiaj && st.size > 0 && (wiersze === null || wiersze > 0);

      res.json({
        ok: okStatus,
        exists: true,
        status: okStatus ? 'ok' : 'blad',
        powod: okStatus ? null : (!dzisiaj ? 'Plik nie zostal wygenerowany dzisiaj' : 'Plik pusty'),
        ostatnia_synchronizacja: mtime.toISOString(),
        wygenerowany_dzisiaj: dzisiaj,
        wiek_minut: wiekMin,
        wiersze: wiersze,
        rozmiar_bajty: st.size,
        rozmiar_mb: +(st.size / 1048576).toFixed(2),
        url: CSV_URL,
      });
    } catch (e) {
      res.status(500).json({ ok: false, status: 'blad', error: e.message });
    }
  });

`;

const patched = src.replace(MARKER, ENDPOINT + MARKER);
fs.writeFileSync(ROUTES, patched, 'utf8');
console.log('OK: dodano endpoint /api/selly/csv-status do routes.cjs');
console.log('nowy rozmiar:', patched.length, 'bajtow (bylo', src.length + ')');
