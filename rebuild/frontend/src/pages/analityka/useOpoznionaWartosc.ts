/**
 * Opóźnienie wartości pola tekstowego — ŚWIADOME ODSTĘPSTWO O-10b-1 (decyzja użytkownika
 * z 2026-09-03).
 *
 * ⚠ ORYGINAŁ NIE MA DEBOUNCE. Pola „EAN" i „Kod produktu" karty „3.2 / 3.3" sterują
 * bezpośrednio kluczem zapytania (`queryKey: [ścieżka, n, a]`,
 * `deminified/frontend-index.js:27870`), więc każde naciśnięcie klawisza to nowe zapytanie.
 * Trasa `prices/product-history` NIE MA LIMIT-u i skanuje `historia_cen` — w nagraniu
 * 15 597 wierszy. Wpisanie trzynastocyfrowego EAN-u to trzynaście pełnych przebiegów.
 *
 * Dlatego 300 ms. Odstępstwo jest niewidoczne w kształcie odpowiedzi (GATE go nie dotyka)
 * i kosztuje jedną zauważalną rzecz: wynik pojawia się o te 300 ms później niż na produkcji.
 *
 * Blok 10c ma `ean/details?ean` i `ean-porownanie?ean` w dokładnie tej samej sytuacji —
 * hook stoi tu, w katalogu analityki, żeby nie powstał drugi taki sam.
 */
import { useEffect, useState } from "react";

/** Ile milisekund ciszy w polu przed wysłaniem zapytania. */
export const OPOZNIENIE_MS = 300;

export function useOpoznionaWartosc<T>(wartosc: T, opoznienie = OPOZNIENIE_MS): T {
  const [opozniona, ustaw] = useState(wartosc);

  useEffect(() => {
    const uchwyt = setTimeout(() => ustaw(wartosc), opoznienie);
    // Sprzątanie przy każdej zmianie: licznik startuje od nowa, więc szybkie pisanie
    // nie wypuszcza serii zapytań, tylko jedno — po ostatnim znaku.
    return () => clearTimeout(uchwyt);
  }, [wartosc, opoznienie]);

  return opozniona;
}
