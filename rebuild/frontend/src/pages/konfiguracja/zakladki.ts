/**
 * Sześć zakładek ekranu `/konfiguracja` — nazwy, kolejność i `data-testid` 1:1
 * z oryginałem (`deminified/frontend-index.js:26299-26338`).
 *
 * Blok 3f-1 wypełnia WYŁĄCZNIE „wgrywanie". Pozostałe pięć zostaje szkieletem z jawną
 * adnotacją, która iteracja je dowiezie — zakres podzielony decyzją użytkownika
 * z 2026-09-01 (roadmapa §5, blok 3f, „Decyzje zaklepane"): zakładka „dostawcy" idzie
 * do 3f-2 razem z `PATCH /api/dostawcy/{id}` i „Synchronizuj teraz", a spedycja, shoper,
 * katalog i AI zostają w Iteracji 11 razem z `GET/PUT /api/config` i `GET /api/spedycja`.
 */
export type OpisZakladki = {
  wartosc: string;
  etykieta: string;
  /** `null` dla zakładki wypełnionej w tym bloku. */
  domykaBlok: string | null;
  opis: string;
};

export const ZAKLADKI_KONFIGURACJI: OpisZakladki[] = [
  {
    wartosc: "dostawcy",
    etykieta: "Dostawcy",
    domykaBlok: "bloku 3f-2",
    opis: "Konfiguracja każdego źródła cennika — HTTP polling, ręczny upload lub mail.",
  },
  {
    wartosc: "wgrywanie",
    etykieta: "Wgrywanie ręczne",
    domykaBlok: null,
    opis: "Wgranie cennika z dysku — plik trafia do stagingu.",
  },
  {
    wartosc: "spedycja",
    etykieta: "Spedycja",
    domykaBlok: "Iteracji 11",
    opis: "Limity i parametry spedycji per dostawca.",
  },
  {
    wartosc: "shoper",
    etykieta: "Shoper",
    domykaBlok: "Iteracji 11",
    opis: "Połączenie ze sklepem Shoper.",
  },
  {
    wartosc: "katalog",
    etykieta: "Katalog",
    domykaBlok: "Iteracji 11",
    opis: "Ustawienia katalogu produktów.",
  },
  {
    wartosc: "ai",
    etykieta: "AI Fallback",
    domykaBlok: "Iteracji 11",
    opis: "Klucz API i tryb awaryjnego parsowania.",
  },
];
