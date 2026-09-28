// Waga gabarytowa — formuła PALETOWA/OPONOWA z `POST /api/waga-gabarytowa/oblicz`.
//
// Port 1:1 handlera `deminified/backend-index.cjs:48749-48769` (jedno wystąpienie w
// `mirror/backend/index.cjs`, żaden `patch_*.cjs` tej trasy nie nadpisuje — sprawdzone).
//
// ⚠ TO NIE JEST TEN SAM WZÓR CO NA FRONCIE. Widok `/waga-gabarytowa` liczy w przeglądarce
// wagę WOLUMETRYCZNĄ kurierską (`dł × szer × wys / dzielnik przewoźnika`,
// `deminified/frontend-index.js:26656-26685`) i tego endpointu NIE WOŁA — ani w produkcji,
// ani w odbudowie (plan.md D1). Dwie różne funkcje biznesowe pod jedną nazwą; sklejenie ich
// w „jedno źródło logiki" byłoby zmianą zachowania, nie deduplikacją.

/** Cztery klucze `waga_gab.*` sterujące formułą (`backend-index.cjs:45633-45637`). */
export type UstawieniaWagiGabarytowej = {
  /** Próg półpalety w cm — szerokość do niego zaokrągla się w dół do stałej 60. */
  szerPolpaleta: number;
  /** Próg palety w cm — szerokość powyżej półpalety zaokrągla się do tej wartości. */
  szerPaleta: number;
  /** Wysokość samej palety w cm, doliczana do wysokości ładunku. */
  wysPalety: number;
  /** Mnożnik objętości → kilogramy (domyślnie DPD 1/6000, czyli 1 m³ = 167 kg). */
  wspolczynnik: number;
};

/** Ciało żądania — wszystkie pola opcjonalne, dokładnie jak w oryginale. */
export type WymiaryZadania = {
  szerokosc?: unknown;
  dlugosc?: unknown;
  wysokosc?: unknown;
};

/** Odpowiedź 200 — pięć pól, ani jednego więcej (`:48766-48769`). */
export type WynikWagiGabarytowej = {
  wagaGabarytowa: number;
  szerokoscEfektywna: number;
  wysokoscZPaleta: number;
  wspolczynnik: number;
  opis: string;
};

/**
 * `parseFloat(c.body.pole || "0")` z oryginału (`:48755-48757`).
 *
 * ⚠ Odtwarzamy CAŁE zachowanie tego wyrażenia, z jego dziwactwami:
 *   - brak pola, `null`, `0`, `""`, `false` → `||` podstawia `"0"` → 0;
 *   - `"abc"` → `parseFloat` daje NaN i NaN idzie dalej przez całą formułę (patrz niżej);
 *   - `"60cm"` → 60, bo `parseFloat` czyta prefiks liczbowy.
 * Nie „naprawiamy" tego walidacją — oryginał nie zwraca 400 dla żadnego wejścia.
 */
function naLiczbe(wartosc: unknown): number {
  return Number.parseFloat(String(wartosc || "0"));
}

/**
 * Liczy wagę gabarytową paletową (`:48758-48765`).
 *
 * ⚠ NaN PRZECHODZI PRZEZ CAŁĄ FORMUŁĘ — i tak ma zostać. Gdy szerokość jest NaN, oba
 * porównania (`h <= p`, `h <= f`) są fałszywe, więc wpada trzecia gałąź i `T = NaN`;
 * `wagaGabarytowa` wychodzi NaN, a `res.json` serializuje NaN do `null`. Dokładnie to
 * dziś dostaje klient produkcji, więc nie dokładamy tu ani strażnika, ani błędu 400.
 */
export function obliczWageGabarytowa(
  wymiary: WymiaryZadania,
  ustawienia: UstawieniaWagiGabarytowej,
): WynikWagiGabarytowej {
  const { szerPolpaleta, szerPaleta, wysPalety, wspolczynnik } = ustawienia;

  const szerokosc = naLiczbe(wymiary.szerokosc);
  const dlugosc = naLiczbe(wymiary.dlugosc);
  const wysokosc = naLiczbe(wymiary.wysokosc);

  let szerokoscEfektywna: number;
  let opis: string;

  if (szerokosc <= szerPolpaleta) {
    // Stała 60 jest w oryginale zapisana wprost, NIE bierze się z `szer_polpaleta`
    // (`:48758`) — półpaleta o progu 55 cm rozlicza się jako 60 cm.
    szerokoscEfektywna = 60;
    opis = `Szerokość ${szerokosc} cm ≤ ${szerPolpaleta} cm (półpaleta) → zaokrąglone do 60 cm`;
  } else if (szerokosc <= szerPaleta) {
    szerokoscEfektywna = szerPaleta;
    opis =
      `Szerokość ${szerokosc} cm > ${szerPolpaleta} cm, ≤ ${szerPaleta} cm (paleta) ` +
      `→ zaokrąglone do ${szerPaleta} cm`;
  } else {
    szerokoscEfektywna = szerokosc;
    opis = `Szerokość ${szerokosc} cm > ${szerPaleta} cm → użyto oryginału`;
  }

  const wysokoscZPaleta = wysokosc + wysPalety;
  const waga = szerokoscEfektywna * dlugosc * wysokoscZPaleta * wspolczynnik;

  return {
    // `Math.round(x * 1e3) / 1e3` — trzy miejsca po przecinku (`:48766`).
    wagaGabarytowa: Math.round(waga * 1e3) / 1e3,
    szerokoscEfektywna,
    wysokoscZPaleta,
    wspolczynnik,
    opis,
  };
}
