/**
 * Zakładki ekranu `/konfiguracja`.
 *
 * ⚠ PIERWSZE SZEŚĆ jest 1:1 z oryginałem (`deminified/frontend-index.js:26299-26338`) —
 * nazwy, kolejność i `data-testid`. DWIE OSTATNIE („Admin", „Dziennik") dołożyła Iteracja 12b
 * jako ŚWIADOME ODSTĘPSTWO (plan.md D1/D3, decyzja użytkownika): produkcja obsługuje trasy
 * `/api/admin/*`, `/api/users`, `/api/maintenance/usun-nieopony` i `/api/audit-log` osobnymi
 * stronami HTML poza React SPA (`mirror/backend/extensions.cjs:290-295,410-415`), więc nie ma
 * dla nich wzorca w bundlu. Ta lista NIE JEST już więc lustrem oryginału — porównując ją
 * z `:26299-26338`, oczekuj sześciu pozycji, nie ośmiu.
 *
 * Wszystkie sześć jest wypełnionych: „wgrywanie" w bloku 3f-1, „dostawcy" w 3f-2,
 * a spedycja, shoper, katalog i AI w Iteracji 11 razem z `GET/POST /api/config`
 * i `GET/POST /api/spedycja`. Wraz z ostatnią zaślepką zniknęły dwa pola opisujące
 * zaślepki: `domykaBlok` (która iteracja dowiezie zakładkę) i `opis` (tekst wyświetlany
 * zamiast zawartości). Każda zakładka ma dziś własny podtytuł, przepisany z oryginału
 * — trzymanie drugiego, przybliżonego opisu obok tylko by się z nim rozjeżdżało.
 */
export type OpisZakladki = {
  wartosc: string;
  etykieta: string;
};

export const ZAKLADKI_KONFIGURACJI: OpisZakladki[] = [
  {
    wartosc: "dostawcy",
    etykieta: "Dostawcy",
  },
  {
    wartosc: "wgrywanie",
    etykieta: "Wgrywanie ręczne",
  },
  {
    wartosc: "spedycja",
    etykieta: "Spedycja",
  },
  {
    wartosc: "shoper",
    etykieta: "Shoper",
  },
  {
    wartosc: "katalog",
    etykieta: "Katalog",
  },
  {
    wartosc: "ai",
    etykieta: "AI Fallback",
  },
  {
    wartosc: "admin",
    etykieta: "Admin",
  },
  {
    wartosc: "dziennik",
    etykieta: "Dziennik",
  },
];
