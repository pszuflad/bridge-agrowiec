// Poprawki Marty (`manual_overrides`) — port `Gq()` (`deminified/backend-index.cjs:47319`).

import type { PozycjaZnormalizowana } from "./pozycja.js";

export interface WynikPoprawek {
  /** Pozycja po nałożeniu poprawek — w 3c identyczna z wejściem. */
  pozycja: PozycjaZnormalizowana;
  /** Nazwy pól, w których plik dostawcy jest sprzeczny z niepotwierdzoną poprawką Marty. */
  naruszono: string[];
  /** Wartości z pliku dostawcy dla naruszonych pól — trafiają do `snapshotJson._srcConflict`. */
  srcVals: Record<string, string>;
}

/**
 * ⚠ STUB PRZEPUSZCZAJĄCY — JEDYNE ŚWIADOMIE NIEPEŁNE MIEJSCE W SESJI 3c (plan.md D6).
 *
 * Oryginał czyta `manual_overrides` dla pary (dostawca, kod), nadpisuje pola pozycji wartościami
 * Marty i melduje naruszenia, gdy plik dostawcy niesie coś innego niż niepotwierdzona poprawka.
 * Cała ta logika należy do sesji **3d**, razem z endpointami `GET/PUT/DELETE /api/overrides`
 * i z repozytorium `manual_overrides`.
 *
 * Do czasu 3d NIE POWSTANĄ (odnotowane w raporcie 3c):
 *   • ostrzeżenie „plik nadpisuje poprawke Marty: …" (`:47709`)
 *   • składnik `powod` o konflikcie z poprawką Marty (`:47740`)
 *   • gałąź `_srcConflict` w `snapshotJson` (`:47740`)
 *   • udział `p.length > 0` w wymuszeniu `typZmiany: "blad"` (`:47758`)
 *
 * Podmiana tej funkcji na realną implementację jest jedyną zmianą, jakiej `tk()` do tego
 * potrzebuje — sygnatura jest już docelowa.
 */
export function zastosujPoprawkiMarty(
  _kodDostawcy: string,
  pozycja: PozycjaZnormalizowana,
): WynikPoprawek {
  return { pozycja, naruszono: [], srcVals: {} };
}
