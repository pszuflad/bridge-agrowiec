/**
 * Wirtualizacja wierszy tabeli katalogu — odtworzenie mechanizmu z `AT()`
 * (`deminified/frontend-index.js:23191-23255`, obliczenia w :23312).
 *
 * Oryginał nie używa biblioteki: nasłuchuje scrolla głównego kontenera (`#$vMainScroll`,
 * ten sam element mamy w `components/AppShell.tsx`), mierzy odległość tabeli od jego góry
 * i renderuje tylko widoczny wycinek wierszy, dokładając puste `<tr>` o wyliczonej
 * wysokości nad i pod nim.
 *
 * Włącza się dopiero powyżej 150 wierszy NA STRONIE — przy domyślnym rozmiarze strony
 * (25) nie działa wcale; ma znaczenie po wybraniu „Wszystkie".
 */
import { useEffect, useRef, useState, type RefObject } from "react";

/** Wysokość wiersza w pikselach (`$vROWH`). */
export const WYSOKOSC_WIERSZA = 37;
/** Zapas wierszy renderowanych poza widocznym obszarem (`$vOVER`). */
export const ZAPAS_WIERSZY = 20;
/** Próg, powyżej którego wirtualizacja się włącza (`$vActive`). */
export const PROG_WIRTUALIZACJI = 150;

/** Kwant przewijania z oryginału — ogranicza liczbę przerysowań (frontend-index.js:23222). */
const KWANT_SCROLLA = 74;
const PROG_SKOKU = 444;

export type OknoWirtualizacji = {
  /** Podpinany do kontenera z poziomym scrollem tabeli — potrzebny do pomiaru offsetu. */
  refKontenera: RefObject<HTMLDivElement>;
  aktywna: boolean;
  start: number;
  koniec: number;
  wysokoscGora: number;
  wysokoscDol: number;
};

/**
 * Zwraca zakres wierszy do wyrenderowania dla listy o zadanej długości.
 * Gdy wirtualizacja jest wyłączona, oddaje cały zakres i zerowe spacery.
 */
export function useWirtualizacja(liczbaWierszy: number): OknoWirtualizacji {
  const refKontenera = useRef<HTMLDivElement>(null);
  const gornaKrawedzRef = useRef(0);
  const [przewinieto, setPrzewinieto] = useState(0);
  const [wysokoscOkna, setWysokoscOkna] = useState(600);

  useEffect(() => {
    const scroller = document.getElementById("$vMainScroll");
    if (!scroller) return;

    let klatka: number | null = null;

    const zmierz = (): void => {
      const kontener = refKontenera.current;
      if (kontener) {
        gornaKrawedzRef.current =
          kontener.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop;
      }
      setWysokoscOkna(scroller.clientHeight || 600);
    };

    const naScroll = (): void => {
      if (klatka !== null) return;
      klatka = requestAnimationFrame(() => {
        const pozycja = Math.max(0, scroller.scrollTop - gornaKrawedzRef.current);
        // Kwantyzacja z oryginału: przerysowujemy dopiero po przesunięciu o pełny kwant,
        // albo po skoku większym niż `PROG_SKOKU` (np. przeciągnięcie suwaka).
        setPrzewinieto((poprzednia) => {
          const skwantowana = Math.round(pozycja / KWANT_SCROLLA) * KWANT_SCROLLA;
          if (Math.abs(skwantowana - poprzednia) >= KWANT_SCROLLA) return skwantowana;
          return Math.abs(pozycja - poprzednia) > PROG_SKOKU ? pozycja : poprzednia;
        });
        klatka = null;
      });
    };

    zmierz();
    scroller.addEventListener("scroll", naScroll, { passive: true });
    window.addEventListener("resize", zmierz);
    return () => {
      if (klatka !== null) cancelAnimationFrame(klatka);
      scroller.removeEventListener("scroll", naScroll);
      window.removeEventListener("resize", zmierz);
    };
  }, []);

  const aktywna = liczbaWierszy > PROG_WIRTUALIZACJI;
  const start = aktywna
    ? Math.max(0, Math.floor(przewinieto / WYSOKOSC_WIERSZA) - ZAPAS_WIERSZY)
    : 0;
  const koniec = aktywna
    ? Math.min(
        liczbaWierszy,
        Math.ceil((przewinieto + wysokoscOkna) / WYSOKOSC_WIERSZA) + ZAPAS_WIERSZY,
      )
    : liczbaWierszy;

  return {
    refKontenera,
    aktywna,
    start,
    koniec,
    wysokoscGora: aktywna ? start * WYSOKOSC_WIERSZA : 0,
    wysokoscDol: aktywna ? (liczbaWierszy - koniec) * WYSOKOSC_WIERSZA : 0,
  };
}
