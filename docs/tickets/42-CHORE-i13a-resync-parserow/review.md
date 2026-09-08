# 42-CHORE-i13a-resync-parserow — Code review

> Reviewed: 2026-09-08
> Branch: chore/42-i13a-resync-parserow
> Diff: 38 plików zmienionych (9 par mirror+port, 18 wzorców charakteryzacji parserów+silnika, 2 pliki dokumentacji ticketa nowe/nietrackowane), 3 commity (`bb020fb`, `9b26ceb`, `5887c0b`)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md` (blok „Iteracja 13", ok. linii 185, 1930) — 13a nadal opisane jako zaplanowane, nie jako zrobione.
  - Reason: DoD karty wprost wymaga „`docs/rebuild-roadmap.md` blok I13: 13a oznaczone jako zrobione (data + ID ticketa)". `git diff origin/develop...HEAD -- docs/rebuild-roadmap.md` jest **pusty** — plik nie był w ogóle dotknięty w tej gałęzi. Tabela w §5 (linia 185) nadal ma status `⬜`, a opis karty 13a (linia 1930) nie ma żadnej wzmianki o realizacji. Precedens z tej samej roadmapy: ticket `41-CHORE-i13f-decyzja-backfille` (commit `e116ce6`) aktualizował `rebuild-roadmap.md` i `rebuild-backlog.md` w tym samym commicie co decyzję — więc to nie jest praca odłożona na później, tylko pominięty krok tej karty.
  - Suggestion: dopisać do bloku 13a datę zamknięcia + ID `42-CHORE-i13a-resync-parserow`, zakres faktycznie dowieziony (9 plików, przenagranie parserów + świadome przenagranie silnika), i — zgodnie z zasadą CLAUDE.md #2 — wszelkie ustalenia dla 13b (stan przejściowy „silnik 25.08 + parsery 08.09", konieczność re-recordu po bumpie `index.cjs`) wpisać DO bloku 13b, nie do 13a.

- [ ] `docs/rebuild-backlog.md` (wpisy #8, #9, #10, #53, #54, #55, #57, #58, #63, #64) — statusy części parserowej nie zaktualizowane mimo ukończonego portu.
  - Reason: DoD wprost wymaga aktualizacji tych statusów „w części parserowej". `git diff` na `rebuild-backlog.md` jest pusty. #53/#54/#55/#63/#64 nadal mają `**Status:** ⬜ do portu` — mimo że port tych zmian właśnie się odbył i jest potwierdzony bajt-w-bajt zgodny z produkcją. #8/#9/#10 mają status z 2026-09-01 zapowiadający „Port w I13/13a" w czasie przyszłym, bez potwierdzenia, że port faktycznie nastąpił w tym tickecie.
  - Suggestion: dla każdego z 10 wpisów dopisać potwierdzenie portu (np. „✅ sportowane w `42-CHORE-i13a-resync-parserow`, 2026-09-08") — zgodnie z zasadą CLAUDE.md „Po każdym zamkniętym bloku roadmapa/backlog opisuje STAN, nie zamiar."

- [ ] `docs/tickets/42-CHORE-i13a-resync-parserow/raport.md` (sekcja „Zależność parsery→silnik") i commit `5887c0b` — twierdzenie „Zero różnic strukturalnych" jest nieprawdziwe dla MO8.
  - Reason: Zweryfikowano niezależnie porównaniem JSON przed/po dla wszystkich 10 `silnik/MOx.expected.json`. Dla MO8 pole `statystyki` zmienia się strukturalnie: `doStagingu` 25→31, `zmienione` 24→30, `bezZmian` 600→594 — sześć rekordów przeszło z „bez zmian" do pełnych wpisów `staging` (z kompletem nowych pól: `kod`, `eanRaw`, `eanCandidates`, `cenaZakupuStara/Nowa`, `stanStary`, `typZmiany`, `ostrzezenie` itd.), bo reparsowana szerokość (efekt `odswinch`/`p2_4`) przestała się zgadzać z wartością zapisaną w katalogu produkcyjnym. To jest realna zmiana **liczby i zawartości rekordów** silnika, nie tylko przesunięcie tekstu w `powod`/`snapshotJson`, jak twierdzi raport i treść commita (powtórzona identycznie w obu miejscach). Dla pozostałych 9 dostawców twierdzenie jest prawdziwe (zweryfikowano — brak zmian w `statystyki`). Nie podważa to poprawności technicznej samego przenagrania (silnik nadal woła oryginalny `tk()`, `index.cjs` nienaruszony — to potwierdzone), ale zaniża w dokumentacji faktyczny zakres świadomego odstępstwa, na którym ma polegać 13b.
  - Suggestion: poprawić opis w raporcie (i ewentualnie dopisek w rozwinięciu do 13b) — wskazać wprost, że MO8 ma dodatkowo zmianę strukturalną w liczbie rekordów `staging` (25→31), wynikającą z przeliczonych szerokości, a nie tylko kosmetyczną zmianę treści pól tekstowych.

## SHOULD-FIX

- [ ] `docs/tickets/42-CHORE-i13a-resync-parserow/raport.md` (tabela „Co realnie zmieniło się") — liczba rekordów MO8 dotkniętych przez `odswinch` (~72) jest przybliżeniem trudnym do zweryfikowania osobno od `p2_4`, bo oba efekty nakładają się w tym samym pliku (łącznie 78 zmienionych linii `szerokosc` w MO8). Nie jest to błąd, ale warto doprecyzować w raporcie, że rozbicie 72/78 jest szacunkiem, a nie zmierzoną wartością — obecnie brzmi jak twarda liczba.

## NICE-TO-HAVE

- [ ] Brak dalszych uwag — pozostała część zmian (9 plików parserów, przenagranie wzorców pola-po-polu) jest kopią bajtową kodu producenta i nie podlega ocenie stylu zgodnie z zasadami karty.

## Plan compliance

### Done ✓
- Krok 0/1: 9 plików zsynchronizowanych RÓWNOLEGLE w `mirror/backend/` i `rebuild/backend/src/import/legacy/`; zweryfikowano niezależnie `cmp`/`diff` każdego z 9 plików przeciw blobowi `main` — identyczne bajt-w-bajt w obu kopiach.
- Integralność całego drzewa portu: wszystkie 18 plików `src/import/legacy/**` (poza `package.json`) zweryfikowane jako identyczne z `mirror/backend/**`; brak plików `.bak_*` czy testów producenta w porcie.
- Zakres: `git diff origin/develop...HEAD --name-only` pokrywa się dokładnie z 9 parami plików + 18 plikami `*.expected.json` — nic z 13b/13c/13d/13e nie zostało ruszone (`index.cjs`, `selly/`, migracje, frontend — zero zmian, potwierdzone).
- Krok 2: rozłożenie `odswinch` (#64) diffem `.bak_odswinch_20260904_1403` vs `tyre_params.cjs@main` zweryfikowane niezależnie — dokładnie +26/−1, dwa hunki, oba w `parseSize()`, zgodnie z opisem w raporcie. Plik `.bak_` nie trafił do portu.
- Krok 3: przenagranie `MOx.expected.json` przez `scripts/charakteryzacja-nagraj.mjs`, który jednoznacznie w kodzie i komentarzu uruchamia oryginalne parsery z `mirror/backend` (kopiowane do `.tmp/oryginal/`), nie port — potwierdzone czytaniem skryptu.
- Twierdzenia raportu zweryfikowane niezależnie i potwierdzone: liczba rekordów niezmieniona u wszystkich 10 dostawców (2686 wstawień == 2686 usunięć w diffie wzorca); jedyny przesunięty licznik to MO1 `odrzuconePrzezAdapter` 1→0; `katunify` nieuruchamiane próbkami (zero zmian pola `kategoria` w całym diffie); `mo9expand` nieuruchamiane (indeksy MO9 bez zmian wartości); `b4` istniało już przed 25.08 (potwierdzone na baseline `origin/develop`); `b10` dotyczy dokładnie 2 rekordów MO4.
- Przenagranie wzorca silnika (`5887c0b`, decyzja 6 z promptu): potwierdzono, że `mirror/backend/index.cjs` ma zerowy diff w tej gałęzi, że `charakteryzacja-silnik-nagraj.mjs` bierze wejście z wzorca 3a i wycina oryginalny `tk()` z `index.cjs` (nie z portu TS), oraz że `silnik/katalog/` i `silnik/overrides/` mają zerowy diff.
- Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` — wszystkie zielone, `79 plików / 1223 testy`, zgodnie z deklaracją raportu.

### Missing lub deviating ✗
- DoD „`docs/rebuild-roadmap.md` blok I13: 13a oznaczone jako zrobione" — NIE wykonane (zerowy diff pliku).
- DoD „`docs/rebuild-backlog.md`: statusy #8, #9, #10, #53, #54, #55, #57, #58, #63, #64 zaktualizowane" — NIE wykonane (zerowy diff pliku).
- Raport zaniża skalę przenagrania wzorca silnika dla MO8 (patrz BLOCKER wyżej) — nie jest to pominięcie kroku planu, ale nieścisłość w opisie tego, co plan (decyzja 6 z promptu) wymagał ocenić rzetelnie.

### Definition of done
- [x] 9 plików zsynchronizowanych z `main` RÓWNOLEGLE w `mirror/backend/` i `rebuild/backend/src/import/legacy/`
- [x] `cmp` mirror↔port cichy dla wszystkich 9; warstwa 1 gate'a (sha256 całego drzewa `legacy/**`) zielona
- [x] Żaden plik spoza listy 9 nie został ruszony (potwierdzone `git diff --stat`)
- [x] `MOx.expected.json` przenagrane skryptem `charakteryzacja-nagraj.mjs` (osobny commit)
- [x] Warstwy 2 i 3 gate'a charakteryzacji zielone (MO1–MO10)
- [x] Wzorce charakteryzacji silnika i akceptacji: akceptacja nietknięta i zielona; silnik ŚWIADOMIE przenagrany za zgodą użytkownika (zatwierdzone odstępstwo od pierwotnej decyzji 3 z planu) i zielony — literalnie DoD nie jest spełnione („nietknięte"), ale odstępstwo jest udokumentowane jako zaakceptowane w trakcie pracy
- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/` zielone
- [ ] `raport.md` zawiera rozłożony diffem realny zakres `odswinch`, podsumowanie przesunięć per dostawca i potwierdzenie zakresu silnika — obecne, ale z nieścisłością („zero różnic strukturalnych" nieprawdziwe dla MO8, patrz BLOCKER)
- [ ] `docs/rebuild-roadmap.md` blok I13: 13a oznaczone jako zrobione — NIE spełnione
- [ ] `docs/rebuild-backlog.md`: statusy #8/#9/#10/#53/#54/#55/#57/#58/#63/#64 zaktualizowane — NIE spełnione

## Parallel-test concerns

Brak nowych testów jednostkowych (zgodnie z planem — kod parserów jest kopią bajtową, field-characterization mierzy zachowanie). `npm test` uruchomiony lokalnie na bazie w katalogu tymczasowym / portach efemerycznych zgodnie z konwencją projektu — brak sygnałów zależności od zasobów współdzielonych w zmienionych plikach (same fixtures + kod producenta, żadnych nowych plików testowych). None — wszystkie testy równoległe do innych agentów.

## Overall assessment

Techniczne wykonanie karty jest solidne i w pełni zweryfikowane niezależnie: kopia bajtowa 9 plików jest rzeczywiście identyczna z `main` w obu miejscach (mirror i port), zakres nie wykracza poza 9 par + wzorce, wszystkie twierdzenia merytoryczne raportu o przesunięciach charakteryzacji (konstr, bug1, bug2, odswinch, b10, katunify/mo9expand/b4 nieuruchomione) potwierdziły się co do joty, a wszystkie cztery bramki backendu są zielone z dokładnie deklarowaną liczbą testów. Główne zastrzeżenia dotyczą nie kodu, lecz dokumentacji stanu: roadmapa i backlog — mimo wyraźnego wymogu w DoD i mimo świeżego precedensu z ticketu 41 w tej samej gałęzi roadmapy — nie zostały w ogóle dotknięte, a opis przenagrania wzorca silnika istotnie zaniża skalę zmiany dla MO8 (nie tylko kosmetyka tekstu, ale realna zmiana liczby rekordów w stagingu). Oba te punkty trzeba domknąć przed uznaniem karty za w pełni zamkniętą, bo od nich zależy, czy 13b wystartuje z rzetelnym obrazem stanu przejściowego.
