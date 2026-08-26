# 6-FEATURE-silnik-tk-dopasowanie-klasyfikator — Code review

> Reviewed: 2026-08-26
> Branch: `feature/6-silnik-tk-dopasowanie-klasyfikator`
> Diff: 46 plików, 5 commitów (`fc26ead`…`988896d`), +20340/-92

## BLOCKER

- [ ] `docs/spec-backend.md:112` — reguła EAN „auto-zmieniany tylko dla długości 8/12/13/14…” NIE została sprostowana, mimo że raport i plan.md (D4) twierdzą wprost, że to martwy kod i „oba dokumenty prostujemy”.
  - Reason: Definicja ukończenia (plan.md) wymaga jawnie: „`docs/spec-backend.md` §5 sprostowana w punkcie reguły EAN (D4)”. `git diff origin/develop...HEAD -- docs/spec-backend.md` jest pusty — plik w ogóle nie był dotykany w tej gałęzi. Raport w sekcji U3 pisze „Nie zaimplementowana. Oba dokumenty do sprostowania” i w „Follow-up” pkt 4 odsyła to na później, co wprost zaprzecza zdaniu z sekcji D4 „oba dokumenty prostujemy” — ślad dokumentacyjny jest niespójny, a efektywnie zadanie nie zostało wykonane. Kolejna sesja czytająca spec-backend.md trafi na regułę, która w produkcji nigdy się nie wykonuje.
  - Suggestion: dopisać do §5 adnotację, że reguła jest w martwym kodzie i nie wchodzi do portu (z odnośnikiem do D4/backlog #11), albo usunąć zdanie.
- [ ] `docs/rebuild-roadmap.md` (blok 3c, §5) — roadmapa NIE opisuje zamknięcia bloku 3c: brak daty, brak numeru PR, status iteracji 3 (linia ok. 152, 310) nadal pokazuje tylko „3a ✅ … · 3b ✅ …” bez wpisu 3c.
  - Reason: to złamanie zasady stałej projektu (`CLAUDE.md`, „Roadmapa jest wejściem dla następnej sesji”) i jawnego punktu Definition of Done w plan.md: „Roadmapa zaktualizowana wg §3: blok 3c zamknięty (stan, nie zamiar)”. `git diff origin/develop...HEAD -- docs/rebuild-roadmap.md` jest pusty. Sesja 3d, która ma czytać ten plik jako jedyne źródło stanu, nie dowie się, że 3c jest zamknięte, jaki jest numer PR ani czy gate przeszedł — dokładnie ten scenariusz, przed którym ostrzega CLAUDE.md.
  - Suggestion: dopisać wpis zamknięcia bloku 3c (data, PR, rozliczenie gate'u) analogicznie do 3a/3b, zanim ticket pójdzie do 3d.

## SHOULD-FIX

- [ ] `rebuild/backend/src/repos/staging.ts:183-201` — deduplikacja w `zapiszPozycjeStagingu` robi jeden `SELECT` na każdą pozycję z bufora wewnątrz pojedynczej transakcji (N zapytań zamiast jednego zbiorczego sprawdzenia). Przy większych importach (setki pozycji, tak jak w charakteryzacji MO5: 1989 katalog / kilkadziesiąt do zapisu) to nadal małe N, ale przy realnych plikach dostawców rzędu tysięcy wierszy warto mieć to na radarze — oryginał (`U.addStaging`, :44923) robi dokładnie to samo per-wiersz, więc port jest wierny, ale nie ma to nic wspólnego z wydajnością SQLite przy większym woluminie. Nie blokuje (wierność > optymalizacja), ale warto odnotować dla 3d/I12, gdy `POST /api/staging/import` zacznie przyjmować duże bufory z ciała żądania.
- [ ] `rebuild/backend/test/charakteryzacja/silnik/` — ok. 5,0 MB danych wzorca zacommitowanych na stałe (raport szacował 4,9 MB). Uzasadnienie w raporcie (projekcja kolumn zweryfikowana maszynowo, podwójne uruchomienie oryginału) jest przekonujące i nie proszę o redukcję — ale warto rozważyć w przyszłości `git lfs` albo kompresję JSON-ów (`*.katalog.json`, `*.expected.json`), gdy kolejne sesje (3d, wycofania, overrides) dołożą własne wzorce i suma urośnie.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/repos/products.ts:92-110` (`aktualizujProdukt`) — dwa dodatkowe `SELECT` (przed i po `UPDATE`) tam, gdzie patch nie rusza cen (np. wyłącznie `{ nieobecnoscPodRzad: 0 }` w zakresie 3c) moglibyśmy pominąć pierwszy `SELECT`, bo warunek `"cenaSprzedazy" in patch || "cenaZakupu" in patch` już go filtruje — to już jest zoptymalizowane poprawnie, tylko końcowy `SELECT` po `UPDATE` (linia 109) wykonuje się zawsze, nawet gdy wołający nie potrzebuje zwróconego wiersza (w `tk.ts` wynik `aktualizujProdukt` jest ignorowany). Kosmetyczna oszczędność, nie wpływa na poprawność.
- [ ] `rebuild/backend/test/charakteryzacja/silnik/oryginal.mjs:142-165` — `zaladujOryginal` używa `new Function` na ~20 kB wyciętego kodu; dobrze, że testy charakteryzacyjne (silnik.charakteryzacja.test.ts) go NIE wołają per test (korzystają z nagranego wzorca), tylko `silnik.gate.test.ts` robi to raz na test HTTP — obecny narzut jest znikomy (cały pakiet 286 testów w ok. 27 s), ale warto to świadomie utrzymać przy dokładaniu kolejnych scenariuszy gate'u w 3d, żeby nie rozrosło się w wolny support.

## Plan compliance

### Done ✓
- Harness oryginału (`oryginal.mjs`, `atrapy.mjs`, `integralnosc.json`) wycina ŻYWY `tk =
  function` (nie martwą `function tk`) po kotwicach tekstowych, ze strażnikiem sha256 i
  jednoznacznością kotwic — zweryfikowane w kodzie.
- Nagrany wzorzec (kroki 1-2) pochodzi z uruchomionego oryginału, nie z portu — `oryginal.mjs`
  jest niezależny od `src/import/`, a `wzorzec.mjs`/`scenariusze.mjs` też nie importują portu.
- Funkcje pomocnicze (`ean.ts`, `rozmiar.ts`, `klasyfikator.ts`, `pozycja.ts`,
  `identyfikator.ts`, `overrides.ts`) porównane linia po linii z oryginałem
  (`deminified/backend-index.cjs:46940-47355`) — port wierny, łącznie z niesymetrycznymi
  warunkami `Xq`/`Vq`, kolejnością składników `ostrzezenie` i odtworzonym błędem cieniowania
  `Lq` (D3).
- `src/import/tk.ts` — kolejność wykonania, mapy dopasowania, łańcuch identyfikatora, klasyfikacja
  `nowa`/`blad`/`zmiana_kluczowa`, konflikt EAN, reset `nieobecnoscPodRzad`, kasowanie nie-opony —
  zweryfikowane linia po linii wobec `:47584-47851`. Auto-zatwierdzanie (D5) i pętla wycofań
  poprawnie pozostawione jako jawnie oznaczone gałęzie 3d.
- `zapiszPozycjeStagingu` (D8) — dedup po `(kod, typZmiany, COALESCE(powod,''))` w transakcji,
  zgodny z `U.addStaging` (:44923); `doStagingu` liczy bufor, nie zapisy (:47849).
- `katalogDoImportu`/`aktualizujProdukt`/`usunProdukt` — wierny port `U.listProducts`
  (filtrowany w SQL zamiast w JS, bez zmiany zachowania), `U.updateProduct` (efekt uboczny ceny 0),
  `U.deleteProduct`.
- `PustyImportBlad` (D7) — bezpiecznik przeniesiony do `tk()`, trasa tłumaczy wyłącznie ten
  wyjątek na 400 i przepuszcza inne błędy dalej (`instanceof` + `throw e`), niczego nie połyka.
- Gate treści (`silnik.gate.test.ts`) — realny import HTTP przez prawdziwy parser MO1, katalog
  skonstruowany tak, żeby trafić w każdą gałąź, porównanie POLE PO POLU z oryginałem uruchomionym
  na TYM SAMYM katalogu odczytanym z tej samej bazy.
- Zmiany w `test/import.test.ts` — uzasadnione i NIE naginają testu pod kod: liczby wyprowadzane
  z liczników kontraktu HTTP, z komentarzem odwołującym się do konkretnego wzorca charakteryzacji
  (`MO8.expected.json`) i potwierdzeniem zachowania oryginału (dedup MO2: 200 w buforze / 198
  zapisów).
- `docs/rebuild-backlog.md` — wpis #11 (błąd cieniowania `Lq`, D3) kompletny: opis biznesowy,
  mechanizm, ocena ryzyka, propozycja naprawy, adnotacja co zrobiła odbudowa.
- Bramki: `lint`, `typecheck`, `build`, `test` (286/286, 20 plików) — zweryfikowane uruchomieniem
  w tym review, zgodne z raportem.

### Missing or deviating ✗
- `docs/spec-backend.md` §5 nie sprostowana (D4) — patrz BLOCKER.
- `docs/rebuild-roadmap.md` blok 3c nie zamknięty — patrz BLOCKER.
- Reszta zakresu (Implementation plan kroki 1-6) zrealizowana zgodnie z opisem; „Out of scope”
  (auto-zatwierdzanie efekty, historia_cen, wycofania, realne overrides, `bridge_ext.cjs`,
  `assignKodImportu`, endpointy mutacji stagingu, frontend, `szerokosc` REAL→TEXT) — nic z tego
  nie wsiąkło do diffu, sprawdzone grepem po odpowiednich symbolach w `src/`.

### Definition of done
- [x] Silnik odtwarza dopasowanie i klasyfikację 1:1 z żywym `tk()` (:47584)
- [x] Charakteryzacja przeciw uruchomionemu oryginałowi zielona na realnych cennikach MO1–MO10
- [x] Strażnik sha256 wyciętych fragmentów mirrora działa i jest opisany
- [x] Gate treści zielony — 10 scenariuszy, porównanie pole po polu
- [x] `GET_staging.json` i `GET_staging_paged.json` dalej zielone
- [x] Charakteryzacja 3a (1838 rekordów, sha256) dalej zielona
- [x] GATE I2 (`katalog.gate.test.ts`) zielony bez zmian w samym teście
- [x] `lint` / `typecheck` / `build` / `test` czyste
- [x] Strategia portu i sposób budowy wzorca opisane w raporcie wraz z uzasadnieniem
- [x] Błąd cieniowania `Lq` (D3) zgłoszony do `docs/rebuild-backlog.md`
- [ ] `docs/spec-backend.md` §5 sprostowana w punkcie reguły EAN (D4) — plik nietknięty w diffie
- [ ] Roadmapa zaktualizowana wg §3: blok 3c zamknięty — plik nietknięty w diffie

## Parallel-test concerns

None — wszystkie testy używają `stworzTestowaBaze()`/`stworzSrodowiskoTestowe()` (baza w katalogu
tymczasowym, porty efemeryczne), zgodnie z konwencją repo. `test/silnik.charakteryzacja.test.ts`
i `test/silnik.gate.test.ts` tworzą osobną bazę per `it()` z `afterEach` sprzątającym — brak
współdzielonego stanu między testami ani między równoległymi agentami.

## Overall assessment

Implementacja jest bardzo staranna i rzeczywiście wierna: przeszedłem `tk.ts` oraz wszystkie
moduły `silnik/*.ts` linia po linii wobec żywego oryginału i nie znalazłem ani jednej pominiętej
gałęzi, przestawionego warunku ani rozjazdu `??`/`||`. Metodyka dowodu (uruchomiony oryginał
wycięty z realnego bundla, dwuwarstwowa charakteryzacja — cenniki + scenariusze celowane, gate
HTTP porównujący z tym samym katalogiem) jest solidniejsza niż wymagałby tego sam ticket, a
odtworzenie błędu cieniowania `Lq` (D3) jest przykładowo udokumentowane i zgłoszone do decyzji.
Jedyny realny problem to niedowieziona część Definition of Done poza kodem — dwie aktualizacje
dokumentacji (`spec-backend.md`, roadmapa), które plan.md i CLAUDE.md traktują jako twardy
wymóg zamknięcia bloku, a raport w jednym miejscu sugeruje, że zostały zrobione, a w drugim
(„Follow-up”) przyznaje, że nie. To do uzupełnienia przed scaleniem, żeby sesja 3d nie
startowała z rozjechanym stanem wejściowym.
