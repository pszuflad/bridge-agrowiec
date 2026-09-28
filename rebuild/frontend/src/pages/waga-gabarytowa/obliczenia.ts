/**
 * Waga gabarytowa liczona W PRZEGLĄDARCE — port `:26656-26685` (przycisk „Oblicz").
 *
 * ⚠ TO NIE JEST WZÓR Z BACKENDU I NIE MA BYĆ. `POST /api/waga-gabarytowa/oblicz` liczy wagę
 * PALETOWĄ (progi półpalety/palety, doliczona wysokość palety, współczynnik z configu —
 * `rebuild/backend/src/waga-gabarytowa/formula.ts`). Ten widok liczy wagę WOLUMETRYCZNĄ
 * kurierską z dzielnikiem przewoźnika i tamtego endpointu NIE WOŁA — tak samo jak produkcja
 * (`docs/spec-frontend.md:79`, w całym komponencie oryginału nie ma ani jednego `fetch`).
 * To dwie różne funkcje biznesowe pod jedną nazwą; decyzja świadoma, plan.md D1.
 */
import type { Przewoznik } from "./przewoznicy";

export type WynikWagi = {
  wagaGabarytowa: number;
  wagaRzeczywista: number | null;
  /** `max(gabarytowa, rzeczywista)` — `null`, gdy wagi rzeczywistej nie podano. */
  wagaDoWyceny: number | null;
  objetoscM3: number;
  dlugosc: number;
  szerokosc: number;
  wysokosc: number;
  dzielnik: number;
  przewoznik: string;
};

/** Wymiary prosto z inputów — jako tekst, bo takie trzyma stan widoku i IndexedDB. */
export type WymiaryTekstem = {
  dlugosc: string;
  szerokosc: string;
  wysokosc: string;
  wagaRzeczywista: string;
};

/**
 * `parseFloat(x.replace(",", "."))` z oryginału (`:26657-26660`) — Ania pisze „12,5"
 * z klawiatury numerycznej, a `parseFloat` sam z siebie przecinka nie zrozumie.
 */
export function naLiczbe(tekst: string): number {
  return Number.parseFloat(tekst.replace(",", "."));
}

/**
 * Walidacja z oryginału (`:26661`): trzy wymiary muszą być skończonymi liczbami dodatnimi.
 * Waga rzeczywista jest opcjonalna i NIE jest walidowana — pusta znaczy „nie podano",
 * a nieparsowalna schodzi do `null` przez sprawdzenie `Number.isFinite` niżej.
 */
export function wymiaryPoprawne(wymiary: WymiaryTekstem): boolean {
  return [wymiary.dlugosc, wymiary.szerokosc, wymiary.wysokosc]
    .map(naLiczbe)
    .every((liczba) => Number.isFinite(liczba) && liczba > 0);
}

/**
 * Liczy wynik dla poprawnych wymiarów; `null`, gdy walidacja nie przechodzi
 * (wywołujący pokazuje wtedy toast „Niepoprawne wymiary").
 */
export function policzWage(
  wymiary: WymiaryTekstem,
  przewoznik: Przewoznik,
): WynikWagi | null {
  if (!wymiaryPoprawne(wymiary)) return null;

  const dlugosc = naLiczbe(wymiary.dlugosc);
  const szerokosc = naLiczbe(wymiary.szerokosc);
  const wysokosc = naLiczbe(wymiary.wysokosc);
  // Pusty input to „nie podano" (`i ? parseFloat(...) : null`, `:26660`).
  const rzeczywista = wymiary.wagaRzeczywista ? naLiczbe(wymiary.wagaRzeczywista) : null;

  const objetoscCm3 = dlugosc * szerokosc * wysokosc;
  const wagaGabarytowa = objetoscCm3 / przewoznik.dzielnik;

  return {
    wagaGabarytowa,
    wagaRzeczywista: rzeczywista,
    // ⚠ `Number.isFinite` jest w oryginale (`:26672`): „abc" w wadze rzeczywistej daje NaN,
    // a wtedy pole „waga do wyceny" ma się NIE pokazać, zamiast pokazać NaN kg.
    wagaDoWyceny:
      rzeczywista !== null && Number.isFinite(rzeczywista)
        ? Math.max(wagaGabarytowa, rzeczywista)
        : null,
    objetoscM3: objetoscCm3 / 1e6,
    dlugosc,
    szerokosc,
    wysokosc,
    dzielnik: przewoznik.dzielnik,
    // Zapisujemy NAZWĘ, nie id — wynik przeżywa w IndexedDB usunięcie przewoźnika z listy.
    przewoznik: przewoznik.nazwa,
  };
}
