/**
 * Przewoźnicy i dzielniki wagi wolumetrycznej — port `ng` i kluczy IndexedDB
 * (`deminified/frontend-index.js:9165-9192`).
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (backlog #27, karta P9.1, ticket 76): w produkcji lista żyje wyłącznie
 * w IndexedDB przeglądarki (klucz `waga-gabarytowa-przewoznicy`). Tu jest na SERWERZE
 * (`GET`/`PUT /api/waga-gabarytowa/przewoznicy`, tabela `waga_gab_przewoznicy`) i jest wspólna
 * dla całej firmy. Stary klucz IndexedDB nie jest już ani czytany, ani pisany — lokalne listy
 * nie są importowane (Ania potwierdziła seed), a wpis zostaje w przeglądarce nieruszony.
 *
 * W IndexedDB zostaje stan OSOBISTY: wybrany przewoźnik, ostatnie wymiary i ostatni wynik.
 */

export type Przewoznik = {
  id: string;
  nazwa: string;
  /** Dzielnik wzoru `dł × szer × wys / dzielnik` — im mniejszy, tym cięższa paczka. */
  dzielnik: number;
  /** Znacznik z oryginału, niesiony przy GEIS-ie; sam wybór trzyma osobny klucz. Serwer oddaje go zawsze. */
  domyslny?: boolean;
};

/** Klucze magazynu KV stanu osobistego, nazwy 1:1 z oryginałem (`:9166-9168`). */
export const KLUCZ_WYBRANY = "waga-gabarytowa-wybrany";
export const KLUCZ_OSTATNI_WYNIK = "waga-gabarytowa-ostatni-wynik";
export const KLUCZ_OSTATNIE_WYMIARY = "waga-gabarytowa-ostatnie-wymiary";

/**
 * Sześć przewoźników z oryginału (`:9169-9192`), w tej samej kolejności — lista, którą wysyła
 * „Przywróć domyślne". Ta sama lista jest seedem migracji `rebuild/schema/007_waga_gab_przewoznicy.sql`;
 * test backendu `waga-gabarytowa.przewoznicy.test.ts` pilnuje, że się nie rozjadą.
 */
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
