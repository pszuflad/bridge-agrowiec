# 168-FEATURE-uzupelnianie-ean-999 — Implementation report

## Summary
Dodano regułę uzupełniającą PUSTE `products.ean` EAN-ami `999` + licznik + cyfra kontrolna, tabelę par
`kod` ↔ EAN (`ean_pary`, migracja 017) i API w obie strony. Wygenerowany EAN przeżywa kolejny import:
staging uzupełnia pusty EAN z tabeli par (także po `clear` katalogu), a akceptacja zapisuje go do `products`.

## Changes
- **New:** `rebuild/schema/017_ean_pary.sql` (+ wiersz w `schema/README.md`), model `eanPary` w `src/db/schema.ts`.
- **New:** `src/ean-pary/generator.ts` (EAN-13 z numeru, cyfra kontrolna), `src/ean-pary/uzupelnianie.ts`
  (`przydzielEan`, `uzupelnijEanRekordu`, `uzupelnijKatalog`, `oznaczJakoZastapiona`).
- **New:** `src/routes/ean-pary.ts` — `GET /api/ean-pary/po-kodzie/:kod`, `GET /api/ean-pary/po-ean/:ean`,
  `POST /api/ean-pary/generuj`, `POST /api/ean-pary/uzupelnij` (`dry_run`), `GET /api/ean-pary`; rejestracja w `app.ts`.
- `src/import/polityka/fabryka.ts` — pusty EAN w stagingu uzupełniany z pary.
- `src/import/akceptacja.ts`, `src/import/bulk.ts`, `src/import/polityka/akceptacja.ts`, `src/routes/products.ts` —
  wpięcie reguły przy zapisie produktu (opt-in `uzupelnijEan`, domyślnie wyłączone dla harnessu charakteryzacji;
  włączone w ścieżce Staging v2 i w `POST /api/products`; NIE włączone dla wycofań).
- Testy: `test/ean-pary.test.ts`, `test/ean-pary.staging.test.ts`; poprawione `db.migracje*.test.ts` (36 tabel, `ean_pary`).

## Deviations from plan
- Zamiast „hooka po akceptacji” reguła wchodzi tuż PRZED zapisem rekordu (jak `applyWagaDziedziczona`) — ten sam efekt,
  prościej i atomowo. `POST /api/products` (bulk) też ją dostaje. Bez zmian funkcjonalnych wobec decyzji.
- Flaga `uzupelnijEan` (domyślnie false) w `zatwierdzPozycjeStagingu` i `dodajProduktyBulk`: testy charakteryzacji
  porównują port z oryginałem, który tej reguły nie ma (konstrukcja jak istniejący `nadajKod`).
- Trasa `po-kodzie` zwraca dodatkowo `maEan` i `para`; `po-ean` zwraca `kody` (EAN w katalogu może powtarzać się u kilku produktów).

## Test results
- **Gate odbudowy (fixtures/kontrakt):** ✓ regresja — brak zmian w kontrakcie; istniejące gate'y produktów, stagingu,
  analityki i charakteryzacje akceptacji/bulk zielone. Nowe trasy są spoza `openapi.yaml` (świadomie).
- Unit + integration: ✓ pełne `npm test` — 120 plików zielonych, 1932 testy (12 pominiętych jak wcześniej); lint, typecheck, build ✓.
  (Szum `DB_PATH: Required` / „kopia-bazy: brak DB_PATH” jest oczekiwany.)
- E2E: nie dotyczy (brak UI).

## Breaking changes
None. Nowa tabela, nowe trasy; zachowanie istniejących tras bez zmian poza uzupełnianiem pustych EAN-ów.

## Follow-up
- Brak UI (przycisk „Uzupełnij EAN”) — poza zakresem.
- `src/selly/mapper.ts:197-203` ma znany błąd flag `'Tak'` (backlog #154.1) — niezwiązane.
- Po wdrożeniu warto jednorazowo wywołać `POST /api/ean-pary/uzupelnij` z `dry_run: true`, żeby zmierzyć liczbę pustych EAN-ów w produkcji.

## Review fixes applied
- BLOCKER: `POST /api/products` (bulk) nadpisywał prawdziwy EAN istniejącego produktu wygenerowanym, gdy payload nie miał `ean` → `uzupelnijEanRekordu` dziedziczy EAN istniejącej karty (bulk i akceptacja); test regresji.
- SHOULD-FIX: `dry_run` nie-boolean → 400 (test); staging pomija parę, której EAN nosi już inny produkt; poprawiony komentarz o rezerwacji numerów.
- Dodano `docs/spec-backend/wpis-168b.md` i `docs/rebuild-backlog/wpis-168b.md`. Drugiego przebiegu reviewera nie robiono — poprawki są lokalne i pokryte testami.

## Docs updates
Wpisy: `docs/spec-backend/wpis-168b.md`, `docs/rebuild-backlog/wpis-168b.md`, wiersz 017 w `rebuild/schema/README.md`. Brak karty odbudowy dla tego ticketu.

## Synchronizacja z develop
Scalono `origin/develop` (823d725); bramki (lint, typecheck, build, `npm test` — 1935 zielonych) przebiegły PO synchronizacji.

## Kolizja numeru ticketu
Numer 168 zajął równolegle inny ticket (okno „Sprawdź dopasowanie opony", commit 165d076 na `develop`; jego `wpis-168.md` w spec-backend). Rezerwacja numerów jest lokalna dla maszyny/sesji, więc nie widziała cudzej. Ten ticket zostaje pod katalogiem `168-FEATURE-uzupelnianie-ean-999`, ale jego wpisy dokumentacyjne noszą sufiks **b**: `docs/spec-backend/wpis-168b.md`, `docs/rebuild-backlog/wpis-168b.md` (id `#168b.1`). Wpis cudzego ticketu zostawiony bez zmian.

## Stan kroku deployowego
Krok `npm run uzupelnij-ean` w `tools/deploy-produkcja.sh` NIE jest częścią tej gałęzi (zmiana pliku wdrożeniowego czeka na decyzję użytkownika); skrypt `uzupelnij-ean` jest, uruchamiany ręcznie.
