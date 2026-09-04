# Specyfikacja frontendu Bridge — ZWERYFIKOWANA

Werdykt weryfikacji dokumentacji frontendu od Perplexity
(`docs/incoming/frontend-perplexity/dokumentacja/`), skonfrontowanej z naszym
`deminified/frontend-index.js`, kontraktem `contract/openapi.yaml` (2.3) oraz
instrukcją z 17 zrzutami.

> **Werdykt: dokumentacja RZETELNA i przyjęta jako referencja.** W przeciwieństwie
> do wcześniejszej „specyfikacji UI" (która miała **zmyślone** endpointy), ta
> cytuje `plik:linia`, oznacza NIEZNANE, sama zawiera plik `03_ROZBIEZNOSCI.md`
> z macierzą wszystkich 53 ścieżek klienta skonfrontowanych z backendem, i podaje
> MD5 analizowanego bundla (`index-PRICEFMT1783512500.js`). Moja niezależna
> krzyżowa kontrola potwierdziła jej rdzeń.

**Kanoniczna referencja (przyjęta):**
`docs/incoming/frontend-perplexity/dokumentacja/` — `00_PODSUMOWANIE`,
`01_WARSTWA_WSPOLNA`, `02_WIDOKI`, `03_ROZBIEZNOSCI`, `04_DESIGN_TOKENS`,
`_mapy_api/` (mapy wywołań FE vs BE). **Sprostowania do niej — §7.**

---

## 1. ⭐ Krzyżowa kontrola kontraktu — POTWIERDZONE niezależnie

Skonfrontowałem 53 wywołania frontendu (`_mapy_api/api_fe_uniq.txt`) z moim
kontraktem `openapi.yaml` (2.3). **Jedyne dwie ścieżki, których backend NIE ma:**

```
❌ /api/attributes        (frontend woła 8×)   → backend ma: /api/atrybuty
❌ /api/attribute-kinds   (frontend woła 6×)   → backend ma: /api/atrybuty/rodzaje
```

Wszystkie pozostałe 51 ścieżek FE istnieje w kontrakcie (w tym całe
`/api/analytics/*`). To jest ten sam rozjazd, który podejrzewałem w lipcu —
teraz **potrójnie potwierdzony**: mój audyt → dokumentacja Perplexity → moja
krzyżowa kontrola z kontraktem. Zweryfikowane też w naszym `deminified`:
`/api/attributes` 8 trafień, `/api/attribute-kinds` 6.

> To opis błędu **oryginału**. Odbudowa (7b, `31-FEATURE-atrybuty-frontend`, 2026-09-04) go nie
> ma — `grep -rn "attributes\|attribute-kinds" rebuild/frontend/src` zwraca zero wywołań (zostały
> tylko komentarze i dwa `data-testid` przeniesione 1:1: `button-add-attribute`,
> `button-save-attribute`). Szczegóły niżej, §2 i §5.

## 2. ⭐ Mapa do naprawy przy odbudowie (konkretna lista)

**A. Dwie martwe ścieżki → zamiana na natywne API:**
| Frontend woła (błędnie) | Ma być | Backend |
|---|---|---|
| `/api/attributes` | `/api/atrybuty` | `atrybuty_module.cjs:103` |
| `/api/attribute-kinds` | `/api/atrybuty/rodzaje` | `atrybuty_module.cjs:114` |

**Stan 2026-09-04 (7a, `29-FEATURE-atrybuty-backend`):** natywny backend atrybutów jest gotowy
(13 ścieżek / 18 operacji, `rebuild/backend/src/routes/atrybuty.ts`). Uwaga na różnicę pól:
`GET /api/atrybuty` zwraca rodzaje z `utworzony`, `GET /api/atrybuty/rodzaje` — bez.

**Stan 2026-09-04 (7b, `31-FEATURE-atrybuty-frontend`):** front woła właściwe ścieżki — widok
natywny `/atrybuty` i dialog reguł w `/narzuty` (część B). Szczegóły widoku: blok „Odbudowa (7b…)"
w §5 niżej.

**B. Trzy skrypty injection → wchłonąć do natywnego Reacta** (dziś łatają UI
poza aplikacją). **Stan 2026-09-04: wchłonięte WSZYSTKIE TRZY** — `freq-injection.js`
(2026-09-01), `pending-injection.js` i `selly-injection.js` (oba 2026-09-04). Nowy frontend
nie zależy już od żadnego z nich:
| Skrypt | Co robiło | Co weszło natywnie |
|---|---|---|
| ~~`pending-injection.js` (57 KB)~~ ✅ **WCHŁONIĘTY 2026-09-04 (7b, `31-FEATURE-atrybuty-frontend`)** | przejmował ekran `/atrybuty` przez React Fiber + MutationObserver, nadpisywał cache Query | ✔ `src/pages/Atrybuty.tsx` + `src/pages/atrybuty/` (`KafleRodzajow`, `PanelWartosci`, `PanelPending`, `DialogProduktow`, `DialogNowyRodzaj`, `DialogNowaWartosc`, `api.ts`); jeden Query key `["/api/atrybuty"]`, mutacje + invalidacje, „Wyczyść wszystko" przez `DELETE /api/atrybuty/pending`. Bez React Fiber i `MutationObserver`. |
| ~~`selly-injection.js` (30 936 B)~~ ✅ **WCHŁONIĘTY 2026-09-04 (8b, `30-FEATURE-selly-panel-frontend`)** | overlay panelu Selly na `/panel/api/selly` (hash-routing, flaga `sessionStorage.sellyViewActive`) | ✔ trasa Wouter `/selly` (odstępstwo O1 — w produkcji Selly nie było trasą Reacta) + pięć sekcji i sześć tras 1:1, ikona `PackageOpen` (D7) |
| ~~`freq-injection.js` (12 KB)~~ ✅ **WCHŁONIĘTY 2026-09-01 (blok 3f-2)** | dokładał kontrolkę częstotliwości importu poza Reactem (PATCH) | ✔ `rebuild/frontend/src/pages/konfiguracja/{dostawcy.ts,Dostawcy.tsx}` — presety, `fmt()` i kotwica `data-testid="supplier-config-<KOD>"` przeniesione 1:1; znikła mapa `kod → id` i `MutationObserver` |

> **Iteracja 8 zamknięta (8a + 8b, 2026-09-04).** 8a (`28-FEATURE-selly-eksport-backend`)
> dowiozła 10 tras panelu Selly (`/api/selly/*`) i 2 trasy eksportu Shopera
> (`/api/export-shoper`, `/api/export/shoper`) za `requireAuth`. 8b
> (`30-FEATURE-selly-panel-frontend`) dowiozła natywną trasę `/selly`, odtwarzającą żywy
> `selly-injection.js` **1:1**: pięć sekcji („Status połączenia", „Codzienna synchronizacja
> CSV", „Mapowanie dostawców" — z przyciskiem „Sync" per wiersz odpalającym PEŁNY,
> niedry-runowy sync bez pytania w oryginale — „Sync dostawcy", „Historia operacji") i sześć
> wołanych tras (`ping`, `csv-status`, `generate-csv`, `status`, `log?limit=10`,
> `sync-supplier`). **Cztery z dziesięciu tras 8a zostają bez konsumenta w UI**
> (`dictionaries`, `producers`, `categories`, `sync-product`) — tak jak w produkcji, gdzie
> używano ich z konsoli (D1); obie trasy eksportu (`export-shoper`, `export/shoper`) też
> zostają bez konsumenta (D2). `mirror/frontend/selly.html` (8 587 B) to martwy poprzednik
> injection, bez linku z niczego — zostaje nietknięty w `mirror/` (D6). `/selly` nie jest
> jedną z 12 oryginalnych tras (odstępstwo O1) — router odbudowy ma dziś **13 tras**, sidebar
> **11 pozycji**. Szczegóły: `docs/tickets/30-FEATURE-selly-panel-frontend/`.

## 3. Korekty do MOICH dokumentów

Weryfikacja frontendu koryguje dwie rzeczy z `audit-delta.md`:

- 🔴 **UI analityki ISTNIEJE.** Pisałem „31 endpointów analityki, zero UI". Fałsz —
  jest trasa **`/analityka`** wołająca 20 endpointów `analytics/*` (`fe.js:27804`,
  `01_WARSTWA_WSPOLNA.md`). Do usunięcia z listy „bez UI".
- **12 tras** (nie 11): `/login`, `/`, `/staging`, `/katalog`, `/narzuty`,
  `/alerty`, `/analityka`, `/historia`, `/konfiguracja`, `/waga-gabarytowa`,
  `/atrybuty`, `/moje-konto`. Router **Wouter v3**, `Switch`, `fe.js:28644-28677`.
  Odbudowane dotąd: `/login`, `/`, `/katalog`, `/staging`, `/konfiguracja`, `/historia`,
  `/narzuty`, `/alerty`, `/waga-gabarytowa`, `/analityka`, `/atrybuty` (11 widoków; `/analityka`
  ładowana leniwie — `lazy`+`Suspense`); pozostał wyłącznie 1 placeholder (`/moje-konto`,
  `src/pages/placeholdery.ts`).

## 4. Zachowania „lokalne vs API" — do świadomej decyzji przy odbudowie

Dokument wyłapał miejsca, gdzie frontend liczy coś **lokalnie**, mimo że backend
ma endpoint:
- ~~**Alerty** (`/alerty`) — status/obsługa trzymane lokalnie, choć `/api/alerts` istnieje.~~
  ⚠ **Sprostowanie (I6, `18-FEATURE-widok-alerty`, 2026-09-03):** to był mylący zapis — nie
  chodziło o miejsce przechowywania statusu TYCH SAMYCH alertów, tylko o dwa różne zestawy
  danych. Oryginalny widok `/alerty` (`HT()`, `fe.js:25177-25340`) **nie woła `/api/alerts`
  w ogóle** — liczy pseudo-alerty katalogowe z `GET /api/products` (marża ujemna, niska marża,
  „nie-opona", `pv()`, `:16631-16705`) i trzyma ich status w IndexedDB (`alerty-statusy`).
  Alerty z `/api/alerts` **pisze import** (błąd HTTP, błąd pobierania, ręczny upload —
  `src/repos/alerts.ts`), a oryginalny widok ich w ogóle nie czyta. Odbudowa (I6) stawia widok
  `/alerty` na REALNYCH alertach importu z `/api/alerts`, ze statusem przez `PATCH
  /api/alerts/{id}` (świadome odejście od oryginału), z grupowaniem powtórek w widoku, bo zapis
  nie ma dławika (339 alertów „Błąd pobierania" w produkcji, do 23/dobę na jednego dostawcę).
  Pseudo-alerty katalogowe oryginału **świadomie pominięte** — `docs/rebuild-backlog.md` #26
  (⬜ do decyzji). Szczegóły: `docs/tickets/18-FEATURE-widok-alerty/`.
- **Waga gabarytowa** — liczona w przeglądarce, choć `POST /api/waga-gabarytowa/oblicz` istnieje.
  Nie jest to przeoczenie: BE liczy inny wzór (paletowy/oponowy), a widok — wolumetryczny
  kurierski z wyborem przewoźnika, objętością m³ i wagą do wyceny; podpięcie pod endpoint
  odebrałoby te funkcje. Odbudowa (I9) zachowała ten stan świadomie (D1),
  `docs/tickets/18-FEATURE-waga-gabarytowa/`.
- **Staging** — instrukcja v5 zakłada ręczną obsługę, kod auto-przyjmuje zmiany ceny/stanu.
- Instrukcja v5 opisuje **Narzuty i Historię jako „w przygotowaniu"**, a kod ich API używa
  (potwierdza deltę: te moduły dojrzały po czerwcu). Doprecyzowanie z I5: widok Historii woła
  **wyłącznie** `GET /api/history/paged` i `GET /api/history/meta` — gołej `GET /api/history`
  (log 10-polowy z tabeli `history`) nie woła w ogóle; tę trasę wołają Pulpit (I10) i cache
  edycji katalogu.

## 5. Blueprint odbudowy (potwierdzony w kodzie)

**Stack:** React 18 · **Wouter v3** · TanStack Query · Radix/shadcn · Tailwind.

**Przepływ auth (do wiernego odtworzenia, `01_WARSTWA_WSPOLNA.md`):**
- `POST /api/login` z `{email: email.trim(), password}` → oczekuje `{ok, user, token}`.
- Nagłówki: `Authorization: Bearer <token>` **tylko gdy token jest** + `credentials:"include"` (cookie `bridge_session`) — **równolegle**.
- „Remember me" nie zapisuje osobnej flagi przy tokenie — przełącza **cały magazyn**:
  `localStorage.bridge_remember === "1" ? localStorage : sessionStorage`, i w nim lądują ZARÓWNO
  token (`bridge_auth_token`), JAK I `bridge_user` (`fe.js:9000-9013`). Wylogowanie czyści oba
  klucze z **obu** magazynów (`:9015-9021`, `:9098-9107`).
- **Frontend NIGDY nie woła `GET /api/me`** — stan użytkownika jest hydratowany raz, przy starcie,
  z `bridge_user` (`:9080-9084`; grep po bundlu: zero trafień `/api/me`).
- Błąd logowania, który widzi użytkownik, ma postać `401: {"error":"…"}` — `Mg` rzuca wyjątek, zanim
  `gb` sięgnie po pole `error` (`:9031-9038`, `:9085-9097`). To **nie** jest goły komunikat backendu.
- Query: `on401:"returnNull"`, `staleTime:Infinity`, `retry:false`, `refetchOnWindowFocus:false`,
  `refetchInterval:false`. Klucz = `queryKey.join("/")`.
- Po mutacjach stagingu invalidacja: `staging`, `products`, `history`, `alerts`.

> **Odbudowa (I1a, `1-FEATURE-backend-fundament-logowanie`):** strona serwerowa tego
> przepływu już działa — `POST /api/login`/`/api/logout`/`GET /api/me` w `rebuild/backend`
> zwracają dokładnie ten kształt (`{ok,user,token}`), akceptują Bearer i cookie
> `bridge_session` równolegle. **Ważne dla 1b:** backend dopasowuje e-mail **dokładnie**,
> bez `trim()` po swojej stronie — `.trim()` musi zostać po stronie frontendu, tak jak
> tu opisano, inaczej logowanie z białymi znakami się rozjedzie.
>
> **Iteracja 1 zamknięta (I1b, `2-FEATURE-frontend-shell-logowanie`):** `rebuild/frontend/`
> realizuje ten blueprint — widok `/login`, rama aplikacji z ciemnym sidebarem, 12 tras
> (11 placeholderów) i pełne tokeny z produkcyjnego CSS. Odstępstwa od oryginału (m.in. routing
> po ścieżkach zamiast po hashu) — patrz `docs/tickets/2-FEATURE-frontend-shell-logowanie/raport.md`.
>
> **Iteracja 2 zamknięta (I2, `3-FEATURE-katalog-odczyt`):** `/katalog` odbudowany — 12 tras,
> 10 placeholderów. Kluczowy fakt zweryfikowany w kodzie: `GET /api/products` jest wołane
> **bez żadnych parametrów** i zwraca gołą tablicę ~7405 produktów; szukajka (tokeny, AND
> między tokenami / OR po 16 polach, bez debounce), filtry, sortowanie, paginacja
> (25/50/100/Wszystkie) i wirtualizacja (> 150 wierszy) są **w 100% po stronie klienta**
> (`frontend-index.js:23261-23312`). Tabela ma 59 konfigurowalnych kolumn (15 domyślnych,
> zapis w IndexedDB), z `nazwa`/`ean`/`dostawca` zawsze widocznymi i przyklejonymi do lewej;
> nagłówki mają statyczną, przygaszoną ikonę sortowania — bez wskazania aktywnej kolumny/kierunku.
> Oryginał **nie ma** szczegółu produktu w trybie odczytu (tylko modal edycji) — I2 dokładała
> chwilowo podgląd read-only jako odstępstwo D4; **zniesione w 12c** (patrz blok niżej), gdzie
> dialog edycji zastąpił podgląd, tak jak w oryginale. Eksport CSV (backend gotowy
> od I8, `28-FEATURE-selly-eksport-backend`) dowieziony w 8b, a **słowniki marek/kategorii dla
> filtrów tego widoku — w sesji 7c** (`32-FEATURE-katalog-slowniki-atrybutow`, 2026-09-04):
> obie listy to SUMA słownika i danych katalogu, z filtrem „bez cyfr" wyłącznie na gałęzi
> produktowej marek i zwykłym `sort()` dla kategorii (`:23285-23295`). ⚠ Nie mylić z dialogiem
> reguł w `/narzuty`, gdzie kategorie idą WYŁĄCZNIE ze słownika. Szczegóły:
> `docs/tickets/3-FEATURE-katalog-odczyt/` i `docs/tickets/32-FEATURE-katalog-slowniki-atrybutow/`.

> **Odbudowa (3e, 3f-1, 3f-2 — 2026-09-01):** `/staging` i `/konfiguracja` odbudowane; router
> ma **12 tras, 8 placeholderów**. Zakładka **Wgrywanie ręczne** (3f-1) i **Dostawcy** (3f-2)
> wypełnione, cztery pozostałe (spedycja / shoper / katalog / ai) czekały wtedy na Iterację 11 —
> dowiezione 2026-09-03, patrz blok I11 niżej.
> Fakty zweryfikowane w bundlu, których ta specyfikacja nie miała:
>
> - **⭐ Karta dostawcy `ZT()` (`frontend-index.js:25661-25806`) NIE MA żadnej edycji.**
>   Pokazuje odznaki (format, sposób dostarczania, „co X min", status), link do URL-a, licznik
>   produktów oraz dwie akcje: „Synchronizuj" (tylko przy `sposobDostarczania === "url"`)
>   i „Wgraj plik" (przy `upload`/`mail`). Częstotliwość jest **tylko wyświetlana** — i to
>   jest cała przyczyna, dla której powstał `freq-injection.js`. Edycja pól w odbudowie
>   jest więc NASZYM dodatkiem, nie portem.
> - **`POST /api/dostawcy/:kod/synchronizuj-teraz` odpowiada 200 TAKŻE przy niepowodzeniu.**
>   Status siedzi w polu `ok` ciała, nie w kodzie HTTP; oryginalna karta czyta właśnie `t.ok`
>   (`:25727`). Widok, który patrzyłby wyłącznie na kod HTTP, pokazałby awarię jako sukces.
> - **`Konfiguracja` otwiera się na zakładce `dostawcy`** (`defaultValue`, `:26298`).
> - **`liczbaProduktow` na karcie jest liczone w locie z tabeli `products`**, więc po imporcie
>   zostaje zerowe do czasu zatwierdzenia stagingu — nie nadaje się na wskaźnik „ile wczytano".
> - **⚠ Ograniczenie środowiska testowego:** `fetch` z ciałem `FormData` **nie działa
>   w jsdom** — żądanie wisi do timeoutu. Testy wysyłające multipart muszą mieć
>   `@vitest-environment node` (patrz `test/integracja/wgrywanie.integracja.test.ts`).
>   Żądania JSON w jsdom działają normalnie.
>
> Szczegóły bloków: `docs/rebuild-roadmap.md` §5, blok 3f.

> **Odbudowa (4b, `16-FEATURE-widok-narzuty-promocje` — 2026-09-02):** `/narzuty`
> odbudowany — dwie zakładki, „Narzuty" (tabela reguł + symulator ceny krok po kroku) i
> „Promocje" (tabela), pełny CRUD obu zasobów przez React Query (bez optimistic update/
> IndexedDB oryginału — świadome odstępstwo), wspólny dialog z builderem warunków.
> `GET /api/markups` i `GET /api/promotions` zwracają **gołe tablice**, nie koperty; pole
> `warunki` w obu tabelach to **string ze zserializowanym JSON-em**, nie tablica; aktywny
> status to `"aktywny"` przy narzucie i `"aktywna"` (żeński) przy promocji; silnik cen
> **ignoruje** daty `start`/`koniec` promocji — wyłączenie promocji to zmiana `status`, nie
> upływ daty (formularz o tym ostrzega — nota przy polach dat); `PATCH /api/promotions/{id}`
> na nieistniejące id oddaje **200 z pustym ciałem** (bliźniacza trasa narzutu ma 404),
> klient to znosi; każda mutacja narzutu/promocji przelicza ceny CAŁEGO katalogu synchronicznie
> w handlerze. Builder warunków wystawia **9 typów** (oryginał 6; dołożone `konstrukcja`,
> `srednica`, `vfIf`, które silnik rozumie). Etykieta statusu promocji liczona z dat przy
> każdym odczycie (jak oryginał), bez zapisu na serwer, plus widoczny znacznik rozbieżności,
> gdy etykieta nie zgadza się z kolumną `status` z bazy. Ostrzeżenie „poniżej kosztu" przed
> zapisem promocji — pasek na żywo w formularzu + dialog potwierdzenia (oryginał używał
> `window.confirm`). **Kolumna „Promocja" w `/katalog` zostaje MARTWA** — w produkcji
> `_reguly` nie jest ustawiane nigdzie i `GET /api/products` nie niesie danych o promocji;
> to port 1:1, nie brakujące dane do dociągnięcia. Dołożony `Toaster` do drzewa aplikacji
> (`App.tsx`) — pierwszy widok używający toastów; `TooltipProvider` dalej czeka. Szczegóły:
> `docs/tickets/16-FEATURE-widok-narzuty-promocje/`, backend: `docs/tickets/15-FEATURE-narzuty-promocje-ceny/`.
>
> **Odbudowa (I5, `15-FEATURE-historia-zmian`, 2026-09-02):** `/historia` odbudowany — router
> ma **12 tras, 7 placeholderów**. Tabela + filtry (szukaj / typ / dostawca) + paginacja 25/50/100.
> Widok woła **wyłącznie** `GET /api/history/paged` i `GET /api/history/meta`
> (`frontend-index.js:25374-25390`); gołej `GET /api/history` nie woła. To log **zdarzeń**
> (import/eksport/edycja), nie lista zmian cen — podtytuł oryginału to „Log każdego importu,
> eksportu i ręcznej edycji produktu w katalogu" (`:25393`), a kolumna „Szczegóły" pokazuje przy
> edycji tylko nazwy zmienionych pól, bez „przed → po" (te wartości siedzą w `GET /api/history`,
> którego ten ekran nie woła). **Odstępstwo D5:** nasz widok ma stany `isLoading`/`isError`,
> jak `Staging.tsx`; oryginał ich nie ma (`data = {}` domyślnie, więc podczas ładowania i przy
> błędzie renderuje „Brak wpisów w historii."). Szczegóły: `docs/tickets/15-FEATURE-historia-zmian/`.
>
> **Odbudowa (I6, `18-FEATURE-widok-alerty`, 2026-09-03):** `/alerty` odbudowany — router ma
> **12 tras, 5 placeholderów**. Widok stoi na `GET /api/alerts` (bez limitu) i **zwija powtórki**
> w grupy `(dostawca, typ, status)` z licznikiem i czasem ostatniego wystąpienia, bo import
> pisze alert przy każdej nieudanej próbie bez dławika (do 23×/dobę dla jednego dostawcy);
> rozwinięcie grupy pokazuje pojedyncze wpisy. Domyślny filtr `status=nowy`; zmiana statusu
> (pojedyncza i grupowa, w obie strony) idzie przez `PATCH /api/alerts/{id}`, bez IndexedDB/
> localStorage — świadome odejście od oryginału, który dla `/alerty` liczył zupełnie inne dane
> (patrz §4, sprostowanie). Szczegóły: `docs/tickets/18-FEATURE-widok-alerty/`.

> **Odbudowa (I9, `18-FEATURE-waga-gabarytowa`, 2026-09-03):** `/waga-gabarytowa` odbudowany —
> router ma **12 tras, 4 placeholdery**. Ustalenie ticketa: BE i FE liczą **dwa różne wzory**,
> nie ten sam w dwóch miejscach (BE: formuła paletowa/oponowa, patrz `spec-backend.md`; FE:
> waga wolumetryczna kurierska `dł×szer×wys / dzielnik`, dzielnik per przewoźnik — GEIS 10000,
> DPD 6000, GLS 4000, InPost/UPS/DHL 5000 — plus objętość m³ i waga do wyceny
> `max(gabarytowa, rzeczywista)`). Widok liczy **wyłącznie lokalnie, zero wywołań API** (D1).
> Formularz: Długość/Szerokość/Wysokość w cm (domyślnie 60/50/50), opcjonalna Waga rzeczywista,
> select Przewoźnik; pełny edytor przewoźników i dzielników (dodawanie, usuwanie z blokadą
> „min. 1", zmiana nazwy/dzielnika, „Przywróć domyślne"). Stan trwały w IndexedDB przez
> `magazynKV` (cztery klucze `waga-gabarytowa-*`). Mechanizm „waga pamięć" (`waga_pamiec`) to
> osobna, import-side logika bez związku z tym widokiem. Szczegóły:
> `docs/tickets/18-FEATURE-waga-gabarytowa/`.

> **Odbudowa (I11, `18-FEATURE-konfiguracja-config-spedycja`, 2026-09-03):** `/konfiguracja`
> domknięte — ostatnie cztery zakładki (spedycja / shoper / katalog / ai) wypełnione, zaślepki
> i pole `domykaBlok` zniknęły; wszystkie sześć zakładek są dziś wypełnione. Trzy rzeczy, które
> łatwo się domyślić błędnie: **zakładka „spedycja" świadomie NIE jest portem 1:1** (D2) — w
> produkcji `GET/POST /api/spedycja` istnieje, ale UI nigdy go nie woła (dane żyją w
> module-level tablicy i IndexedDB, `frontend-index.js:10381`), odbudowa woła realne
> `GET/POST /api/spedycja`, więc limity są trwałe i wspólne, nie lokalne dla przeglądarki.
> **Zakładka „katalog" nie dotyka `/api/config`** — to „Domyślne kolumny katalogu" w IndexedDB
> (`konfig-domyslne-kolumny`) + „Przywróć fabryczne"; destrukcyjny przycisk „Usuń wszystko
> z katalogu" (`POST /api/products/clear`) zostaje poza zakresem do Iteracji 12 (D3).
> **Edytora `waga_gab.*` nie ma i nie będzie** — w oryginale nie istnieje żaden (0 wystąpień
> w bundlu), mimo że podtytuł ekranu Konfiguracji to sugeruje. Zakładka „shoper" zapisuje
> `shoper.kolumny`/`shoper.separator` (2× `POST /api/config`), kluczy tych nie ma jeszcze
> w `contract/fixtures/GET_config.json` (nikt ich w produkcji nie zapisał). ⚠ **Sprostowanie
> (I8, `28-FEATURE-selly-eksport-backend`, 2026-09-04):** to NIE są te same klucze, które czyta
> backendowa trasa eksportu — `GET /api/export/shoper` czyta `shoper.format_eksportu`
> (domyślnie `ean;nazwa;producent;rozmiar;cena_netto;magazyn;vat`), inny klucz i inna droga niż
> `shoper.kolumny`/`shoper.separator` zapisywane tu przez I11. ⚠ **Sprostowanie (8b,
> `30-FEATURE-selly-panel-frontend`, 2026-09-04):** przycisk „Pobierz CSV (Shoper)" w
> `/katalog` NIE woła `GET /api/export/shoper` — czyta `shoper.kolumny`/`shoper.separator`
> po stronie klienta i buduje CSV z produktów już wczytanych do katalogu (Blob z BOM, kotwica
> `download`), zerowe trafienia na `export-shoper`/`export/shoper` w
> `deminified/frontend-index.js` i w `mirror/frontend/assets/*.js` potwierdzają, że tak samo
> działał oryginał (D2) — eksport jest w 100% kliencki, nie linkuj go do serwerowej trasy.
> Domyślnie działa jednak INNA gałąź niż nazwa sugeruje: stan wybranych kolumn startuje
> z 15 kolumn domyślnych, więc dopiero po odznaczeniu w konfiguratorze WSZYSTKICH kolumn
> włącza się gałąź czytająca `shoper.kolumny`/`shoper.separator` (a przy ich braku wbudowaną
> 13-kolumnową listę). Stąd trzy warianty etykiety: **„Pobierz CSV (15 kol.)"** (domyślnie,
> separator wymuszony na `";"`, `shoper.separator` ignorowany), **„Pobierz CSV (Shoper)"**
> (po odznaczeniu wszystkiego, widok „wszyscy dostawcy") i **„Pobierz CSV dla Shopera"**
> (jw., wybrany konkretny dostawca). Szczegóły:
> `docs/tickets/30-FEATURE-selly-panel-frontend/`.
> Zakładka „ai" zapisuje trzy klucze `ai_fallback.*`
> (3× `POST /api/config`), `aktywny` wyprowadzony z obecności klucza, nie z osobnego pola.
> Szczegóły: `docs/tickets/18-FEATURE-konfiguracja-config-spedycja/`.

> **Odbudowa (10a, `19-FEATURE-analityka-fundament`, 2026-09-03):** `/analityka` odbudowany —
> router ma **12 tras, 3 placeholdery**. Oryginał (`zM`, `frontend-index.js:27804-28640`) ma
> **pięć** zakładek — `dostawcy` „Dostawcy" · `ean` „EAN i ceny" · `ceny` „Ceny w czasie" ·
> `dostepnosc` „Dostępność" · `marza` „Marża i rotacja", domyślna `dostawcy` — **zero wykresów**
> (grep `recharts`/`chart.js`/`d3`/`apexcharts`/`echarts`/`nivo` po `mirror/frontend/assets/*.js`:
> brak trafień; cała wizualizacja to tabela `.slice(0,300)` + pasek postępu z dwóch `<div>`) i
> **brak paska filtrów** (`/api/analytics/filters` jest pobierane, ale renderowane jest wyłącznie
> `f.dostawcy.length` w kaflu KPI). Cztery kafle nagłówka oryginału liczą się z
> `filters.dostawcy.length`, `ean/comparison`, `ean/unique` i `status.snapshots` —
> `GET /api/analytics/kpi` **nie jest wołane przez oryginalny frontend ani razu** (sam backend
> nazywa je „backward-compatible aliases used by previous frontend build").
>
> Odbudowa robi 10a jako **świadomie inny ekran niż oryginał**, decyzją użytkownika 2026-09-03
> (D1–D4, `docs/tickets/19-FEATURE-analityka-fundament/plan.md`): zakładki i etykiety zostają 1:1,
> ale nagłówek KPI (O-10a-1) czyta z `GET /api/analytics/kpi` zamiast czterech aliasów oryginału,
> dochodzi globalny pasek sześciu wyszukiwalnych filtrów działający **po stronie klienta**
> (O-10a-2, `currentWhere()` backendu zostaje martwym kodem — nie jest ożywiana), a zakładka
> „Marża i rotacja" dostaje poziomy wykres słupkowy nad tabelą jako wzorzec dla bloków 10b–10e
> (O-10a-3). Wypełniona jest karta „Marża per dostawca/kategoria/marka" (O-10a-4); pozostałe
> w tym bloku są puste, ale nazwane — wypełniły je kolejne bloki: `ean` w 10c, `dostawcy`
> w 10d, `ceny` w 10b i `dostepnosc` w 10e (patrz niżej). Wzorzec sekcji dashboardu
> jest udokumentowany
> w `rebuild/frontend/src/pages/analityka/README.md`. Trasa jest ładowana **leniwie**
> (`lazy`+`Suspense`) — Recharts trafia do osobnego chunku (~398 kB po 10c i 10d), więc płaci za niego tylko
> wejście na `/analityka`, nie wspólny bundle. Szczegóły: `docs/tickets/19-FEATURE-analityka-fundament/`.
>
> **Dla bloków 10b i 10f:** karty oryginału zakładka po zakładce (tytuły, kolumny,
> etykiety PL, kontrolki, przyciski CSV) plus lista tras bez konsumenta w bundlu —
> `docs/analityka-bloki-10b-10f.md`.
>
> **Odbudowa (10c, `22-FEATURE-analityka-ean`, 2026-09-03):** zakładka „EAN i ceny" wypełniona —
> trzy karty 1:1 z oryginałem („Porównanie cen po EAN", „Pozycje unikalne", „Pokrycie wspólne
> i ranking dostawcy"), zasilane czterema z sześciu nowych tras `/api/analytics/ean*`
> (`comparison`, `unique`, `coverage`, `supplier-rank`); `ean/details` i `ean-porownanie`
> dowiezione jako trasy **bez UI** — oryginał ich też nie woła (D6). Karta „Pokrycie i ranking"
> dostaje dwa wykresy (histogram pokrycia, ranking dostawców po `najtanszyPct`) nad tabelami —
> drugie zastosowanie wzorca z 10a (O-10c-1). Nagłówek KPI **zostaje** na `GET /api/analytics/kpi`
> (D1, odstępstwo O-10a-1 utrzymane) — dane do przepięcia na kafle oryginału
> (`ean/comparison.rows.length`, `ean/unique.rows.length`) są od teraz gotowe, przepięcie czeka
> na decyzję użytkownika. Szczegóły: `docs/tickets/22-FEATURE-analityka-ean/`.
>
> **Odbudowa (10d, `23-FEATURE-analityka-dostawcy`, 2026-09-03):** zakładka `dostawcy` — domyślna
> zakładka `/analityka` — wypełniona trzema kartami 1:1: „1.1 Stabilność cennika dostawcy" (7
> kolumn; dwie gałęzie backendu zwracają różny komplet kolumn, więc część komórek zawsze pokazuje
> „—" — zastane zachowanie oryginału, odtworzone świadomie, D1), „1.2 Nowości i wycofania" (6
> kolumn, data w surowym ISO jak oryginał) i „1.4 / 1.5 Stan i dostępność dostawcy" (5 kolumn,
> „Dostępność" jako pasek postępu przez wspólny `PasekDostepnosci.tsx`, drugim konsumentem będzie
> blok 10e; nad tabelą wykres słupkowy dostępności — odstępstwo O-10d-1, oryginał nie ma żadnych
> wykresów). Filtrowanie klienckie jak w 10a: wiersze tych tras niosą wyłącznie wymiar `dostawca`,
> pozostałe pięć filtrów globalnych są pomijane z widoczną notką. Przyciski „CSV" trzech kart
> (obecne w oryginale) pominięte — trasa `GET /api/analytics/export/{view}` to blok 10f. Trasa
> `GET /api/analytics/dostawcy-stats` odtworzona pod GATE, bez konsumenta w UI (D3, jak w
> oryginale). Szczegóły: `docs/tickets/23-FEATURE-analityka-dostawcy/`.
>
> **Odbudowa (10e, `25-FEATURE-analityka-dostepnosc-rotacja`, 2026-09-04):** zakładka
> `dostepnosc` dostaje trzy karty („Historia dostępności pozycji", „Tempo schodzenia z
> magazynu", „Sezonowy wzorzec cen"), zakładka `marza` dostaje dwie kolejne pod kartą marż z
> 10a („Rotacja / produkty bez aktualizacji", „Cykl życia modelu") — `ZakladkaWPrzygotowaniu`
> zostaje już tylko w zakładce `ceny` (blok 10b). Jedyny filtr serwerowy całej analityki: pole
> „Bez ruchu dni" (`?days` w `rotation/inactive`). Kolejny wykres (O-10e-1, kontynuacja O-10a-3):
> linia „średnia cena zakupu wg miesiąca" nad kartą sezonowości, jedna seria. **Dwie z pięciu
> kart („Historia dostępności pozycji", „Tempo schodzenia z magazynu") pokazują „Brak danych"
> niezależnie od stanu bazy** — port 1:1 zapytania, które w produkcji zawsze zawodzi (brak
> kolumny `nazwa` w `historia_cen`, patrz `spec-backend.md` §2 i `rebuild-backlog.md` #32).
> Szczegóły: `docs/tickets/25-FEATURE-analityka-dostepnosc-rotacja/`.

> **Odbudowa (10b, `24-FEATURE-analityka-ceny`, 2026-09-04):** zakładka `ceny`
> („Ceny w czasie") wypełniona — trzy karty oryginału 1:1: „3.1 Zmiany cen z ostatnich
> importów", „3.2 / 3.3 Historia ceny wybranej opony" (pola EAN/Kod produktu z debounce
> 300 ms — świadome odstępstwo O-10b-1, bo trasa bez LIMIT-u skanuje 15 597 wierszy) i
> „3.6 Inflacja cennika" (dołożony wykres liniowy, O-10b-2, rozszerzenie wzorca O-10a-3).
> Backend dowozi też `market/group-prices` i `top-zmiany`, ale **bez UI** (decyzje D1/D2 —
> zero konsumentów / martwy fetch w oryginale, ten sam wzorzec co `bootstrap-current` w 10a);
> `stats {min,max,avg}` z `product-history` jest pobierane i nierenderowane (D4, jak
> `margins.low`/`high` w 10a). Szczegóły: `docs/tickets/24-FEATURE-analityka-ceny/`.

> **Odbudowa (10f, `26-FEATURE-analityka-export-pulpit`, 2026-09-04) — zamyka Iterację 10.**
> Dwie części. **Export CSV:** przycisk „CSV" doszedł do wszystkich dziesięciu kart
> `/analityka` (pominięty świadomie przez 10a–10e), jako **nawigacja przeglądarki**
> (`window.location.href`, nie `fetch`) na `GET /api/analytics/export/{view}` — cookie sesji
> starcza, bo `SameSite=Lax` przechodzi przy nawigacji GET najwyższego poziomu; adres nie niesie
> żadnych parametrów/filtrów. **Pulpit `/`:** ostatni placeholder Iteracji 10 odtworzony — cztery
> klikalne kafle KPI (ikona, trend, `href`) liczone **lokalnie** z `GET /api/products` i
> `GET /api/staging` (port `Si()`, nie `NaglowekKpi` z 10a — inny layout, inne liczby, D2),
> karta „Najnowsze powiadomienia" (≤5, `poziom ∈ {krytyczny,ostrzezenie}` ∧ `status==="nowy"`,
> sort poziom→data malejąco, karta nieobecna gdy brak alertów) i tabela „Ostatnia aktywność
> dostawców" (9 kolumn) z `GET /api/suppliers`. **Odstępstwo O-10f-1 (D1):** oryginalny Pulpit
> (`N2`, `frontend-index.js:16836-17090`) nie woła ani `/api/analytics/*`, ani `/api/alerts` —
> alerty wyprowadza klientem z `/api/products` przez `pv()`; odbudowa karmi ten sam layout
> realnymi alertami z `GET /api/alerts` (kontynuacja D1 z I6, `docs/rebuild-backlog.md` #26).
> Kafel „Ostatni eksport CSV" jest **trwale martwy** (D3) — szuka `typ==="eksport"` w
> `GET /api/history`, a ten wiersz nie ma pola `typ`. Szczegóły:
> `docs/tickets/26-FEATURE-analityka-export-pulpit/`.

> **Odbudowa (7b, `31-FEATURE-atrybuty-frontend`, 2026-09-04):** `/atrybuty` odbudowany natywnie —
> router ma **12 tras, 1 placeholder** (`/moje-konto`). Produkcyjny ekran ma **trzy warstwy**, nie
> dwie: bazowy React (kafle na lokalnych tablicach, nie na API) + **mostek wbudowany w bundle**
> (`setQueryDefaults`/`setQueryData` na martwych kluczach `/api/attributes(-kinds)`, zasilany
> `fetch("/panel/api/atrybuty")`, plus write-through `Hb`/`Qb`/`Gb` → POST/PUT/DELETE na
> `/atrybuty/wartosci` i `window.__atrybutyAddRodzaj` → POST `/rodzaje`,
> `deminified/frontend-index.js:9960-10268`) + `pending-injection.js`, który chował kafle
> bazowego widoku i renderował własny DOM; licznik użycia i modal „Produkty używające atrybutu"
> są wbudowane w bazowy bundle (`:29404-29469`), nie w injection. Odbudowa zastępuje wszystkie
> trzy warstwy jednym natywnym widokiem pod wspólnym Query key `["/api/atrybuty"]` — bez React
> Fiber i `MutationObserver`: nagłówek + `Nowy rodzaj` · `Dodaj wartość` · `Do akceptacji [badge]`
> → kafle rodzajów (tag `wbudowany`/`własny`, licznik wartości, sekcja „Sieroty w DB") → panel
> wartości (szukajka, CRUD, tabela Wartość/Akcje: Podgląd/Edytuj/Usuń) · panel kolejki (filtr
> rodzaju, szukajka, „Wyświetlono X z Y", dwa przyciski czyszczące, tabela
> Rodzaj/Wartość/Wystąpień/Sugerowane aliasy/Akcje). **Odstępstwo D2:** `window.prompt`/`confirm`
> oryginału zamienione na dialogi Radix z tymi samymi tekstami. **D5:** `PUT`/`DELETE
> /rodzaje/{value}` i `POST /scan-pending` zostają bez konsumenta w UI — nieosiągalne też w
> produkcji (mostek ich nie patchuje / injection chowa przycisk / skan odpala backend sam po
> `POST /api/staging/accept`). **Część B** domyka degradację z 4b: dialog reguł w `/narzuty`
> czyta ten sam słownik (marki = suma słownika i produktów, kategorie = wyłącznie słownik,
> dostawcy = osobne `GET /api/suppliers` po `kod`), zweryfikowane w oryginale
> (`:24203-24313`). Listy marek/kategorii dla filtrów `/katalog` (blok I2 wyżej) domknęła
> **sesja 7c** — INNĄ regułą: tam kategorie sumują słownik z katalogiem, tu idą wyłącznie
> ze słownika. Szczegóły: `docs/tickets/31-FEATURE-atrybuty-frontend/`.

> **Odbudowa (12c, `37-FEATURE-katalog-edycja-produktu`, 2026-09-05):** `/katalog` dostał ZAPIS —
> **odstępstwo D4 z I2 zniesione**, `PodgladProduktu.tsx` usunięty. Ostatnia kolumna tabeli to
> menu „Akcje" (nagłówek zmieniony z „Podgląd"): Edytuj → Historia (`disabled`) → separator →
> Wstrzymaj/Aktywuj (jedna pozycja przełączająca) → Usuń. Dialog edycji (port `LT()`) ma 42 pola
> w kolejności i z etykietami oryginału (bez polskich znaków, np. „Cena sprzedazy",
> „Bieznik/model"); `dostawca` jest widoczne, ale `disabled`, więc nigdy nie trafia do payloadu;
> pole „Bieznik/model" zapisuje jednocześnie `model` i `bieznik`; cztery pola (`rozmiar`,
> `indeksNosnosci`, `indeksPredkosci`, `sezon`) są selectem tylko gdy słownik ma wartości danego
> rodzaju, inaczej input. Zapis to `PATCH /api/products/{id}` z **wyłącznie dotkniętymi polami**
> (pole nadmiarowe zamroziłoby wartość przed kolejnym importem przez `manual_overrides`);
> usunięcie to `DELETE /api/products/{id}`. Dialog czyta `GET /api/overrides?dostawca&kod`,
> pokazuje znacznik override przy polach z poprawką i kasuje je przez `DELETE /api/overrides/{id}`.
> Invalidacje po każdej mutacji: wyłącznie `["/api/products"]` (1:1 z oryginałem) **plus
> `["/api/history"]`** (odstępstwo D2 — oryginalny `Yb()` nie jest API, tylko lokalnym dziennikiem
> w IndexedDB; zastąpiony invalidacją realnego źródła historii z 12a) — świadomie **bez**
> `["/api/alerts"]`/`["/api/analytics"]`, bo oryginał ich też nie unieważnia. **Odstępstwo D1:**
> „Usuń" pyta przez `DialogPotwierdzenia` (Radix) zamiast `window.confirm`, tekst dosłowny
> `Usunąć {kod}?`. **D3:** `szerokosc` portowana 1:1 z wadą oryginału — ręczna edycja gubi zera
> końcowe („10.00" → „10"), mimo że kolumna jest TEXT. Szczegóły:
> `docs/tickets/37-FEATURE-katalog-edycja-produktu/`.

**Design tokens** (`04_DESIGN_TOKENS.md`) — komplet do wiernego wyglądu:
- Fonty: **Inter** (UI), **JetBrains Mono** (kod/EAN).
- Primary `hsl(35 70% 45%)` (bursztyn), sidebar ciemny `hsl(215 28% 12%)`,
  tło `hsl(210 20% 98%)`.
- ⚠️ Źródłem prawdy jest **surowy arkusz produkcji** `mirror/frontend/assets/index-BVOkSOnE.css`,
  nie `04_DESIGN_TOKENS.md` — patrz §7.

## 6. Widoki

12 tras = 12 widoków opisanych w `02_WIDOKI.md` (widok/dane/akcje/API/komponenty) +
tabela zbiorcza w `00_PODSUMOWANIE.md`. Do wiernego UX służą też **17 zrzytów**
z `docs/reference/Instrukcja_obslugi_Bridge.docx` (uwaga: instrukcja to wersja 5,
starsza niż bundle — patrz §4).

Uwaga na arytmetykę: **sidebar ma 10 pozycji nawigacji** (`fe.js:16287-16327`). `/moje-konto`
jest linkiem w stopce sidebara przy avatarze, a `/login` nie występuje w żadnym menu.

## 7. Sprostowania do dokumentacji Perplexity

Dokumentacja pozostaje kanoniczna, ale poniższe punkty są w niej błędne albo niepełne —
zweryfikowane w kodzie oryginału przy Iteracji 1b. Plików w `docs/incoming/` nie ruszamy
(artefakt „jak dostaliśmy"); obowiązuje ta lista.

**A. `04_DESIGN_TOKENS.md` — sześć rozjazdów wartości** względem surowego arkusza
`mirror/frontend/assets/index-BVOkSOnE.css`. **Wygrywa arkusz** (zasada: oryginał > spec):

| Token | Dokumentacja | Produkcyjny CSS |
|---|---|---|
| `--border` (dark) | `215 22% 18%` | `215 20% 18%` |
| `--input` (dark) | `215 22% 20%` | `215 20% 24%` |
| `--secondary` (dark) | `215 22% 17%` | `215 20% 18%` |
| `--muted-foreground` (dark) | `215 16% 62%` | `215 12% 65%` |
| `--accent` / `--accent-foreground` (dark) | `35 45% 17%` / `35 80% 65%` | `35 30% 22%` / `35 80% 80%` |
| `--secondary-foreground` (light) | `215 25% 20%` | `215 25% 14%` |

**B. `04_DESIGN_TOKENS.md:73` „mechanizm zapisu trybu ciemnego NIEZNANY" — rozstrzygnięte:**
oryginał **nie zapisuje** preferencji. Init = `window.matchMedia("(prefers-color-scheme: dark)").matches`,
toggle tylko dodaje/usuwa klasę `dark` na `<html>` (`fe.js:16228-16241`).

**C. `04_DESIGN_TOKENS.md` nie wymienia kompletu tokenów.** Surowy arkusz ma dodatkowo:
`--popover`/`-foreground`/`-border`, `--card-border`, `--sidebar-ring`, `--chart-1..5`,
`--shadow-2xs…-2xl` (wszystkie z alpha 0, czyli faktycznie niewidoczne), `--button-outline`,
`--badge-outline`, `--elevate-1/2`, `--opaque-button-border-intensity`, warianty `--*-border`
liczone przez `hsl(from …)`, `--tracking-normal`, `--font-sans/serif/mono`. Plus utility
`hover-elevate` / `active-elevate-2` / `toggle-elevate`, na których stoją Button i Badge.

**D. Skala zaokrągleń jest STATYCZNA i nie wynika z `--radius`.** Produkcja generuje
`.rounded-sm{.1875rem}`, `.rounded-md{.375rem}`, `.rounded-lg{.5625rem}`, `.rounded-xl{.75rem}`,
a `var(--radius)` nie występuje w żadnej regule arkusza (0 trafień). Domyślna konwencja shadcn
(`lg: var(--radius)`) dałaby złe wartości.

**E. `01_WARSTWA_WSPOLNA.md` podaje nieistniejącą opcję `refetchOnReconnect:false`.** W kodzie
jest `refetchInterval:false` (`fe.js:9063-9079`). Reszta domyślnych opcji Query się zgadza.

**F. `01_WARSTWA_WSPOLNA.md` „zakres ochrony pozostałych tras NIEZNANY" — rozstrzygnięte:**
komponent `cM` (`fe.js:27789-27801`) opakowuje cały `Switch` i przekierowuje na `/login` każdego
bez sesji; wyjątkiem jest sama trasa `/login`.

---

## Do propagacji

- `audit-delta.md`: dopisać — **UI analityki istnieje** (`/analityka`); 12 tras.
- Faza 3 (odbudowa frontendu): punktem wyjścia jest §2 (mapa napraw) + §5 (blueprint)
  + §7 (sprostowania) + `02_WIDOKI.md` + zrzuty. Kontrakt `openapi.yaml` mówi, na jakie API wołać.

*Weryfikacja Krok 2.2 (Faza 2) — 2026-08-17. Krzyżowa kontrola tez Perplexity
z naszym kodem i kontraktem 2.3. Dokumentacja przyjęta jako kanoniczna referencja
frontendu; ten plik to warstwa weryfikacji i mapa napraw.*
