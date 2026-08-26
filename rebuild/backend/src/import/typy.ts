// Typy brzegu importu — nasza warstwa nad portowanym podsystemem parserów
// (src/import/legacy/**). Nazwy pól są POLSKIE i celowo identyczne z tym, co zwraca
// `adapter.recordToSurowe()` w produkcji — to one trafiają potem do `staging_items`
// (sesja 3b) i dalej do kolumn `products`. Nie tłumaczymy ich.

/** Kody dostawców obsługiwane przez dispatcher (`legacy/parsers/dispatcher.cjs`). */
export const KODY_DOSTAWCOW = [
  "MO1",
  "MO2",
  "MO3",
  "MO4",
  "MO5",
  "MO6",
  "MO7",
  "MO8",
  "MO9",
  "MO10",
] as const;

export type KodDostawcy = (typeof KODY_DOSTAWCOW)[number];

export function jestKodemDostawcy(wartosc: string): wartosc is KodDostawcy {
  return (KODY_DOSTAWCOW as readonly string[]).includes(wartosc);
}

/**
 * Rekord po `adapter.recordToSuroweDostawca()` — końcowy produkt potoku parsowania
 * i punkt przechwycenia charakteryzacji (3a). Zapis do bazy dokłada dopiero 3b.
 *
 * Typy odzwierciedlają to, co portowany kod realnie produkuje (zweryfikowane
 * empirycznie na próbkach MO1–MO10, patrz test/charakteryzacja/ZRODLA.md), a nie to,
 * co wynikałoby z nazw pól — np. `szerokosc` jest STRINGIEM (poprawka `szertxt`
 * Ani z 2026-08-19: zachowujemy oryginalny zapis z zerami końcowymi, "10.00" ≠ 10).
 */
export interface RekordSurowy {
  /** Klucz produktu, globalnie unikalny — zawsze z prefiksem dostawcy (`MO4_...`). */
  kod: string | null;
  /** Kod handlowy dostawcy, pole prezentacyjne (dla MO9 = `sku`, nie `id` encji). */
  kodDostawcy: string | null;
  ean: string | null;

  nazwa: string | null;
  marka: string | null;
  model: string | null;
  bieznik: string | null;
  kategoria: string | null;

  magazyn: null;
  magazynRaw: string | null;
  stan: number | null;

  cenaZakupu: number | null;
  /** „Cena na zapytanie" — MO7 Nokian dla wielkoformatowych VF (backlog #4). */
  uwagaCena: string | null;
  cenaSprzedazy: null;

  rozmiar: string | null;
  rozmiarAlternatywny: string | null;
  /**
   * Zwykle STRING — pierwsza liczba z rozmiaru 1:1, z zerami końcowymi (poprawka
   * `szertxt` Ani z 2026-08-19: "10.00" ≠ 10). Bywa jednak LICZBĄ: gdy `parseSize()`
   * nie rozbije rozmiaru, `normalizeJmk` (MO2) i `normalizeHandlopex` (MO4/MO5)
   * sięgają po `parseWidthFallbackMm()`, który zwraca milimetry jako float. To
   * pozostałość po cofniętym `szerokoscfix` — odtwarzamy ją wiernie, bo taka jest
   * produkcja; rozstrzygnięcie należy do backlogu #3.
   */
  szerokosc: string | number | null;
  profil: number | null;
  srednica: number | null;
  konstrukcja: string | null;
  indeksNosnosci: string | null;
  indeksPredkosci: string | null;
  tlTt: string | null;
  vfIf: string | null;
  pr: string | null;
  wysokosc: number | null;
  indeks1: null;
  indeks2: null;
  indeksy: string | null;

  dot: string | null;
  waga: number | null;

  // Oznaczenia techniczne — obecność tokenu albo null (nigdy 0/1).
  sf: string | null;
  sb: string | null;
  hf: string | null;
  ls: string | null;
  hs: string | null;
  nro: number | null;
  cho: number | null;

  // Flagi etykiety UE — `'Tak'` albo null (poprawki `sniegfix`/`flagsfix`, backlog #1).
  cfo: string | null;
  stubbleResistant: string | null;
  labelRolling: string | null;
  labelWet: string | null;
  labelNoise: string | null;
  labelNoiseClass: string | null;
  labelIce: string | null;
  labelSnow: string | null;

  rodzaj: string | null;
  linkZdjecia: string | null;
  oznaczenieBieznika: string | null;
  sezon: string | null;
  ms: string | null;
  snow3pmsf: string | null;
  wentyl: string | null;
}

/** Błąd pojedynczego wiersza zgłoszony przez parser dostawcy. */
export interface BladWiersza {
  error?: string;
  [klucz: string]: unknown;
}

/** Wiersz świadomie odrzucony przez parser (np. quad, akcesorium). */
export interface OdrzuconyWiersz {
  powod?: string;
  [klucz: string]: unknown;
}

export interface WynikParsowania {
  /** Etykieta dostawcy z parsera, np. `MO1_Bohnenkamp`. */
  dostawca: string;
  /** Rekordy po `recordToSuroweDostawca()`, gotowe dla stagingu (3b). */
  rekordy: RekordSurowy[];
  /** Wiersze, na których parser wywrócił się z wyjątkiem. */
  bledy: BladWiersza[];
  /** Wiersze świadomie pominięte przez parser dostawcy. */
  odrzucone: OdrzuconyWiersz[];
  /**
   * Ile rekordów parsera adapter odrzucił na etapie normalizacji
   * (`recordToSurowe()` zwraca null — np. pozycja nie jest oponą).
   * `rekordy.length + odrzuconePrzezAdapter` = liczba rekordów z parsera.
   */
  odrzuconePrzezAdapter: number;
}
