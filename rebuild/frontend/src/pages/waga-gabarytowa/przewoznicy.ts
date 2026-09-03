/**
 * Przewoźnicy i dzielniki wagi wolumetrycznej — port `ng` i czterech kluczy IndexedDB
 * (`deminified/frontend-index.js:9165-9192`).
 *
 * ⚠ TO NIE JEST CONFIG BACKENDU. Lista żyje wyłącznie w przeglądarce Ani (IndexedDB,
 * store `kv` bazy `bridge-store-v2`) — nie ma dla niej ani tabeli, ani endpointu.
 * Skutek, który trzeba znać: zmiany są PER PRZEGLĄDARKA i giną przy czyszczeniu danych
 * witryny. Tak działa produkcja i tego nie zmieniamy (plan.md D1, D3).
 */

export type Przewoznik = {
  id: string;
  nazwa: string;
  /** Dzielnik wzoru `dł × szer × wys / dzielnik` — im mniejszy, tym cięższa paczka. */
  dzielnik: number;
  /** Znacznik z oryginału, niesiony przy GEIS-ie; sam wybór trzyma osobny klucz. */
  domyslny?: boolean;
};

/** Cztery klucze magazynu KV, nazwy 1:1 z oryginałem (`:9165-9168`). */
export const KLUCZ_PRZEWOZNICY = "waga-gabarytowa-przewoznicy";
export const KLUCZ_WYBRANY = "waga-gabarytowa-wybrany";
export const KLUCZ_OSTATNI_WYNIK = "waga-gabarytowa-ostatni-wynik";
export const KLUCZ_OSTATNIE_WYMIARY = "waga-gabarytowa-ostatnie-wymiary";

/** Sześć przewoźników z oryginału (`:9169-9192`), w tej samej kolejności. */
export const PRZEWOZNICY_DOMYSLNI: Przewoznik[] = [
  { id: "geis", nazwa: "GEIS Polska", dzielnik: 10000, domyslny: true },
  { id: "dpd", nazwa: "DPD", dzielnik: 6000 },
  { id: "gls", nazwa: "GLS", dzielnik: 4000 },
  { id: "inpost", nazwa: "InPost Kurier", dzielnik: 5000 },
  { id: "ups", nazwa: "UPS", dzielnik: 5000 },
  { id: "dhl", nazwa: "DHL Parcel", dzielnik: 5000 },
];

/** Id przewoźnika wybranego po pierwszym wejściu i po „Przywróć domyślne" (`:26797`). */
export const WYBRANY_DOMYSLNY = "geis";

/** Wymiary paczki z kolumny „Przykład" w tabeli — 60 × 50 × 50 = 150 000 cm³ (`:26833`). */
export const OBJETOSC_PRZYKLADU = 150000;
