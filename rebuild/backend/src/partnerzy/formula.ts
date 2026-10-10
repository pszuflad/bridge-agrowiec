// Pola obliczeniowe partnerów — bezpieczny parser i ewaluator wyrażeń (karta PARTNERZY, ticket 211 / PRT-2.3).
//
// Wyrażenie, np. `(zakup + zakup*narzut_FR + przesylka_FR + koszty_dodatkowe_FR) / kurs_EUR`. Bez `eval` i bez
// `Function` — własny parser rekurencyjny; formuła nie ma dostępu do niczego poza podanymi zmiennymi.
//
// Gramatyka: liczby (`12`, `1.05`; separator dziesiętny to KROPKA — przecinek rozdziela argumenty funkcji),
// zmienne (litery łącznie z polskimi, cyfry, `_`), operatory `+ - * /`, minus jednoargumentowy, nawiasy,
// funkcje: `zaokr(x, miejsca)`, `min(a, b, …)`, `max(a, b, …)`, `abs(x)`.
//
// Zasady bezpieczeństwa wyniku (karta: „NIGDY zero"): brak wartości zmiennej, dzielenie przez zero i wynik nieskończony lub
// NaN to BŁĄD, a nie 0 — pozycję z błędem kalkulacji pomija i loguje wywołujący (PRT-2.4).

export class BladFormuly extends Error {
  constructor(
    komunikat: string,
    /** Pozycja znaku w tekście formuły (0-based) albo `null`, gdy błąd dotyczy całości/obliczeń. */
    readonly pozycja: number | null = null,
  ) {
    super(komunikat);
    this.name = "BladFormuly";
  }
}

export type Wyrazenie =
  | { typ: "liczba"; wartosc: number }
  | { typ: "zmienna"; nazwa: string; pozycja: number }
  | { typ: "minus"; arg: Wyrazenie }
  | { typ: "dzialanie"; op: "+" | "-" | "*" | "/"; lewy: Wyrazenie; prawy: Wyrazenie; pozycja: number }
  | { typ: "funkcja"; nazwa: string; argumenty: Wyrazenie[]; pozycja: number };

type Zeton =
  | { rodzaj: "liczba"; wartosc: number; poz: number }
  | { rodzaj: "nazwa"; tekst: string; poz: number }
  | { rodzaj: "znak"; tekst: "+" | "-" | "*" | "/" | "(" | ")" | ","; poz: number };

const LITERA = /[A-Za-z_ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const CYFRA = /[0-9]/;
const MAKS_DLUGOSC = 2000;
const MAKS_GLEBOKOSC = 50;

/** Funkcje: nazwa → [min argumentów, max argumentów (null = bez limitu), implementacja]. */
const FUNKCJE: Record<string, [number, number | null, (a: number[]) => number]> = {
  zaokr: [2, 2, (a) => zaokraglij(a[0]!, a[1]!)],
  min: [1, null, (a) => Math.min(...a)],
  max: [1, null, (a) => Math.max(...a)],
  abs: [1, 1, (a) => Math.abs(a[0]!)],
};
export const NAZWY_FUNKCJI = Object.keys(FUNKCJE);

/** Zaokrąglenie „jak na kartce" (0,5 w górę), odporne na błąd zapisu binarnego (1,005 → 1,01). */
export function zaokraglij(x: number, miejsca: number): number {
  if (!Number.isInteger(miejsca) || miejsca < 0 || miejsca > 10) throw new BladFormuly("Liczba miejsc w zaokr() musi być całkowita z zakresu 0–10.");
  const przesuniete = Number(`${x}e${miejsca}`);
  return Number(`${Math.sign(x) * Math.round(Math.abs(przesuniete))}e-${miejsca}`);
}

function tokenizuj(tekst: string): Zeton[] {
  const zetony: Zeton[] = [];
  let i = 0;
  while (i < tekst.length) {
    const c = tekst[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (CYFRA.test(c) || (c === "." && CYFRA.test(tekst[i + 1] ?? ""))) {
      const start = i;
      while (i < tekst.length && (CYFRA.test(tekst[i]!) || tekst[i] === ".")) i++;
      const surowa = tekst.slice(start, i);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(surowa)) throw new BladFormuly(`Niepoprawna liczba „${surowa}”.`, start);
      zetony.push({ rodzaj: "liczba", wartosc: Number(surowa), poz: start });
    } else if (LITERA.test(c)) {
      const start = i;
      while (i < tekst.length && (LITERA.test(tekst[i]!) || CYFRA.test(tekst[i]!))) i++;
      zetony.push({ rodzaj: "nazwa", tekst: tekst.slice(start, i), poz: start });
    } else if ("+-*/(),".includes(c)) {
      zetony.push({ rodzaj: "znak", tekst: c as "+", poz: i });
      i++;
    } else {
      throw new BladFormuly(`Niedozwolony znak „${c}”.`, i);
    }
  }
  return zetony;
}

/** Parsuje formułę do drzewa. Rzuca `BladFormuly` z pozycją błędu. */
export function parsujFormule(tekst: string): Wyrazenie {
  if (typeof tekst !== "string" || tekst.trim() === "") throw new BladFormuly("Formuła jest pusta.");
  if (tekst.length > MAKS_DLUGOSC) throw new BladFormuly(`Formuła jest za długa (limit ${MAKS_DLUGOSC} znaków).`);
  const zetony = tokenizuj(tekst);
  let k = 0;
  const podglad = (): Zeton | undefined => zetony[k];
  const jestZnak = (z: string): boolean => {
    const t = podglad();
    return t?.rodzaj === "znak" && t.tekst === z;
  };
  const oczekuj = (z: string): void => {
    if (!jestZnak(z)) throw new BladFormuly(`Oczekiwano „${z}”.`, podglad()?.poz ?? tekst.length);
    k++;
  };

  const suma = (g: number): Wyrazenie => {
    let lewy = iloczyn(g);
    while (jestZnak("+") || jestZnak("-")) {
      const z = zetony[k++] as Extract<Zeton, { rodzaj: "znak" }>;
      lewy = { typ: "dzialanie", op: z.tekst as "+" | "-", lewy, prawy: iloczyn(g), pozycja: z.poz };
    }
    return lewy;
  };
  const iloczyn = (g: number): Wyrazenie => {
    let lewy = jednoargumentowy(g);
    while (jestZnak("*") || jestZnak("/")) {
      const z = zetony[k++] as Extract<Zeton, { rodzaj: "znak" }>;
      lewy = { typ: "dzialanie", op: z.tekst as "*" | "/", lewy, prawy: jednoargumentowy(g), pozycja: z.poz };
    }
    return lewy;
  };
  const jednoargumentowy = (g: number): Wyrazenie => {
    if (jestZnak("-")) {
      k++;
      return { typ: "minus", arg: jednoargumentowy(g) };
    }
    if (jestZnak("+")) {
      k++;
      return jednoargumentowy(g);
    }
    return podstawowy(g);
  };
  const podstawowy = (g: number): Wyrazenie => {
    if (g > MAKS_GLEBOKOSC) throw new BladFormuly("Formuła jest zbyt zagnieżdżona.", podglad()?.poz ?? tekst.length);
    const t = podglad();
    if (!t) throw new BladFormuly("Formuła kończy się za wcześnie.", tekst.length);
    if (t.rodzaj === "liczba") {
      k++;
      return { typ: "liczba", wartosc: t.wartosc };
    }
    if (t.rodzaj === "nazwa") {
      k++;
      if (jestZnak("(")) {
        const def = FUNKCJE[t.tekst];
        if (!def) throw new BladFormuly(`Nieznana funkcja „${t.tekst}” (dostępne: ${NAZWY_FUNKCJI.join(", ")}).`, t.poz);
        k++;
        const argumenty: Wyrazenie[] = [];
        if (!jestZnak(")")) {
          do argumenty.push(suma(g + 1));
          while (jestZnak(",") && ++k);
        }
        oczekuj(")");
        const [min, max] = def;
        if (argumenty.length < min || (max !== null && argumenty.length > max))
          throw new BladFormuly(`Funkcja ${t.tekst}() przyjmuje ${max === min ? min : max === null ? `co najmniej ${min}` : `${min}–${max}`} arg.`, t.poz);
        return { typ: "funkcja", nazwa: t.tekst, argumenty, pozycja: t.poz };
      }
      return { typ: "zmienna", nazwa: t.tekst, pozycja: t.poz };
    }
    if (t.tekst === "(") {
      k++;
      const w = suma(g + 1);
      oczekuj(")");
      return w;
    }
    throw new BladFormuly(`Nieoczekiwany znak „${t.tekst}”.`, t.poz);
  };

  const wynik = suma(0);
  const reszta = podglad();
  if (reszta) throw new BladFormuly(`Nieoczekiwany fragment „${reszta.rodzaj === "liczba" ? reszta.wartosc : reszta.tekst}”.`, reszta.poz);
  return wynik;
}

/** Nazwy zmiennych użytych w formule (bez powtórzeń, w kolejności pierwszego użycia). */
export function zmienneWFormule(w: Wyrazenie): string[] {
  const nazwy = new Set<string>();
  const idz = (x: Wyrazenie): void => {
    if (x.typ === "zmienna") nazwy.add(x.nazwa);
    else if (x.typ === "minus") idz(x.arg);
    else if (x.typ === "dzialanie") {
      idz(x.lewy);
      idz(x.prawy);
    }
    else if (x.typ === "funkcja") x.argumenty.forEach(idz);
  };
  idz(w);
  return [...nazwy];
}

/**
 * Sprawdza formułę przy zapisie: składnia + czy wszystkie zmienne są w zbiorze `dozwolone`.
 * Zwraca listę błędów (pustą, gdy poprawna) — do pokazania użytkownikowi w panelu.
 */
export function sprawdzFormule(tekst: string, dozwolone: ReadonlySet<string>): BladFormuly[] {
  let drzewo: Wyrazenie;
  try {
    drzewo = parsujFormule(tekst);
  } catch (e) {
    if (e instanceof BladFormuly) return [e];
    throw e;
  }
  return zmienneWFormule(drzewo)
    .filter((n) => !dozwolone.has(n))
    .map((n) => new BladFormuly(`Nieznana zmienna „${n}”.`, tekst.indexOf(n)));
}

/** Oblicza wartość. Brak zmiennej / `null` / dzielenie przez zero / wynik nieskończony → `BladFormuly`. */
export function obliczFormule(w: Wyrazenie, zmienne: Readonly<Record<string, number | null | undefined>>): number {
  const licz = (x: Wyrazenie): number => {
    switch (x.typ) {
      case "liczba":
        return x.wartosc;
      case "zmienna": {
        const v = zmienne[x.nazwa];
        if (typeof v !== "number" || !Number.isFinite(v)) throw new BladFormuly(`Brak wartości zmiennej „${x.nazwa}”.`, x.pozycja);
        return v;
      }
      case "minus":
        return -licz(x.arg);
      case "dzialanie": {
        const a = licz(x.lewy);
        const b = licz(x.prawy);
        if (x.op === "/" && b === 0) throw new BladFormuly("Dzielenie przez zero.", x.pozycja);
        return x.op === "+" ? a + b : x.op === "-" ? a - b : x.op === "*" ? a * b : a / b;
      }
      case "funkcja":
        return FUNKCJE[x.nazwa]![2](x.argumenty.map(licz));
    }
  };
  const wynik = licz(w);
  if (!Number.isFinite(wynik)) throw new BladFormuly("Wynik formuły nie jest liczbą skończoną.");
  return wynik;
}
