// „DA” = opona z wadą kosmetyczną. Dostawcy (MO5 Handlopex, MO3 Grasdorf) wpisują to w nazwie,
// a parser zostawia samo „DA” w modelu/bieżniku (np. `AGROLOX DA`) i w środku nazwy.
//
// ⭐ ODSTĘPSTWO OD PRODUKCJI (decyzja użytkowniczki, 2026-10-06): „DA” nie jest częścią modelu —
// ma być WYŁĄCZNIE na końcu nazwy (jak „DEMO”, `nazwa-demo.ts`). Parsery w `legacy/` są pilnowane
// bajt w bajt, więc korekta idzie warstwą po parserze, w `fabryka.ts`, obok `oczyscModelZDot`.
// Poprawka Marty (`manual_overrides`) nakładana później wygrywa z tą regułą.

type Pozycja = Record<string, unknown>;

/** Samodzielne `DA` wielkimi literami (nie część słowa, rozmiaru ani oznaczenia z `-`/`/`/`.`). */
const SLOWO_DA = /(?<![\p{L}\p{N}/.-])DA(?![\p{L}\p{N}/.-])/u;
const SLOWO_DA_GLOBALNIE = new RegExp(SLOWO_DA.source, "gu");

export const maOznaczenieDa = (tekst: unknown): boolean =>
  typeof tekst === "string" && SLOWO_DA.test(tekst);

const bezDa = (tekst: string): string =>
  tekst.replace(SLOWO_DA_GLOBALNIE, " ").replace(/\s+/g, " ").trim();

/** Model/bieżnik bez samodzielnego `DA` (np. `AGROLOX DA` → `AGROLOX`); samo `DA` zostaje. */
export function modelBezDa(wartosc: unknown): unknown {
  if (typeof wartosc !== "string" || !maOznaczenieDa(wartosc)) return wartosc;
  return bezDa(wartosc) || wartosc;
}

/**
 * Gdy w nazwie z pliku (albo w nazwie pozycji) jest samodzielne `DA`: zdejmuje je z modelu
 * i bieżnika, a w nazwie zostawia jedno `DA` na końcu. Inaczej zwraca pozycję bez zmian.
 */
export function zastosujOznaczenieDa(d: Pozycja, nazwaZrodla: unknown): Pozycja {
  if (!maOznaczenieDa(nazwaZrodla) && !maOznaczenieDa(d.nazwa)) return d;
  const wynik: Pozycja = { ...d };
  for (const pole of ["model", "bieznik"] as const) wynik[pole] = modelBezDa(wynik[pole]);
  const baza = bezDa(String(d.nazwa ?? nazwaZrodla ?? ""));
  wynik.nazwa = baza ? `${baza} DA` : "DA";
  return wynik;
}
