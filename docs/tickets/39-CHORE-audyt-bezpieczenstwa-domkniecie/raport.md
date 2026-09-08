# 39-CHORE-audyt-bezpieczenstwa-domkniecie — raport z implementacji

## Podsumowanie

Finalny audyt bezpieczeństwa odbudowy (Iteracja 12, sesja 12e) **nie znalazł ani jednej otwartej
dziury** w czterech obszarach zakresu A: auth stoi na wszystkich trasach danych, CORS jest
domyślnie zamknięty (a nie — jak zakładał prompt — de facto otwarty), `JWT_SECRET` ma fail-fast
bez fallbacku, a mass-assignment (backlog #14) jest domknięty na każdej trasie mutacji.
Znaleziona została natomiast **luka procesu**: testy auth chodziły po listach (kontrakt,
kuratorowane tablice), więc nowa trasa bez `requireAuth` i bez wpisu w `openapi.yaml`
przeszłaby CI — zamknięte testem skanującym realny rejestr Express.

Poza audytem ticket domyka trzy wpisy backlogu naprawą (#36 sidebar, #49 retencja kopii,
#51 potwierdzenia), trzy decyzją o pominięciu (#45, #48, #50), dokumentuje plan cutoveru
i przygotowuje checklistę przeglądu 12 widoków dla Ani.

**Efekt uboczny naprawy #36 okazał się naprawą realnego defektu, nie kosmetyką** — patrz
sekcja „Znalezisko przy okazji".

---

## Wynik audytu (zakres A) — zmierzony, nie przepisany z roadmapy

### A1. Auth na trasach danych — **OK**

~95 operacji w 21 plikach `rebuild/backend/src/routes/*.ts`. **Każda trasa danych ma
`requireAuth` bezpośrednio przy rejestracji**, nie przez `router.use` — więc nie da się jej
zgubić przy refaktorze montowania. Publiczne są dokładnie trzy:

| Trasa | Gdzie | Dlaczego wolno |
|---|---|---|
| `POST /api/login` | `routes/auth.ts:31` | bez niej nie da się dostać tokenu |
| `POST /api/logout` | `routes/auth.ts:62` | JWT bezstanowy — czyszczenie cookie nie ma czego autoryzować; tak samo w oryginale (`backend-index.cjs:48175-48178`) |
| `GET /api/health` | `app.ts:135` | healthcheck PM2, nie oddaje danych |

Kolejność middleware (`app.ts:84-198`): CORS → `compression` → parsery → `optionalAuth`
(globalny, tylko wypełnia `req.user`) → `/api/health` → routery → `nieZnalezionoHandler`
(404 JSON) → `bladHandler`. Nic nie jest montowane przed `optionalAuth` poza CORS i parserami;
`OPTIONS` obsłużone w `cors.ts:28-31`; 404 nie wycieka stack trace'ów.

### A2. Kompletność testów auth — **LUKA, naprawiona**

`test/kontrakt.spojnosc.test.ts:143` iteruje po operacjach z `contract/openapi.yaml`. Osiem
testów modułowych (`admin.gate.test.ts:238`, `narzuty.gate.test.ts:149`,
`produkty.mutacje.test.ts:78`, `selly.gate.test.ts:241`, `konfiguracja.test.ts:159` i in.)
używa **kuratorowanych list ścieżek**. Wspólna cecha: każda wymaga, żeby ktoś PAMIĘTAŁ
o uzupełnieniu. Trasa dodana bez `requireAuth` **i** nieopisana w kontrakcie nie trafiłaby do
żadnej z nich.

Dziś nic takiego nie istnieje — to zabezpieczenie na przyszłość, dodane jako
`test/auth.rejestr.test.ts` (D2a).

### A3. CORS — **OK; obawa z promptu się nie potwierdziła**

Prompt zakładał, że pusty `CORS_ORIGINS` zostawia CORS „de facto otwarty". **Jest odwrotnie.**
`app.ts:116` montuje middleware tylko gdy allowlista jest niepusta — przy pustej **middleware
w ogóle nie ma**, więc nie ma nagłówków `Access-Control-Allow-*` i przeglądarka blokuje
cross-origin sama. Architektura jest same-origin: Apache `mod_proxy [P]` proxuje `/api/*` na
`127.0.0.1:5001` pod tą samą subdomeną co statyczny front (`deploy/staging/htaccess:11`).
W repo **nie ma nigdzie** `Access-Control-Allow-Origin: *`, a `tools/deploy-staging.sh` nie
ustawia `CORS_ORIGINS` — na staging CORS jest wyłączony, spójnie z same-origin.

Gdy origin JEST na allowliście, `cors.ts:13-35` odsyła **konkretny origin z listy** razem
z `Allow-Credentials: true` — nigdy `*`, nigdy echa dowolnego originu z żądania. To jawnie
udokumentowana naprawa wobec produkcji, która odbijała DOWOLNY origin z `credentials:true`
(`backend-index.cjs:48926-48930`).

**Wniosek dla zapisu w roadmapie:** wymaganie „staging/prod muszą mieć allowlistę" było
nietrafione — przy same-origin allowlista jest zbędna, a jej wymuszenie byłoby konfiguracją
na wyrost (każdy origin na liście dostaje `Allow-Credentials: true`). Zamiast tego domknięto
pomyłkę w drugą stronę (D2b).

### A4. `JWT_SECRET` — **OK**

`config/env.ts:36`: `z.string().min(1, …)` bez `.default()`; `wczytajEnv` rzuca
(`env.ts:125-135`), serwer nie wstaje. `grep` po całym `rebuild/` (bez `node_modules`): jedyne
wystąpienia to produkcyjny kod przez `env.JWT_SECRET` oraz stałe **testowe**
(`test/gate/aplikacja.ts:14`), żadna nie sięga ścieżki produkcyjnej. Pokryte
`config.env.test.ts:11`. Token: `expiresIn: "30d"` (`auth/jwt.ts:20`), zgodnie z oryginałem.

### A5. Mass-assignment — **OK, backlog #14 domknięty na wszystkich trasach**

Żadna trasa mutacji nie robi `Object.keys(req.body)` do `UPDATE` ani spreadu całego ciała
do `SET` (potwierdzone `grep`em).

| Trasa | Handler | Filtr pól |
|---|---|---|
| `PATCH /api/dostawcy/:id` | `suppliers.ts:282` | `odsiejPolaEdytowalne` → `POLA_EDYTOWALNE_DOSTAWCY` (3f-2) |
| `POST/PATCH /api/markups` | `markups.ts:46,90` | `odsiejPolaNarzutu` (4a) |
| `POST/PATCH /api/promotions` | `promotions.ts:39,74` | `odsiejPolaPromocji` (4a) |
| `PUT /api/staging/:id` | `staging-mutacje.ts:266,289` | `POLA_EDYTOWALNE` (`:35`, port 1:1) |
| `POST /api/spedycja` | `spedycja.ts:43` | `odsiejPolaSpedycji` (I11) |
| `POST /api/config` | `config.ts:56` | jawne `{klucz, wartosc}` + whitelista kluczy (#30) |
| `PUT/PATCH /api/products/:id` | `products.ts:271-272` | `odsiejPolaEdytowalneProduktu` → `repos/products.ts:199` |
| `POST /api/products` (bulk) | `products.ts:161` | `tylkoKolumnyProduktu` — filtr na poziomie kolumn, zamierzony |
| `PATCH /api/admin/supplier-config/:kod` | `admin.ts:137-193` | pole-po-polu z walidacją |
| `POST /api/password/change` | `konto.ts:44` | destrukturyzacja |
| `POST /api/maintenance/usun-nieopony`, `POST /api/products/clear` | `maintenance.ts:79,123` | `{potwierdzenie}` |
| `POST/PUT/DELETE /api/atrybuty/*` | `atrybuty.ts` | destrukturyzacja per handler |
| `POST /api/selly/*` (6 tras) | `selly.ts` | pola używane selektywnie |

**Zasada stała utrzymana:** `POLA_EDYTOWALNE_PRODUKTU` (`repos/products.ts:184-199`) jawnie
wyklucza 26 kolumn wyliczanych, `uwagaCena`, `id`/`kod`/`dataAktualizacji` i `dostawca`;
`POLA_EDYTOWALNE_DOSTAWCY` nie zawiera `importWylaczony`. Jedyny wyjątek — `POST /api/products`
(bulk import) — filtruje na poziomie **kolumn tabeli**, bo import z definicji musi zapisać
kolumny wyliczane; jest to opisane komentarzem (`repos/products.ts:149-159`) i zamierzone.

---

## Znalezisko przy okazji — naprawa #36 odblokowała martwą wirtualizację katalogu

Po wpięciu `AppShell` do routera **48 testów katalogu padło** na
`ReferenceError: ResizeObserver is not defined`. Diagnoza okazała się ciekawsza niż brak
polyfilla w jsdom:

`useWirtualizacja` (`pages/katalog/wirtualizacja.ts:47`) zaczyna od
`document.getElementById("$vMainScroll")` i **wychodzi z efektu, gdy go nie znajdzie**. Ten
element to `<main>` z `AppShell` (`AppShell.tsx:152`). Skoro `/katalog` do 12e w ogóle nie
renderował `AppShell`, to **wirtualizacja katalogu była martwa nie tylko w testach, ale
i w przeglądarce**: `przewinieto` zostawało na 0, `wysokoscOkna` na domyślnych 600, a okno
wierszy nigdy się nie przesuwało.

**Skutek dla Ani, jeśli nie liczyć na przypadek:** wirtualizacja włącza się powyżej 150 wierszy
(`PROG_WIRTUALIZACJI`). Rozmiary strony 25/50/100 są poniżej progu, więc problem był
niewidoczny — **ale przycisk „Wszystkie"** ustawia rozmiar strony na całą przefiltrowaną listę
(przy pełnym katalogu ~7 400 pozycji). W tym trybie renderowało się pierwsze okno wierszy plus
dwa spacery, a przewijanie niczego nie doładowywało.

Naprawa #36 usuwa przyczynę (element `$vMainScroll` istnieje na `/katalog`), a w testach
doszła zaślepka `ResizeObserver` w `test/setup.ts` — ta sama kategoria luki jsdoma co obecne
tam `matchMedia`, `hasPointerCapture` i `scrollIntoView`. **Ten punkt trafił do checklisty dla
Ani** (sekcja „Katalog", przycisk „Wszystkie") jako rzecz do sprawdzenia ręcznie — testy
jednostkowe nie zmierzą płynności przewijania.

Wpis backlogu #36 przestaje więc być „regresją wizualną" — była to także regresja funkcjonalna.

---

## Zmiany

### Backend

- `src/config/env.ts` — `schemaEnv` rozbite na `schemaEnvBazowe` + `superRefine`: **fail-fast,
  gdy `NODE_ENV=production` a `CORS_ORIGINS` zawiera `*`** (D2b). Komentarz mówi wprost, czego
  tu NIE MA i dlaczego: pusty `CORS_ORIGINS` jest stanem docelowym, nie brakiem konfiguracji.
- `src/app.ts` — komentarz przy `if (env.CORS_ORIGINS.length > 0)`: brak middleware to stan
  docelowy dla same-origin, nie przeoczenie; ostrzeżenie przed „naprawianiem" tego domyślną
  allowlistą. Bez zmiany zachowania.
- `src/server.ts` — **log stanu CORS przy starcie** (`[cors] wyłączony …` / `[cors] allowlista …`),
  obok istniejącego logu schedulera. Celowo w `server.ts`, nie w `app.ts` — `stworzApp` wołane
  jest przez każdy z 79 plików testowych.
- `src/auth/jwt.ts` — stała `ALGORYTM = "HS256"`, przekazana do `jwt.sign` i **do `jwt.verify`
  jako `algorithms`** (D2c).
- `src/routes/maintenance.ts` — **retencja kopii bazy** (D2d, backlog #49): po
  `copyFileSync` + checkpoint WAL zostaje `LIMIT_KOPII_PRZED_CZYSZCZENIEM = 5` najnowszych
  plików `*.bak_before_clear_*`, starsze kasowane. Best-effort w `try/catch` — błąd sprzątania
  nie przerywa czyszczenia katalogu i nie zmienia odpowiedzi HTTP. Sortowanie po nazwie =
  sortowanie po czasie, bo znacznik to ISO 8601 o stałej długości.
- **Nowy:** `test/auth.rejestr.test.ts` — rekurencyjny obchód `app._router.stack`, zestawienie
  z jawną listą `TRASY_PUBLICZNE` (3 pozycje). `requireAuth` rozpoznawany przez **tożsamość
  funkcji**, nie po nazwie. Cztery asercje, w tym „rejestr nie jest pusty" (żeby zmiana
  w Express nie zamieniła testu w cicho przechodzący no-op) i „lista publicznych ma dokładnie
  trzy pozycje" (żeby jej rozszerzenie wymagało świadomej edycji testu).
- **Nowy:** `test/auth.jwt.test.ts` — round-trip, nagłówek `alg: HS256`, odrzucenie tokenu
  podpisanego HS512 mimo poprawnego sekretu, odrzucenie `alg: none`, zły sekret / śmieci /
  token wygasły.
- `test/config.env.test.ts` — dwa testy strażnika CORS: `*` w produkcji rzuca (także w liście
  z innymi originami), `*` lokalnie przechodzi, **pusta lista w produkcji przechodzi**
  (asercja, że strażnik NIE wymaga allowlisty).
- `test/maintenance.test.ts` — dwa testy retencji: siedem podłożonych kopii + jedno czyszczenie
  zostawia pięć najnowszych; błąd sprzątania nie przerywa operacji. Drugi test wywołuje realny
  błąd `unlinkSync`, podkładając **katalog** o nazwie kopii — zamiast atrapy `fs`.

### Frontend

- `src/App.tsx` — **`AppShell` wpinany przez router** (D1, backlog #36). Tabela
  `TRASY_Z_RAMA: [string, ComponentType][]` z dwunastoma trasami zalogowanego; `/login` i 404
  zostają poza ramą, jak w oryginale.
- `src/components/AppShell.tsx` — nagłówek przepisany: rama należy do routera, padding treści
  należy do ramy (widok nie dokłada własnego).
- `src/pages/{Pulpit,Konfiguracja,Atrybuty,Selly,MojeKonto}.tsx` — zdjęte własne
  `<AppShell>`, import i nieaktualne komentarze o „ramie jako części widoku". W każdym została
  krótka nota odsyłająca do `App.tsx`.
- `src/pages/Katalog.tsx` — zdjęte `p-6` z korzenia widoku (rama daje już
  `px-4 sm:px-6 lg:px-8 py-6 md:py-8`); pozostałe sześć widoków bez `AppShell` własnego
  paddingu nie miało.
- `src/pages/Staging.tsx` — dwa `confirm()` → `DialogPotwierdzenia` (D5, backlog #51), stan
  `doPotwierdzenia: "akceptuj" | "odrzuc" | null`. **Teksty pytań dosłownie te same.**
- `src/pages/konfiguracja/Admin.tsx` — `window.confirm` → `DialogPotwierdzenia`, tekst
  dosłowny. `konfiguracja/Katalog.tsx` **bez zmian** — natywny dialog zostaje tam jako świadomy,
  opisany komentarzem wyjątek.
- `test/setup.ts` — zaślepka `ResizeObserver` (luka jsdoma; patrz „Znalezisko przy okazji").
- `test/shell.test.tsx` — nowy blok: `it.each` po dwunastu trasach sprawdza obecność sidebara,
  plus dwa testy na jego BRAK na `/login` i 404.
- `test/staging.test.tsx`, `test/konfiguracja.admin.test.tsx` — testy przestały podmieniać
  globalny `window.confirm`, klikają w dialog. Doszły dwa testy na dosłowność tekstu pytania.

### Dokumenty

- **Nowy:** `docs/cutover.md` — plan big-bang. Warunki wstępne · **rozdział 3: weryfikacja
  schematu bazy** (najdłuższy, z próbą migracji na kopii) · różnice env staging vs produkcja ·
  kroki okna · smoke-testy · rollback w trzech wariantach · po cutoverze.
- **Nowy:** `docs/przeglad-12-widokow.md` — checklista dla Ani, po polsku, językiem nietechnicznym.
  12 sekcji + logowanie, w każdej „ma się pokazać" i konkretne czynności z kratkami ✅/❌.
  Osobno: „rzeczy, które wyglądają inaczej i to jest w porządku" (6 pozycji) oraz „rzecz znana
  i nienaprawiona" (#48).

---

## Odstępstwa od planu

**Jedno, drobne.** Plan zakładał log stanu CORS w `app.ts`. Trafił do `src/server.ts`, bo
`stworzApp` jest wołane przez każdy z 79 plików testowych — log w `app.ts` zaśmieciłby wyjście
całej suity. `server.ts` jest wołane raz na proces i już trzyma analogiczny log schedulera.

Poza tym implementacja jest zgodna z planem. Dodatkowo, poza planem, doszła zaślepka
`ResizeObserver` w `test/setup.ts` — wymuszona przez skutek D1 opisany w „Znalezisku przy
okazji", nie przewidziany przy planowaniu.

---

## Rozliczenie backlogu

| # | Temat | Decyzja 12e | Status po tickecie |
|---|---|---|---|
| **#36** | `AppShell` niejednolity | **D1 — naprawić** | ✅ TAK — rama w routerze, sidebar na 12/12 |
| **#49** | kopie bazy niesprzątane | **D2d — naprawić** | ✅ TAK (świadome odstępstwo: produkcja nie sprząta wcale) |
| **#51** | trzy `window.confirm` | **D5 — ujednolicić** | ✅ TAK — dwa pliki na `DialogPotwierdzenia`, `Katalog.tsx` zostaje jako opisany wyjątek |
| **#45** | martwy filtr „Źródło" | **D4 — pominąć** | ❌ NIE — decyzja D4 z 7b utrzymana; ożywienie wymaga wystawienia `origin` w API, czego produkcja nie robi |
| **#48** | brak kolumny roli w `users` | **D3 — zostawić 1:1** | ❌ NIE w odbudowie — stan zgodny z produkcją; kandydat na osobny ticket po cutoverze, odnotowany w `cutover.md` §8 i w checkliście Ani |
| **#50** | `parsujSzczegoly` w dwóch kopiach | **D4 — pominąć** | ❌ NIE — zamierzony duplikat, decyzja D4 z ticketu 36 |
| **#52** | `security: []` vs `requireAuth` | **D6 — utrzymać odstępstwo** | ✅ rozstrzygnięty — 14 tras zostaje pod `requireAuth` na stałe |

Wpisy ⬜ pozostające otwarte poza zakresem tego ticketa (port 1:1 wykonany, naprawa czeka na
decyzję Ani): #11, #12, #19, #21, #25, #26, #31–#35, #39–#43. Wszystkie dotyczą defektów
PRODUKCJI odtworzonych świadomie — żaden nie jest regresją odbudowy i żaden nie blokuje
cutoveru. Sześć z nich, widocznych dla Ani, trafiło do sekcji „rzeczy, które wyglądają inaczej"
albo „znane i nienaprawione" w `docs/przeglad-12-widokow.md`.

---

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Ticket **nie zmienia kształtu ani wartości
  żadnej odpowiedzi API**, więc gate'em jest cała dotychczasowa siatka — 73 nagrania / 96 ścieżek
  — z wymaganiem, żeby nic się nie zmieniło. Pełny `npm test` w `rebuild/backend` (obejmuje
  `kontrakt.spojnosc.test.ts` z walidacją względem `contract/openapi.yaml` i 14 adnotacjami
  `x-odbudowa-auth` oraz wszystkie testy GATE porównujące odpowiedzi z `contract/fixtures/`)
  przeszedł w całości, a **`git status contract/` jest pusty** — ani jeden plik kontraktu ani
  fixture nie został dotknięty.
- **Backend:** ✓ 79 plików / **1223 testy** (było 1209 — +14 z tego ticketa).
  `lint` ✓, `typecheck` ✓, `build` ✓.
- **Frontend:** ✓ 48 plików / **747 testów** (było 731 — +16). `lint` ✓, `typecheck` ✓,
  `build` ✓. Integracyjne: ✓ 5 plików / 39 testów.
- **Negatywna weryfikacja nowego testu auth.** Żeby nie oddać testu, który przechodzi zawsze:
  tymczasowo zdjęto `requireAuth` z `GET /api/alerts` (`routes/alerts.ts:34`) — test padł
  z czytelną różnicą wskazującą dokładnie tę trasę. Zmiana wycofana.
- **E2E:** brak w projekcie — nie dotyczy.

---

## Breaking changes

**Dla użytkownika: brak.** Zmiany widoczne dla Ani (sidebar wszędzie, dwa dialogi potwierdzeń
w stylu panelu) są opisane w checkliście przeglądu jako oczekiwane; treści pytań są dosłownie
te same co wcześniej.

**Dla wdrożenia — jedna nowa reguła:** `CORS_ORIGINS` zawierający `*` przy `NODE_ENV=production`
**zatrzyma start procesu**. Żadne z obecnych środowisk tak nie jest skonfigurowane (staging
w ogóle nie ustawia tej zmiennej), więc nic się nie psuje — ale wpisanie gwiazdki „na szybko"
przestanie być możliwe. To jest zamierzone.

---

## Follow-up

Rzeczy zauważone i **świadomie niezrobione** w tym tickecie:

1. **Rola administratora (#48)** — do czasu jej wprowadzenia każdy zalogowany widzi zakładki
   „Admin" i „Dziennik". Stan zgodny z produkcją, decyzja D3. Wymaga migracji `004`, middleware
   `requireAdmin` i rozstrzygnięcia, kto dostaje rolę na starcie. Odnotowane w `cutover.md` §8
   z rekomendacją „raczej wcześniej niż później" i przedstawione Ani w checkliście.
2. **Wariant `003_szerokosc_text.sql` dla produkcji** — jeśli próba migracji na kopii produkcji
   (`cutover.md` §3) padnie na 003, trzeba napisać migrację dopasowaną do faktycznego kształtu
   tabeli. To osobne zadanie, nie improwizacja w oknie cutoveru.
3. **Kolizja `002_import.sql` z produkcją** — `ALTER TABLE products ADD COLUMN uwaga_cena`
   najprawdopodobniej padnie, bo kolumnę dokłada tam patch przy każdym starcie. Obejście jest
   opisane w `cutover.md` §3 (odnotowanie 002 w `_migracje` + ręczne dołożenie brakującej
   kolumny dostawcy). **Nie zmierzone na żywej produkcji** — nie mamy do niej dostępu z tej
   sesji; zmierzony został snapshot z 2026-08-13 (72 kolumny, bez `uwaga_cena`, `szerokosc`
   REAL), który jest starszy niż obie zmiany produkcji i sam z siebie niczego nie rozstrzyga.
4. **Wirtualizacja katalogu przy „Wszystkie"** — naprawiona pośrednio przez D1, ale
   **nieprzetestowana automatycznie**: testy jednostkowe nie zmierzą płynności przewijania
   7 400 wierszy. Zweryfikuje to Ania na staging (punkt w checkliście).
5. **Pozostałe ⬜ w backlogu** (#11, #12, #19, #21, #25, #26, #31–#35, #39–#43) — defekty
   produkcji odtworzone 1:1, czekające na decyzję Ani. Nie blokują cutoveru.
