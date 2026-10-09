# 204-FEATURE-filtr-brak-zdjecia — link do produktów bez zdjęcia z „Uzupełniania zdjęć"

> Status: Implemented · Branch: `feature/204-filtr-brak-zdjecia`

## Ticket description
Po „Pokaż propozycje zdjęć" (ticket 203) użytkowniczka widzi „Produktów bez linku: 369", ale nie ma jak wejść do tych pozycji. Prośba: link, który przenosi do katalogu z samymi pozycjami bez linku do zdjęcia.

## Kontrakt i fixtures (zakres)
Brak (nie dotyka kontraktu): filtr działa po stronie frontendu na liście z `GET /api/products` (jak `brak_waga`, ticket 166). Bez zmian backendu, `openapi.yaml` i fixtures.

## Decisions
- Nowa opcja statusu `brak_zdjecia` („Brak zdjęcia") w katalogu, otwierana deep linkiem `?status=brak_zdjecia` — wzorzec ticketu 166.
- „Pusty" link = `null` albo same spacje (ten sam próg co backendowe `jestPustyLink`, więc liczba w katalogu zgadza się z „Produktów bez linku" w podglądzie).
- Link pod podsumowaniem podglądu: „Zobacz w katalogu produkty bez linku do zdjęcia (N)".

## Implementation plan
`src/pages/katalog/filtrowanie.ts` (tryb), `src/pages/Katalog.tsx` (opcja w dropdownie), `src/pages/konfiguracja/UzupelnianieZdjec.tsx` (link). Testy: `katalog.filtrowanie.test.ts`, `katalog.test.tsx`, `konfiguracja.admin.test.tsx`.

## Out of scope
Zmiany backendu, filtr po stronie serwera, ręczna edycja wielu linków naraz.

## Definition of done
- [x] Link w podsumowaniu prowadzi do katalogu z filtrem „Brak zdjęcia"
- [x] Filtr łapie null/pusty/same spacje
- [x] Bramki frontendu zielone, gałąź zsynchronizowana z `develop`
