# 30-FEATURE-selly-panel-frontend — raport z implementacji

## Podsumowanie

Panel Selly działa natywnie pod `/selly` i pokrywa zakres żywego
`mirror/frontend/assets/selly-injection.js` (30 936 B, `VERSION='v5-csvstatus-genbtn'`):
pięć sekcji, sześć tras API, teksty i kolumny przepisane dosłownie. W `/katalog` działa
przycisk eksportu CSV odłożony z Iteracji 2 — w 100% kliencki, jak w oryginale. Sidebar ma
11 pozycji, router 13 tras, komentarze liczbowe zaktualizowane wraz z uzasadnieniem różnicy
wobec produkcji. Backendu nie ruszano.

## Zmiany

**Panel Selly (nowe):**
- `src/pages/Selly.tsx` — widok, cztery zapytania, dwie mutacje, dialog potwierdzenia (D3).
- `src/pages/selly/api.ts` — klient sześciu tras + typy z pięciu fixtures + `czyBrakKonfiguracjiSelly`.
- `src/pages/selly/formatowanie.ts` — port formatowania rozmiaru, liczb, dat, wariantów odznak, sortowania MO1…MO10.
- `src/pages/selly/Wskaznik.tsx` — kropka statusu (`.dot`/`.err`/`.load`) + nagłówek karty.
- `src/pages/selly/BladSekcji.tsx` — rozdzielenie „Selly nieskonfigurowane" (D4) od surowego błędu.
- `src/pages/selly/SekcjaPolaczenie.tsx`, `SekcjaCsv.tsx`, `SekcjaMapowanie.tsx`, `SekcjaSync.tsx`, `SekcjaLog.tsx` — pięć kart oryginału.

**Eksport katalogu (nowe):**
- `src/pages/katalog/eksport.ts` — `escapujCsv` (`Qy`), `zbudujCsv` (`OT`), `wartoscKomorki`, `KOLUMNY_SHOPER` (`TT`, 13 par), `parsujKolumnyShoper`, `odsiejDoEksportu`, `dataDoNazwyPliku`, `pobierzPlik` (`IT`).

**Zmienione:**
- `src/pages/Katalog.tsx` — przycisk `button-export-katalog`, handler eksportu, odczyt `/api/config`, trzy warianty etykiety; nagłówek pliku prostuje zakres (eksport już nie jest „poza zakresem").
- `src/App.tsx` — trasa `/selly`.
- `src/components/nawigacja.ts` — 11. pozycja „Selly" (`PackageOpen`), za „Konfiguracją"; komentarz 10→11 pozycji z uzasadnieniem.
- `src/pages/placeholdery.ts` — komentarz 12→13 tras z uzasadnieniem (oryginał ma 12; `/selly` to odstępstwo O1).

**Testy:**
- **Nowe:** `test/selly.gate.test.tsx`, `test/selly.test.tsx`, `test/selly.brak-konfiguracji.test.tsx`, `test/katalog.eksport.test.ts`, `test/katalog.eksport-przycisk.test.tsx`.
- `test/msw/kontrakt.ts` — cztery loadery fixtures Selly (`pingSellyZFixtura`, `statusCsvZFixtura`, `statusDostawcowZFixtura`, `logSellyZFixtura`).
- `test/shell.test.tsx` — 10→11 pozycji + nowy test pozycji „Selly"; nagłówek pliku zaktualizowany.
- `test/katalog.test.tsx` — handler `/api/config` (widok pobiera komplet tras przy każdym wejściu, `onUnhandledRequest:"error"` nie wybacza braków).

## Odstępstwa od planu

Brak co do zakresu. Trzy rozstrzygnięcia szczegółowe podjęte w trakcie, wszystkie w duchu planu:

1. **Test pozycji sidebara przeniesiony do `shell.test.tsx`.** Plan zakładał asercję w GATE 8b,
   ale `AppShell` jest wpinany przez WIDOK, nie przez router — sidebar renderują tylko
   `Pulpit`, `Konfiguracja` i placeholdery. `/selly` (jak `/katalog`, `/alerty`, `/analityka`)
   go nie renderuje, więc asercja mieszka tam, gdzie startuje się na `/`. Przy okazji wyszło,
   że `shell.test.tsx` i tak wymagał aktualizacji z 10 na 11 pozycji.
2. **`KolumnaEksportu` zamiast `DefinicjaKolumny`** w warstwie eksportu — CSV nie ma szerokości
   ani wyrównania, a szerszy typ zmuszałby kolumny z konfiguracji i z `TT` do wymyślania
   `width: 0`. `KOLUMNY.filter(...)` pasuje strukturalnie, więc nic nie trzeba konwertować.
3. **Przechwytywanie eksportu w teście widoku na granicy modułu** (`vi.mock` na `pobierzPlik`),
   a nie przez podmianę `Blob`/`URL.createObjectURL` — jsdom nie ma pełnego API plikowego,
   a prawdziwe `anchor.click()` z `href="blob:"` powodowało hałaśliwe
   „Not implemented: navigation". BOM, typ MIME i kotwica `download` mają własny test
   jednostkowy tam, gdzie faktycznie powstają.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Widok konsumuje kształty czterech nagrań:
  `GET_selly_ping.json`, `GET_selly_csv-status.json`, `GET_selly_status.json`,
  `GET_selly_log.json` — odpowiedzi MSW budowane Z FIXTURES przez loadery w
  `test/msw/kontrakt.ts`. Asercje na konkretnych wartościach z nagrań (`6 898` wierszy,
  `2.38 MB`, `MO1`/`634`, `sync_supplier`, data `2026-07-06 07:43:36`) oraz osobny test
  wymuszający, że nagrania są NIEPUSTE (pułapka (b) z bloku 10a). `_przyciete` odsiane
  w loaderze i asertowane, że nie przecieka do widoku.
  **Piąte nagranie, `GET_selly_dictionaries.json`, jest świadomie poza GATE** — trasa
  `dictionaries` nie ma konsumenta w żywym panelu (decyzja D1), więc loader bez wywołania
  byłby martwym kodem udającym pokrycie.
  Ticket **nie dotyka backendu ani kontraktu** — nie zmieniono żadnego pliku w
  `rebuild/backend/` ani `contract/`.
- **Unit: ✓ 572/572** (40 plików, `npm test`) — po poprawkach z review. Nowe w tym tickecie:
  11 GATE + 14 zachowania panelu + 5 braku konfiguracji + 25 formatu CSV + 12 przycisku
  eksportu = 67 testów, plus jeden dołożony do `shell.test.tsx`.
- **Lint: ✓** `eslint .` czysty.
- **Typecheck: ✓** trzy projekty TS czyste.
- **Build: ✓** wspólny chunk 514,52 kB (gzip 156,65), `Analityka` 444,15 kB (gzip 127,34).
  Panel Selly nie wnosi ciężkich zależności, więc idzie do wspólnego chunku bez `lazy`.
- **Integracja:** nie uruchamiana — `test:integracja` dotyczy ścieżek backendowych,
  a ten ticket ich nie rusza.

## Breaking changes

Brak. Jedyna zmiana zachowania istniejącego ekranu to **dodanie** przycisku eksportu
w `/katalog` (funkcja odłożona z I2, nie modyfikacja istniejącej).

## Ustalenia faktograficzne do przeniesienia do dokumentacji

Trzy rzeczy, w których prompt sesji rozmijał się ze stanem faktycznym — **wszystkie
zweryfikowane w kodzie**, żadna nie jest decyzją do podjęcia:

1. **`POST`, nie `GET`, dla `categories` i `producers`** (`contract/openapi.yaml`,
   `rebuild/backend/src/routes/selly.ts:112,139`). Roadmapa podaje to poprawnie
   („5 GET + 5 POST") — mylił się prompt.
2. **„Mapowanie dostawców" ma przycisk „Sync" per wiersz**
   (`selly-injection.js:637-646`), w oryginale odpalający PEŁNY sync jednym kliknięciem,
   bez pytania. Prompt opisywał tę sekcję jako sam status z odświeżaniem.
3. **⭐ Przycisk CSV w katalogu domyślnie NIE jest w trybie Shoper.** `S` inicjalizuje się
   jako `new Set(Nn)` — 15 kolumn domyślnych (`frontend-index.js:23272`, hook `_T()` :23039),
   podmienianych zawartością IndexedDB. Warunek `S.size === 0` zachodzi WYŁĄCZNIE po
   odznaczeniu wszystkich kolumn w konfiguratorze. Domyślna ścieżka to więc gałąź „wybrane
   kolumny": separator wymuszony `";"`, plik `katalog_wszyscy_wybrane_<data>.csv`, etykieta
   **„Pobierz CSV (15 kol.)"**. Format Shoper (`TT`, `shoper.kolumny`, `shoper.separator`)
   jest osiągalny dopiero po odznaczeniu wszystkiego. Obie gałęzie odtworzone 1:1 i zamrożone
   testami, ale roadmapa i `docs/spec-frontend.md` opisują to odwrotnie i wymagają korekty.

Dodatkowo: **`selly.html` to martwy poprzednik** (mtime 2026-07-31 08:53, brak
`generate-csv`, nielinkowany z niczego; injection ma mtime 09:19 i plik `.bak_pre_genbtn`
obok). Żywy jest `selly-injection.js`. Plik zostaje w `mirror/` nietknięty (D6).

## Follow-up

- **Cztery trasy 8a bez konsumenta** (`dictionaries`, `producers`, `categories`,
  `sync-product`) — świadomie bez UI (D1). Jeśli kiedyś mają je dostać, `dictionaries` ma
  gotowy fixture, a `producers`/`categories`/`sync-product` są POST-ami.
- **Dwie serwerowe trasy eksportu** (`GET /api/export-shoper`, `GET /api/export/shoper`)
  nadal bez konsumenta we froncie — zgodnie z produkcją (D2). Uwaga przy ewentualnym
  podpięciu: mają RÓŻNE parametry filtrujące (`?dostawca=` vs `?supplier=`), a
  `export-shoper` bez parametru oddaje ZIP, nie CSV.
- **`AppShell` jest wpinany przez widok, nie przez router** — przez co `/katalog`, `/alerty`,
  `/analityka`, `/staging`, `/narzuty`, `/historia`, `/waga-gabarytowa` i teraz `/selly`
  renderują się BEZ sidebara, a `/`, `/konfiguracja` i placeholdery z nim. To zastane
  zachowanie, spoza zakresu tego ticketa, ale wygląda na niezamierzone — warte osobnej
  decyzji.
- **Backlog #12** (`products.zastosowanie`, `__restoreZastosowanie`) — bez zmian, decyzja
  podtrzymana w 8a (D3).


## Review fixes applied

Review (`review.md`) zwrócił **1 BLOCKER / 4 SHOULD-FIX / 5 NICE-TO-HAVE**. Wszystkie
zweryfikowałem samodzielnie w `mirror/frontend/assets/selly-injection.js` przed poprawieniem —
cztery uwagi merytoryczne okazały się trafne i wskazywały na **ciche odstępstwa od oryginału,
których plan nie przewidywał** (a więc dokładnie to, czego reguła 1:1 zabrania).

### Poprawione — wierność portu

1. **`SekcjaPolaczenie.tsx`** — oryginał (`:553-559`) renderuje jedną linię:
   `✓ Połączono · <shop> · token wygasa za <N>s · <vat_probe>`. Mój port pokazywał listę
   czterech pól, gubił „✓ Połączono" i **dokładał `token_prefix`, którego oryginał NIE
   pokazuje**. Przywrócone 1:1; `token_prefix` usunięty z widoku — to fragment tokenu
   dostępowego, więc jego wystawianie było odstępstwem w złą stronę. Test pilnuje obu rzeczy.

2. **`SekcjaCsv.tsx`** — trzy zgubione elementy (`:580-588`):
   - zdanie podsumowania nad tabelą (`✓ Synchronizacja OK — plik wygenerowany dzisiaj` /
     `✗ Błąd synchronizacji — <powod || "plik nieaktualny lub pusty">`),
   - komórka „Status" to **odznaka `OK`/`BŁĄD`**, nie surowe pole `status` z API,
   - wiek pliku kolorowany flagą `wygenerowany_dzisiaj` (zielono/bursztynowo).
   Przy okazji `formatujOstatniaSynchronizacje` rozbite na `formatujDateSynchronizacji` —
   wiek musi być osobnym elementem DOM, żeby dało się go kolorować. Testy pokrywają obie
   gałęzie (`status: "ok"` i nieaktualny plik).

3. **`Selly.tsx` — `onSettled` → `onSuccess`** dla `sync-supplier`. Oryginalny `doSync` przy
   `!r.ok` wypisuje błąd i robi `return` (`:705-710`), więc `loadStatus()`/`loadLog()` (`:737-738`)
   **nie wykonują się po błędzie**. `onSettled` przeładowywał listy także po nieudanym syncu,
   sugerując, że coś się jednak stało. Test pilnuje, że po 500 liczniki pobrań nie rosną.

4. **Trzeci wariant etykiety eksportu bez testu** — dodany. Przy okazji wyszło, że fixtures są
   celowo rozjechane (`GET_products.json` ma wyłącznie MO9, `GET_suppliers.json` — MO1…MO10),
   więc każda zakładka dostawcy jest pusta; dało to darmowe pokrycie **drugiego wariantu
   toastu** („Dostawca <kod> nie ma produktów"), którego też brakowało.

### Poprawione — NICE-TO-HAVE

5. **`Selly.tsx`** — klik „Sync" w wierszu tabeli mapowania przestawia teraz także `<select>`
   w sekcji „Sync dostawcy", jak oryginał (`:643`). Kolejne ciche odstępstwo, choć nieszkodliwe.
6. **`formatowanie.ts`** — `wariantStatusuOperacji` zwracał `"ladowanie"` dla zakończonego wpisu
   w logu. Rozdzielone: `WariantOperacji` (`sukces`/`blad`/`inny`) osobno od `StanWskaznika`.
7. Komentarz „14 pól" → **12 pól** (policzone) w `api.ts` i `plan.md`.
8. `plan.md` — status `Draft` → `Implemented`.
9. Liczby testów w tym raporcie sprostowane (było „9 GATE… = 62 testy").

### BLOCKER — dokumentacja

Review słusznie wskazał, że DoD ticketa wymaga aktualizacji `docs/rebuild-roadmap.md`
i `docs/spec-frontend.md`, a diff ich nie dotykał. Zrobione w fazie „Docs updates" niżej —
to normalny etap tego przepływu, wykonywany po review, nie przeoczenie.

### Nie poprawione świadomie

Brak. Wszystkie uwagi z review zostały albo naprawione, albo (w przypadku BLOCKER-a)
zrealizowane w fazie dokumentacji.
