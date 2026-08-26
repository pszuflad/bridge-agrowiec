# 5-FEATURE-staging-endpointy-importu — Iteracja 3b: zapis do stagingu + endpointy importu

> Status: Implemented
> Branch: `feature/5-staging-endpointy-importu`
> Worktree: `.worktrees/5-FEATURE-staging-endpointy-importu`

## Opis ticketa

Iteracja 3, sesja 3b (BACKEND) wg `docs/rebuild-roadmap.md` §5. Wyjście parsera (dostarczone
w 3a, PR #6) → tabela `staging_items` przez Drizzle, plus endpointy uruchamiające import.
Bez silnika dopasowania `tk()` (3c), bez zatwierdzania/overrides (3d), bez frontendu (3e).

Zakres z opisu: repozytorium stagingu + `GET /api/staging`, `/paged`, `/{id}`;
`POST /api/import/parse-file` (ścieżka główna — MO6/MO8 to importy ręczne),
`POST /api/import/from-url`, endpoint AI fallback. Plus wejście z 3a: backlog #3, #4, #7, #8
oraz archiwizacja buforów.

## Kontekst

### Sprostowania do opisu ticketa (zweryfikowane w oryginale, zmieniają zakres)

1. **`/api/import/ai-fallback/parse` nie istnieje.** Realna ścieżka to `POST /api/ai-fallback/parse`
   (`contract/openapi.yaml:51`, `backend-index.cjs:48864-48886`). Nie jest to fallback z bloku
   `catch` — to osobny, ręcznie wołany endpoint bramkowany kluczem `ai_fallback.klucz_api`
   w tabeli `config`, który **nigdy nie woła OpenAI**: bez klucza zwraca 5 zmyślonych rekordów
   (`tryb: "symulacja"`), z kluczem — pustą tablicę i komunikat „wymaga połączenia z OpenAI".

2. **Fallback z `catch` to inny mechanizm i inny endpoint.** `backend-index.cjs:48243` to
   `POST /api/dostawcy/:kod/upload` (rdzeń, multer, pole `plik`), a jego fallback w `catch`
   to `Wc()` (`:46910`) — zestaw starych wbudowanych parserów per-dostawca, nie AI.
   Ten endpoint należy do I11 (mutacje dostawcy), nie do 3b.

3. **Nasze endpointy importu żyją w `mirror/backend/extensions.cjs:126-286`, nie w rdzeniu,
   i nie mają ŻADNEGO fallbacku** — na wyjątek parsera zwracają zwykłe `500 {error, dostawcaKod}`.

4. **Ciało odpowiedzi endpointu importu TO JEST wynik `tk()`:**
   ```js
   const tkResult = tk(dostawcaKod, surowe);
   res.json({ ok: true, dostawcaKod, wczytanych, parserErrors, odrzuconePrzezParser, ...tkResult });
   ```
   `tk()` zwraca `{doStagingu, odrzuconeNieOpony, odrzuconeBrakDanych, odrzuconeSmieciMO2, nowe,
   zmienione, wycofane, bezZmian, autoZatwierdzone, szczegolyOdrzuconych}` (`:47586-47597`).

5. **Wariant „pusty katalog" NIE upraszcza tyle, ile zakładał opis ticketa.** Przejście gałęzi
   `nowa` linia po linii (`:47600-47737`): pusty katalog zeruje tylko mapy dopasowania
   (`T` zawsze `null`), diff pól `Vq`/`Xq`, auto-zatwierdzanie i pętlę wycofań. Na **każdym**
   rekordzie nadal wykonują się `Zc()` (klasyfikator „czy opona"), `Hq()` (normalizacja EAN →
   `eanRaw`/`eanIsValid`/`eanSourceStatus`/`eanCandidates` + `rozmiarWykryty`), `Gq()` (overrides),
   `Lq()` (kod zastępczy), `Kq()` (błędny zapis nazwy). Roadmap przypisuje `Zc`/`Lq` do **3c**,
   a `Gq` do **3d** — „wierna ścieżka dla pustego katalogu" wciągnęłaby więc ~60% 3c i kawałek 3d.

6. **Trzy RÓŻNE kształty odpowiedzi** dla trzech GET-ów stagingu — patrz sekcja kontraktu.

7. **`staging_items` nie ma kolumn `szerokosc` ani `uwaga_cena`** — szerokość jedzie w `snapshot_json`
   (TEXT), więc staging zachowuje `szertxt` wiernie bez żadnej migracji. Obie kolumny z backlogu
   #3/#4 żyją w `products`, a do `products` zapisuje wyłącznie `acceptStaging`, czyli 3d.

8. **Błąd w oryginale (`extensions.cjs:189-199`):** w `from-url` zmienna `archOk` jest zadeklarowana
   `let` **wewnątrz** bloku `try`, a używana w `catch`. Wejście w `catch` daje `ReferenceError`
   wewnątrz obsługi błędu — odpowiedź nigdy nie zostaje wysłana, żądanie wisi. Patrz D8.

### Stan `rebuild/` po 3a

`src/import/parsuj.ts` (`parsujPlik`, `parsujBufor`, `listaDostawcow`), `src/import/typy.ts`
(`RekordSurowy` — 50 pól, **bez** pól EAN-owych, bo te powstają w `Hq()`), `src/import/legacy/**`
(port bajt-w-bajt, pilnowany sha256 — NIE RUSZAĆ). Drizzle `stagingItems` już istnieje
(`src/db/schema.ts:106-131`) i pokrywa cały kształt z fixtures. Harness GATE
(`test/gate/{ksztalt,kontrakt,fixtures,asercje,dane,aplikacja,baza,repo}.ts`) jest dojrzały
i przetestowany własnymi testami — wpinamy się w niego, nie budujemy nic nowego.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

### Ścieżki `contract/openapi.yaml`
| Metoda + ścieżka | Linia | Auth w kontrakcie | Nasza decyzja |
|---|---|---|---|
| `GET /api/staging` | 1038 | `security: []` (publiczne) | `requireAuth` — D1 |
| `GET /api/staging/paged` | 1082 | bearer/cookie | `requireAuth` |
| `GET /api/staging/{id}` | 1103 | bearer/cookie | `requireAuth` |
| `POST /api/import/from-url` | 651 | bearer/cookie | `requireAuth` |
| `POST /api/import/parse-file` | 663 | bearer/cookie | `requireAuth` |
| `POST /api/ai-fallback/parse` | 51 | bearer/cookie | `requireAuth` |

Kontrakt **nie zamraża ciał** (`schema: {type: object}`, brak schematów odpowiedzi) — kształt
płynie wyłącznie z fixtures i z oryginału.

### Fixtures — GATE tej sesji
**`contract/fixtures/GET_staging.json`** (`/api/staging?limit=5`) — koperta
`{items, total, limit, offset}`, pozycja ma **24 klucze**:
`id, typZmiany, kod, nazwa, dostawca, magazyn, stanStary, stanNowy, cenaZakupuStara,
cenaZakupuNowa, cenaSprzedazyNowa, zmianaPct, ostrzezenie, powod, snapshotJson, eanRaw,
eanIsValid, eanSourceStatus, eanCandidates, magazynRaw, edytowanePola, utworzono,
zatwierdzilUzytkownikId, zatwierdzonoData`.

**`contract/fixtures/GET_staging_paged.json`** — koperta `{items, total, page, pageSize, pages}`,
pozycja ma **20 kluczy**: bez `snapshotJson`, `eanCandidates`, `magazynRaw`,
`zatwierdzilUzytkownikId`, `zatwierdzonoData`; **za to** `zatwierdzono` (alias
`zatwierdzono_data`).

**`GET /api/staging/{id}`** — brak fixtura; kształt z `pagination_module.cjs:105-124`:
**21 kluczy** = zestaw `paged` **plus** `snapshotJson`. Walidacja przez kontrakt + test kluczy.

### Zachowanie odczytu (oryginał)
- `GET /api/staging` (`backend-index.cjs:48488-48501`): `limit` **nieobecny** → **goła tablica**
  (`U.listStaging()`); obecny → `{items,total,limit,offset}` z `Math.min(parseInt(limit)||200, 2000)`
  i `offset = parseInt(offset ?? "0") || 0`. **Bez `ORDER BY`** — kolejność `rowid`.
- `GET /api/staging/paged` (`pagination_module.cjs:16-88`): `page` (≥1), `pageSize`/`limit`
  (1–200, domyślnie 50), filtry `typZmiany` (pomijany gdy `"all"`), `dostawca`, `search`
  (tokenizacja po spacjach, max 8 tokenów, `LIKE %tok%` na `nazwa|kod|dostawca|ean_raw`,
  AND między tokenami), `ORDER BY id DESC`, `pages = ceil(total/pageSize)`.
- `GET /api/staging/:id` (`pagination_module.cjs:91-127`): 400 gdy `id` nie jest liczbą,
  404 `{error: "Nie znaleziono pozycji stagingu"}` gdy brak wiersza.

### Zachowanie importu (oryginał, `extensions.cjs`)
- **`parse-file`**: `dostawcaKod` z query lub body → 400 gdy brak; `resolveUrl()` (URL z
  `suppliers.url`, fallback `dispatcher.getUrl`) jako test „znany dostawca" → 400 `Nieznany dostawca`;
  czyta **surowy strumień** `req` (mimo komentarza o multipart); 400 gdy pusty; 400 gdy > 25 MB;
  zapis do pliku tymczasowego; **archiwizacja PRZED parsowaniem**; parsowanie
  (`dispatcher.parseByKod` + `adapter.recordsToSurowe`); `updateMeta` z licznikami; `tk()`;
  `updateSupplier({ostatniPlik, liczbaProduktow, status:'aktywny'})`; audit log `import_pliku`;
  odpowiedź `{ok, dostawcaKod, wczytanych, parserErrors, odrzuconePrzezParser, ...tkResult}`;
  sprzątanie pliku tmp. Błąd → `500 {error, dostawcaKod}`.
- **`from-url`**: jw., plus pobranie `http`/`https` (nie `fetch`) z timeoutem 60 s i obsługą 3xx;
  odpowiedź dodatkowo ma `url` i `archiwum: <id|null>`; audit log `import_z_url`;
  błąd → `500 {error, dostawcaKod, url}`.
- **Archiwum** (`archive_module.cjs:50-88`): plik + `.meta.json` w `import_archive/RRRR-MM/`,
  nazwa `{DOSTAWCA}__{RRRRMMDD__GGMMSS}__{safeName(nazwa)}`, meta = 14 pól
  (`id, dostawca, zrodlo, url, uzytkownik, data, oryginalnaNazwa, rozmiar, sha256, status,
  blad, rekordy, parserErrors, odrzucone`), retencja 7 dni / 5 GB, **nigdy nie rzuca**
  (`catch → null`, „archiwum nie może wywrócić importu").

### Rozjazdy i jak je rozstrzygamy
| Rozjazd | Rozstrzygnięcie |
|---|---|
| Opis ticketa: `/api/import/ai-fallback/parse` w bloku `catch` | Kontrakt + oryginał wygrywają: `POST /api/ai-fallback/parse`, stub bramkowany konfiguracją. Patrz D7 |
| `openapi.yaml`: `GET /api/staging` publiczne | Stała decyzja I1 (auth na trasach danych) + precedens I2 dla `/api/products`. D1 |
| Kontrakt nie zamraża ciał POST | Kształt bierzemy z oryginału; testujemy zbiór kluczy odpowiedzi |
| `GET /api/staging/{id}` bez fixtura | Kształt z `pagination_module.cjs`; test kompletnego zbioru 21 kluczy |

## Decisions

**D1 — auth na `GET /api/staging`.** `openapi.yaml:1042` ma `security: []`, ale I1 zaklepała
`requireAuth` na wszystkich trasach danych, a I2 zastosowała to do `/api/products` (też
publicznego w kontrakcie) przy zielonym gate. Kontynuujemy. *Świadome odstępstwo, dziedziczone.*

**D2 — podział 3b/3c: brzegi + jawny szew, placeholder `tk()`.** 3b dowozi wszystko, co nie
wymaga `tk()`: repozytorium Drizzle, trzy kształty odczytu, cały brzeg importu (surowy strumień,
pobranie z URL, plik tymczasowy, limity, archiwum, `suppliers`, audit log, kształt błędów).
`tk()` jest jawnie zdefiniowanym szwem `(kodDostawcy, surowe) => StatystykiImportu`
z implementacją **oznaczoną jako NIEwierna**; 3c wymienia jej ciało na pełny port.
*Odrzucono:* wciągnięcie `Zc`/`Hq`/`Lq`/`Kq`/`Gq` do 3b (przenosi ~60% 3c i kawałek 3d, a 3c
i tak musi wrócić do tego kodu) oraz scalenie 3b+3c (sesja zbyt duża do rzetelnej recenzji).

**D3 — archiwizacja buforów: TAK, teraz, z retencją.** Pole `archiwum: <id>` jest częścią
odpowiedzi `from-url`, więc bez archiwum kształt byłby wierny tylko przypadkiem. Archiwum
jest też jedynym śladem, gdy parser zawiedzie (produkcja archiwizuje też pliki błędne, ze
statusem `blad`). Endpointy `/api/import-archive/*` zostają poza zakresem — roadmap ich w 3b
nie wymienia.

**D4 — bezpiecznik na pusty wynik parsowania (backlog #8): TAK.** Gdy parser zwróci 0 rekordów,
endpoint kończy się `400` i **nie woła silnika stagingu** ani nie dotyka liczników nieobecności.
*Świadome odstępstwo od produkcji.* Uzasadnienie: backlog #8 opisuje scenariusz, w którym trzy
takie importy wycofują cały katalog dostawcy, a MO8 to import ręczny (Trelleborg mailem, Marta
wgrywa), więc nie ma cyklicznego przebiegu, który by to nadrobił. Bezpiecznik działa dla
wszystkich dostawców i nie koliduje z poprawką Ani w parserze — ta przyjdzie portem (backlog #6).

**D5 — wyłączenie MO6 (backlog #7 ✅ TAK): nowa kolumna `suppliers.import_wylaczony`.**
`INTEGER NOT NULL DEFAULT 0`, ustawiona na `1` dla MO6; endpointy importu odrzucają wywołanie
dla wyłączonego dostawcy (`400`). *Świadome odstępstwo (nowa kolumna poza kanonem).* Powód
odrzucenia `suppliers.status`: produkcyjne endpointy importu po każdym udanym imporcie robią
`updateSupplier({status: 'aktywny'})`, więc ta kolumna sama kasowałaby się jako flaga i mieszała
dwa znaczenia (stan zdrowia vs włączenie).

**D6 — jawna projekcja na granicy API.** Dodanie kolumn z D5 i D9 do schematu Drizzle złamałoby
**zielony GATE Iteracji 2**: `repos/suppliers.ts:104` robi `{...dostawca}`, a `repos/products.ts:15`
`db.select().from(products)` — obie rozlewają całą tabelę do odpowiedzi, a `katalog.gate.test.ts`
sprawdza kompletny zbiór kluczy (72 dla produktu). Dlatego repozytoria dostają **jawną projekcję
kontraktową**: helper wyliczający kolumny tabeli minus jawnie wymienione kolumny wewnętrzne.
Granicą zamrożoną kontraktem jest ODPOWIEDŹ, nie układ tabeli. Test-strażnik pilnuje, że zbiór
kluczy projekcji zgadza się z fixture'em, więc gate nie słabnie — zmienia się tylko to, co
udowadnia (z „tabela == kontrakt" na „tabela minus zadeklarowane kolumny wewnętrzne == kontrakt").

**D7 — `POST /api/ai-fallback/parse` odtworzony 1:1 jako stub.** Ścieżka wg kontraktu (nie
`/api/import/ai-fallback/parse`), zachowanie wg `backend-index.cjs:48864-48886`: brak
`ai_fallback.klucz_api` w tabeli `config` → `{tryb:"symulacja", komunikat, produkty:[5 zmyślonych]}`;
klucz obecny → `{tryb:"aktywny", komunikat:"Tryb aktywny — wymaga połączenia z OpenAI", produkty:[]}`.
**Nie wpinamy go w żadną ścieżkę parsowania** — w oryginale też nie jest.

**D8 — naprawa błędu `archOk` w `from-url`.** *Świadome odstępstwo.* W oryginale
(`extensions.cjs:189-199`) `let archOk` jest w bloku `try`, a `catch` go używa → `ReferenceError`
wewnątrz obsługi błędu, odpowiedź nigdy nie wychodzi, żądanie wisi. Deklarujemy `archOk` obok
`buf`, przed `try`. Odtwarzamy **zamierzone** zachowanie (archiwizacja błędnego pliku / oznaczenie
meta statusem `blad` + `500`), a nie zawieszenie żądania.

**D9 — backlog #4 `uwaga_cena`: kolumna w 3b, endpoint i propagacja w 3d.** Migracja dokłada
`products.uwaga_cena TEXT` (ta sama migracja co D5). Propagacja (`acceptStaging` czyta `uwagaCena`
ze `snapshotJson`) i `GET /api/products/uwagi-cena` lądują w 3d, u swojego pisarza — endpoint bez
pisarza zwracałby zawsze pustą listę i nie dałoby się go sensownie przetestować. Wartość już dziś
dociera do stagingu w `snapshot_json` (parsery 3a propagują `uwagaCena`), więc nic nie ginie.

**D10 — backlog #3 `szerokosc` REAL→TEXT: NIE w tej sesji.** Powody: (a) `staging_items` nie ma
tej kolumny — wartość jedzie w `snapshot_json` jako TEXT, więc 3b zachowuje `szertxt` wiernie bez
migracji; (b) `products.szerokosc` zapisuje wyłącznie `acceptStaging`, czyli 3d; (c) zmiana na TEXT
natychmiast łamie zielony gate I2 (`GET_products.json` ma `"szerokosc": 620` jako liczbę, a
przenagranie fixtures roadmap przypisuje do I12); (d) `szertxt` jest niekompletny —
`parseWidthFallbackMm()` w `normalizeJmk`/`normalizeHandlopex` nadal zwraca float, Ania to poprawia.
Decyzję przekazujemy do 3d/I12.

**D11 — ścieżka archiwum konfigurowalna.** *Drobne świadome odstępstwo.* Oryginał trzyma
`import_archive/` obok `__dirname`. My bierzemy katalog z env (`IMPORT_ARCHIVE_DIR`), domyślnie
`<cwd>/import_archive` — inaczej archiwum lądowałoby w `dist/` po buildzie, a testy pisałyby
po repo.

### Świadome odstępstwa od oryginału — zbiorczo
| # | Odstępstwo | Podstawa |
|---|---|---|
| D1 | auth na `GET /api/staging` (kontrakt: publiczne) | stała decyzja I1, precedens I2 |
| D2 | placeholder `tk()` zamiast pełnego silnika | podział sesji, zatwierdzone |
| D4 | bezpiecznik na 0 rekordów z parsera | backlog #8, zatwierdzone |
| D5 | nowa kolumna `suppliers.import_wylaczony` | backlog #7 ✅ TAK, zatwierdzone |
| D6 | jawna projekcja kolumn w repozytoriach I2 | konieczne, by D5/D9 nie złamały gate I2 |
| D8 | naprawa `ReferenceError` w `catch` `from-url` | oczywisty błąd blokujący obsługę błędu |
| D9 | nowa kolumna `products.uwaga_cena` | backlog #4 ✅ TAK, zatwierdzone |
| D11 | konfigurowalna ścieżka archiwum | wymóg techniczny (build do `dist/`) |
| D12 | limit 10 przekierowań w `pobierzZUrl` | dodane w trakcie implementacji — oryginał nie ma licznika, pętla przekierowań wiesza żądanie |
| D13 | limit 25 MB egzekwowany w trakcie strumieniowania | dodane po recenzji — odpowiedź identyczna, znika ryzyko wyczerpania pamięci |

## Implementation plan

### Krok 1 — migracja schematu + jawna projekcja (commit 1)
- **Nowy** `rebuild/schema/002_import.sql`:
  `ALTER TABLE suppliers ADD COLUMN import_wylaczony INTEGER NOT NULL DEFAULT 0;`
  `ALTER TABLE products ADD COLUMN uwaga_cena TEXT;`
  `UPDATE suppliers SET import_wylaczony = 1 WHERE kod = 'MO6';`
- `src/db/schema.ts` — `importWylaczony` w `suppliers`, `uwagaCena` w `products`.
- **Nowy** `src/repos/kolumny.ts` — `projekcjaKontraktowa(tabela, wykluczone[])` na
  `getTableColumns()` z drizzle; stała `KOLUMNY_POZA_KONTRAKTEM` z uzasadnieniem per kolumna.
- `src/repos/suppliers.ts`, `src/repos/products.ts` — użycie projekcji zamiast `select()`/spreadu.
- Test-strażnik: zbiór kluczy projekcji == zbiór kluczy z fixture'a (18 dostawca, 72 produkt).
- **Sprawdzenie:** `katalog.gate.test.ts` musi zostać zielony bez żadnej zmiany w nim.

### Krok 2 — repozytorium stagingu (commit 2)
**Nowy** `src/repos/staging.ts`, trzy jawne projekcje odpowiadające trzem kształtom:
- `KOLUMNY_PELNE` (24) → `listaStagingu(db)` (goła tablica, bez `ORDER BY`) i
  `listaStaginguStronicowana(db, limit, offset)` → `{items, total}` — odpowiedniki
  `U.listStaging` / `U.listStagingPaged` (`backend-index.cjs:44808-44820`).
- `KOLUMNY_STRONICOWANE` (20, z `zatwierdzono`) → `stronaStaginguZFiltrami(db, filtry)`
  z `typZmiany`/`dostawca`/`search`, `ORDER BY id DESC`, `{items, total, page, pageSize, pages}`.
- `KOLUMNY_SZCZEGOLU` (21) → `pozycjaStaginguPoId(db, id)`.
- `zapiszPozycjeStagingu(db, pozycje)` — insert wsadowy **w transakcji**
  (1:1 z `ww.transaction(() => { for (u of c) U.addStaging(u) })`, `:47848-47850`).

### Krok 3 — trasy odczytu stagingu (commit 3)
**Nowy** `src/routes/staging.ts`, rejestracja `/paged` **przed** `/:id` (inaczej `"paged"`
wpadnie w parametr). `GET /api/staging` z dwoma kształtami (jak `routes/products.ts`),
`GET /api/staging/paged`, `GET /api/staging/:id` (400 dla nie-liczby, 404 dla braku).
Wpięcie w `src/app.ts`.

### Krok 4 — szew silnika stagingu (commit 4)
**Nowy** `src/import/tk.ts`:
- `StatystykiImportu` — dokładnie 10 kluczy z `:47586-47597`.
- `SilnikStagingu = (kodDostawcy, surowe) => StatystykiImportu`.
- `silnikTymczasowy3b(db)` — **jawnie oznaczony jako NIEwierny**, z listą tego, czego nie robi.
  Zachowuje: filtr śmieci MO2 (port 1:1 z `:47619-47634`, czysty, bez zależności) i odrzucenie
  rekordów bez `kod` → `odrzuconeBrakDanych` (bez `Lq()` nie ma zastępczego identyfikatora).
  Pozostałe → `typZmiany: "nowa"`, `powod: "Nowa pozycja w cenniku"`,
  `snapshotJson: JSON.stringify(rekord)`, `magazyn: "—"`, `stanNowy: stan ?? 0`,
  `cenaZakupuNowa: cenaZakupu ?? 0`, pola EAN `null` (brak `Hq()`), jeden `utworzono` na przebieg.
  `odrzuconeNieOpony`/`zmienione`/`wycofane`/`bezZmian`/`autoZatwierdzone` zawsze `0`.

### Krok 5 — archiwum importu (commit 5)
**Nowy** `src/import/archiwum.ts` — port zachowania `archive_module.cjs:26-130`:
`archiwizujBufor(bufor, opts)` → `{id, sciezka, rozmiar, sha}` albo `null` (**nigdy nie rzuca**),
`aktualizujMeta(id, patch)`, retencja 7 dni / 5 GB, katalog z env (D11).

### Krok 6 — trasy importu (commit 6)
**Nowy** `src/routes/import.ts`:
- `POST /api/import/parse-file` — kolejność 1:1 z oryginałem: `dostawcaKod` (query|body) → 400;
  znany dostawca → 400; **strażnik D5** (`import_wylaczony`) → 400; surowy strumień → 400 gdy
  pusty / > 25 MB; **archiwizacja przed parsowaniem**; `parsujBufor`; `aktualizujMeta`;
  **bezpiecznik D4** (0 rekordów → 400, bez zapisu); silnik stagingu; `updateSupplier`;
  audit log `import_pliku`; odpowiedź `{ok, dostawcaKod, wczytanych, parserErrors,
  odrzuconePrzezParser, ...statystyki}`; błąd → `500 {error, dostawcaKod}`.
- `POST /api/import/from-url` — jw., plus rozwiązanie URL (`suppliers.url` → `dispatcher.getUrl`),
  pobranie `http`/`https` z timeoutem 60 s i obsługą 3xx, `url` i `archiwum` w odpowiedzi,
  audit log `import_z_url`, błąd → `500 {error, dostawcaKod, url}`, poprawka D8.
- `POST /api/ai-fallback/parse` — stub 1:1 (D7).
- **Nowy** `src/import/pobierz.ts` — `pobierzZUrl(url)` (http/https, 60 s, 3xx).
- Rozszerzenie `repos/suppliers.ts` o `dostawcaPoKodzie` i `zapiszWynikImportu`.
- Audit log: sprawdzić, czy istnieje repozytorium `audit_log`; jeśli nie — minimalny zapis
  odpowiadający `be()` z oryginału.

### Krok 7 — testy i GATE (commit 7)
- **Nowy** `test/staging.gate.test.ts` — seed `staging_items` danymi 1:1 z obu fixtures;
  `sprawdzZgodnoscZKontraktem` + `sprawdzZgodnoscZFixture` dla `/api/staging?limit=5`
  i `/api/staging/paged`; testy **kompletnego zbioru kluczy** (24 / 20 / 21).
- **Nowy** `test/staging.odczyt.test.ts` — goła tablica bez `limit`, `Math.min(…, 2000)`,
  filtry `typZmiany`/`dostawca`/`search` (w tym wielotokenowy AND i limit 8 tokenów),
  `ORDER BY id DESC`, `pages`, 400/404 dla `/{id}`.
- **Nowy** `test/import.test.ts` — **bez mocków**, na realnych cennikach z
  `test/charakteryzacja/probki/` (MO1.csv itd.): upload → rekordy realnie w `staging_items`;
  strażnik MO6; bezpiecznik pustego wyniku; pusty plik; przekroczenie 25 MB; nieznany dostawca;
  brak `dostawcaKod`; archiwum powstało wraz z `.meta.json` o poprawnych polach; stub AI fallback
  w obu trybach.
- **Nowy** `test/projekcja.test.ts` — strażnik D6.
- **Musi zostać zielone:** `charakteryzacja.test.ts` (1838 rekordów, sha256 portu) — nie dotykamy
  `src/import/legacy/**`; `katalog.gate.test.ts` — bez zmian w samym teście.
- `npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/backend/`.

## Testing strategy

**GATE odbudowy.** `GET_staging.json` i `GET_staging_paged.json` porównywane przez
`sprawdzZgodnoscZFixture` (kształt: klucze, typy, zagnieżdżenie) po zasianiu `staging_items`
danymi wprost z fixtures — bo pola `typZmiany`/`snapshotJson`/`eanCandidates` powstają w `tk()`,
którego w 3b nie ma (D2). To testuje **całą warstwę odczytu** (projekcje, mapowanie
snake_case→camelCase, koperty, sortowanie, filtry) niezależnie od silnika. Dodatkowo
`sprawdzZgodnoscZKontraktem` dla wszystkich sześciu ścieżek.

**Czego GATE 3b świadomie NIE sprawdza:** treści pozycji wyprodukowanych przez realny import
(`typZmiany`, `powod`, pola EAN, `snapshotJson`) — to gate 3c, po porcie `tk()`. Odnotowane
w raporcie jako jawna luka w pokryciu.

**Testy importu bez mocków.** Mamy realne cenniki MO1–MO10 w `test/charakteryzacja/probki/`,
więc `POST /api/import/parse-file` testujemy end-to-end na prawdziwym pliku, przeciw prawdziwej
bazie SQLite w pamięci — sprawdzamy, że rekordy fizycznie lądują w `staging_items` w liczbie
zgodnej z parserem. Mockujemy **wyłącznie** transport HTTP w `from-url` (jedyna zewnętrzna
zależność; sam parser i zapis są realne).

**Pomijamy:** testy AI (endpoint jest stubem, nie ma czego integrować), testy retencji archiwum
na 5 GB (sprawdzamy tylko ścieżkę wiekową na sztucznych `mtime`), E2E (brak frontendu — 3e).

## Out of scope
- Silnik `tk()`: dopasowanie kod→EAN→`Lq()`, klasyfikator `Zc()`, `Hq()`, `Kq()`, `Vq`/`Xq`,
  `assignKodImportu`, port `bridge_ext.cjs`/`tire_dims.js` — **3c**.
- Zatwierdzanie (`POST /api/staging/accept|reject|import|clear`), historia cen, wycofanie po
  3 nieobecnościach, overrides `Gq()`, propagacja `uwaga_cena` w `acceptStaging`,
  `GET /api/products/uwagi-cena` — **3d**.
- Widok `/staging` — **3e**.
- `PUT`/`DELETE /api/staging/{id}` — mutacje, nie ma ich w zakresie 3b wg roadmapy.
- `POST /api/dostawcy/:kod/upload` (rdzeń, multer, fallback `Wc()`) — **I11**.
- Endpointy `/api/import-archive/*` (lista, stats, pobranie pliku) — poza roadmapą 3b.
- Scheduler auto-pull (`runAutoPull`, codziennie 06:00) — poza roadmapą 3b.
- `products.szerokosc` REAL→TEXT — **3d/I12** (D10).

## Definition of done
- [ ] Rekordy z parsera trafiają do `staging_items` przez Drizzle, w transakcji
- [ ] `GET /api/staging` — oba kształty (goła tablica / koperta), `GET /api/staging/paged`
      z pełnym zestawem filtrów, `GET /api/staging/{id}` z 400/404
- [ ] `POST /api/import/parse-file` działa na realnym cenniku z próbek 3a
- [ ] `POST /api/import/from-url` pobiera, archiwizuje, parsuje i zapisuje
- [ ] `POST /api/ai-fallback/parse` odtworzony 1:1 w obu trybach
- [ ] Strażnik MO6 (D5) i bezpiecznik pustego wyniku (D4) pokryte testami
- [ ] Archiwum tworzy plik + `.meta.json` o poprawnych 14 polach
- [ ] `GET_staging.json` i `GET_staging_paged.json` przez GATE (kształt 1:1)
- [ ] Zbiory kluczy 24 / 20 / 21 pokryte testami
- [ ] `katalog.gate.test.ts` nadal zielony (bez zmian w samym teście) — D6 zadziałało
- [ ] `charakteryzacja.test.ts` nadal zielony (1838 rekordów, sha256)
- [ ] `lint` / `typecheck` / `build` / `test` czyste
- [ ] `raport.md` opisuje podział 3b/3c i wszystkie 8 świadomych odstępstw
