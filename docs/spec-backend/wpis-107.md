# Wpis do spec-backend od ticketu 107 (karta I15.1) · 2026-09-22

**Sekcja:** §2 (schemat bazy / migracje) i §5 (zachowanie backendu — reguły biznesowe zapisu produktów), w
zakresie, w jakim opisują tabelę `products` i cykl zapisu.

**Potwierdzone w 107** (`107-FEATURE-products-blokady-triggery`, 2026-09-22, karta I15.1): produkcja
(`origin/main` @ `7d6cfc9`) NIE trzyma triggerów `products`/`manual_overrides` w żadnej migracji — zakłada je kod
startowy backendu przy KAŻDYM uruchomieniu procesu (`extensions.cjs` → `payment_blocks.cjs`
`ensurePaymentBlocks()` i `application_rules.cjs` `ensureApplicationRules()`). Odbudowa przenosi to jako migrację
jednorazową `rebuild/schema/011_blokowane_formy_i_triggery.sql`, odporną na to, że na bazie produkcyjnej kolumna i
triggery już istnieją (mechanizm inny niż oryginał — jednorazowa migracja zamiast kodu przy każdym starcie — ale
efekt końcowy identyczny; brak świadomego odstępstwa w zachowaniu).

Sześć triggerów, treść **bajt w bajt** z `git show 7d6cfc9:db/schema.sql:334-385`:
- `products_blokowane_formy_ai/_au` (AFTER INSERT/UPDATE OF `dostawca`) — ustawia
  `blokowane_formy_platnosci` z mapy dostawca → lista ID form płatności (`MO1`…`MO10`, `MO6` celowo bez
  mapowania → `NULL`, CHANGELOG produkcji 2026-09-10 14:53 „nie będzie na razie w sprzedaży”).
- `products_zastosowanie_ai/_au` — każdy z dwóch triggerów robi w JEDNYM `UPDATE ... SET kategoria = CASE ...,
  zastosowanie = CASE ...` to samo: normalizuje `kategoria` do kanonicznej formy (4 warianty:
  Rolnicze/Przemysłowe/Ciężarowe/Leśne, z aliasami pisowni) i liczy nowy `zastosowanie` z `CASE` warunkowanym na
  `NEW.kategoria` — czyli na kategorii SPRZED tego samego `UPDATE` (SQLite ewaluuje wszystkie wyrażenia `SET`
  względem wiersza przed zmianą), NIE na wartości, którą ten sam `UPDATE` właśnie zapisuje do `kategoria`. W
  kategorii kanonicznej rozpoznaje tylko pojedyncze wartości `zastosowanie` z zamkniętej listy (plus
  `Forwarder`/`Harwester` scalane do `Forwarder/Harwester`); łańcuch (separator dosłowny `' ; '`, produkowany przez
  JS `normalizeApplication()`) w kategorii kanonicznej ląduje jako `Uniwersalne/pozostałe`; w kategorii spoza
  czterech kanonicznych `zastosowanie` przechodzi bez zmian.
  **Efekt kaskady `ai`→`au`:** `products_zastosowanie_ai` (AFTER INSERT) liczy `zastosowanie` na podstawie
  kategorii SUROWEJ (tej, którą wpisał `INSERT`, jeszcze nienormalizowanej), ale jego własny `UPDATE`
  jednocześnie zapisuje już znormalizowaną `kategoria` — a to uruchamia `products_zastosowanie_au` (nasłuchuje
  `AFTER UPDATE OF kategoria, zastosowanie`), który ma identyczną logikę i przelicza `zastosowanie` PONOWNIE, tym
  razem na podstawie już znormalizowanej `kategoria`. Efekt końcowy po INSERT to więc wynik `au` (druga,
  poprawna normalizacja), nie `ai`.
- `manual_overrides_kategoria_ai/_au` — ta sama normalizacja kategorii, tylko dla pola `override_value`, gdy
  `field_name = 'kategoria'` (inne pola `manual_overrides` nietknięte).

`UPPER()`/`LOWER()` w triggerach są ASCII-only (SQLite, patrz `CLAUDE.md`) — odtworzone dosłownie, nie „poprawione”
na wariant Unicode-aware.

**Dyrektywa runnera** (nowa w odbudowie, bez odpowiednika w oryginale — potrzebna, bo SQLite nie ma
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, a runner wykonuje cały plik migracji w jednej transakcji): linia
`-- @dodaj-kolumne-jesli-brak <tabela> <kolumna> <definicja>` na początku pliku `.sql`, wykonywana przez
`zastosujDyrektywy()` (`src/db/migrate.ts`) przed treścią pliku, w tej samej transakcji — `PRAGMA table_info` →
`ALTER` tylko przy braku kolumny. Identyfikatory walidowane `^\w+$`; nieznana dyrektywa / zła składnia / brak
tabeli = błąd i rollback całej migracji.

**RETURNING przed triggerem AFTER — pułapka, nie błąd (dziś bez skutku).** `repos/overrides.ts:73`
`zapiszPoprawke()` robi `INSERT INTO manual_overrides ... RETURNING`. SQLite ewaluuje `RETURNING` na wierszu
SPRZED wykonania triggerów `AFTER INSERT` — więc jeśli `field_name = 'kategoria'`, `RETURNING` oddaje
`override_value` w postaci SUROWEJ (przed normalizacją triggera `manual_overrides_kategoria_ai`), a nie
znormalizowanej, która faktycznie wyląduje w tabeli. Zmierzone w 107. Dziś bez efektu, bo żaden wołający
`zapiszPoprawke()` nie czyta zwróconej wartości `overrideValue` (używa jej tylko `id`/metadanych) — odnotowane jako
follow-up, nie naprawione w tej karcie.

Szczegóły i testy: `docs/tickets/107-FEATURE-products-blokady-triggery/` (`plan.md` T1–T4, `raport.md`,
`rebuild/backend/test/db.migracja-011.test.ts`).
