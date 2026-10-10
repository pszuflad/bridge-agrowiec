# 227 — Raport (PRT-7.1)

## Summary
Dodano model zamówień partnerów (migracja 028, dwie tabele) oraz bezzależnościowy parser `DOCUMENTORDER` i idempotentne repo zapisu. Moduł wewnętrzny — bez tras REST.

## Changes
- **Nowe:** `rebuild/schema/028_partner_zamowienia.sql`, `src/partnerzy/zamowienie-xml.ts`, `src/repos/partnerzy-zamowienia.ts`
- `src/db/schema.ts` — modele `partnerZamowienia`, `partnerZamowieniaPozycje`
- Testy: `partnerzy.zamowienie-xml.test.ts`, `partnerzy.zamowienia.test.ts`, `db.migracja-028.test.ts` (+ fixture `partnerzy.zamowienie-przyklad.ts`); liczniki w `db.migracje.test.ts`, `db.migracje-produkcja.test.ts`
- Docs: `docs/spec-backend/wpis-227.md`, `docs/karty/PARTNERZY/{karta.md,decyzje-do-konsultacji-marty.md}`, `rebuild/schema/README.md`

## Deviations from plan
Brak. Praca w gałęzi wskazanej przez środowisko (`claude/peaceful-gates-a8yebr`), bez osobnego worktree — gałąź zresetowana do `origin/develop` (nie miała własnych commitów).

## Test results
- **Gate kontraktu:** N/D — ticket nie dotyka API (nowe tabele i moduł wewnętrzny; brak tras, brak zmian w `openapi.yaml`/fixtures).
- Lint, typecheck, build: ✓. `npm test`: ✓ 172 pliki / 2437 testów (12 pominiętych, istniejące). Szum stderr `DB_PATH` jest oczekiwany (CLAUDE.md).

## Breaking changes
None.

## Follow-up
- Wpis ticketu 226 (krok z partnerami startowymi) jest sprzeczny z decyzją użytkownika z 2026-10-10 — zob. `decyzje-do-konsultacji-marty.md`.
- Format `INVOICE`/`DELIVERY` poznajemy tylko z jednego przykładu (karta ma „…”); pola zapisane jako płaska mapa, do doprecyzowania z prawdziwymi plikami partnerów.

## Review fixes applied (review.md, 2 BLOCKER / 6 SHOULD-FIX)
- **BLOCKER ReDoS** — regex znacznika zastąpiony liniowym skanerem ręcznym (`indexOf`); test na 500 tys. znaków ucięnego znacznika i 100 tys. zagnieżdżeń kończy się w <2 s.
- **BLOCKER brak limitów** — `MAKS_ROZMIAR_XML` (2 mln znaków) i `MAKS_POZYCJI` (5000), z testami.
- SHOULD-FIX: transakcja `immediate` (zapis współbieżny z innym połączeniem); skrót liczony z SPARSOWANEJ treści (białe znaki/BOM nie są „zmianą”); tekst/CDATA poza elementem głównym odrzucany;
  `ORDERQUANTITY` sprawdzane `isSafeInteger`; testy odporności (niedomknięty komentarz/CDATA/znacznik, DOCTYPE w CDATA).
- Pozostałe NICE-TO-HAVE z review.md: nie wdrożone (zob. plik). Drugi przebieg reviewera nie był uruchamiany — poprawki są pokryte testami powyżej.
