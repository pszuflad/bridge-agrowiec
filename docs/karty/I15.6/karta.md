# I15.6 — Selly REST 1: nowy schemat `selly_products`, odnajdywanie produktów, aktualizacje w ciągu dnia

> **Stan:** ⬜ gotowe (fala 1)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #60, #74, #77 (delta), #68, #69, #70 · **Zależy od:** —
> **Ticket:** —

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Dawne 13d-1. Port TS z `origin/main`: `mirror/backend/selly/discovery.cjs` (442 l.), `sync_delta.cjs` (187),
`rate_limiter.cjs` (64; 250/60 s + retry). **Migracja `013`**: `selly_products` → `selly_products_old`, nowa
`selly_products` (schemat z `git show origin/main:db/schema.sql`: klucz `(kod_importu, dostawca)`, `selly_product_id`,
`selly_variant_id`, `feature_id_magazyn`, indeksy). Model wariantowy: cena/stan PER WARIANT, `provider_code=kod_importu`.
- **#74:** żywe kategorie Selly 1/2/3/4 z danych (`selly_kategoria_norm_map`) — **nie hardkodować**.
- **#77 (delta):** `findDeltaProducts()` obejmuje `wstrzymany` z istniejącym wariantem → stan 0, bez tworzenia produktów.
- **#68/#69/#70 i osierocone mapowania** (usunięcie produktu nie sprząta `selly_products`): domyślnie **1:1**.
  KROK 0: zapytaj użytkownika, czy Ania odpowiedziała na pytania 1.3/1.4 rundy 3
  (`docs/pytania-do-ani-2026-09-22.md`) — jeśli wybrała naprawę, to świadome odstępstwo.
- **#67:** stary `POST /api/selly/sync-supplier` (I8) po zmianie schematu psuje się w produkcji — odtworzone 1:1
  (decyzja D3 z 13d-1); utrzymaj.
⚠ **PUŁAPKA revertu:** port na NOWEJ gałęzi ze stanu `origin/main`, NIE przez ponowny merge `feature/45`
(revert #58 sprawia, że git uzna go za zmergowany). Kod z `feature/45` wolno czytać jako ściągę, nie przenosić.
⚠ **Bezpieczeństwo:** testy NIGDY nie wołają prawdziwego Selly (klient za interfejsem, atrapa
`test/gate/selly-atrapa.ts`), `SELLY_TRYB` obowiązuje dla nowych ścieżek.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/rest/**` (nowe), `rebuild/schema/013_*.sql`, `db/schema.ts` (tylko Selly), dostosowanie
repozytorium Selly z I8 do nowej tabeli, testy. NIE: `generator-csv.ts` (I15.3), `sync_full`/`mapper_v2` (I15.7), trasy
`sync-*` i harmonogram (I15.8).

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy to `origin/main` na commicie `7d6cfc9`; nowy kod na `main` = zgłoś.

Numer migracji `013` zarezerwowany.

## Dowiezione
—

## Do koordynatora
—
