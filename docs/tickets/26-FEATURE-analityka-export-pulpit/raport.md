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
