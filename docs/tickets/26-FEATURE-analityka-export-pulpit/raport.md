# 26-FEATURE-analityka-export-pulpit — raport z implementacji

## Podsumowanie

Blok 10f zamyka Iterację 10. Backend dostał 27. i ostatnią trasę modułu analityki —
`GET /api/analytics/export/{view}` z dziesięcioma widokami CSV, każdym portowanym z jego
WŁASNEGO zapytania (nie z danych dashboardu). Front dostał przyciski „CSV" w dziesięciu
kartach `/analityka`, pomijanych świadomie przez bloki 10a–10e, oraz odtworzony Pulpit `/` —
ostatni placeholder Iteracji 10. Autoryzacja eksportu samym cookie'em `bridge_session`
(bez nagłówka `Authorization`, bo w oryginale to nawigacja przeglądarki) jest dowiedziona
testem integracyjnym na prawdziwym serwerze.

## Zmiany

### Backend

- **Nowy:** `rebuild/backend/src/analityka/csv.ts` — port `toCsv`/`csvEscape`
  (`analytics_module.cjs:56-57`): separator średnik, BOM, podwajane cudzysłowy, nagłówek
  z kluczy pierwszego wiersza, pusty wynik = sam BOM.
- **Nowy:** `rebuild/backend/src/repos/analityka-eksport.ts` — dziesięć zapytań eksportu
  + mapa `WIDOKI_EKSPORTU`. Osobny plik, bo `repos/analityka.ts` ma ~1300 linii i jest
  wspólnym punktem merge'u pięciu bloków.
- `rebuild/backend/src/repos/analityka.ts` — wyeksportowany `bezpiecznieWiersze` (port
  `safeAll`) + nota, że korzysta z niego też 10f. Jedyna zmiana w tym pliku.
- `rebuild/backend/src/routes/analytics.ts` — trasa `GET /api/analytics/export/:view`;
  nagłówek pliku zaktualizowany z 26/27 na 27/27 tras.
- `rebuild/backend/test/gate/asercje.ts` — **nowa** `sprawdzZgodnoscZKontraktemNieJson()`.
- **Nowe testy:** `analityka.csv.test.ts` (13), `analityka.eksport.agregaty.test.ts` (13),
  `analityka.eksport.gate.test.ts` (10).

### Frontend

- **Nowy:** `src/pages/analityka/eksport.tsx` — `adresEksportu()` (port `M()`) + `PrzyciskCsv`.
- Dziesięć sekcji `/analityka` — przycisk „CSV" w nagłówku karty. Cztery przez istniejący slot
  `obok` w `NaglowekSekcji`; trzy sekcje dostawców dostały układ „tytuł–akcje" w swoim
  nagłówku inline; `SekcjaEan.NaglowekKarty` i `SekcjaCeny.KartaCen` dostały prop `obok`.
  Zdezaktualizowane komentarze „CZEGO TU CELOWO NIE MA: przycisku CSV" zastąpione opisem
  tego, co eksport realnie zwraca (inny SQL, dwa puste pliki).
- **Nowe:** `src/pages/Pulpit.tsx`, `src/pages/pulpit/{api.ts,kpi.ts,czas.ts,KafelKpi.tsx}`.
- `src/App.tsx` — trasa `/` → `Pulpit`; `src/pages/placeholdery.ts` — zdjęty wpis `/`
  (zostają `/atrybuty` i `/moje-konto`; liczba tras routera nadal 12).
- `test/msw/kontrakt.ts` — loader `dziennikZmianZFixtura()` (`GET_history.json`).
- **Nowy:** `test/msw/pulpit.ts` — `handleryPulpitu()` dla testów, które renderują `<App/>`
  pod `/`, a pulpitu nie dotyczą.
- **Nowe testy:** `pulpit.kpi.test.ts` (17), `pulpit.test.tsx` (15),
  `analityka.eksport.test.tsx` (9).
- `test/shell.test.tsx`, `test/logowanie.test.tsx` — dopisane `handleryPulpitu()`
  (patrz „Odstępstwa"). `test/analityka.ean.test.tsx` — zaktualizowany test, który zamrażał
  BRAK przycisków CSV.

## Odstępstwa od planu

Plan przewidywał trzy rzeczy, które wyszły inaczej — wszystkie na korzyść wierności:

1. **`Pulpit` renderuje `AppShell`.** Plan tego nie zapisał, bo konwencja w `rebuild/` jest
   niejednolita. Oryginał (`N2`) zwraca `mn(…)`, czyli ramę z sidebarem, i tak samo robił
   `WidokWPrzygotowaniu`, który stał pod `/` do tej pory. Bez tego `/` straciłoby nawigację.
2. **Trzy testy poza zakresem bloku wymagały zmiany**, bo `/` przestało być placeholderem:
   `shell.test.tsx` i `logowanie.test.tsx` renderują `<App/>` pod `/`, a Pulpit pobiera pięć
   tras — przy `onUnhandledRequest: "error"` bez handlerów każdy taki test padał. Zamiast
   kopiować pięć handlerów do dwóch plików powstał wspólny `test/msw/pulpit.ts`.
   `analityka.ean.test.tsx` miał asercję „NIE ma przycisków CSV — trasa eksportu należy do
   bloku 10f"; 10f ją unieważnił, więc test sprawdza teraz, że przyciski są przy kartach
   „2.1-2.4" i „2.5", a NIE ma ich przy „2.6".
3. **`sformatujWzglednie` powstał jako nowy port, nie reużycie.** Plan kazał sprawdzić, czy
   nie jest tym samym co `sformatujOstatnia()` z `pages/alerty/grupowanie.ts` (I6) — nie jest:
   tamta ma dwa progi, ta sześć i pochodzi z innego miejsca oryginału (`Bu()`, `:16747`).
   Różnica jest w produkcji widoczna, więc obie zostają.

Poza tym plan zrealizowany 1:1, łącznie z czterema decyzjami użytkownika (D1–D4).

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne.
  - `GET /api/analytics/export/{view}` — **fixture nie istnieje i istnieć nie może** (nagrywarka
    zapisywała wyłącznie JSON, `contract/README.md`; trasa oddaje `text/csv`). Kontrakt
    (`openapi.yaml:178-188`) sprawdzony: ścieżka istnieje, status 200 zadeklarowany. Ponieważ
    kontrakt nie deklaruje dla tej ścieżki żadnego `content`, `text/csv` go nie narusza —
    weryfikacja idzie przez `sprawdzZgodnoscZKontraktemNieJson()` plus jawne asercje
    `content-type: text/csv; charset=utf-8` i `content-disposition`. Wspólna maszyneria GATE
    (`test/gate/kontrakt.ts`) **nie została zmieniona** — bloki 1–10e działają jak działały.
  - Kształt odpowiedzi niosą testy jednostkowe: `analityka.csv.test.ts` (format pliku)
    i `analityka.eksport.agregaty.test.ts` (komplet kolumn każdego z dziesięciu widoków).
    To zadeklarowana luka siatki, nie obejście gate'a.
  - Trasy konsumowane przez Pulpit (`/api/history`, `/api/alerts`, `/api/products`,
    `/api/staging`, `/api/suppliers`) mają zielony GATE od I2/3b/I5/I6 i nie były zmieniane —
    przeszły jako regresja w pełnym przebiegu.
- **Backend:** ✓ 847 testów w 54 plikach. `lint`, `typecheck`, `build` czyste.
- **Frontend:** ✓ 504 testy w 35 plikach. `lint`, `typecheck`, `build` czyste.
- **Charakteryzacja usterek produkcji (zamrożone):** `export/availability-products`
  i `export/sell-through` oddają sam BOM mimo zasianej `historia_cen` (backlog #32) — sprawdzone
  i na poziomie repo, i przez HTTP. Kafel „Ostatni eksport CSV" pokazuje „—" mimo niepustego
  `/api/history` (decyzja D3).
- **Autoryzacja eksportu przez cookie:** ✓ dowiedziona testem integracyjnym —
  `POST /api/login` → wyjęcie `Set-Cookie` → `GET /api/analytics/export/margins` z samym
  nagłówkiem `Cookie`, **bez** `Authorization` → 200 `text/csv`. Sprawdzone też atrybuty
  cookie (`HttpOnly`, `Path=/`, `SameSite=Lax` — `Lax` wysyła cookie przy nawigacji GET
  najwyższego poziomu, czyli dokładnie przy `window.location.href`) oraz to, że podrobione
  cookie daje 401. Staging jest same-origin (`docs/deploy-setup.md`), więc nie wchodzi w grę
  nawet kwestia cross-site.

## Breaking changes

Brak zmian w kontrakcie API. Dwie zmiany zachowania widoczne dla użytkownika, obie zamierzone:

- trasa `/` przestała być placeholderem i pokazuje Pulpit;
- w dziesięciu kartach `/analityka` pojawił się przycisk „CSV".

## Follow-up

1. **Nowy wpis do `docs/rebuild-backlog.md`: kafel „Ostatni eksport CSV" jest trwale martwy.**
   Oryginał szuka `typ === "eksport"` w odpowiedzi `GET /api/history`, a ta trasa oddaje tabelę
   `history`, której wiersz nie ma pola `typ` (pole to niesie `GET /api/history/paged` z
   `audit_log`). Odtworzone 1:1 (D3); naprawa = decyzja Ani.
2. **`Content-Disposition` bierze `req.params.view` bez sanityzacji** (port 1:1 z `:308`).
   Node odrzuca wartości nagłówka ze znakiem sterującym, więc `{view}` z `\n` kończy jako 500,
   a nie jako wstrzyknięcie — ale nazwa pliku nadal przyjmuje dowolny „legalny" napis.
   Do backlogu jako obserwacja, nie naprawiane bez decyzji.
3. **Niejednolite renderowanie `AppShell` w widokach** (zastane, POZA zakresem 10f).
   Ramę renderują tylko `Pulpit`, `Konfiguracja` i `WidokWPrzygotowaniu`; `Katalog`, `Staging`,
   `Historia`, `Narzuty`, `Alerty`, `WagaGabarytowa` i `Analityka` zwracają samą treść.
   Warto sprawdzić, czy to zamierzone — jeśli nie, sidebar znika na siedmiu ekranach.
4. **Backlog #33 (`sell-through`: okno po niepełnym `GROUP BY`)** dotyczy także widoku
   eksportu, nie tylko dashboardu — dziś zamaskowany przez #32, odsłoni się przy jego naprawie.
5. **Przepięcie kafli `NaglowekKpi` na dane z 10c** (odstępstwo O-10a-1) — nadal otwarte,
   nie w zakresie tego bloku.

---

## Review

`docs/tickets/26-FEATURE-analityka-export-pulpit/review.md` — **1 BLOCKER, 0 SHOULD-FIX,
2 NICE-TO-HAVE**.

Zakres merytoryczny został zweryfikowany linia po linii wobec oryginału i uznany za zgodny
co do joty: dziesięć zapytań eksportu (kolumny, aliasy, `GROUP BY`/`HAVING`/`ORDER BY`
i LIMIT dokładnie tam, gdzie ma go oryginał — 6/10), format CSV, zachowanie dla nieznanego
`{view}` (200 + BOM, nie 404), autoryzacja przez samo cookie, Pulpit wobec `N2`, mapowanie
dziesięciu przycisków CSV. Testy uznane za rzeczowe — zasiew w `analityka.eksport.agregaty.test.ts`
realnie gwarantuje niepuste wyniki tam, gdzie test twierdzi, że sprawdza kształt wiersza.
Wszystkie cztery bramki potwierdzone niezależnie po obu stronach.

**BLOCKER** dotyczył wyłącznie pominiętego Kroku 8 planu — nieruszonej dokumentacji projektu
(roadmapa nadal pokazywała Iterację 10 jako `🔨` / „Zostaje 10f"). **Domknięty w Fazie 5**,
patrz niżej. Oba **NICE-TO-HAVE** (brak sanityzacji `filename`, niejednolity `AppShell`) też
sprowadzały się do braku wpisów w backlogu — dziś są to wpisy **#35** i **#36**.

Nie było poprawek kodu po review.

## Docs updates

Cztery równoległe doc-checkery, osiem plików.

### `docs/rebuild-roadmap.md`
- §4: Iteracja 10 `🔨` → **✅**, dopisany `10f: 26-FEATURE-analityka-export-pulpit · 2026-09-04`,
  usunięte „Zostaje 10f".
- §5: nagłówek Iteracji 10 `🔨` → **✅ zrobione**, wypisane wszystkie sześć bloków z datami.
- **Blok 10f przepisany od zera** — sześć akapitów „WEJŚCIE Z BLOKU 10a/10b/10c/10d/10e"
  (czas przyszły, zapowiedź) zastąpione opisem stanu faktycznie dowiezionego.
- **Sprostowane dwa błędy roadmapy:** (1) uogólnienie „LIMIT 5000" na wszystkie widoki
  eksportu — dotyczy tylko 6/10, z listą i namiarem na `analytics_module.cjs:311-320`;
  (2) teza, że Pulpit reużywa `useKpi()`/`useStatusHistorii()`/`NaglowekKpi` — oryginał
  (`frontend-index.js:16836-17090`) nie woła ŻADNEJ trasy `/api/analytics/*`.
- Dopisane fakty: nieznany `{view}` → 200 + sam BOM; autoryzacja na samym cookie; decyzje
  D1 (O-10f-1) i D3; doprecyzowane, dlaczego `export/{view}` i `bootstrap-current` nie mają
  fixtura (z różnych powodów — CSV vs metoda zapisująca).
- Tematy otwarte przeniesione do sekcji „Otwarte, BEZ przypisania do przyszłego bloku"
  (Iteracja 10 była ostatnią analityki): O-10a-1, backlog #26, #32, #33.

### `docs/rebuild-backlog.md`
- **#26** — decyzja utrzymana po raz drugi (10f): pseudo-alerty `pv()` porzucone teraz na
  DWÓCH ekranach, nie jednym.
- **#32** — dopisane, że 10f odtworzył oba widoki eksportu oddające sam BOM; zamrożone dwoma
  testami. Status nadal ⬜.
- **#33** — dopisane, że dotyczy także `export/sell-through`, dziś zamaskowanego przez #32.
- **#34 (nowy)** — kafel „Ostatni eksport CSV" trwale martwy (`GET /api/history` bez pola `typ`).
- **#35 (nowy)** — `Content-Disposition` bierze `{view}` bez sanityzacji.
- **#36 (nowy)** — niejednolite renderowanie `AppShell`; **potwierdzone grepem**, że siedem
  widoków (`Katalog`, `Staging`, `Historia`, `Narzuty`, `Alerty`, `WagaGabarytowa`, `Analityka`)
  faktycznie nie renderuje sidebara, bo `App.tsx` nie ma wspólnego layoutu.

### `docs/analityka-bloki-10b-10f.md`
- Nagłówek: 26/27 → **27/27**, Iteracja 10 zamknięta.
- §8 oznaczone ✅ i przepisane na opis stanu; **usunięty zdublowany akapit** o dwóch pustych
  widokach eksportu (był wklejony dwa razy).
- §8.1 — sprostowany LIMIT; dopisane 200+BOM, dowód cookie testem integracyjnym, wyjaśnienie
  braku fixtura i `sprawdzZgodnoscZKontraktemNieJson()`.
- §8.2 — **przepisany od zera**, obalona teza o reużyciu hooków analityki i `pobierzAlerty()`;
  dopisane decyzje D1, D2, D3.
- §9 — inwentarz do reużycia poszerzony o `PrzyciskCsv`/`adresEksportu()`, `naCsv`,
  `KafelKpi`, `sformatujWzglednie`, `handleryPulpitu()`, `sprawdzZgodnoscZKontraktemNieJson()`.
- §10 — nowy punkt kontrolny: sprawdź, czy trasa oddaje JSON, zanim użyjesz wspólnej asercji GATE.

### `rebuild/frontend/src/pages/analityka/README.md`
- Nagłówek „obowiązuje bloki 10c–10e" → Iteracja 10 zamknięta (10a–10f).
- Nowa sekcja „Co ustalił blok 10f": przycisk CSV w dziesięciu kartach, trzy sposoby wpięcia,
  **dlaczego to musi być `window.location.href`, a nie `fetch`**, ostrzeżenie, że eksport nie
  odzwierciedla tabeli, i dwa puste widoki (#32).
- §4 — dopisane odstępstwo **O-10f-1**.

### `docs/spec-backend.md`
- Dopisany blok „Potwierdzone w 10f": `export/{view}` jako 27/27, jedyna trasa z parametrem
  ścieżki, **jedyna trasa całego backendu, która nie oddaje JSON-a**, nagłówki, podział LIMIT-u,
  200+BOM, odziedziczona usterka `historia_cen.nazwa`.

### `docs/spec-frontend.md`
- §3: `/` dopisane do widoków odbudowanych (9 → 10), placeholdery 3 → 2 (`/atrybuty`, `/moje-konto`).
- Nowy blok o obu połówkach 10f — eksport CSV (nawigacja, bez parametrów, na cookie) i Pulpit
  (cztery kafle lokalne, karta powiadomień, tabela dostawców), z O-10f-1 i martwym kaflem.

### `CLAUDE.md`
- Akapit o `safeAll()` i backlogu #32 rozszerzony o jedno zdanie: ta sama pułapka ma też postać
  PLIKU — pusty CSV (sam BOM) mimo danych w bazie. „Nie ufaj też pustemu plikowi eksportu."

### `rebuild/backend/README.md`
- Sekcja GATE — poprawione nieprawdziwe już twierdzenie, że odpowiedzi sprawdzane przez GATE są
  zawsze JSON-em; nazwany wyjątek i nowy pomocnik.

### Pre-existing issues (zgłoszone, NIE naprawiane — poza zakresem 10f)
- **`rebuild/backend/README.md` — sekcje „Stan:" i drzewo struktury `src/` są zamrożone na
  Iteracji 3b.** Nie wspominają narzutów/promocji (4a/4b), historii (I5), alertów (I6), wagi
  gabarytowej (I9), konfiguracji (I11) ani **całego modułu analityki** (10a–10f) — dziś
  największego w backendzie. Doc-checker świadomie nie łatał tam samego 10f, bo dopisanie dwóch
  plików do drzewa zamrożonego osiem iteracji wcześniej pogłębiłoby rozjazd, zamiast go zmniejszyć.
  Wymaga osobnego przejścia.
- `docs/analityka-bloki-10b-10f.md` nie ma osobnych sekcji dla bloków 10d i 10e (tylko wzmianki) —
  luka sprzed tego ticketu.
