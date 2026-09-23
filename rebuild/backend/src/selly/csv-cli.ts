/**
 * Wejście dla `npm run selly:csv` — generuje plik CSV dla Selly poza procesem serwera
 * (backlog #102, karta I15.3).
 *
 * ⭐ PO CO TO JEST. W produkcji plik o 6:00 generuje **cron systemowy** uruchamiający
 * `mirror/backend/generate_selly_export.cjs` — skrypt spoza aplikacji (`selly/routes.cjs:297`
 * „Plik generowany cronem ~6:00"). Odbudowa miała dotąd wyłącznie trasę ręczną
 * `POST /api/selly/generate-csv`, więc po cutoverze albo cron dalej odpalałby STARY skrypt na
 * tej samej bazie, albo plik przestałby się odświeżać i Selly o 12:00 zaciągałoby wczorajszy
 * katalog. To polecenie jest tym, na co cutover przepina crona (`docs/cutover.md`).
 *
 * ⚠ TA SAMA FUNKCJA CO TRASA. Woła `wygenerujCsvSelly()` — dokładnie to, co robi
 * `POST /api/selly/generate-csv` (`routes/selly.ts`). Plik z crona i plik z panelu są
 * bajt w bajt identyczne, bo to jedna ścieżka kodu, a nie dwie kopie formatu. Pilnuje tego
 * test w `test/selly.generator-csv.test.ts`.
 *
 * ⚠ NIE DOTYKA `.htaccess`. Katalog eksportu na produkcji jest chroniony `.htaccess` z białą
 * listą IP (Selly + Agrowiec). `wygenerujCsvSelly` nadpisuje wyłącznie sam plik CSV przez
 * `rename` pliku tymczasowego — reszta katalogu zostaje nietknięta
 * (`docs/cutover.md`, krok „Frontend na miejsce").
 *
 * Konfiguracja idzie przez `wczytajEnv()`, tak samo jak w `server.ts`, więc `SELLY_CSV_DIR`,
 * `SELLY_CSV_PLIK` i `SELLY_CSV_URL` rozwiązują się identycznie jak w trasie (domyślne =
 * wartości produkcyjne) — bez przepisywania tych trzech domyślnych w drugie miejsce.
 *
 * ⚠ DLACZEGO PODSTAWIAMY `JWT_SECRET`. `wczytajEnv()` wymaga go, bo serwer bez niego nie ma prawa
 * wstać — ale generowanie CSV nie dotyka ani logowania, ani tokenów. Cron to osobna linia
 * w `crontab`, która NIE dziedziczy środowiska procesu serwera; gdyby brak `JWT_SECRET`
 * przewracał to polecenie, plik dla Selly przestałby się odświeżać i **dowiedzielibyśmy się
 * o tym dopiero z tego, że sklep ma wczorajsze ceny**. Podstawiamy więc wartość zastępczą,
 * a realna z otoczenia i tak ma pierwszeństwo (rozwinięcie `process.env` jest DRUGIE).
 * `DB_PATH` zostaje WYMAGANY — tam cichy fallback byłby groźny (pisalibyśmy do nie tej bazy).
 */
import { wczytajEnv } from "../config/env.js";
import { otworzBaze } from "../db/index.js";
import { wygenerujCsvSelly } from "./generator-csv.js";

const env = wczytajEnv({ JWT_SECRET: "nieuzywany-przy-generowaniu-csv", ...process.env });
const { sqlite, db } = otworzBaze(env.DB_PATH);

try {
  const wynik = wygenerujCsvSelly(db, {
    katalog: env.SELLY_CSV_DIR,
    plik: env.SELLY_CSV_PLIK,
    url: env.SELLY_CSV_URL,
  });
  // Te same cztery linie, które wypisywał `generate_selly_export.cjs` — cron produkcji
  // loguje stdout, więc treść zostaje rozpoznawalna dla kogoś, kto czyta stare logi.
  process.stdout.write(wynik.stdout);
} catch (blad) {
  console.error("selly:csv — nie udało się wygenerować pliku CSV:", blad);
  process.exitCode = 1;
} finally {
  sqlite.close();
}
