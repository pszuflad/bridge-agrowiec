/**
 * Klient `/api/alerts` — backend gotowy od Iteracji 6 (ticket `18-FEATURE-widok-alerty`).
 *
 * ⚠ TEN WIDOK NIE PISZE ALERTÓW. Alerty tworzy wyłącznie IMPORT (bloki 3f-1/3f-2) —
 * przy błędzie HTTP, przy błędzie pobierania i przy ręcznym uploadzie. Stąd jedyna
 * mutacja w tym pliku dotyczy `status`.
 */
import { BAZA_API, naglowki, rzucGdyBlad, zadanie } from "@/lib/api";

/**
 * Kształt z `contract/fixtures/GET_alerts.json` — siedem pól.
 *
 * `poziom`, `typ` i `status` są w bazie zwykłym tekstem BEZ `CHECK`, więc typujemy je
 * jako `string`, a nie jako unię. Realnie występują cztery kombinacje (`db/snapshot.db`):
 * `Synchronizacja`/info/rozwiazany, `Błąd pobierania`/ostrzezenie/nowy,
 * `Ręczny upload`/info/rozwiazany, `Błąd HTTP`/ostrzezenie/nowy.
 */
export type Alert = {
  id: number;
  poziom: string;
  typ: string;
  opis: string;
  dostawca: string | null;
  status: string;
  /** ISO 8601. Backend zwraca listę posortowaną po tym polu MALEJĄCO. */
  data: string;
};

/** Statusy, którymi operuje widok — 1:1 z `StatusAlertu` w `backend/src/repos/alerts.ts`. */
export const STATUS_NOWY = "nowy";
export const STATUS_ROZWIAZANY = "rozwiazany";

/**
 * Cała tabela alertów jedną gołą tablicą — bez limitu i bez paginacji, jak w oryginale
 * (`listAlerts()`, `backend-index.cjs:44951`). Grupowanie powtórek dzieje się po stronie
 * klienta i POTRZEBUJE kompletu: na obciętym zbiorze licznik grupy („150×") kłamałby.
 *
 * Nie używamy domyślnego `queryFn` z `queryClient.ts` (`on401: returnNull`), bo widok ma
 * odróżniać brak alertów od braku sesji — tamten zwróciłby `null` i tabela pokazałaby
 * „brak alertów" przy wygasłym tokenie.
 */
export async function pobierzAlerty(): Promise<Alert[]> {
  const odpowiedz = await fetch(`${BAZA_API}/api/alerts`, {
    headers: naglowki(false),
    credentials: "include",
  });
  await rzucGdyBlad(odpowiedz);
  return (await odpowiedz.json()) as Alert[];
}

/**
 * Zmiana stanu alertu.
 *
 * ⚠ Odpowiedź to zawsze `{ok:true}` — także dla `id`, którego nie ma w bazie (oryginał
 * nie sprawdza istnienia wiersza, `backend-index.cjs:48689`). Nie da się z niej wyczytać,
 * czy cokolwiek się zmieniło, więc zwracamy `void`, a widok i tak przeładowuje listę.
 */
export async function zmienStatusAlertu(id: number, status: string): Promise<void> {
  await zadanie("PATCH", `/api/alerts/${id}`, { status });
}

/**
 * Limit równoległych PATCH-ów przy akcji na całej grupie.
 *
 * Kontrakt NIE MA trasy masowej, więc „oznacz wszystkie jako rozwiązane" to N osobnych
 * żądań. Największa grupa w produkcji to 150 alertów `MO3 — Błąd pobierania`; puszczenie
 * ich naraz zapchałoby pulę połączeń przeglądarki (6 na host) i ustawiło resztę aplikacji
 * w kolejce. Ósemka mieści się w tej puli z zapasem.
 */
export const LIMIT_ROWNOLEGLYCH_PATCHY = 8;

/** Wynik zbiorczej zmiany statusu — patrz `zmienStatusAlertow`. */
export type WynikZmianyGrupowej = {
  udane: number;
  /** Pierwszy napotkany błąd albo `null`, gdy przeszły wszystkie żądania. */
  blad: Error | null;
};

/**
 * Zmiana statusu wielu alertów naraz, porcjami po `LIMIT_ROWNOLEGLYCH_PATCHY`.
 *
 * ⚠ NIE PRZERYWA po pierwszym błędzie i nie rzuca wyjątkiem: przy 150 żądaniach część
 * przechodzi, część nie, a widok musi pokazać jedno i drugie — zwykły `throw` zgubiłby
 * informację, ile alertów już zamknięto, i lista rozjechałaby się z bazą.
 */
export async function zmienStatusAlertow(
  idki: number[],
  status: string,
): Promise<WynikZmianyGrupowej> {
  let udane = 0;
  let blad: Error | null = null;

  for (let i = 0; i < idki.length; i += LIMIT_ROWNOLEGLYCH_PATCHY) {
    const porcja = idki.slice(i, i + LIMIT_ROWNOLEGLYCH_PATCHY);
    const wyniki = await Promise.allSettled(porcja.map((id) => zmienStatusAlertu(id, status)));
    for (const wynik of wyniki) {
      if (wynik.status === "fulfilled") {
        udane += 1;
      } else {
        blad ??=
          wynik.reason instanceof Error ? wynik.reason : new Error(String(wynik.reason));
      }
    }
  }

  return { udane, blad };
}
