# 36-FEATURE-konto-admin-maintenance — Iteracja 12, sesja 12b (Konto + admin + maintenance)

> Status: Draft
> Branch: `feature/36-konto-admin-maintenance`
> Worktree: `.worktrees/36-FEATURE-konto-admin-maintenance`

## Opis ticketa

> Iteracja 12b — Konto + admin + maintenance (wierna odbudowa Bridge)
>
> Realizuj Iterację 12, sesję 12b (BE+FE) wg `docs/rebuild-roadmap.md` (§5 „Iteracja 12" — obszar A
> + noty z I5/I11; §3). Zależy od I11 (gotowe). Niezależny od 12a → równolegle (inne pliki/domena).
>
> CEL (Ania klika): zmienia hasło w `/moje-konto`; admin zarządza użytkownikami, konfiguracją
> dostawców i utrzymaniem.
>
> ZAKRES — Backend (za `requireAuth`): `POST /api/password/change`; `GET /api/users`;
> `GET/PUT /api/admin/supplier-config(+{kod})`; `GET /api/admin/suppliers-list`;
> `POST /api/maintenance/usun-nieopony`; `POST /api/products/clear` (ciało `{potwierdzenie:"WYCZYSC"}`);
> `GET /api/audit-log`.
> ⚠ `/api/audit-log` to SUROWY audyt (bez filtra typu jak `/historia`). Musi znieść:
> `szczegoly_json = NULL` (np. `synchronizacja_reczna`, I5) i `encja_id` niezłączalny z `suppliers`.
> REUŻYJ `parsujSzczegoly` z `src/historia/mapowanie.ts` (try/catch → `{}`), nie pisz drugiej wersji.
> Zobaczy nowe akcje z I11: `edycja_konfiguracji` i `edycja_spedycji`.
>
> ZAKRES — Frontend: `/moje-konto` (pełne — zmiana hasła) + ekrany admin (users, supplier-config,
> suppliers-list, maintenance). Przycisk „Usuń wszystko z katalogu" → zakładka „Katalog"
> w `/konfiguracja` (`Katalog.tsx`, miejsce oznaczone adnotacją): `window.confirm`, po sukcesie
> unieważnij `["/api/products"]`, `["/api/alerts"]`, `["/api/analytics"]`.
>
> POZA ZAKRESEM: mutacje produktów (12a); dialog edycji + menu Akcje (12c); przenagranie
> fixtures/openapi (12d); finalny audyt (12e).
>
> GATE: 4 fixtures (users, admin×2, audit-log) zgodne kształtem 1:1 + openapi; audit-log odporny
> na NULL `szczegoly` i niezłączalny `encja_id` (test na danych); `products/clear` chroniony
> potwierdzeniem; lint/typecheck/build czyste.

## Kontekst

Ustalenia researchera potwierdzone przeze mnie wprost w oryginale — trzy z nich **korygują treść
ticketa i roadmapy**:

**1. `supplier-config/{kod}` to `PATCH`, nie `PUT`.** Potwierdzone dwoma niezależnymi źródłami:
`contract/openapi.yaml:28-41` (`patch:`) oraz kod oryginału `mirror/backend/extensions.cjs:344`
(`app.patch('/api/admin/supplier-config/:kod', we, …)`). Metody `PUT` na tej ścieżce nie ma nigdzie.
To dokładnie ten typ błędu roadmapy, przed którym ostrzega `CLAUDE.md` (§3 „w I11 roadmapa
dwukrotnie opisała endpoint niezgodnie ze stanem faktycznym"). Roadmapę prostujemy w Kroku 13.

**2. `GET /api/audit-log` w oryginale NIE parsuje `szczegoly_json`.** Cała trasa to jedna linia:
`e.get("/api/audit-log", (c, u) => u.json(U.listAudit(500)))` (`deminified/backend-index.cjs:48735`)
— bez `we`, bez JOIN-a, bez mapowania. `contract/fixtures/GET_audit-log.json` to potwierdza:
`szczegolyJson` jest **stringiem** (`"{\"source\":\"scheduler\",…}"`), nie obiektem.
Gdyby backend użył `parsujSzczegoly`, GATE by padł (klucz `szczegoly` zamiast `szczegolyJson`,
obiekt zamiast stringa). **Miejsce `parsujSzczegoly` jest więc we FRONCIE**, przy renderowaniu
kolumny „Szczegóły" — i tam go reużywamy, zgodnie z intencją ticketa („nie pisz drugiej wersji").
Komentarz w `src/historia/mapowanie.ts:87-91` („Ten sam parser obsłuży `/api/audit-log` w I12")
jest w tej formie mylący i zostanie doprecyzowany.

**3. Ekrany admin NIE ISTNIEJĄ w oryginalnym React SPA.** Grep po `deminified/frontend-index.js`
i po wszystkich `mirror/frontend/assets/*.js` daje ZERO trafień dla `admin/supplier-config`,
`admin/suppliers-list`, `/api/users`, `usun-nieopony`, `audit-log`. Oryginał obsługuje je
osobnymi serwerowymi stronami HTML poza SPA (`GET /admin/import-now`, `GET /admin/supplier-config`,
`extensions.cjs:290-295,410-415`). Budowa tych ekranów w Reakcie jest więc **świadomym
odstępstwem** (D1 niżej), a nie odtworzeniem — zatwierdzonym przez użytkownika.

Gotowe do reużycia w `rebuild/` (nie piszemy od nowa):
- `repos/audit.ts::listaAudytu(db, 500)` — port `listAudit()`, projekcja Drizzle daje camelCase
  zgodny 1:1 z fixture. Handler `/api/audit-log` to dosłownie `res.json(listaAudytu(db, 500))`.
- `repos/audit.ts::zapiszAudyt` — pisarz audytu dla pięciu mutacji tego ticketa.
- `auth/password.ts::zahashujHaslo` / `porownajHaslo` (bcrypt, koszt 10 — ten sam co `P4`).
- `import/silnik/klasyfikator.ts::czyOpona()` — port `Zc()` 1:1, detektor dla `usun-nieopony`.
- `import/parsuj.ts::listaDostawcow()` (10 kodów dispatchera) + `urlDostawcy(kod)` (fallback URL).
- `repos/suppliers.ts::dostawcaPoKodzie` (⚠ w tym pliku jest DRUGA funkcja o nazwie
  `listaDostawcow(db, teraz)` o innym kształcie — przy imporcie obu w jednym pliku konieczny alias).
- `middleware/auth.ts::requireAuth`, `routes/config.ts` jako wzorzec routera.
- FE: `AuthGate.tsx::useUzytkownik()` (to samo źródło co oryginalny `tk()`), `AppShell.tsx:124-125`
  (link `/moje-konto` w sidebarze JUŻ jest), `pages/konfiguracja/Katalog.tsx:140-141` (adnotacja
  wskazująca miejsce przycisku), `historia/mapowanie.ts::parsujSzczegoly`.

Tabela `users` (`db/schema.ts:224-233`) ma `id, email, haslo_hash, imie_nazwisko, utworzono,
ostatnie_logowanie` — **nie ma kolumny roli**. „Admin" nie jest technicznie odróżnialny od
zwykłego użytkownika; zakładki admin zobaczy każdy zalogowany. To stan zastany, nie do naprawy
w tym tickecie (patrz Follow-up).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ścieżki `contract/openapi.yaml`, które ten ticket MUSI spełnić (8 operacji):

| Metoda | Ścieżka | openapi | Fixture |
|---|---|---|---|
| POST | `/api/password/change` | `:790-801` (auth) | brak (mutacja) |
| GET | `/api/users` | `:1146-1154` (auth) | `GET_users.json` ✅ |
| GET | `/api/admin/supplier-config` | `:19-27` (auth) | `GET_admin_supplier-config.json` ✅ |
| PATCH | `/api/admin/supplier-config/{kod}` | `:28-41` (auth) | brak (mutacja) |
| GET | `/api/admin/suppliers-list` | `:42-50` (auth) | `GET_admin_suppliers-list.json` ✅ |
| POST | `/api/maintenance/usun-nieopony` | `:697-708` (auth) | brak (mutacja) |
| POST | `/api/products/clear` | `:822-833` (auth) | brak (mutacja) |
| GET | `/api/audit-log` | `:533-539` (**`security: []`**) | `GET_audit-log.json` ✅ |

Cztery fixtures GET porównujemy kształtem 1:1 (klucze, typy, zagnieżdżenie) plus asercja
**kompletu kluczy** (wzorzec z `test/historia.gate.test.ts`) — przy `audit-log` to krytyczne,
bo `szczegolyJson`-string łatwo pomylić z obiektem.

**Znane rozjazdy i rozstrzygnięcia:**
- `GET /api/audit-log` — openapi mówi `security: []`, my nakładamy `requireAuth` (D2).
  Kontrakt sprawdzamy kształtem odpowiedzi 200; brak auth daje 401, co jest zadeklarowanym
  odstępstwem, nie niezgodnością kształtu.
- `_przyciete: {dostawcy: 10}` w `GET_admin_supplier-config.json` i `_body_przyciete_z: 500`
  w `GET_audit-log.json` to **markery sanityzacji nagrywarki** (`contract/README.md`), nie pola
  odpowiedzi — harness fixtures już je odsiewa, nie odtwarzamy ich w kodzie.
- Roadmapa mówi `PUT` dla `supplier-config/{kod}` — błędna, prostujemy (patrz Kontekst §1).

## Decyzje

**D1 — Ekrany admin jako DWIE nowe zakładki w `/konfiguracja` (odstępstwo świadome).**
Oryginał nie ma ich w SPA (patrz Kontekst §3). Dokładamy: **„Admin"** (tabela dostawców
z `suppliers-list` + edycja przez `PATCH supplier-config/{kod}`, karta „Użytkownicy" read-only
z `/api/users`, karta „Utrzymanie" z `usun-nieopony`) i **„Dziennik"** (surowy `audit-log`).
Za: endpointy przestają być martwe w UI, wszystko w istniejącym wzorcu zakładek, pasek nie puchnie
(8 zamiast 10 zakładek). Przeciw: `zakladki.ts` przestaje być listą 1:1 z oryginałem
(`frontend-index.js:26299-26338`) — komentarz nagłówka tego pliku wymaga aktualizacji, żeby nie
kłamał. Odrzucone: cztery osobne zakładki (10 pozycji łamie pasek, „Dostawcy (admin)" myli się
z istniejącą „Dostawcy") i jedna zbiorcza (dziennik z filtrami doklejony pod tabelą czyta się źle).

**D2 — `requireAuth` na wszystkich ośmiu trasach, w tym na `/api/audit-log` (odstępstwo świadome).**
Kontynuacja zasady §3 i wzorca D1 z I1, powtórzonego w I2, 3b, 4a, I5, I6, I9. Dziennik audytu
ujawnia e-maile użytkowników, nazwy plików i URL-e dostawców — publiczny jest realnym wyciekiem.
Pozostałe siedem tras ma `we` już w oryginale, więc dla nich to odtworzenie 1:1, nie odstępstwo.

**D3 — Widok dziennika audytu we froncie, mimo że oryginał go nie ma (odstępstwo świadome).**
Tabela Data / Użytkownik / Akcja / Encja / Szczegóły + filtry po akcji i typie encji.
To jedyne miejsce, gdzie Ania zobaczy akcje spoza pięciu typów rozpoznawanych przez `/historia`
(`synchronizacja_reczna`, `edycja_konfiguracji`, `edycja_spedycji`, `czyszczenie_katalogu`,
`maintenance_usun_nieopony`, `zmiana_hasla`) — a to był wprost powód przeniesienia `audit-log`
do I12. Kolumna „Szczegóły" renderowana przez **`parsujSzczegoly`** z `historia/mapowanie.ts`.

**D4 — backend oddaje surowy string; front dostaje własny `parsujSzczegoly` z kotwicą
(świadome odstępstwo od zdania w tickecie).** Wymuszone przez fixture (Kontekst §2): skoro
backend NIE parsuje, jedynym konsumentem parsera jest widok dziennika we froncie. `rebuild/`
nie ma wspólnego pakietu, a BE i FE są dziś rozłączne — **nie ma ani jednego importu kodu
z backendu do frontu**; wszystkie wzmianki to komentarze-kotwice. Idziemy ustalonym wzorcem
projektu (`waga-gabarytowa/obliczenia.ts` vs `backend/waga-gabarytowa/formula.ts`,
`alerty/api.ts:29` vs `repos/alerts.ts`): `pages/konfiguracja/dziennik.ts` dostaje własne
`parsujSzczegoly` (12 linii) z komentarzem wskazującym `backend/src/historia/mapowanie.ts:87`
jako źródło oraz test pilnujący tych samych trzech wejść (NULL, zepsuty JSON, wartość
nie-obiektowa). Odrzucone: `rebuild/shared/` (zmiana struktury całej odbudowy — buildy,
tsconfigi, lint, deploy obu stron i kolizja z równoległą 12a, za 12 linii kodu) oraz alias
Vite/tsconfig do pliku backendu (wciąga drizzle-orm i schemat bazy do grafu typów frontu,
wiąże build FE ze strukturą BE).

**D5 — `products/clear` kopiuje plik bazy z `env.DB_PATH`, z checkpointem WAL (drobne wzmocnienie
portu).** Oryginał robi `copyFileSync(path.join(__dirname,"data.db"), … + ".bak_before_clear_" + ts)`
w best-effort `try/catch` (`:48320-48331`). Portujemy 1:1 co do wzorca nazwy, best-effort i braku
wpływu na odpowiedź — z jedną różnicą: ścieżka pochodzi z `env.DB_PATH` (w odbudowie baza nie leży
obok pliku wejściowego), a przed kopiowaniem wykonujemy `wal_checkpoint(TRUNCATE)` w tym samym
`try/catch`. Powód: baza chodzi w trybie WAL (`db/index.ts:18`), więc goła kopia `.db` bez
checkpointu gubi wszystko, co siedzi jeszcze w `-wal` — bezpiecznik, dla którego ta opcja została
wybrana, byłby pozorny. Zero zmian w kształcie i kodzie odpowiedzi.

**D6 — walidacja zmiany hasła: port 1:1 `P4()` (`:47905-47931`), bez własnych reguł.**
Kolejność i kody: `USER_NOT_FOUND` → 400; złe stare hasło → `WRONG_OLD_PASSWORD` **401**;
`typeof nowe != "string" || nowe.length < 8` → `WEAK_PASSWORD` → 400; `bcrypt.compare(nowe, hash)`
→ `SAME_PASSWORD` → 400. Ciało `{oldPassword, newPassword}`; brak stringa w którymkolwiek →
400 `{error:"Wymagane: oldPassword i newPassword"}` (to sprawdza sama trasa, przed `P4`).
Komunikaty dosłownie po polsku, jak w oryginale. Sukces: audyt `zmiana_hasla`/`user`/`{email}`
+ `{ok:true}`.

**D7 — teksty FE dosłownie z oryginału.** `/moje-konto` (`lM()`, `frontend-index.js:27624-27780`):
karty „Dane konta" (Imię i nazwisko, Email (login) — z kontekstu, BEZ fetcha do `/api/me`)
i formularz „Aktualne hasło" / „Nowe hasło" / „Powtórz nowe hasło", komunikaty inline
„Za krótkie.", „Musi być inne niż aktualne.", „Hasła nie są identyczne.", toasty
„Hasło zmienione" / „Twoje hasło zostało zaktualizowane." i „Nie udało się zmienić hasła".
`data-testid`: `account-name`, `account-email`, `input-old-password`, `input-new-password`,
`input-confirm-password`, `button-submit-change-password`. Przycisk czyszczenia
(`:26101-26134`): `data-testid="button-clear-products-work"`, `window.confirm("Usunąć wszystko
z katalogu? Ta operacja usuwa wszystkie produkty i służy tylko do testów parsera.")`, toasty
„Katalog wyczyszczony" / „Usunięto wszystkie pozycje z katalogu" i „Błąd czyszczenia",
etykieta „Usuń wszystko z katalogu" / „Czyszczenie..." w trakcie.

**D8 — edycja konfiguracji dostawcy w dialogu na wierszu**, nie inline. Trzy pola (`url`,
`czestotliwoscMinuty`, `status`), walidacja klienta odtwarzająca walidację backendu
(`^https?://`, 5..10080, `aktywny|wstrzymany|blad`), jeden `PATCH` na zapis. Spójne z wzorcem
dialogów z `/narzuty` i `/atrybuty`; inline-edit nie ma precedensu w odbudowie i łatwo o
przypadkowy zapis.

## Plan implementacji

Kolejność: backend (trasy + testy + GATE) → frontend. Jeden krok = jeden commit.

### Krok 1 — `repos/users.ts`: lista i zapis hasła
`rebuild/backend/src/repos/users.ts` (+):
- `listaUzytkownikow(db)` — port `U.listUsers()`; **projekcja jawna** `{id, email, imieNazwisko}`
  (fixture ma dokładnie te trzy klucze; `haslo_hash` nie może wyciec).
- `zapiszHasloUzytkownika(db, id, hash)` — port `updateUserPassword`.

### Krok 2 — `POST /api/password/change` + `GET /api/users`
Nowy `rebuild/backend/src/routes/konto.ts` (wzorzec `routes/config.ts`):
- `zmienHaslo(db, userId, stare, nowe)` w `src/auth/zmiana-hasla.ts` — port `P4()` 1:1 (D6),
  zwraca `{ok:true}` albo `{ok:false, code, message}`; reużywa `porownajHaslo`/`zahashujHaslo`.
- trasa `POST /api/password/change` (`requireAuth`): walidacja typów → `zmienHaslo` → mapowanie
  `code` na status (401 tylko dla `WRONG_OLD_PASSWORD`) → audyt → `{ok:true}`.
- trasa `GET /api/users` (`requireAuth`) → `res.json(listaUzytkownikow(db))`.
- Rejestracja w `app.ts`.
Testy: `test/konto.haslo.test.ts` — cztery ścieżki błędu + sukces + realne przelogowanie
(zmiana hasła → `POST /api/login` starym daje 401, nowym 200) + wpis w `audit_log`.

### Krok 3 — trasy admin (`supplier-config` ×2, `suppliers-list`)
Nowy `rebuild/backend/src/routes/admin.ts`, port `extensions.cjs:296-405`:
- `GET /api/admin/supplier-config` — pętla po `listaDostawcow()` (10 kodów dispatchera, NIE po
  `suppliers`!): `nazwa: s.nazwa || kod`, `url: (s.url niepuste) ? s.url : urlDostawcy(kod)`,
  `urlEfektywnyZDb: !!(s.url niepuste)`, `czestotliwoscMinuty: s.czestotliwoscMinuty ?? null`,
  `status: s.status || "aktywny"`, `fallbackUrl: urlDostawcy(kod)`. Koperta `{ok:true, dostawcy}`.
- `GET /api/admin/suppliers-list` — ta sama pętla; `url` = `resolveUrl` (db.url || fallback),
  plus `ostatniPlik: s.ostatniPlik || null`, `liczbaProduktow: s.liczbaProduktow || 0`
  (⚠ `|| 0`, nie `?? 0` — oryginał zamienia `null` na `0`).
- `PATCH /api/admin/supplier-config/:kod` — port `:344-395` co do znaku: `kod.toUpperCase()`,
  nieznany kod → 400 `Nieznany dostawca: ${kod}`, brak w bazie → 404, walidacja trzech pól
  po `hasOwnProperty` (pole nieobecne ≠ pole `null`!), pusty patch → 400, `updateSupplier`,
  audyt `edit_supplier_config`/`dostawca`/`kod`/`{pola, nowe}`, odpowiedź
  `{ok, kod, url, czestotliwoscMinuty, status}`.
  **`delete lastRunPerSupplier[kod]` NIE jest portowane** — scheduler odbudowy trzyma stan inaczej;
  sprawdzę w `src/import/`, czy istnieje odpowiednik do wyzerowania, i albo go zawołam, albo
  odnotuję jako świadome pominięcie w raporcie.
Testy: `test/admin.supplier-config.test.ts` — komplet gałęzi walidacji (URL zły/`null`/pusty,
częstotliwość 4/5/10080/10081/`null`, status spoza enumu, pusty patch, nieznany kod, kod spoza bazy),
audyt, i asercja, że lista ma 10 pozycji także wtedy, gdy `suppliers` ma mniej wierszy.

### Krok 4 — `maintenance/usun-nieopony` + `products/clear`
Nowy `rebuild/backend/src/routes/maintenance.ts`:
- `POST /api/maintenance/usun-nieopony` — port `:48392-48405`: iteracja po produktach,
  `czyOpona(nazwa || "", kategoria).isTire === false` → usuń, licznik, `perDostawca`,
  do 10 przykładów `` `${dostawca}/${kod}: ${(nazwa||"").substring(0,60)}` ``, audyt
  `maintenance_usun_nieopony`, odpowiedź `{ok, usuniete, perDostawca, przyklady}`.
- `POST /api/products/clear` — port `:48315-48334`: `req.body?.potwierdzenie !== "WYCZYSC"` → 400
  z **dosłownym** komunikatem oryginału; kopia bazy wg D5; `wyczyscProdukty(db)` (nowa funkcja
  w `repos/products.ts`, `DELETE FROM products` bez `WHERE`); audyt `czyszczenie_katalogu`/
  `produkt`/`wszystkie` **bez `szczegoly`** (czyli `szczegoly_json = NULL` — to jeden z wierszy,
  na których dowiedziemy odporności `/api/audit-log`); `{ok:true}`.
- Router dostaje `dbPath` z `env.DB_PATH` (wzorzec `trasyImportu({db, katalogArchiwum})`).
Testy: `test/maintenance.test.ts` — nie-opony znikają a opony zostają (dane z realnych nazw),
`perDostawca`/`przyklady` (limit 10), `clear` bez potwierdzenia = 400 i **katalog nietknięty**,
z potwierdzeniem = pusty katalog + plik kopii powstał obok bazy testowej.

### Krok 5 — `GET /api/audit-log`
Trasa w `routes/admin.ts`: `requireAuth` (D2) → `res.json(listaAudytu(db, 500))`. Bez mapowania.
Testy: `test/audit-log.test.ts` — 401 bez tokenu; sortowanie malejąco po `kiedy` i limit 500;
**wiersz z `szczegoly_json = NULL` i `encja_id` spoza `suppliers`** (dokładnie kształt, jaki pisze
`synchronizacja_reczna`) przechodzi bez wyjątku i zachowuje `szczegolyJson: null`; wiersze
`edycja_konfiguracji` i `edycja_spedycji` z I11 widoczne w surowej postaci.

### Krok 6 — GATE
`rebuild/backend/test/admin.gate.test.ts` (wzorzec `historia.gate.test.ts`): cztery fixtures
(`GET_users.json`, `GET_admin_supplier-config.json`, `GET_admin_suppliers-list.json`,
`GET_audit-log.json`) — `sprawdzZgodnoscZKontraktem` + `sprawdzZgodnoscZFixture` + asercja
kompletu kluczy. Seedy w `test/gate/dane.ts`: użytkownicy, 10 dostawców z `ostatni_plik`/
`liczba_produktow`, audyt zawierający **także** wiersz z `NULL` i niezłączalnym `encja_id`.

### Krok 7 — FE: `/moje-konto`
`rebuild/frontend/src/pages/MojeKonto.tsx` + `pages/moje-konto/api.ts`. Port `lM()` 1:1 (D7),
dane z `useUzytkownik()`. Zdjąć `/moje-konto` z `pages/placeholdery.ts` (plik zostaje pusty —
lista placeholderów przestaje mieć wpisy; komentarz nagłówka do przepisania), wpiąć `<Route>`
w `App.tsx`. Testy: walidacja inline (trzy komunikaty), `disabled` przycisku, sukces czyści pola,
błąd 401 pokazuje `error` z odpowiedzi.

### Krok 8 — FE: przycisk „Usuń wszystko z katalogu"
`pages/konfiguracja/Katalog.tsx` — w miejscu adnotacji (`:130-141`): przycisk `destructive`,
`window.confirm`, `POST /api/products/clear`, toasty i trzy `invalidateQueries` (D7).
Zaktualizować nagłówek pliku (`:10-14`) — adnotacja „zakres pomniejszony, powstanie w I12"
przestaje być prawdą. Test: `confirm` → false nie wysyła żądania; sukces unieważnia trzy klucze.

### Krok 9 — FE: zakładki „Admin" i „Dziennik"
`pages/konfiguracja/zakladki.ts` (+2 pozycje, nagłówek do poprawy — D1),
`pages/Konfiguracja.tsx` (+2 `TabsContent`), nowe:
- `pages/konfiguracja/Admin.tsx` — tabela dostawców (`suppliers-list`) + `DialogKonfiguracjiDostawcy.tsx`
  (D8) + karta „Użytkownicy" (`/api/users`, read-only) + karta „Utrzymanie" (`usun-nieopony`
  z potwierdzeniem i podsumowaniem `usuniete`/`perDostawca`).
- `pages/konfiguracja/Dziennik.tsx` + `dziennik.ts` — tabela audytu, filtry po akcji i typie encji,
  kolumna „Szczegóły" przez lokalne `parsujSzczegoly` z kotwicą do
  `backend/src/historia/mapowanie.ts:87` (D3/D4), z testem na NULL, zepsuty JSON i wartość
  nie-obiektową.
- `pages/konfiguracja/admin.ts` — wywołania API (`useQuery`/`useMutation`, `isLoading`/`isError`
  wg wzorca `Staging.tsx`).
Do poprawienia przy okazji: komentarz w `backend/src/historia/mapowanie.ts:87-91` zapowiada,
że „ten sam parser obsłuży `/api/audit-log` w I12" — nieprawda (trasa oddaje surowy string),
więc nota idzie do sprostowania razem z kotwicą w drugą stronę.

## Strategia testów

- **GATE (Krok 6)** — cztery fixtures kształtem 1:1 + walidacja względem `openapi.yaml`
  + komplet kluczy. Rozbieżność = STOP, fixtures nietykalne.
- **Backend jednostkowo/integracyjnie** — na realnej bazie SQLite w katalogu tymczasowym
  (wzorzec `stworzSrodowiskoTestowe`), bez mocków: `zmienHaslo` (5 gałęzi + realne przelogowanie),
  walidacja `PATCH` (wszystkie granice), `usun-nieopony` na prawdziwym `czyOpona`, `clear`
  (ochrona + kopia pliku), `audit-log` (NULL, niezłączalny `encja_id`, limit, sort, 401).
- **Frontend** — Testing Library + MSW jak w dotychczasowych widokach; `onUnhandledRequest:"error"`,
  więc każde nowe zapytanie w `Konfiguracja.tsx` wymaga mocka (nota z 7c).
- **Nie robimy** E2E — brak harnessu E2E w projekcie; ścieżki są pokryte integracyjnie.
- Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/`
  i `rebuild/frontend/`.

## Poza zakresem

- Mutacje produktów `POST /api/products`, `PUT/PATCH/DELETE /api/products/{id}` — sesja 12a.
- Dialog edycji produktu `LT()` i menu „Akcje" w `/katalog` — sesja 12c.
- Przenagranie fixtures i odświeżenie `openapi.yaml` (w tym `GET_products.json` z `szerokosc`
  jako TEXT, dwa endpointy `uwaga_cena`) — sesja 12d.
- Finalny audyt bezpieczeństwa, przegląd 12 widoków z Anią, decyzja o sidebarze wpinanym
  przez widok — sesja 12e.
- Role/uprawnienia w tabeli `users` — brak kolumny, patrz Follow-up.
- Serwerowe strony HTML oryginału (`/admin/import-now`, `/admin/supplier-config`) — nie są
  Reactem i nie wchodzą do odbudowy.

## Definition of done

- [ ] Osiem operacji backendu działa za `requireAuth`, każda oddaje 401 bez tokenu.
- [ ] GATE: cztery fixtures zgodne kształtem 1:1 + walidacja kontraktu, z asercją kompletu kluczy.
- [ ] `GET /api/audit-log` oddaje surowy `szczegolyJson` (string) i znosi `NULL` oraz `encja_id`
      niezłączalny z `suppliers` — dowiedzione testem na danych, nie tylko typem.
- [ ] `POST /api/products/clear` bez `{potwierdzenie:"WYCZYSC"}` zwraca 400 i **nie kasuje nic**;
      z potwierdzeniem tworzy kopię bazy przed czyszczeniem.
- [ ] `PATCH /api/admin/supplier-config/{kod}` odtwarza wszystkie gałęzie walidacji oryginału.
- [ ] `/moje-konto` pełne: Ania zmienia hasło i loguje się nowym; teksty i `data-testid` 1:1.
- [ ] Przycisk „Usuń wszystko z katalogu" w zakładce „Katalog" z `window.confirm` i trzema
      `invalidateQueries`.
- [ ] Zakładki „Admin" i „Dziennik" w `/konfiguracja` obsługują cztery pozostałe trasy.
- [ ] Parser szczegółów we froncie ma kotwicę do backendowego oryginału i test na te same trzy
      wejścia (NULL, zepsuty JSON, wartość nie-obiektowa); mylący komentarz w `mapowanie.ts`
      sprostowany.
- [ ] `lint` / `typecheck` / `build` / `test` czyste w backendzie i we froncie.
- [ ] Roadmapa sprostowana: `PATCH` zamiast `PUT`, zakres 12b odhaczony, ustalenia dla 12a/12c/12d/12e
      wpisane DO ICH bloków.
