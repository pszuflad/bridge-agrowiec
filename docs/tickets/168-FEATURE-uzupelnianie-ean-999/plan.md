# 168-FEATURE-uzupelnianie-ean-999 — Uzupełnianie pustych EAN-ów (prefiks 999) + tabela par kod–EAN

> Status: Draft
> Branch: `feature/168-uzupelnianie-ean-999` (wypychana na `claude/tender-curie-g8cskd`, baza PR: `develop`)
> Worktree: `.worktrees/168-FEATURE-uzupelnianie-ean-999`

## Ticket description
Dodać regułę uzupełniającą brakujące EAN-y, tak by w katalogu nigdzie nie brakowało EAN. EAN-y
mają się nie powtarzać i zaczynać od 999; potrzebna tabela porównawcza (w bazie) par
kod dostawcy – EAN (999 + losowe cyfry grozi kolizjami). Dotyczy tylko pustych pól EAN. API w dwie
strony (kod → EAN, EAN → kod) oraz „mam kod, zrób EAN". Kolejny import nie może wywalić
nowych EAN-ów w Stagingu.

## Context
- To **NOWA logika biznesowa, nie odtworzenie produkcji** (brak w `contract/openapi.yaml`, fixtures
  i oryginale). Jedyny precedens: `mirror/backend/apply_ean_memory.cjs` (ręczny skrypt „pamięć EAN").
- `products.kod` = UNIQUE globalnie; `products.ean` bez indeksu/UNIQUE. `staging_items` nie ma
  kolumny `ean` (siedzi w `snapshot_json`).
- `validateEan` (`import/legacy/staging_policy.cjs:9-23`) wymaga długości 8/12/13/14 i poprawnej cyfry
  kontrolnej → generowany EAN musi być poprawnym EAN-13.
- Gdzie EAN ginie: nowa pozycja / katalog po `POST /api/products/clear` dostaje pusty EAN
  (`fabryka.ts:479` dziedziczy tylko z istniejącej karty); pusty EAN w cenniku = ostrzeżenie w stagingu.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
- Nowe trasy `/api/ean-pary/*` — **spoza kontraktu** (kontraktu `openapi.yaml` NIE ruszamy; jak w
  `waga-gabarytowa`, trasy nowe są opisane w spec-backend wpisie i testowane własnymi testami).
- **Gate regresji** (muszą pozostać zielone, kształt bez zmian): `GET_products*`, `PUT/PATCH_products_id`,
  `GET_staging*`, `POST_staging_*` (akceptacja), trasy importu, `GET_analytics_ean_*`, Selly CSV.
  Zmiana dotyka ścieżki importu/akceptacji, więc charakteryzacja importu (`test/charakteryzacja*`)
  ma przejść bez zmian.

## Decisions (użytkownik, Krok 3)
1. **Klucz pary = `products.kod`** (nie `(dostawca, kod_dostawcy)`); tabela trzyma też `dostawca`
   i `kod_dostawcy` informacyjnie.
2. **Uruchomienie: po akceptacji stagingu + na żądanie (API) dla całego katalogu.** Prawdziwy EAN z
   cennika **nadpisuje** wygenerowany 999…; wygenerowany zostaje w tabeli ze statusem `zastapiony`
   (numer zarezerwowany, nigdy ponownie nie wydany).
3. **Staging: EAN z tabeli par wpisywany do snapshotu/podglądu** (pusty EAN z cennika uzupełniony
   z par jeszcze w stagingu → brak różnicy „EAN → pusty", przeżywa akceptację, także po `clear`).
4. **Selly: EAN 999… idzie jak zwykły EAN** (bez zmian w generatorze CSV i mapperze REST).
5. Generator: **deterministyczny licznik, nie losowe cyfry** — `999` + 9-cyfrowy numer kolejny
   (zero-padded) + cyfra kontrolna EAN-13 (≈ 10⁹ numerów). Kolizje wykluczone: UNIQUE(ean) w tabeli
   + pomijanie numerów, których EAN już jest w `products.ean` (prawdziwy 999… z zewnątrz).
6. Reguła dotyka **wyłącznie pustych** `products.ean` (NULL / `''` / same spacje).

## Implementation plan
1. **Migracja `rebuild/schema/017_ean_pary.sql`** (przed startem ponownie zweryfikować numer wobec
   `origin/develop`): tabela `ean_pary(id PK, kod TEXT NOT NULL UNIQUE, ean TEXT NOT NULL UNIQUE,
   numer INTEGER NOT NULL UNIQUE, dostawca TEXT, kod_dostawcy TEXT, status TEXT NOT NULL DEFAULT
   'aktywny' CHECK (status IN ('aktywny','zastapiony')), utworzono TEXT, zastapiono TEXT,
   zastapiony_przez TEXT)`. Jedna para na `kod` (kolejna generacja dla tego samego `kod` po
   zastąpieniu nie jest potrzebna — prawdziwy EAN wygrywa i jest w `products`). Model w `db/schema.ts`.
2. **Moduł `src/ean-pary/`**: `generator.ts` (`eanZNumeru(n)`, cyfra kontrolna, prefiks 999; czysta
   logika, test jednostkowy), `repo` w `src/repos/ean-pary.ts` (`znajdzPoKodzie`, `znajdzPoEanie`,
   `wygenerujDlaKodu(db, kod)` – transakcja, następny numer = MAX+1 z pomijaniem numerów, których
   EAN jest już w `products.ean`/tabeli; idempotentne), `uzupelnijPusteEany(db, {dryRun})` – pętla po
   `products` z pustym EAN → wpis w `ean_pary` + `UPDATE products SET ean, ean_raw, ean_is_valid=1,
   ean_source_status='ok'`; `uzgodnijZastapione(db)` – pary aktywne, gdzie `products.ean` ≠ EAN pary
   (prawdziwy EAN przyszedł z importu) → status `zastapiony`. Zapis audytu (`zapiszAudyt`).
3. **Hook w stagingu** — `import/polityka/fabryka.ts` zaraz po `:479`: jeśli `!d.ean` i w `ean_pary`
   jest aktywna para dla `kod` (karta bieżąca lub `kod` z dopasowania) → `d.ean`, `eanRaw`,
   `eanIsValid=1`, `eanSourceStatus='ok'`. Ostrzeżenie „puste pole EAN" nie powstaje. Mapa par
   ładowana raz na import (jak `poKodzie`). Błąd „Brak kodu dostawcy i poprawnego EAN" (`:488`) bez
   zmian (dotyczy surowego wejścia).
4. **Hook po akceptacji** — w `routes/staging-mutacje.ts` / `import/akceptacja.ts` po udanej akceptacji
   (pojedynczej i hurtowej) wywołać `uzgodnijZastapione` + `uzupelnijPusteEany` ograniczone do
   zaakceptowanych `kod` (albo całość — tania operacja). Błąd reguły nie może wywrócić akceptacji
   (log, jak `audytuj()` w `waga-gabarytowa`).
5. **Trasy `src/routes/ean-pary.ts`** (`requireAuth`, rejestracja w `app.ts`; klucze JSON jawnie,
   camel→snake nie dotyczy — nowe trasy, stałe nazwy polskie):
   - `GET /api/ean-pary/po-kodzie/:kod` → `{kod, ean|null, status|null, zrodlo:'wygenerowany'|'katalog'|null}`
     (zrodlo `katalog` = EAN jest w `products`, bez wpisu w parach).
   - `GET /api/ean-pary/po-ean/:ean` → `{ean, kod|null, status|null}` (szuka w `ean_pary`, potem
     `products.ean`).
   - `POST /api/ean-pary/generuj` body `{kod}` → tworzy i zapisuje EAN dla produktu z pustym EAN;
     gdy para istnieje lub produkt ma EAN → zwraca istniejący (200, `utworzono:false`); nieznany
     `kod` → 404; puste `kod` → 400.
   - `POST /api/ean-pary/uzupelnij` body `{dry_run?: boolean}` → uzupełnia cały katalog; zwraca
     `{dry_run, uzupelniono, zastapiono, pominieto}`.
   - `GET /api/ean-pary` (lista par, paginacja `limit/offset`) — „tabela porównawcza" do wglądu/CSV nie
     jest potrzebna; tylko lista JSON.
6. **Dokumentacja**: `docs/spec-backend/wpis-168.md`, wpis backlogu `docs/rebuild-backlog/wpis-168.md`
   (świadome odstępstwo od 1:1), ewentualnie karta `docs/karty/` jeśli istnieje dla tematu.
7. Frontend: **poza zakresem** (brak UI — użytkownik prosił o regułę i API).

## Testing strategy
- Jednostkowe: generator (cyfra kontrolna, prefiks, format 13 cyfr, zgodność z `validateEan`).
- Integracyjne na prawdziwej bazie tymczasowej (bez mocków): unikalność (1000 generacji bez
  duplikatów), pomijanie zajętego numeru (`products.ean` = istniejący 999…), tylko puste EAN-y
  (produkt z EAN nietknięty), idempotencja, `zastapiony` po prawdziwym EAN z importu.
- **Scenariusz „kolejny import"**: produkt z wygenerowanym EAN → import z pustym EAN → staging
  pokazuje EAN z par, akceptacja go zachowuje; oraz: po `clear` katalogu + reimport → EAN wraca z par.
- Trasy: 200/400/404, auth 401, dry-run.
- Regresja: pełne `npm test`, lint, typecheck, build; gate fixtures produktów/stagingu bez zmian.

## Out of scope
- UI/frontend, eksport par do CSV, zmiana prefiksu/zakresu, ręczna edycja par, migracja danych
  historycznych z `ean_memory.json`, filtrowanie 999… w Selly.

## Definition of done
- [ ] Tabela `ean_pary` + migracja 017, unikalność kod/EAN/numer wymuszona w bazie
- [ ] Generator produkuje poprawne EAN-13 z prefiksem 999, bez kolizji
- [ ] Reguła uzupełnia wyłącznie puste EAN-y (API + po akceptacji)
- [ ] Kolejny import nie gubi wygenerowanego EAN (staging + akceptacja + po `clear`)
- [ ] Trasy: po kodzie, po EAN-ie, generuj, uzupełnij — przetestowane
- [ ] Gate regresji zielony, bramki zielone, docs zsynchronizowane
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki PO synchronizacji, PR `MERGEABLE`
