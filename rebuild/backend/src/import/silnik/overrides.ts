// Poprawki Marty (`manual_overrides`) — port `Gq()` (`deminified/backend-index.cjs:47319-47348`).

import { poprawkiDla } from "../../repos/overrides.js";
import type { Baza } from "../../db/index.js";
import type { PozycjaZnormalizowana } from "./pozycja.js";

export interface WynikPoprawek {
  /** Pozycja po nałożeniu poprawek Marty. */
  pozycja: PozycjaZnormalizowana;
  /** Nazwy pól, w których plik dostawcy jest sprzeczny z niepotwierdzoną poprawką Marty. */
  naruszono: string[];
  /** Wartości z pliku dostawcy dla naruszonych pól — trafiają do `snapshotJson._srcConflict`. */
  srcVals: Record<string, string>;
}

/** Sygnatura, którą widzi `tk()`. Baza jest domknięta przez `poprawkiMarty(db)`. */
export type ZastosujPoprawkiMarty = (
  kodDostawcy: string,
  pozycja: PozycjaZnormalizowana,
) => WynikPoprawek;

/**
 * Buduje strażnika poprawek Marty dla danej bazy.
 *
 * ⭐ ROLA W SILNIKU: to jest miejsce, w którym ręczna decyzja człowieka wygrywa z plikiem
 * dostawcy. Import NIGDY nie nadpisuje wartości, którą Marta poprawiła — zamiast tego
 * podmienia ją z powrotem na wartość Marty i MELDUJE konflikt, żeby człowiek zobaczył,
 * że plik chciał czegoś innego.
 *
 * ⚠ TRZY NIESYMETRIE ORYGINAŁU, ODTWORZONE DOSŁOWNIE:
 *
 * 1. **Podmiana jest bezwarunkowa, meldunek nie.** `r[s.fieldName] = s.overrideValue`
 *    wykonuje się dla KAŻDEJ poprawki (`:47344`), także wtedy, gdy plik przyniósł `null`
 *    albo dokładnie tę samą wartość. Naruszenie melduje się tylko wtedy, gdy wartość z pliku
 *    jest niepusta ORAZ różna od poprawki ORAZ różna od `acknowledgedSourceValue`.
 *
 * 2. **`acknowledgedSourceValue` wycisza alarm, nie samą poprawkę.** Gdy Marta raz
 *    zaakceptowała pozycję, wartość z pliku zostaje zapamiętana jako „widziana" i ten sam
 *    konflikt nie wraca przy każdym imporcie. Poprawka nadal wygrywa.
 *
 * 3. **`overrideValue` jest zawsze STRINGIEM** (kolumna `TEXT NOT NULL`), więc nałożenie
 *    poprawki na pole liczbowe zmienia typ wartości w pozycji. Porównania w `tk()` idą
 *    przez `String()`, więc oryginałowi to nie przeszkadza — i nam też nie może.
 */
export function poprawkiMarty(db: Baza): ZastosujPoprawkiMarty {
  return (kodDostawcy, pozycja) => {
    const kod = pozycja.kod ? String(pozycja.kod) : "";
    if (!kod) return { pozycja, naruszono: [], srcVals: {} };

    const poprawki = poprawkiDla(db, kodDostawcy, kod);
    if (poprawki.length === 0) return { pozycja, naruszono: [], srcVals: {} };

    const wynik = { ...pozycja } as PozycjaZnormalizowana;
    const naruszono: string[] = [];
    const srcVals: Record<string, string> = {};

    for (const poprawka of poprawki) {
      const zPliku = (pozycja as unknown as Record<string, unknown>)[poprawka.fieldName];

      // Niesymetria 1: pusta wartość z pliku NIE jest konfliktem — plik po prostu nic nie wie.
      if (zPliku != null && String(zPliku) !== poprawka.overrideValue) {
        // Niesymetria 2: konflikt już potwierdzony przez człowieka nie alarmuje ponownie.
        if (
          poprawka.acknowledgedSourceValue == null ||
          String(zPliku) !== String(poprawka.acknowledgedSourceValue)
        ) {
          naruszono.push(poprawka.fieldName);
          srcVals[poprawka.fieldName] = String(zPliku);
        }
      }

      // Poza pętlą warunków: podmiana zachodzi ZAWSZE (`:47344`).
      (wynik as unknown as Record<string, unknown>)[poprawka.fieldName] = poprawka.overrideValue;
    }

    return { pozycja: wynik, naruszono, srcVals };
  };
}
