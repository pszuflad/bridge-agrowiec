// Silnik importu — wejście dla tras i schedulera.
//
// ⭐ CO SIĘ TU ZMIENIŁO W I15.4b. Do ticketu 130 ten plik zawierał port żywego `tk()`
// z bundla (`deminified/backend-index.cjs:47584-47851`). Na `88fa31c` ta funkcja jest
// MARTWA — `mirror/backend/index.cjs` nadpisuje ją polityką stagingu:
//
//   tk = require("./staging_policy.cjs").install({U, db:Qi, normalize:Hq, classify:Zc,
//                                                 badName:Kq, ext:__BRIDGE_EXT});
//
// Cała logika siedzi więc teraz w `import/polityka/fabryka.ts`, a ten plik jest wyłącznie
// cienką warstwą zgodności: utrzymuje nazwę `silnikStagingu`, typ `SilnikStagingu` i eksport
// `PustyImportBlad`, których używają trasy, scheduler i testy.
//
// Stary port nie został „poprawiony" ani częściowo przeniesiony — został ZASTĄPIONY, bo
// odtwarzał inny silnik. Różnice w zachowaniu (m.in. ciche nakładanie poprawek Marty zamiast
// raportowania konfliktu, dopasowanie po EAN tylko do jednej zgodnej opony, natychmiastowe
// wstrzymanie zamiast licznika nieobecności) są skutkiem #99/#103/#104 i widać je we
// wzorcach charakteryzacji przenagranych z `88fa31c`.

import type { Baza } from "../db/index.js";
import {
  pusteStatystyki,
  stworzPolitykeStagingu,
  type OpcjeImportu,
  type StatystykiImportu,
  type ZaleznosciPolityki,
} from "./polityka/fabryka.js";
import { zadajOdswiezenie } from "../selly/dostepnosc.js";
import type { RekordSurowy } from "./typy.js";

export {
  BladOdczytuCennikaBlad,
  CennikMasowoNierozpoznanyBlad,
  CennikPodejrzanieMalyBlad,
  jestBlokadaZrodla,
  PustyImportBlad,
} from "./polityka/bledy.js";

export { pusteStatystyki };
export type { OpcjeImportu, StatystykiImportu, ZaleznosciPolityki };

/** Pozycja listy `szczegolyOdrzuconych`. */
export type SzczegolOdrzucenia = StatystykiImportu["szczegolyOdrzuconych"][number];

/**
 * Silnik stagingu — sygnatura jak `importer(supplier, incoming, options)` z oryginału.
 *
 * Trzeci argument jest OPCJONALNY i niesie przede wszystkim `meta` z `feed_safety` (#103).
 * Jego brak znaczy „oferta niekompletna": silnik nie zlicza wtedy braków, nie wstrzymuje
 * automatycznie i nie zapisuje wersji oferty. To bezpieczny domyślny stan dla wejść, które
 * nie przeszły przez dispatcher (np. `POST /api/staging/import` z ciałem żądania).
 */
export type SilnikStagingu = (
  kodDostawcy: string,
  surowe: RekordSurowy[],
  opcje?: OpcjeImportu,
) => StatystykiImportu;

/**
 * Buduje silnik importu dla danej bazy.
 *
 * @param zaleznosci szew na moduł dostępności z karty I15.10. Domyślnie wpięty
 *   `zadajOdswiezenie` z `src/selly/dostepnosc.ts` — funkcja opisana tam wprost jako
 *   „punkt wejścia dla karty I15.4".
 *
 * ⚠ Wpięcie jest BEZPIECZNE bez dodatkowej konfiguracji: `zadajOdswiezenie()` bez zamontowanej
 * instancji nie robi NIC (`dostepnosc.ts:127-130`). To celowy odpowiednik bramki oryginału
 * (`staging_policy.cjs:131-134`), która wychodzi, gdy baza nie jest produkcyjna — kopia testowa
 * nigdy nie wysyła do sklepu ani nie publikuje produkcyjnego CSV. Montaż instancji należy
 * do I15.8 (`ustawDomyslnaSynchronizacjeDostepnosci`), nie do tej karty.
 */
export function silnikStagingu(db: Baza, zaleznosci: ZaleznosciPolityki = {}): SilnikStagingu {
  const polityka = stworzPolitykeStagingu(db, {
    odswiezDostepnosc: zadajOdswiezenie,
    ...zaleznosci,
  });
  return (kodDostawcy, surowe, opcje) => polityka.importer(kodDostawcy, surowe, opcje);
}
