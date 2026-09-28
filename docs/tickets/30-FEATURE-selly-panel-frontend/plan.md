# 30-FEATURE-selly-panel-frontend — Panel Selly `/selly` + przycisk CSV w `/katalog` (I8, sesja 8b)

> Status: Draft → Approved → **Implemented**
> Branch: `feature/30-selly-panel-frontend`
> Worktree: `.worktrees/30-FEATURE-selly-panel-frontend`

## Opis ticketa

Iteracja 8, sesja 8b (FRONTEND). Ania otwiera `/selly` w natywnym panelu Reacta i robi tam
wszystko, co dziś robi przez wstrzykiwany overlay `selly-injection.js`; w `/katalog` działa
przycisk eksportu CSV odłożony z Iteracji 2.

Backend 8a (`28-FEATURE-selly-eksport-backend`) jest zmergowany: 12 tras za `requireAuth`,
GATE zielony (12/12 ścieżek, 5/5 fixtures, 954 testy).

## Kontekst

**Żywy panel to `mirror/frontend/assets/selly-injection.js`** (773 linie, `VERSION =
'v5-csvstatus-genbtn'`), wstrzykiwany z `index.html:19`, aktywowany flagą
`sessionStorage.sellyViewActive`, overlayujący `<main>` Reacta (hash zostaje `#/`, bo router
oryginału zna tylko swoje trasy). Woła **sześć** tras:
`/ping` (:547), `/csv-status` (:570), `/generate-csv` (:604), `/status` (:620),
`/log?limit=10` (:653), `/sync-supplier` (:691).

**`mirror/frontend/selly.html`** (8 587 B, mtime 2026-07-31 08:53) to martwy POPRZEDNIK:
nie ma przycisku „Wygeneruj CSV teraz" ani `generate-csv`, nie jest linkowany z `index.html`
ani z żadnego assetu — dostępny wyłącznie po bezpośrednim URL. `selly-injection.js` ma mtime
09:19 i plik `.bak_pre_genbtn` obok, co potwierdza kolejność. **Odtwarzamy injection.**

Stan odbudowy: `/selly` **nie istnieje nigdzie** — ani w `App.tsx`, ani w `nawigacja.ts`,
ani w `placeholdery.ts`; dziś leci w `NotFound`.

### ⚠ Trzy fakty, w których prompt sesji mijał się ze stanem faktycznym

1. **`categories` i `producers` to POST, nie GET.** Potwierdzone w `contract/openapi.yaml`,
   w oryginale i w `rebuild/backend/src/routes/selly.ts:112,139`. Roadmapa
   (`docs/rebuild-roadmap.md:1034-1035`) podaje to poprawnie jako „5 GET + 5 POST" —
   pomylił się prompt, nie roadmapa. Bez znaczenia dla zakresu (te trasy i tak nie mają UI),
   ale nie wolno tego przepisać do dokumentacji w błędnej postaci.

2. **Sekcja „Mapowanie dostawców" NIE jest tylko statusem.** Tabela ma piątą, bezetykietową
   kolumnę z przyciskiem **„Sync"** per wiersz (`selly-injection.js:637-646`), który wpisuje
   dostawcę do selecta i odpala `doSync(false)` — czyli **PEŁNY, niedry-runowy sync** jednym
   kliknięciem. To najgroźniejszy przycisk w panelu.

3. **⭐ Przycisk CSV w katalogu domyślnie NIE jest w trybie „Shoper".**
   `S` (wybrane kolumny) inicjalizuje się jako `new Set(Nn)` — 15 kolumn domyślnych
   (`frontend-index.js:23272`, hook `_T()` :23039) — i jest podmieniane tym, co leży
   w IndexedDB. `S.size === 0` zachodzi **wyłącznie**, gdy Ania odznaczy w konfiguratorze
   WSZYSTKIE kolumny. Konsekwencja: domyślna ścieżka eksportu to gałąź `S.size > 0` —
   kolumny użytkownika, separator wymuszony na `";"`, plik `katalog_wszyscy_wybrane_<data>.csv`,
   etykieta **„Pobierz CSV (15 kol.)"**. Nazwa „Pobierz CSV (Shoper)", lista `TT` oraz klucze
   `shoper.kolumny`/`shoper.separator` są osiągalne dopiero po odznaczeniu wszystkich kolumn.
   Prompt sesji (i pośrednio roadmapa) opisywał gałąź Shoperową jako główną — jest odwrotnie.
   **Implementujemy obie 1:1**, ale dokumentacja musi to prostować, żeby następna sesja nie
   szukała „zepsutego" przycisku.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ticket jest **czysto frontendowy** — nie zmienia backendu ani kontraktu. Konsumuje kształty:

| Ścieżka | Fixture | Rola w 8b |
|---|---|---|
| `GET /api/selly/ping` | `GET_selly_ping.json` | karta „Status połączenia" |
| `GET /api/selly/csv-status` | `GET_selly_csv-status.json` | karta „Codzienna synchronizacja CSV" |
| `GET /api/selly/status` | `GET_selly_status.json` | tabela „Mapowanie dostawców" + **lista dostawców do selecta (D5)** |
| `GET /api/selly/log?limit=10` | `GET_selly_log.json` | tabela „Historia operacji" |
| `POST /api/selly/generate-csv` | — (brak fixtura zapisu) | przycisk „Wygeneruj CSV teraz" |
| `POST /api/selly/sync-supplier` | — (brak fixtura zapisu) | „Test dry-run" / „Wyślij do Selly" / „Sync" per wiersz |
| `GET /api/config` | `GET_config.json` | `shoper.kolumny` / `shoper.separator` (obu kluczy w fixturze NIE MA → fallbacki) |
| `GET /api/products`, `GET /api/suppliers` | `GET_products.json`, `GET_suppliers.json` | dane do przycisku CSV (już wczytane przez `/katalog`) |

**Poza zakresem GATE:** `GET_selly_dictionaries.json` — trasa `dictionaries` nie ma konsumenta
w żywym panelu i decyzją D1 nie dostaje UI. `POST /api/selly/{categories,producers,sync-product}`
— jw. `GET /api/export-shoper` i `GET /api/export/shoper` — decyzją D2 zostają bez konsumenta,
tak jak w produkcji.

**Rozjazd odnotowany:** `_przyciete` w `GET_selly_status.json` to adnotacja nagrywarki, nie pole
API — mocki MSW nie mogą go przepuszczać do typu `StatusSelly` (pułapka (a) z bloku 10a).

## Decisions

Wszystkie z rundy Q&A z użytkownikiem (2026-09-04).

- **D1 — Trasy bez konsumenta: odtwarzamy 1:1.** Panel dostaje **pięć sekcji i sześć tras**,
  dokładnie jak `selly-injection.js`. `dictionaries`, `producers`, `categories`, `sync-product`
  zostają bez UI (w produkcji używano ich z konsoli). *Za:* zero odstępstw, najmniejsze ryzyko;
  Ania nie dostaje ścieżek zapisu do cudzego sklepu, których dziś nie ma. *Przeciw:* cztery
  trasy 8a pozostają bez konsumenta — to stan zgodny z produkcją, nie dług.

- **D2 — Przycisk CSV w katalogu: wiernie po stronie klienta.** Bez fetcha, bez nawigacji na
  serwerowe trasy eksportu. Potwierdzone grepem: ani `deminified/frontend-index.js`, ani
  `mirror/frontend/assets/*.js`, ani `mirror/frontend/*.html` nie wołają `export-shoper`
  /`export/shoper` (0 trafień). *Za:* 1:1 z produkcją, zachowuje wybór kolumn z I2.
  *Przeciw:* serwerowe trasy z 8a zostają bez konsumenta — świadomie, jak w oryginale.

- **D3 — Potwierdzenie przed wysyłką do Selly: DODAJEMY (świadome odstępstwo).**
  `POST /api/selly/sync-supplier` z `dry_run: false` realnie tworzy i modyfikuje produkty
  w cudzym, żywym sklepie. Dialog obejmuje **oba** wejścia: „Wyślij do Selly" ORAZ przycisk
  „Sync" w wierszu tabeli mapowania. „Test dry-run (5 szt.)" leci bez pytania (nic nie zapisuje).
  *Uzasadnienie:* wzorzec jest już w panelu — oryginał ma `confirm()` przed `generate-csv`
  (`selly-injection.js:599`), więc rozszerzamy istniejącą konwencję, a nie wnosimy obcą.
  *Koszt:* jedno kliknięcie więcej przy operacji, którą Ania robi rzadko i świadomie.

- **D4 — Brak konfiguracji Selly: rozpoznajemy i pokazujemy „Selly nieskonfigurowane"
  (świadome odstępstwo, kosmetyczne).** Sześć tras zewnętrznych bez sekretów `SELLY_*` oddaje
  500 z `[Selly] Brak konfiguracji: …` — zachowanie 1:1 z produkcją, NIE błąd do naprawienia.
  Panel wykrywa ten konkretny komunikat i pokazuje czytelny stan; **każdy inny błąd leci
  surowo**, jak w oryginale (`JSON.stringify`). *Za:* Ania na środowisku bez sekretów nie widzi
  gołego 500. *Przeciw:* rozpoznawanie po treści komunikatu jest kruche — dlatego dopasowanie
  jest luźne (prefiks `[Selly] Brak konfiguracji`) i ma test.

- **D5 — Lista dostawców w „Sync dostawcy": dynamicznie z `GET /api/selly/status`
  (świadome odstępstwo).** Oryginał ma zahardkodowane `['MO1'…'MO10']`
  (`selly-injection.js:499`). Panel i tak woła `/status` do tabeli mapowania, więc lista bierze
  się z `items[].dostawca` — **bez dodatkowego żądania**. *Za:* lista zawsze zgodna z realnym
  stanem, nowy dostawca się pojawia. *Przeciw:* gdy `/status` padnie, select jest pusty —
  obsłużone: pusty/nieudany `/status` → select wyłączony z komunikatem „Brak dostawców",
  a oba przyciski sync nieaktywne (rozstrzygnięcie brzegowe podjęte w planie, nie w Q&A).
  Sortowanie MO1…MO10 numeryczne, tak jak zakładki katalogu (`Katalog.tsx:131-138`).

- **D6 — `mirror/frontend/selly.html` zostaje nietknięty, ustalenie idzie do dokumentacji.**
  `mirror/` jest wiernym lustrem produkcji — nie kasujemy z niego plików, bo na produkcji ten
  plik nadal jest dostępny pod bezpośrednim URL. Wniosek („martwy poprzednik, żywy jest
  injection") trafia do roadmapy i `docs/spec-frontend.md`, żeby kolejna sesja nie ustalała
  tego drugi raz.

- **D7 — Ikona „Selly" w sidebarze: najbliższa ikona `lucide-react`.** Oryginał wstrzykuje
  własne SVG „karton" (`selly-injection.js:262-270`); odbudowa używa wszędzie lucide.
  `Package` jest już zajęty przez „Katalog", więc bierzemy **`PackageOpen`** (najbliższy
  kształt kartonu wśród wolnych). *Za:* jeden system ikon, spójna grubość linii.
  *Przeciw:* wygląd bliski, nie identyczny.

### Odstępstwa od oryginału — zbiorczo

| # | Odstępstwo | Podstawa |
|---|---|---|
| D3 | Potwierdzenie przed pełnym syncem (2 wejścia) | decyzja użytkownika |
| D4 | „Selly nieskonfigurowane" zamiast surowego 500 | decyzja użytkownika |
| D5 | Lista dostawców z `/status` zamiast `MO1–MO10` | decyzja użytkownika |
| D7 | Ikona lucide zamiast wklejonego SVG | decyzja użytkownika |
| O1 | `/selly` jako trasa Wouter + pozycja sidebara zamiast overlaya i flagi w `sessionStorage` | zakres iteracji (roadmapa §5 I8) |

## Implementation plan

Kolejność = kolejność commitów.

### Krok 1 — Klient API panelu (`src/pages/selly/api.ts`)
Typy z fixtures **dosłownie**: `PingSelly`, `StatusCsv`, `WierszStatusuDostawcy`
(`{dostawca, w_bridge, w_selly, z_bledami}`), `WpisLogu` (12 pól z `GET_selly_log.json`),
`WynikGenerowaniaCsv`, `WynikSynchronizacji`. Funkcje `pobierzPing`, `pobierzStatusCsv`,
`pobierzStatusDostawcow`, `pobierzLog`, `wygenerujCsv`, `synchronizujDostawce`.
Wzorzec: `pages/alerty/api.ts` (własny `fetch` + `rzucGdyBlad`, nie domyślny `queryFn`,
bo panel musi odróżnić 500 od braku danych).
Tu też helper **`czyBrakKonfiguracjiSelly(blad)`** (D4) — dopasowanie prefiksu
`[Selly] Brak konfiguracji`.

### Krok 2 — Formatowanie (`src/pages/selly/formatowanie.ts`)
Port 1:1 z injection: rozmiar `${rozmiar_mb} MB`, `wiersze.toLocaleString("pl-PL")`,
mtime `toLocaleString("pl-PL")` + „(N min temu)" z `wiek_minut`, data logu
`(rozpoczeto||"").slice(0,19).replace("T"," ")`, mapowanie `status` → wariant badge
(`success`→ok, `error`→err, reszta→warn).

### Krok 3 — Pięć sekcji panelu (`src/pages/selly/Sekcja*.tsx`) + `src/pages/Selly.tsx`
`SekcjaPolaczenie`, `SekcjaCsv`, `SekcjaMapowanie`, `SekcjaSync`, `SekcjaLog` — etykiety,
teksty pomocnicze i kolumny tabel przepisane dosłownie z `selly-injection.js:405-492`
(m.in. „Plik CSV generowany codziennie o 6:00…", „Licznik »W Selly« oparty o tabelę
selly_products…", „Ostatnie 10 operacji z tabeli selly_sync_log.", „Limit (0=wszystko)",
„tylko zmienione od ostatniego syncu", „Brak wpisów — jeszcze nie było żadnej operacji.").
Kropka statusu → `Badge`/kropka w trzech stanach (ok / błąd / ładowanie).
Dialog potwierdzenia (D3) na `components/ui/dialog.tsx`.
Odświeżanie: po `sync-supplier` unieważniamy `/status` i `/log` (injection woła `loadStatus()`
+ `loadLog()`, `:737-738`); po `generate-csv` — `/csv-status` (`:613`).

### Krok 4 — Routing i nawigacja
`App.tsx`: `<Route path="/selly" component={Selly} />` (statycznie, nie `lazy` — panel nie
wnosi ciężkich zależności). `nawigacja.ts`: 11. pozycja `{href:"/selly", label:"Selly",
icon: PackageOpen}` na końcu listy (injection wstawia link **za** „Konfiguracja",
`selly-injection.js:255-280`). **Aktualizacja komentarzy liczbowych** w `placeholdery.ts`
(12 → 13 tras) i `nawigacja.ts` (10 → 11 pozycji) wraz z uzasadnieniem różnicy wobec
oryginału (tam Selly nie było trasą Reacta w ogóle).

### Krok 5 — Eksport CSV katalogu (`src/pages/katalog/eksport.ts`)
Czyste funkcje, testowalne bez DOM:
- `escapujCsv(v)` — port `Qy`: cudzysłów tylko gdy `/[",;\n]/`, podwojenie `"`.
- `zbudujCsv(produkty, kolumny, separator)` — port `OT` (`:23052`): nagłówek z `label`,
  `\n` jako łącznik wierszy, przypadki specjalne `szerokosc` (reużyć **istniejącej**
  `formatujSzerokosc` z `katalog/formatowanie.tsx`), `stan === -1 → 0`, `kodDostawcy`
  (zdjęcie prefiksu `<dostawca>_` z pola `kod`), `ean` (tylko cyfry), `konstrukcja`
  (R→„Radialna", D/L/B→„Diagonalna"), `tlTt` (TL→„TL (bezdętkowa)", TT→„TT (dętkowa)"),
  `pr` (`${n}PR`), `sb|sf|hf|ls` (`Tak`/``), `true`→„Tak", `false`→``.
- `KOLUMNY_SHOPER` — port `TT` (`:22706-22731`), **13 par** w kolejności: `kodDostawcy:kod_dostawcy`,
  `nazwa:nazwa`, `marka:marka`, `kategoria:kategoria`, `dostawca:dostawca`, `stan:stan`,
  `cenaZakupu:cena_zakupu`, `cenaSprzedazy:cena_sprzedazy`, `marzaPct:marza_pct`, `vat:vat`,
  `ean:ean`, `status:status`, `linkZdjecia:link_zdjecia`.
- `parsujKolumnyShoper(tekst)` — linie `klucz:naglowek`, filtr `includes(":")`,
  `label` = wszystko po PIERWSZYM dwukropku (`n.join(":")`).
- `pobierzPlik(nazwa, tresc)` — port `IT` (`:23089`): Blob z BOM `﻿`,
  `text/csv;charset=utf-8`, `<a download>`, `revokeObjectURL` po 1 s.

### Krok 6 — Przycisk w `/katalog`
W `Katalog.tsx`, obok `KonfiguratorKolumn`, przycisk `data-testid="button-export-katalog"`
(ten sam testid co oryginał). Logika 1:1 z `:23384-23422`:
odsiew `!(!cz || cz===0 || !cs || cs===0)` na `Number(cenaZakupu)`/`Number(cenaSprzedazy)`
w obrębie **wybranej zakładki dostawcy**; pusty wynik → toast destructive „Brak produktów
do eksportu" z opisem „Katalog jest pusty" / „Dostawca {kod} nie ma produktów";
kolumny: `S.size===0 ? (shoper.kolumny ?? TT) : KOLUMNY.filter(k => S.has(k.key))`;
separator: `S.size===0 ? (shoper.separator || ";") : ";"`;
nazwa: `shoper_{d}_{data}.csv` / `katalog_{d}_wybrane_{data}.csv`, `d = "wszyscy"|kod`,
`data = new Date().toISOString().slice(0,10)`;
etykieta w trzech wariantach; toast sukcesu „Eksport gotowy" z opisem zależnym od gałęzi.
`GET /api/config` czytane defensywnie (`useQuery` na `KLUCZ_KONFIGURACJI`, brak klucza → fallback).

**Historii NIE zapisujemy.** `Xb()` (`:10305`) to wyłącznie optymistyczny
`queryClient.setQueryData(["/api/history"])`, bez żądania do serwera; odbudowa świadomie nie ma
tego kanału (decyzja D3 bloku 10f, `26-FEATURE-analityka-export-pulpit`, pilnowana przez
`test/pulpit.kpi.test.ts`). Nie wynajdujemy nowego.

### Krok 7 — Testy (szczegóły w „Testing strategy")

## Testing strategy

Wszystko w `rebuild/frontend/test/`, własne pliki (konwencja (e) z bloku 10a — bloki idą
równolegle, wspólne pliki testowe to konflikt przy merge'u).

**`selly.gate.test.tsx` — GATE 8b.** Handlery MSW budowane **z fixtures przez helpery
w `test/msw/kontrakt.ts`** (`pingSellyZFixtura()`, `statusCsvZFixtura()`,
`statusDostawcowZFixtura()`, `logSellyZFixtura()` — nowe funkcje obok istniejących), nie
z wyobraźni. Asercje: widok renderuje wartości POCHODZĄCE z fixtures (`6898` produktów,
`2.38 MB`, `MO1`/`634`, `sync_supplier`), a tablice w mockach są **niepuste** (pułapka (b)
z 10a — pusta odpowiedź przechodzi porównanie kształtu bez dowodu). Odsiewamy `_przyciete`.

**`selly.test.tsx` — zachowanie panelu.** Pięć sekcji, teksty etykiet; „Odśwież" per sekcja;
dry-run vs pełny sync (ciało POST: `{dostawca, dry_run, limit: dryRun?5:limit, only_updated}`);
**dialog potwierdzenia D3** blokuje pełny sync do potwierdzenia i NIE pojawia się przy dry-runie;
przycisk „Sync" w wierszu tabeli też przechodzi przez dialog; select dostawców zasilony
z `/status` (D5) i wyłączony przy pustym `/status`; link „Pobierz / podgląd CSV ↗" to `<a href>`
z `csv-status.url` i `target="_blank"` — **nie fetch**.

**`selly.brak-konfiguracji.test.tsx` — ścieżka 500 (D4).** MSW oddaje 500 z ciałem
`[Selly] Brak konfiguracji: SELLY_SHOP_URL / SELLY_CLIENT_ID / SELLY_CLIENT_SECRET`;
panel pokazuje „Selly nieskonfigurowane". Kontrtest: 500 z innym komunikatem → surowy błąd.

**`katalog.eksport.test.ts` — format CSV (czyste funkcje, bez DOM).**
Separator z konfiguracji przy pustym wyborze; **wymuszony `";"` przy wyborze niepustym**;
fallback na `TT`, gdy `shoper.kolumny` nie ma w configu (a w `GET_config.json` faktycznie
go nie ma); parsowanie `klucz:naglowek` z dwukropkiem w etykiecie; odsiew cen zerowych
(i osobno: `null`/`undefined`/`"0"`); escaping `"`/`;`/`,`/`\n`; BOM; `\n` a nie `\r\n`;
przypadki specjalne kolumn (`stan=-1→0`, `kodDostawcy` z prefiksem i bez, `ean` z myślnikami,
`pr`, `konstrukcja`, `tlTt`, boolean); obie nazwy plików; **trzy warianty etykiety przycisku**.
Produkty brane z `produktyZFixtura()`.

**`katalog.test.tsx` — dopięcie przycisku.** Toast „Brak produktów do eksportu" (destructive,
oba warianty opisu), toast „Eksport gotowy", `pobierzPlik` zamockowany na poziomie
`URL.createObjectURL`/`a.click`.

**Uwaga o MSW (wyjątek (e) z 10a):** `onUnhandledRequest: "error"`, a `/katalog` i `/selly`
pobierają komplet swoich tras przy każdym wejściu — handlery nowych ścieżek trzeba dodać
także tam, gdzie testy montują te widoki.

**Bramki:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
w `rebuild/frontend/` — wszystkie czyste. `npm run test:integracja` uruchamiane osobno.

## Out of scope

- Jakiekolwiek zmiany w `rebuild/backend/` — 8a jest zamknięta.
- UI dla `dictionaries`, `producers`, `categories`, `sync-product` (D1).
- Konsument dla `GET /api/export-shoper` i `GET /api/export/shoper` (D2) — zostają bez
  wywołania we froncie, jak w produkcji.
- Podpinanie sandboxa Selly / konfiguracja sekretów `SELLY_*` na środowisku.
- Backlog #12 (`products.zastosowanie`, `__restoreZastosowanie`) — decyzja podtrzymana w 8a (D3).
- Ożywianie kafla „Ostatni eksport CSV" na Pulpicie i lokalnej historii `Xb()` — świadomie
  martwe od 10f.
- Usuwanie `mirror/frontend/selly.html` (D6).

## Definition of done

- [ ] `/selly` działa natywnie i pokrywa zakres żywego `selly-injection.js`: pięć sekcji,
      sześć tras, etykiety i teksty 1:1.
- [ ] Sidebar ma pozycję „Selly" (11 pozycji), router ma trasę `/selly` (13 tras).
- [ ] Komentarze o liczbie tras (`placeholdery.ts`) i pozycji (`nawigacja.ts`) zaktualizowane
      wraz z uzasadnieniem różnicy wobec oryginału.
- [ ] Przycisk eksportu CSV w `/katalog` działa we wszystkich trzech wariantach etykiety,
      z poprawnym separatorem, kolumnami, fallbackiem `TT` i nazwą pliku.
- [ ] GATE: widok konsumuje kształty zgodne z czterema fixture'ami (`_ping`, `_csv-status`,
      `_status`, `_log`); mocki zbudowane Z FIXTURES; tablice w odpowiedziach niepuste.
- [ ] Test ścieżki 500 „Brak konfiguracji" (D4) + kontrtest innego błędu.
- [ ] Testy potwierdzenia przed pełnym syncem (D3), z obu wejść.
- [ ] `lint` / `typecheck` / `build` / `test` czyste w `rebuild/frontend/`.
- [ ] Roadmapa: blok 8 zamknięty w całości (8a ✅ + 8b ✅), DoD rozliczone, parytet
      z `selly-injection.js` odnotowany **faktyczną** wielkością pliku (30 936 B, nie 26 KB).
- [ ] Sprostowania z sekcji „Trzy fakty" zapisane w roadmapie/spec, nie tylko w tym planie.
