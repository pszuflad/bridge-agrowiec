# 76-FEATURE-przewoznicy-serwer-paletowy — P9.1: wspólna lista przewoźników + potwierdzenie usuwania + kalkulator paletowy

> Status: Approved (2026-09-21)
> Branch: `feature/76-przewoznicy-serwer-paletowy`
> Worktree: `.worktrees/76-FEATURE-przewoznicy-serwer-paletowy`
> Karta: **P9.1** (roadmapa, blok „Poprawki po testach Ani", podsekcja „Iteracja 9"); wpisy backlogu #27, #28

## Ticket description

Trzy świadome odstępstwa od produkcji, zatwierdzone przez Anię (rundy pytań 2026-09-18 i 2026-09-21):

1. Usunięcie przewoźnika pyta o potwierdzenie (dziś znika od razu).
2. Lista przewoźników i dzielników przenosi się z IndexedDB przeglądarki na **serwer**. Edytuje każdy
   zalogowany. Seed potwierdzony 21.09 bez poprawek: GEIS Polska 10 000 · DPD 6 000 · GLS 4 000 ·
   InPost Kurier 5 000 · UPS 5 000 · DHL Parcel 5 000, GEIS domyślny.
3. Kalkulator **paletowy** (`POST /api/waga-gabarytowa/oblicz`, dziś bez konsumenta) dostaje ekran
   obok kalkulatora wolumetrycznego, a nie zamiast niego.

## Context

- **Dwa kalkulatory.** Widok `/waga-gabarytowa` liczy lokalnie wagę **wolumetryczną**
  (`dł × szer × wys / dzielnik`, `pages/waga-gabarytowa/obliczenia.ts`). `/oblicz` liczy wagę
  **paletową** (`src/waga-gabarytowa/formula.ts`, progi `waga_gab.*`). Wolumetryczny zostaje bez zmian,
  paletowy dochodzi jako druga sekcja.
- **Dziś lista żyje w IndexedDB** (`magazynKV`, klucz `waga-gabarytowa-przewoznicy`). Widok trzyma
  stan w `WagaGabarytowa.tsx` i przy każdej zmianie zapisuje całą listę (autozapis co znak).
  `TabelaPrzewoznikow.tsx` odpowiada za prezentację i edycję.
- **Migracje.** `zastosujMigracje()` (`src/db/migrate.ts`) stosuje `rebuild/schema/*.sql` alfabetycznie,
  w transakcji, z ewidencją w `_migracje`. Cutover (`docs/cutover.md` §5 krok 5) uruchamia
  `npm run migrate` na żywej `data.db`, więc `INSERT` w migracji **trafia do produkcji**. Najwyższy
  numer: `006` na `origin/develop`. Jedyny otwarty PR (#87) nie ma migracji, więc numer `007` jest wolny
  (sprawdzone 2026-09-21; do ponownego sprawdzenia przed PR).
- **Config nie nadaje się na listę.** `GET /api/config` oddaje całą tabelę `config` bez maskowania,
  a fixture `GET_config.json` ma dokładnie 11 kluczy. Klucz JSON wyciekłby do zakładki Konfiguracja
  i rozjechał fixture.
- **Audyt.** `zapiszAudyt()` (`repos/audit.ts`) + lokalny wrapper `audytuj()` w try/catch
  (`routes/atrybuty.ts:65-71`). Widok Historii czyta `audit_log` przez whitelistę akcji
  (`repos/audit-historia.ts`, `inArray`), więc nowa akcja się tam nie pokaże. Tak ma być (F).
- **Wartości `waga_gab.*` w `db/snapshot.db`** (sprawdzone): `szer_polpaleta = 55`, `szer_paleta = 80`,
  `wys_palety = 10`, `wspolczynnik = 0.000167`. Identyczne z `KONFIGURACJA_POCZATKOWA` i fixture
  `GET_config.json`.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

- **`POST /api/waga-gabarytowa/oblicz`** — kontrakt **bez zmian**, handler bez zmian (bez walidacji,
  każde wejście 200). Fixture brak (jak w I9). Istniejący `waga-gabarytowa.gate.test.ts` ma przejść
  bez zmian.
- **`GET /api/waga-gabarytowa/przewoznicy`, `PUT /api/waga-gabarytowa/przewoznicy`** — **nowe trasy,
  których produkcja nie ma.** Fixture nie istnieje i nie może istnieć (nie ma czego nagrać). Opisujemy
  je ręcznie w `contract/openapi.yaml` (inline schema w `requestBody`, kształt odpowiedzi w tekście markera — linie statusów należą do generatora schematów; `security: bearerAuth`) z nowym markerem
  `x-odbudowa-nowa-trasa` (uzasadnienie + wpisy #27). Gate: `sprawdzZgodnoscZKontraktem` dla 200,
  400 i 401. Test `kontrakt.spojnosc.test.ts` (generator schematów) musi zostać zielony.
- `contract/fixtures/` — **nie ruszamy**.

## Decisions

Świadome odstępstwa od produkcji (zatwierdzone przez Anię, backlog #27 i #28):

- **O1. Lista na serwerze** zamiast IndexedDB. Wspólna dla wszystkich zalogowanych.
- **O2. Potwierdzenie usunięcia** przez `DialogPotwierdzenia` z nazwą przewoźnika i ostrzeżeniem,
  że lista jest wspólna.
- **O3. Kalkulator paletowy w UI** jako druga sekcja na `/waga-gabarytowa`.

Decyzje z Q&A (2026-09-21, wszystkie zgodne z rekomendacją):

- **D1. Osobna tabela `waga_gab_przewoznicy` + seed w migracji `007`.** Seed trafia do produkcji przy
  cutoverze przez `npm run migrate`, bez ręcznych kroków. To pierwszy `INSERT` danych w migracji. Seed
  jest idempotentny (`INSERT OR IGNORE`), bo migracja i tak wykonuje się raz. Odrzucone: klucz w
  `config` (wyciek przez `GET /api/config`, rozjazd fixture) oraz pusta tabela z listą domyślną w kodzie
  (w bazie nie byłoby danych, dopóki nikt nic nie zapisze).
- **D2. Zmiana nazwy lub dzielnika zapisuje się po opuszczeniu pola (blur).** Pusta nazwa albo zły
  dzielnik → komunikat i powrót do poprzedniej wartości, bez żądania. Dodanie i usunięcie (po
  potwierdzeniu) zapisują od razu. Tekst „Zmiany zapisują się automatycznie" zostaje prawdziwy.
- **D3. Wybrany przewoźnik usunięty przez kogoś innego → po cichu pierwszy z listy** (jak `find ?? c[0]`
  w oryginale), a zapamiętany wybór i pole `select` są poprawiane.
- **D4. Kalkulator paletowy: pełny wynik, bez pamięci.** Pola: szerokość, długość, wysokość (cm).
  Wynik: `wagaGabarytowa`, `szerokoscEfektywna`, `wysokoscZPaleta`, `wspolczynnik`, `opis`. Nic nie
  trafia do IndexedDB.

Założenia A–G z karty, przyjęte bez zmian:

- **A.** Na serwer idzie tylko lista. `KLUCZ_WYBRANY`, `KLUCZ_OSTATNI_WYNIK`, `KLUCZ_OSTATNIE_WYMIARY`
  zostają w IndexedDB.
- **B.** „Przywróć domyślne" pyta (`DialogPotwierdzenia`: „zmieni listę dla całej firmy"), potem robi
  `PUT` z listą domyślną i ustawia wybór na GEIS. Lista domyślna po stronie FE zostaje w
  `PRZEWOZNICY_DOMYSLNI`. API ma tylko GET i PUT (bez osobnego endpointu resetu), więc seed jest
  w dwóch miejscach: migracja i stała FE. Test BE pilnuje, że seed migracji = ta lista.
- **C.** Bez importu z IndexedDB. Klucz `KLUCZ_PRZEWOZNICY` przestaje być czytany i pisany. Zostaje
  **nieczytany**: `magazynKV.ts` nie ma funkcji usuwania, a ruszać go nie wolno. Stała znika z
  `przewoznicy.ts`, żeby nikt nie podpiął jej z powrotem.
- **D.** `GET` i `PUT` całej listy pod `/api/waga-gabarytowa/przewoznicy`, `requireAuth`. Wygrywa
  ostatni zapis, bez blokad współbieżności. `PUT` oddaje zapisaną listę, a FE wkłada ją do cache.
- **E.** Walidacja PUT → `400 {error}` (konwencja globalna, jak `routes/config.ts`): ciało musi być
  niepustą tablicą („Musi pozostać co najmniej jeden przewoźnik"); każdy element: `id` niepustym
  napisem, bez duplikatów; `nazwa` napisem niepustym po `trim()`; `dzielnik` liczbą (`typeof number`,
  skończoną, > 0). Tekst `"5000"` → 400. `domyslny` opcjonalny, boolean. Komunikat wskazuje pozycję,
  np. „Przewoźnik nr 2: dzielnik musi być liczbą dodatnią".
- **F.** Audyt: `akcja: "edycja_przewoznikow"`, `encjaTyp: "waga_gab_przewoznicy"`, `szczegoly: {przed, po}`
  (całe listy, bo są krótkie). Wrapper try/catch jak w `atrybuty.ts`. `historia/mapowanie.ts` bez zmian.
- **G.** Tabela (D1). Kształt API: `{id, nazwa, dzielnik, domyslny}` (`domyslny: boolean` zawsze w
  odpowiedzi); `kolejnosc` jest wewnętrzna, wynika z pozycji w tablicy.

## Implementation plan

### Backend (`rebuild/backend/`, `rebuild/schema/`)

1. `rebuild/schema/007_waga_gab_przewoznicy.sql`:
   `CREATE TABLE waga_gab_przewoznicy (id TEXT PRIMARY KEY, nazwa TEXT NOT NULL, dzielnik REAL NOT NULL,
   kolejnosc INTEGER NOT NULL, domyslny INTEGER NOT NULL DEFAULT 0)` + `INSERT OR IGNORE` sześciu
   przewoźników. Nagłówek: skąd seed, że trafia do prod przy cutoverze.
2. `src/db/schema.ts` — model Drizzle `wagaGabPrzewoznicy` (ręcznie, w stylu pliku; `domyslny` jako
   `integer({mode:"boolean"})`).
3. `src/repos/przewoznicy.ts` — `odczytajPrzewoznikow(db)` (ORDER BY kolejnosc) i
   `zapiszPrzewoznikow(db, lista)` (transakcja: DELETE + INSERT z `kolejnosc = indeks`).
4. `src/waga-gabarytowa/przewoznicy.ts` — `zwalidujListePrzewoznikow(body)` → lista albo komunikat
   błędu (czysta funkcja).
5. `routes/waga-gabarytowa.ts` — dwie trasy obok `/oblicz` (ta sama fabryka, rejestracja w `app.ts`
   bez zmian): `GET` i `PUT`, obie `requireAuth`; PUT: walidacja → odczyt „przed" → zapis → audyt
   (try/catch) → `200` z listą po zapisie.
6. `test/db.migracje.test.ts` — lista migracji + 27 tabel.
7. Testy: `test/waga-gabarytowa.przewoznicy.test.ts` (GET seed w kolejności, PUT → GET, walidacja 400
   dla: pustej listy, braku tablicy, pustej nazwy, dzielnika 0/ujemnego/tekstu, duplikatu id;
   audit_log z `przed`/`po`; 401 bez tokenu dla GET i PUT; zgodność z kontraktem 200/400/401;
   seed migracji = lista Ani).

### Kontrakt

8. `contract/openapi.yaml` — ścieżka `/api/waga-gabarytowa/przewoznicy` (get, put) z inline schematem
   `Przewoznik`, kodami 200/400/401 i `x-odbudowa-nowa-trasa`. `/oblicz` bez zmian.

### Frontend (`rebuild/frontend/`)

9. `pages/waga-gabarytowa/api.ts` — `KLUCZ_PRZEWOZNIKOW = ["/api/waga-gabarytowa/przewoznicy"]`,
   `zapiszPrzewoznikow(lista)` (PUT, zwraca listę), `obliczPaletowo(wymiary)` (POST `/oblicz`) + typ
   `WynikPaletowy` (5 pól).
10. `pages/waga-gabarytowa/przewoznicy.ts` — usunięcie `KLUCZ_PRZEWOZNICY`, poprawa nagłówka
    (lista na serwerze), `PRZEWOZNICY_DOMYSLNI` zostaje (reset).
11. `WagaGabarytowa.tsx` — lista z `useQuery`, mutacja `PUT` (sukces → `setQueryData`, błąd → toast
    i odświeżenie z serwera). Wybór, wymiary i wynik dalej w IndexedDB. Efekt D3: gdy lista wczytana,
    a `wybrany` nie istnieje → `ustawWybranego(lista[0].id)`. Kalkulator wolumetryczny zablokowany,
    dopóki lista się nie wczyta; przy błędzie odczytu komunikat w miejscu tabeli.
12. `TabelaPrzewoznikow.tsx` — szkic pól edycji z zapisem na blur (D2), dialog usunięcia (O2),
    dialog „Przywróć domyślne" (B), przyciski zablokowane w trakcie zapisu. Nagłówek: dopisek, że lista
    jest wspólna dla wszystkich.
13. **Nowy** `pages/waga-gabarytowa/KalkulatorPaletowy.tsx` — Card „Waga paletowa (opony)" z
    jednozdaniowym opisem różnicy, trzy pola, walidacja w formularzu (liczba ≥ 0, puste = błąd),
    `useMutation` → `/oblicz`, wynik: waga + rozbicie + `opis`. Wstawiony pod tabelą przewoźników.
14. Testy: przepisanie `test/waga-gabarytowa.test.tsx` na MSW (handler GET/PUT z listą w pamięci).
    Scenariusze z karty + istniejące scenariusze kalkulatora i edytora. `waga-gabarytowa.obliczenia.test.ts`
    **bez zmian**.

## Testing strategy

- **Gate:** nowe trasy walidowane `sprawdzZgodnoscZKontraktem` (200, 400, 401). `/oblicz`: istniejący
  gate bez zmian. `kontrakt.spojnosc.test.ts` zielony. Fixtures nieruszane.
- **BE integracyjne** na prawdziwej bazie tymczasowej (migracje z kanonu), bez mocków.
- **FE:** RTL + MSW (`onUnhandledRequest: "error"`). Sprawdzamy ciało PUT-a i to, że bez potwierdzenia
  nie ma PUT-a.
- Bramki obu stron: lint, typecheck, build, test (Node 20).

## Out of scope

- Ekran dla czterech ustawień `waga_gab.*` (instrukcja I9 §4 pkt 8).
- Wpis w widoku Historii / słowniku `historia/mapowanie.ts`.
- Zmiany w `formula.ts`, `obliczenia.ts` (wzór), `lib/magazynKV.ts`, Spedycji.
- Sprostowanie `docs/instrukcja-testow-I9.md` (§3.11, §4 pkt 4 i 6, „lista żyje w Twojej przeglądarce")
  → karta P9.2.
- Blokady współbieżności edycji.

## Definition of done

- [ ] Migracja 007 tworzy tabelę i sześciu przewoźników w kolejności, GEIS `domyslny`.
- [ ] `GET/PUT /api/waga-gabarytowa/przewoznicy` działają za `requireAuth`, walidują i audytują.
- [ ] Kontrakt opisuje nowe trasy, `/oblicz` bez zmian, fixtures bez zmian.
- [ ] Widok czyta listę z API, nie z IndexedDB; edycje zapisują się na serwer.
- [ ] Usunięcie i „Przywróć domyślne" pytają o potwierdzenie, anulowanie nic nie zmienia.
- [ ] Ostatniego przewoźnika nie da się usunąć; usunięcie wybranego przenosi wybór.
- [ ] Wybór usunięty przez kogoś innego → pierwszy z listy.
- [ ] Kalkulator paletowy woła `/oblicz` i pokazuje pełny wynik.
- [ ] `waga-gabarytowa.obliczenia.test.ts` przechodzi bez zmian; bramki BE i FE zielone.
