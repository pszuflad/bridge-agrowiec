# Cutover — przełączenie produkcji na odbudowany stos (big-bang)

**Wersja dokumentu:** 2026-09-08 (ticket `39-CHORE-audyt-bezpieczenstwa-domkniecie`, Iteracja 12e)
**Charakter:** plan do wykonania w umówionym oknie, wspólnie z Anią. **Ten dokument niczego nie
uruchamia** — sam cutover to osobne zdarzenie, poza zakresem ticketa, który go opisał.

---

## 1. Co się zmienia, a co zostaje

Przełączamy **jednym ruchem** (big-bang, bez okresu współbieżnego działania obu wersji):

| | Przed | Po |
|---|---|---|
| Backend | `mirror/backend/index.cjs` + kilkanaście łatek `patch_*.cjs`, PM2 `bridge-backend`, `0.0.0.0:5000` | `rebuild/backend` → `dist/server.js`, PM2, ten sam port |
| Frontend | zbudowany bundle w `public_html/panel` + trzy skrypty wstrzykiwane (`selly-injection.js`, `pending-injection.js`, `freq-injection.js`) | build `rebuild/frontend`, **skrypty wstrzykiwane znikają** — wszystkie trzy wchłonięte (I7, I8, 3f-2) |
| Baza | `/home/admin/private_apps/bridge/data.db` | **TA SAMA** `data.db` — nie przenosimy plików do innej bazy, ale `npm run migrate` na niej stosuje migracje SCHEMATU (001–003), DANYCH (004–006, konwencje 13c) **nowych tabel** (007 — sześciu przewoźników wagi gabarytowej, 76-FEATURE; 008 — statusy pseudo-alertów katalogowych, 77-FEATURE) oraz **poprawek danych** (009 — polskie znaki w alertach, 92-CHORE; 010 — marki różniące się tylko wielkością liter, 101-CHORE). Pełny opis 004–010: krok 5 w rozdziale 5 |
| Apache | `public_html/panel/.htaccess`, proxy `/api/*` | ten sam mechanizm, przekierowanie na nowy proces |

**Baza jest wspólnym mianownikiem i to jest największe ryzyko całej operacji** — dlatego
rozdział 3 (weryfikacja schematu) jest najdłuższy i nie wolno go pominąć.

**⚠ Kolumna „Konstrukcja opony" zacznie po cutoverze działać — i to jest poprawne.** Łatka
pass-through z 2026-09-01 trafiła do MARTWEGO bundla `index-BRIDGEONE21783342500.js`, a
`mirror/frontend/index.html:16` ładuje `index-PRICEFMT1783512500.js` — więc po migracji
`konstrukcja` na pełne słowa **żywa produkcja pokazuje dziś „—" w tej kolumnie i pustą kolumnę
w eksporcie CSV** (7392 wiersze). Odbudowa ma pass-through od 13c, więc po przełączeniu w tym
miejscu pojawią się „Radialna"/„Diagonalna". Zmiana na lepsze, ale nieoczekiwana — uprzedź Anię
przed oknem. Ustalenie 13e, decyzja D4: `docs/tickets/47-CHORE-i13e-frontend-bridgeone/plan.md`.

**Routing adresów.** Odbudowa porzuciła routing po hashu (odstępstwo O1 z I1): stary panel dawał
adresy `/#/katalog`, nowy daje `/katalog`. Zakładki Ani zapisane na starych adresach trafią na
`/` (hash jest ignorowany po stronie serwera) — to nie jest awaria, ale warto ją o tym uprzedzić
przed oknem, żeby nie zgłosiła tego jako błąd.

**⚠ Pierwszy start procesu i pierwszy zapis dowolnej reguły cenowej mogą wyglądać jak masowa,
niezamówiona zmiana cen — uprzedź Anię przed oknem.** Znalezisko 14e: samo `przeliczCenyZRegul`,
bez żadnej promocji, prostuje pozycje rozjechane z aktualnym narzutem — **2050 z 7405 cen** się
zmieni przy pierwszym zapisie dowolnej reguły narzutu po cutoverze. To zachowanie oryginału, nie
defekt odbudowy. Od karty 14f dochodzi drugi efekt tego samego przeliczenia: nowy wygaszacz
(`docs/tickets/64-FEATURE-i14f-daty-koncza-promocje/`) przy PIERWSZYM STARCIE PROCESU przestawia
`promotions.status` na wartość wyliczoną z dat, w obie strony — świadome odstępstwo od produkcji,
która statusu nigdy nie przelicza. Na dziś tabela `promotions` na produkcji jest **pusta**
(0 wierszy), więc realnie zamiecie 0 wierszy, ale gdy promocje się pojawią, pierwszy start po
przestoju je uporządkuje.

---

## 2. Warunki wstępne (wszystkie muszą być spełnione PRZED oknem)

> **Ustalenia z Anią (runda 3, 2026-09-22):** okno przełączenia **w weekend** (nie w dni robocze pn–pt), konkretny
> dzień i porę ustala Paweł z Anią. **Cron CSV Selly o 6:00** (dziś uruchamia stary `generate_selly_export.cjs`) trzeba
> przepiąć na polecenie generatora nowego stosu (backlog #102, karta I15.3). **Stary Bridge po przełączeniu NIE może
> działać równolegle** na tej samej `data.db` (dwa schedulery importu i dwie synchronizacje Selly) — **decyzja D9 (użytkownik, 2026-09-22):
> stary Bridge wyłączony od razu po przełączeniu**; kod i kopia bazy zostają ~2 tygodnie na rollback; zmiany po
> cutoverze wyłącznie w nowym stosie (`develop` → staging → test → produkcja).

- [ ] **Przegląd 12 widoków przez Anię zakończony i zaakceptowany** na staging
      (`docs/przeglad-12-widokow.md`). To jest warunek nadrzędny — bez niego nie zaczynamy.
- [ ] **Bramki zielone** na `develop`: `lint`, `typecheck`, `build`, `test` po obu stronach
      (backend: 80 plików / 1241 testów — 13d-1 cofnięte; frontend: 48 plików / 751 testów + 5 plików
      integracyjnych).
- [ ] **Sekrety produkcyjne przygotowane** w pliku `.env` poza repo (rozdział 4). Bez
      `JWT_SECRET` i `DB_PATH` backend **nie wstanie** — to celowy fail-fast, nie usterka.
- [ ] **Schemat produkcji zweryfikowany** wg rozdziału 3, na KOPII, nie na żywej bazie.
- [ ] **Okno uzgodnione z Anią** — w trakcie panel jest niedostępny; policz kilkanaście minut
      plus czas na smoke-testy.
- [ ] **Scheduler importu wygaszony na czas okna** albo świadomie zaakceptowany: stary proces
      rusza po URL-e dostawców, a przy przełączaniu nie chcemy importu w połowie.

---

## 3. ⚠ Weryfikacja schematu bazy — NAJWAŻNIEJSZY KROK

### Dlaczego to jest niebezpieczne

Nasze migracje zakładają kształt tabel z `rebuild/schema/001_schema.sql`. **Produkcyjna
`data.db` nie pochodzi z tego kanonu** — ma za sobą własną historię zmian Ani (migracja
`szertxt` z 2026-08-19) oraz łatki dokładane runtime'owo przy każdym starcie procesu
(`uwaga_cena_patch.cjs` robi `ALTER TABLE products ADD COLUMN uwaga_cena`).

Ten sam mechanizm już raz uderzył — na staging, gdzie `products.szerokosc` był TEXT-em, choć
kanon deklarował REAL, i przez wiele iteracji nikt tego nie widział
(`docs/deploy-setup.md`, sekcja „Schemat bazy staging NIE pochodzi z naszego kanonu").

**Dwa konkretne, przewidywalne zderzenia na produkcji:**

**(a) `002_import.sql` prawdopodobnie PADNIE.** Zawiera
`ALTER TABLE products ADD COLUMN uwaga_cena TEXT;`, a produkcja tę kolumnę już ma — dokłada ją
patch przy każdym starcie. SQLite odpowie `duplicate column name: uwaga_cena`. Migracje idą
w transakcji, więc **cała 002 się wycofa i `npm run migrate` przerwie**.

**(b) `003_szerokosc_text.sql` przebudowuje tabelę przez `INSERT INTO nowa SELECT * FROM stara`.**
`SELECT *` jest wrażliwy na **liczbę i KOLEJNOŚĆ** kolumn. Przy rozjeździe albo padnie (liczba
się nie zgadza), albo — co gorsze — **po cichu przestawi dane** (liczba się zgadza, kolejność
nie). Produkcja przeszła własną wersję `szertxt`, więc kolejność kolumn NIE JEST u nas znana
z góry.

**Stan zmierzony (2026-09-08, ticket 39):**

| | products: kolumn | `szerokosc` | `uwaga_cena` | `suppliers.import_wylaczony` | `_migracje` |
|---|---|---|---|---|---|
| Kanon po 001+002+003 | **73** | TEXT | jest, **ostatnia** | jest | jest |
| `db/snapshot.db` (2026-08-13) | 72 | REAL | brak | brak | brak |
| **Produkcja dziś** | **NIEZMIERZONE** | ? | ? | ? | ? |

Snapshot jest starszy niż `szertxt` i niż patch `uwaga_cena`, więc **nie mówi nic o dzisiejszej
produkcji** — służy tu wyłącznie jako punkt odniesienia. Kolumnę `products.uwaga_cena` na
produkcji potwierdza natomiast zmierzone zachowanie API (72 klucze w `GET /api/products`, bez
`uwagaCena` — Drizzle jej nie widzi, bo model jej nie zna, ale fizycznie w tabeli jest).

### Jak to sprawdzić — na kopii, nigdy na żywej bazie

```bash
# 1. Kopia produkcji do piaskownicy (sqlite3 CLI hosta ma 3.26 → `.backup`, NIE `VACUUM INTO`)
mkdir -p ~/cutover-proba
sqlite3 /home/admin/private_apps/bridge/data.db \
  ".backup '$HOME/cutover-proba/data.db'"

# 2. Kształt tabel, które ruszają migracje
sqlite3 ~/cutover-proba/data.db "PRAGMA table_info(products);"   > ~/cutover-proba/products.txt
sqlite3 ~/cutover-proba/data.db "PRAGMA table_info(suppliers);"  > ~/cutover-proba/suppliers.txt
wc -l ~/cutover-proba/products.txt          # oczekiwane: 73 (72 + uwaga_cena)
grep -c uwaga_cena ~/cutover-proba/products.txt
grep -c import_wylaczony ~/cutover-proba/suppliers.txt
sqlite3 ~/cutover-proba/data.db "SELECT name FROM sqlite_master WHERE name='_migracje';"

# 3. Ten sam pomiar na świeżej bazie z kanonu — punkt odniesienia
cd ~/private_apps/bridge-staging/repo/rebuild/backend
DB_PATH=/tmp/kanon.db npm run migrate
sqlite3 /tmp/kanon.db "PRAGMA table_info(products);" > /tmp/kanon-products.txt

# 4. RÓŻNICA — musi być pusta albo świadomie zaakceptowana
diff ~/cutover-proba/products.txt /tmp/kanon-products.txt
```

### 5. PRÓBA MIGRACJI NA KOPII — obowiązkowa

```bash
cd ~/private_apps/bridge-staging/repo/rebuild/backend
DB_PATH=$HOME/cutover-proba/data.db npm run migrate
```

Dopiero wynik tej próby mówi, co zrobić dalej.

**Jeśli przeszło bez błędu** — sprawdź jeszcze, czy dane nie przestawiły się po 003:

```bash
sqlite3 ~/cutover-proba/data.db \
  "SELECT kod, nazwa, marka, szerokosc, cena_zakupu FROM products LIMIT 5;"
sqlite3 ~/cutover-proba/data.db "SELECT COUNT(*) FROM products;"
```
Liczba produktów musi się zgadzać z liczbą sprzed migracji, a wartości w kolumnach muszą
wyglądać sensownie (marka w `marka`, cena w `cena_zakupu`). **Przestawione kolumny nie rzucą
błędu — trzeba je zobaczyć.**

**Jeśli padło na `duplicate column name: uwaga_cena`** (scenariusz oczekiwany) — kolumna już
jest, więc migracja 002 nie ma czego dokładać. Odnotuj ją jako zastosowaną i puść resztę:

```bash
sqlite3 ~/cutover-proba/data.db "
  CREATE TABLE IF NOT EXISTS _migracje (nazwa TEXT PRIMARY KEY, zastosowano TEXT NOT NULL);
  INSERT OR IGNORE INTO _migracje (nazwa, zastosowano)
    VALUES ('002_import.sql', datetime('now'));"
# Brakującą część 002 (kolumna dostawcy) dokładamy ręcznie, jeśli jej nie ma:
sqlite3 ~/cutover-proba/data.db \
  "ALTER TABLE suppliers ADD COLUMN import_wylaczony INTEGER NOT NULL DEFAULT 0;"
sqlite3 ~/cutover-proba/data.db "UPDATE suppliers SET import_wylaczony = 1 WHERE kod = 'MO6';"
DB_PATH=$HOME/cutover-proba/data.db npm run migrate      # zostaje 001 i 003
```

**Jeśli padło na 003** (niezgodna liczba kolumn) — **STOP, nie przełączamy**. Trzeba wtedy
napisać wariant 003 dopasowany do faktycznego kształtu produkcji, przetestować go na kopii
i wrócić do cutoveru w kolejnym oknie. To jest dokładnie ta sytuacja, dla której ta próba
istnieje.

**Jeśli 001 zgłosi cokolwiek poza „już istnieje"** — też STOP. `001_schema.sql` jest
idempotentny (`CREATE TABLE IF NOT EXISTS`) i na bazie produkcyjnej ma być no-opem.

> ⚠ **Uwaga o pozornej zgodności.** Po `npm run migrate` tabela `_migracje` odnotuje wszystkie
> trzy pliki jako zastosowane — także wtedy, gdy realny schemat różni się od kanonu. Od tego
> momentu obie strony *wyglądają* na zgodne. Dlatego `diff` z kroku 4 i podgląd danych z kroku 5
> robimy **przed** uznaniem migracji za udaną, a nie po.

---

## 4. Zmienne środowiskowe — różnice staging vs produkcja

Sekrety trzymamy w pliku poza repo (`chmod 600`), wczytywanym przez skrypt startowy — tak jak
na staging (`docs/deploy-setup.md`, punkt 4a). **Nie wpisujemy ich do repo ani do PM2 inline.**

**Wymagane bez wartości domyślnej — bez nich proces nie wstanie (fail-fast):**

| Zmienna | Wartość produkcyjna | Uwaga |
|---|---|---|
| `DB_PATH` | `/home/admin/private_apps/bridge/data.db` | ta sama baza, co stary stos |
| `JWT_SECRET` | losowy, ≥ 32 bajty | ⚠ **zmiana sekretu wylogowuje wszystkich** — patrz niżej |

**Mają wartości domyślne BEZPIECZNE DLA STAGINGU, ale NIEWIERNE PRODUKCJI — trzeba je ustawić
jawnie.** To jest najłatwiejsza rzecz do przeoczenia w całym cutoverze, bo nic nie krzyknie:
proces wstanie i będzie wyglądał na zdrowy.

| Zmienna | Domyślna | Produkcja | Co się stanie po przeoczeniu |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | ciasteczko sesji bez `Secure`; strażnik CORS nieaktywny |
| `HOST` | `127.0.0.1` | `0.0.0.0` | zależnie od konfiguracji proxy |
| `PORT` | `5001` | `5000` | Apache proxuje w pustkę |
| `IMPORT_SCHEDULER` | **wyłączone** | `true` | **import z URL-i przestaje chodzić** — cennikami nikt się nie zajmuje, a panel wygląda normalnie |
| `IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG` | wyłączone | do decyzji | bez niego pierwszy przebieg dopiero po pełnym cyklu |
| `SELLY_TRYB` | `wylaczony` | `pelny` | **integracja Selly milczy** — klient odmawia każdej operacji, także z poprawnymi sekretami |
| `SELLY_SHOP_URL`, `SELLY_CLIENT_ID`, `SELLY_CLIENT_SECRET`, `SELLY_SCOPE` | brak / `READWRITE` | prawdziwe sekrety | sześć tras zewnętrznych oddaje 500 „Brak konfiguracji" |
| `SELLY_CSV_DIR`, `SELLY_CSV_PLIK`, `SELLY_CSV_URL` | **wartości produkcyjne** | zostawić domyślne | to jedyne trzy, których produkcja NIE nadpisuje — staging musi, produkcja nie |
| `CORS_ORIGINS` | puste | **zostawić puste** | patrz niżej |
| `IMPORT_ARCHIVE_DIR` | `<cwd>/import_archive` (`rebuild/backend/src/import/archiwum.ts:40`) | **`/home/admin/private_apps/bridge/import_archive`** — katalog archiwum STAREGO stosu | archiwum importu przepadałoby przy każdym deployu, a widok „Archiwum importów” (PR.1) nie pokazałby plików sprzed przełączenia. Proces musi mieć prawo zapisu do katalogu. Rotacja 7 dni (po `mtime`) przy pierwszym zapisie usunie starsze pliki — tak samo jak na starym stosie |
| `AGRORAMI_EMAIL`, `AGRORAMI_PASSWORD` | brak | **te same dane logowania do hurtowni Agro-Rami, których używa stary stos** | **MO9 (Agro-Rami/BKT) przestaje się importować** — to jedyny dostawca z API (GraphQL `hurtownia.agrorami.pl`, od 2026-07-10); plik CSV z URL w tabeli `suppliers` jest ignorowany. Proces wstaje normalnie, a błąd widać dopiero jako alert importu MO9. `AGRORAMI_GRAPHQL_URL` i `AGRORAMI_CATEGORY_ID` mają domyślne wartości zgodne z produkcją |

**`CORS_ORIGINS` zostaje PUSTY i to jest stan docelowy, nie przeoczenie.** Front i `/api` stoją
pod tą samą domeną za proxy Apache (same-origin), więc bez nagłówków `Access-Control-Allow-*`
przeglądarka blokuje cross-origin sama. Dokładanie allowlisty „na wszelki wypadek" to
konfiguracja na wyrost — każdy origin na liście dostaje `Access-Control-Allow-Credentials: true`.
Od 12e proces **wypisuje przy starcie**, w jakim jest stanie (`[cors] wyłączony …`), a wpisanie
`*` przy `NODE_ENV=production` **zatrzyma start** z czytelnym komunikatem.

> **⚠ `JWT_SECRET` a sesje Ani.** Stary backend miał sekret zahardkodowany w kodzie
> z fallbackiem; odbudowa wymaga własnego. Nowy sekret = **wszystkie istniejące tokeny
> przestają być ważne**, więc po przełączeniu trzeba zalogować się od nowa. To jest oczekiwane
> — uprzedź Anię, żeby nie wzięła tego za awarię. Hasła zostają bez zmian (ta sama tabela
> `users`, ten sam bcrypt).

---

## 5. Kroki przełączenia (okno)

Numeracja jest kolejnością wykonania. Każdy krok kończy się sprawdzeniem.

1. **Ogłoś okno.** Ania kończy pracę w panelu i nie wchodzi do końca operacji.

2. **Zatrzymaj stary backend** — żeby nic nie pisało do bazy w trakcie kopii i migracji.
   ```bash
   pm2 stop bridge-backend
   pm2 status
   ```

3. **Kopia bazy — punkt powrotu.** Robimy ją PO zatrzymaniu procesu, żeby była spójna.
   ```bash
   sqlite3 /home/admin/private_apps/bridge/data.db \
     ".backup '/home/admin/private_apps/bridge/data.db.przed-cutover-$(date +%Y%m%d-%H%M)'"
   ls -la /home/admin/private_apps/bridge/data.db.przed-cutover-*
   ```
   ⚠ Plik musi być niepusty i mieć rozmiar zbliżony do oryginału. **To jest jedyna droga
   powrotu dla danych — nie idź dalej, jeśli kopii nie ma.**

4. **Wydanie nowego kodu** — build z `develop` (ta sama mechanika, co staging: katalog
   `releases/<sha>` + przełączenie dowiązania `current`, żeby rollback był podmianą symlinku).
   ```bash
   cd <katalog wydania>/rebuild/backend && npm ci --include=dev && npm run build
   cd ../frontend && npm ci --include=dev && npm run build
   ```

5. **Migracje na ŻYWEJ bazie** — wariantem ustalonym w rozdziale 3 (albo zwykłe
   `npm run migrate`, albo z ręcznym odnotowaniem 002).
   ```bash
   cd <katalog wydania>/rebuild/backend
   DB_PATH=/home/admin/private_apps/bridge/data.db npm run migrate
   ```
   Wynik wypisuje, co zastosowano i co pominięto. **Każdy błąd = przerwij i wróć do rozdziału 7.**
   Od 13c dochodzą trzy migracje DANYCH — `004_kategoria_wielka_litera.sql`,
   `005_konstrukcja_slowa.sql`, `006_nazwa_caps.sql` — które odtwarzają konwencje wprowadzone
   przez Anię na produkcji 18.08 i 09-01. **Na żywej bazie mają nie zmienić ani jednego wiersza** —
   produkcja te dane już zmigrowała, więc to jest oczekiwany no-op, dowód wierności, nie usterka.

   Od 76-FEATURE dochodzi `007_waga_gab_przewoznicy.sql` — inny przypadek: tworzy nową tabelę
   `waga_gab_przewoznicy` i **wstawia** sześciu przewoźników (GEIS Polska 10000 domyślny, DPD 6000,
   GLS 4000, InPost Kurier 5000, UPS 5000, DHL Parcel 5000). To NIE jest no-op — produkcja tej
   tabeli nie ma (lista dziś żyje w IndexedDB przeglądarki), więc migracja realnie dokłada sześć
   wierszy. `INSERT OR IGNORE`, więc powtórne uruchomienie nic nie zmieni.

   ⚠ **`008_alerty_katalogu_statusy.sql` (karta P6.2) MUSI zostać zastosowana** — w odróżnieniu
   od `004`–`006` to NIE jest no-op: produkcja tabeli `alerty_katalogu_statusy` nie ma (status
   pseudo-alertów katalogowych tam żył w IndexedDB przeglądarki), więc migracja ją dopiero
   tworzy, pustą. Bez niej zakładka „Katalog" na `/alerty` pokazuje błąd zapytania SQL po
   przełączeniu.

   ⚠ **`009_alerty_polskie_znaki.sql` (karta PR.3, 92-CHORE) — NIE jest no-opem.** Stary backend ma
   znaki zapytania wpisane na sztywno w literałach (`B??d pobierania`, `R?czny upload`, `B??d HTTP`,
   `produkt?w`, `b??dy`), więc psuje KAŻDY nowy alert aż do dnia przełączenia. Migracja naprawia
   wszystkie takie wiersze zapisane do tego dnia (na snapshocie z 13.08: 435 `typ` + 2219 `opis`,
   na żywej bazie więcej). Odbudowa pisze poprawnie, więc po przełączeniu problem nie wraca.

   ⚠ **`010_marka_caps.sql` (karta PR.5, 101-CHORE, backlog #92) — NIE jest no-opem.** Marki różniące
   się od istniejącej marki wyłącznie wielkością liter przechodzą na formę WIELKIMI literami, a forma
   niekanoniczna znika ze słownika marek. Na snapshocie: 1 produkt (`MO1_71970103`, `Alliance` →
   `ALLIANCE`) + 1 wpis słownika. Import od 09-01 i tak podaje markę wielkimi literami, więc poprawka
   nie wróci.

   **Punkty kontrolne po migracjach (na żywej bazie, po `npm run migrate`):**

   ```bash
   sqlite3 data.db "SELECT count(*) FROM alerts WHERE instr(typ,'?')>0 OR instr(opis,'produkt?w')>0;"   # → 0
   sqlite3 data.db "SELECT count(*) FROM products WHERE marka='Alliance';"                              # → 0
   sqlite3 data.db "SELECT count(*) FROM alerty_katalogu_statusy;"                                      # → 0 (tabela istnieje)
   ```

   ⚠ **`npm run migrate` tego NIE pokaże** — wypisuje wyłącznie, które PLIKI zastosował, a które
   pominął (`migrate-cli.ts`), bez liczby zmienionych wierszy. Sprawdź to osobno, na KOPII bazy
   z kroku 1, PRZED uruchomieniem migracji na żywej:

   ```bash
   sqlite3 /sciezka/do/kopii.db <<'SQL'
   SELECT 'konstrukcja', konstrukcja, COUNT(*) FROM products GROUP BY 2;
   SELECT 'kategoria', kategoria, COUNT(*) FROM products GROUP BY 2;
   SELECT 'nazwa nie-UPPER', COUNT(*) FROM products WHERE nazwa <> UPPER(nazwa);
   SELECT 'override nazwa nie-UPPER', COUNT(*) FROM manual_overrides
     WHERE field_name = 'nazwa' AND override_value <> UPPER(override_value);
   SQL
   ```

   Oczekiwane na bazie produkcji po 09-01: `konstrukcja` wyłącznie `Radialna`/`Diagonalna`,
   `kategoria` wyłącznie w formach z Wielkiej litery, oba liczniki nie-UPPER równe **0**.
   Jeśli którykolwiek wyjdzie inaczej, baza NIE ma jeszcze tej konwencji — zatrzymaj się
   i wyjaśnij rozbieżność, zanim puścisz migracje na żywej.

6. **Frontend na miejsce.** Podmień zawartość `public_html/panel` buildem z
   `rebuild/frontend/dist` i wgraj `.htaccess` z regułą proxy oraz SPA fallbackiem (wzór:
   `deploy/staging/htaccess`, z portem produkcyjnym).
   ⚠ **Usuń stare skrypty wstrzykiwane** — `selly-injection.js`, `pending-injection.js`,
   `freq-injection.js`. Wszystkie trzy zostały wchłonięte; zostawione podpięte robiłyby drugą,
   równoległą wersję tych ekranów.

7. **Start nowego backendu pod PM2** z plikiem środowiska z rozdziału 4.
   ```bash
   pm2 delete bridge-backend            # stary wpis, żeby nie startował po reboocie
   pm2 start dist/server.js --name bridge-backend --cwd <katalog wydania>/rebuild/backend
   pm2 save
   pm2 logs bridge-backend --lines 50
   ```
   W logu startu muszą pojawić się trzy rzeczy: adres nasłuchu z `NODE_ENV=production`
   i właściwym `DB_PATH`, linia `[cors] …` w oczekiwanym stanie, oraz `[scheduler]` —
   **jeśli widzisz „scheduler wyłączony", a miał być włączony, wróć do rozdziału 4.**

8. **Smoke-testy** — rozdział 6. Dopiero po nich ogłaszasz Ani, że panel jest gotowy.

---

## 6. Smoke-testy po przełączeniu

Kolejność jest celowa: od najtańszego do najdroższego, żeby awaria wyszła jak najwcześniej.

- [ ] `curl -s https://<domena>/api/health` → `{"ok":true}`
- [ ] `curl -s -o /dev/null -w '%{http_code}' https://<domena>/api/products` → **`401`**
      (bez tokenu). `200` w tym miejscu oznacza, że ruch idzie do STAREGO backendu — proxy
      nie zostało przełączone.
- [ ] Logowanie na konto Ani działa; po zalogowaniu widać jej imię w stopce sidebara.
- [ ] `/katalog` pokazuje produkty, a licznik pozycji zgadza się z tym, co było przed oknem.
- [ ] **Sidebar jest na każdym z 13 ekranów** (od 12e wpina go router; 13. to „Archiwum importów”, PR.1).
- [ ] `/katalog` → kolumna „Konstrukcja opony" pokazuje „Radialna"/„Diagonalna", a nie „—".
      ⚠ To **świadoma różnica wobec starej produkcji** (rozdział 1), nie usterka do zgłoszenia.
- [ ] `/historia` pokazuje wpisy sprzed cutoveru — dowód, że to ta sama baza.
- [ ] `/archiwum` pokazuje pliki importu z ostatnich 7 dni sprzed przełączenia — dowód, że
      `IMPORT_ARCHIVE_DIR` wskazuje katalog starego stosu. Pusta lista = zła ścieżka.
- [ ] `/alerty` → filtr typu: „Błąd pobierania”, „Błąd HTTP”, „Ręczny upload” — bez znaków zapytania (009).
- [ ] `/konfiguracja` → zakładka „Dostawcy": lista i statusy wyglądają jak wcześniej.
- [ ] `waga_gab_przewoznicy` zasiedlona przez 007: `sqlite3 data.db "SELECT count(*) FROM
      waga_gab_przewoznicy;"` → **6**. Lokalne listy z IndexedDB przeglądarki (jeśli ktoś je sobie
      edytował przed cutoverem) **nie są importowane** — po przełączeniu wszyscy widzą wspólny seed
      Ani (76-FEATURE, świadome odstępstwo).
- [ ] `/analityka` rysuje wykresy (ładuje się leniwie — chwilę trwa, to normalne).
- [ ] `/selly` → „Status": pokazuje realny stan, nie „Brak konfiguracji" (jeśli ma być `pelny`).
- [ ] Jeden **odczytowy** eksport CSV — sprawdza, że ścieżki plików są produkcyjne.
- [ ] `pm2 logs bridge-backend` przez kilka minut: brak powtarzających się błędów.
- [ ] Po pierwszym przebiegu schedulera: import **MO9** zakończony sukcesem (`/konfiguracja` →
      „Dostawcy” → MO9: *ostatnia próba* świeża, status aktywny; brak nowego alertu MO9). Błąd
      logowania = brak `AGRORAMI_*` w pliku środowiska (rozdział 4).

**Czego NIE testujemy w oknie:** `POST /api/selly/sync-supplier` z `dry_run=false` (realnie
modyfikuje sklep) ani „Usuń wszystko z katalogu". Import z URL-i zostawiamy schedulerowi.

---

## 7. Rollback

**Decyzję o rollbacku podejmuj wcześnie.** Im dłużej nowy backend pisze do bazy, tym więcej
pracy Ani przepadnie przy powrocie do kopii z kroku 3.

### Wariant A — baza NIE była jeszcze migrowana (przerwanie w kroku 3–4)

Najprostszy. Nic się nie zmieniło:
```bash
pm2 start bridge-backend
```

### Wariant B — migracje przeszły, ale nowy backend nie zapisywał jeszcze nic istotnego

Stary kod **nie zna** tabeli `_migracje` ani kolumny `suppliers.import_wylaczony`. Nie jest to
blokada, ale nie jest też całkiem bez śladu: oryginał czyta tabele przez `SELECT *`, więc nowa
kolumna pojawi się jako dodatkowe pole w odpowiedzi `/api/suppliers`. Stary frontend czyta pola
po nazwach i nadmiarowego po prostu nie użyje. Przywróć stary frontend i proces:
```bash
pm2 stop bridge-backend                 # nowy
# przywróć poprzednią zawartość public_html/panel razem z trzema skryptami injection
pm2 delete bridge-backend && pm2 start <stary ecosystem/wejście> --name bridge-backend
pm2 save
```
⚠ Zweryfikuj `/katalog` w starym panelu **zanim** ogłosisz powrót — po 003 tabela `products`
została przebudowana i to jest miejsce, gdzie ewentualne przestawienie kolumn wyjdzie.

### Wariant C — trzeba cofnąć także dane

```bash
pm2 stop bridge-backend
cd /home/admin/private_apps/bridge
cp data.db.przed-cutover-<znacznik> data.db
rm -f data.db-wal data.db-shm            # resztki WAL po nowej bazie
# dalej jak w wariancie B
```
**Wszystko, co zapisano po przełączeniu, przepada.** Dlatego kopia z kroku 3 i wczesna decyzja.

---

## 8. Po cutoverze

- [ ] Obserwacja przez pierwszy pełny cykl importu — czy scheduler ruszył i czy `/historia`
      notuje przebiegi.
- [ ] Następnego dnia: po 6:00 — czy plik CSV dla Selly powstał (generuje go cron → polecenie z karty I15.3, backlog #102);
      po **12:00** — czy Selly go zaciągnął (Ania, runda 3: Selly pobiera plik o 12:00).
- [ ] Kopia `data.db.przed-cutover-*` zostaje **co najmniej tydzień** — dopiero potem kasujemy.
- [ ] `docs/rebuild-roadmap.md` §6 — odnotować datę cutoveru.
- [ ] Backlog: wpisy odłożone świadomie (**#45** martwy filtr „Źródło", **#48** brak roli
      w `users`, **#50** wspólny pakiet BE/FE) wracają jako osobne tickety, jeśli Ania ich chce.
      **#48 warto ruszyć wcześnie niż później** — do czasu wprowadzenia ról każdy zalogowany
      użytkownik widzi zakładki „Admin" i „Dziennik". Tak samo jest dziś w produkcji, więc
      cutover niczego nie pogarsza, ale też niczego nie naprawia.

---

## 9. Czego ten dokument NIE rozstrzyga

- **Terminu.** Ustala go Ania.
- **Kto wykonuje.** Operacja wymaga dostępu do VPS-a i do sekretów Selly.
- **Wariantu 003 przy rozjeździe schematu.** Jeśli próba z rozdziału 3 padnie na 003, trzeba
  napisać migrację dopasowaną do faktycznego kształtu produkcji — to osobne zadanie, nie
  improwizacja w oknie.
- **Losu starego kodu.** `mirror/` zostaje w repo jako źródło prawdy o zachowaniu produkcji —
  nie kasujemy go po cutoverze.
