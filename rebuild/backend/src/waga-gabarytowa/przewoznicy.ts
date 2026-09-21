// Wspólna lista przewoźników wagi WOLUMETRYCZNEJ — typ i walidacja ciała `PUT`.
//
// ⚠ ODSTĘPSTWO ŚWIADOME (backlog #27, ticket 76, karta P9.1): w produkcji ta lista żyje
// wyłącznie w IndexedDB przeglądarki i serwer jej nie zna, więc walidacja jest NOWA, nie
// portowana. Reguły odtwarzają to, czego pilnuje dziś UI (`TabelaPrzewoznikow.tsx`):
// co najmniej jeden przewoźnik, nazwa niepusta, dzielnik liczbą dodatnią. Do tego dwie reguły
// spójności, których w IndexedDB nikt nie pilnował: id bez powtórzeń i najwyżej jeden domyślny.
//
// To NIE jest wejście kalkulatora paletowego (`formula.ts`) — tamten bierze progi z `config`.

/** Przewoźnik w kształcie API — ten sam, który front trzymał w IndexedDB. */
export type Przewoznik = {
  id: string;
  nazwa: string;
  /** Dzielnik wzoru `dł × szer × wys / dzielnik` — im mniejszy, tym cięższa paczka. */
  dzielnik: number;
  /** Znacznik z oryginału, niesiony przy GEIS-ie. Wyboru nie steruje (ten jest per przeglądarka). */
  domyslny: boolean;
};

export type WynikWalidacji = { ok: true; lista: Przewoznik[] } | { ok: false; blad: string };

const czyObiekt = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Sprawdza ciało `PUT /api/waga-gabarytowa/przewoznicy` i zwraca listę w kształcie do zapisu.
 *
 * Dzielnik musi być LICZBĄ JSON — tekst `"5000"` odrzucamy, zamiast parsować, bo front zawsze
 * wysyła liczbę, a ciche rzutowanie ukryłoby błąd klienta. Nazwę sprawdzamy po `trim()`, ale
 * zapisujemy tak, jak przyszła (edytor oryginału też nie przycina nazwy przy zmianie).
 * Pola spoza kształtu są odcinane.
 */
export function zwalidujListePrzewoznikow(cialo: unknown): WynikWalidacji {
  if (!Array.isArray(cialo)) {
    return { ok: false, blad: "Oczekiwano listy przewoźników" };
  }
  if (cialo.length === 0) {
    return { ok: false, blad: "Musi pozostać co najmniej jeden przewoźnik" };
  }

  const lista: Przewoznik[] = [];
  const widziane = new Set<string>();
  let domyslnych = 0;
  for (const [indeks, pozycja] of cialo.entries()) {
    const nr = `Przewoźnik nr ${indeks + 1}`;
    if (!czyObiekt(pozycja)) return { ok: false, blad: `${nr}: oczekiwano obiektu` };

    const { id, nazwa, dzielnik, domyslny } = pozycja;
    if (typeof id !== "string" || id.trim() === "") {
      return { ok: false, blad: `${nr}: brak identyfikatora` };
    }
    if (widziane.has(id)) return { ok: false, blad: `${nr}: identyfikator „${id}" się powtarza` };
    widziane.add(id);

    if (typeof nazwa !== "string" || nazwa.trim() === "") {
      return { ok: false, blad: `${nr}: nazwa nie może być pusta` };
    }
    if (typeof dzielnik !== "number" || !Number.isFinite(dzielnik) || dzielnik <= 0) {
      return { ok: false, blad: `${nr}: dzielnik musi być liczbą dodatnią` };
    }
    if (domyslny !== undefined && typeof domyslny !== "boolean") {
      return { ok: false, blad: `${nr}: pole domyslny musi być wartością logiczną` };
    }

    if (domyslny === true && ++domyslnych > 1) {
      return { ok: false, blad: `${nr}: tylko jeden przewoźnik może być domyślny` };
    }

    lista.push({ id, nazwa, dzielnik, domyslny: domyslny ?? false });
  }

  return { ok: true, lista };
}
