# 150-DOCS-test-sciezki-krytycznej — Code review

> Reviewed: 2026-09-24
> Branch: `docs/150-test-sciezki-krytycznej`
> Diff: 4 pliki (`docs/instrukcja-testu-sciezki-krytycznej.md`, `docs/tickets/150-.../{plan,raport,dowod-csv}.md`), 2 commity

## BLOCKER

- [ ] `docs/instrukcja-testu-sciezki-krytycznej.md:177-179` — Krok 2 odcinka 2.2 (⭐⭐ „najważniejszy punkt instrukcji") każe Ani w Stagingu kliknąć „Kolumny" i włączyć **EAN, Rozmiar, Producent-opony, Bieznik/model** — cztery z sześciu pól. Te cztery klucze (`ex_ean`, `ex_rozmiar`, `ex_marka`, `ex_model`) należą w `rebuild/frontend/src/pages/staging/kolumny.ts:47-75` do sekcji `dodatkowa` („Dodatkowe (z katalogu)"), która jest **udokumentowanym, świadomym no-opem** — `KonfiguratorKolumn.tsx:126-131` pokazuje w popoverze wprost zdanie „Te kolumny nie są jeszcze wyświetlane w tabeli stagingu.", a `TabelaStagingu.tsx:85-127` (i `KOLEJNOSC_KOLUMN` w `kolumny.ts:109-121`) w ogóle nie renderuje żadnej kolumny `ex_*`. Zaznaczenie checkboxów faktycznie nic nie pokaże w tabeli.
  - Reason: to jest opisane jako **najważniejszy punkt całego dokumentu** — Ania wykona kroki, zaznaczy checkboxy, w tabeli pojawią się tylko „Cena zakupu" i „Stan" (te dwa NIE są `dodatkowa`), a „EAN/Rozmiar/Producent-opony/Bieznik-model" nigdy się nie pokażą. To dokładnie scenariusz, przed którym ostrzega brief: zmarnowane posiedzenie i utrata zaufania do dokumentu. Co gorsza, popover, który Ania otworzy, SAM jej to powie („nie są jeszcze wyświetlane") — rozjazd z instrukcją będzie widoczny natychmiast.
  - Suggestion: dla tych czterech pól jedyna działająca ścieżka w kodzie to przycisk **„Szczegóły"** przy wierszu (`TabelaStagingu.tsx:216-218` → `SzczegolyPozycji.tsx`, sekcja „Podgląd różnic" pokazuje surowy `snapshotJson` z polami z pliku dostawcy). Przepisać Krok 2 tak, żeby Ania używała „Szczegóły", a nie „Kolumny", dla EAN/Rozmiar/Producent-opony/Bieznik-model. Autor raportu cytuje `kolumny.ts:47-75` jako źródło etykiet, ale nie doczytał sąsiadującego komentarza w tym samym pliku, który wprost ostrzega przed tym zachowaniem.

- [ ] `docs/karty/TEST.2/karta.md` (plik nietknięty przez tę gałąź) — Krok 3 planu („domknięcie karty", Faza 5) nie został wykonany: karta nadal ma `> **Stan:** ⬜ do zrobienia`, puste sekcje „Decyzje", „Dowiezione" i „Do koordynatora" (mimo że plan wprost wymagał tam korekty stanu stagingu — `IMPORT_SCHEDULER=true`, `AGRORAMI_*` ustawione). Nie powstały też `docs/karty/TEST.1/wejscie-150.md` ani `docs/karty/TEST.3/wejscie-150.md`, których plan.md też wymagał.
  - Reason: to wprost dwa niespełnione punkty własnej Definition of done ticketu i złamanie reguły projektu „karta.md opisuje STAN, nie zamiar" (`CLAUDE.md`, sekcja o roadmapie). Kolejna sesja czytająca kartę TEST.2 zobaczy zadanie jako nierozpoczęte, mimo że dokument już istnieje.
  - Suggestion: dopisać do `karta.md` sekcje „Dowiezione" (pięć odcinków, dowód CSV, wynik) i „Do koordynatora" (rozjazd `IMPORT_SCHEDULER`/`AGRORAMI_*` względem założeń karty), zmienić `Stan`; założyć `wejscie-150.md` dla TEST.1 i TEST.3 zgodnie z opisem w `raport.md`.

- [ ] `docs/tickets/150-DOCS-test-sciezki-krytycznej/raport.md:113-114` — sekcja „Wyniki testów" kończy się zdaniem „Bramki backendu... wynik niżej, w sekcji dopisanej po Kroku 16", ale takiej sekcji nigdzie w pliku nie ma (`tail` pliku to od razu „Breaking changes" / „Follow-up"). Nie ma dowodu, że `lint`/`typecheck`/`build`/`test` w `rebuild/backend` w ogóle przebiegły.
  - Reason: `plan.md` (sekcja „Strategia testowania") i `CLAUDE.md` wymagają przejścia bramek backendu nawet dla ticketu czysto dokumentacyjnego, bo merge mógł wciągnąć cudze zmiany — a gałąź jest w tej chwili **6 commitów za `origin/develop`** (m.in. `153-DOCS`, `148-DOCS`), więc bramek „po synchronizacji" na pewno jeszcze nie przepuszczono na aktualnym stanie. To jest niespełniony punkt Definition of done („Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`") i, zgodnie z `plan.md`, sam plik ma status „Draft" u góry — ticket wygląda na nieukończony, mimo że trafił do review.
  - Suggestion: zsynchronizować z `origin/develop` (`tools/sync-z-develop.sh`), przepuścić bramki backendu, dopisać realny wynik do `raport.md`.

## SHOULD-FIX

- [ ] `docs/instrukcja-testu-sciezki-krytycznej.md:117` i `:264` — nazwa dostawcy MO9 podana jako „Agro-Rami / BKT", podczas gdy w danych produkcji (`db/snapshot.db`, tabela `suppliers`) nazwa to `Agro-Rami (BKT)` (nawias, nie ukośnik) — dokładnie to, co Ania zobaczy na karcie dostawcy. Drobna, ale to jest cytat nazwy z ekranu.
- [ ] `docs/instrukcja-testu-sciezki-krytycznej.md:116` — „⏳ Generuję plik CSV, to może potrwać kilkanaście sekund…" używa typograficznej elipsy (`…`), a realny komunikat w `SekcjaCsv.tsx:116` kończy się trzema kropkami ASCII (`...`). Wizualnie nieodróżnialne dla Ani, ale skoro cała reszta dokumentu cytuje komunikaty dosłownie „z bindu", warto ujednolicić.

## NICE-TO-HAVE

- [ ] `docs/tickets/150-DOCS-test-sciezki-krytycznej/plan.md` (Definition of done) — żaden z dziewięciu punktów nie jest odhaczony (`[ ]`) mimo że raport.md twierdzi, że większość jest zrobiona — kosmetyczna niespójność między plikami tego samego ticketu, ale utrudnia szybkie zorientowanie się, co faktycznie domknięto.
- [ ] `docs/karty/TEST.2/karta.md` — nagłówek sekcji mówi „Zakres — cztery odcinki", a wylicza pięć (importy, parsery, CSV, porównanie, Selly); to niespójność zastana (nie wprowadzona przez ten ticket), ale skoro ticket i tak miał domknąć kartę, warto poprawić przy okazji.

## Plan compliance

### Done ✓
- Dowód równoważności generatorów CSV (Krok 1) — **zweryfikowany niezależnie przez reviewera**: powtórzyłem cały przebieg z `dowod-csv.md` (kopia `db/snapshot.db` w katalogu tymczasowym, migracje 001–013, stary generator z `88fa31c` z podmienionymi ścieżkami, `npm run selly:csv`) i otrzymałem **identyczny sha256** (`70dacfd7…b87c5`), 6898 produktów, 60 kolumn, 3 177 786 B — dokładnie zgodnie z raportem. Metodologia solidna: poprawnie omija obie pułapki (59 vs 60 kolumn na `develop`, brak migracji na surowym snapshocie), nie jest trywialna (60. kolumna wypełniona we wszystkich wierszach, różne wartości) i nie ma krążenia (dwa fizycznie niezależne skrypty).
- Odcinek 4 (dowód) faktycznie tylko podaje wynik i odsyła do `selly.generator-csv.test.ts` — nie powtarza dowodu, zgodnie z DoD.
- Odcinek 5 opisuje oba warianty Selly i wskazuje docelowy wprost („nic nie przepinamy"), z uczciwie policzoną ceną wariantu testowego (żywy sklep, okno, integrator, `.htaccess`).
- Sekcja „Czego na stagingu sprawdzić NIE MOŻNA" — trzy niezależne blokady wymienione, z tabelą „kiedy się zweryfikuje"; poprawnie odsyła dalej do `cutover.md`.
- MO9 wydzielone jako jedyny dostawca przez API, z rzetelnie opisanym odstępstwem od starego Bridge'a (brak cichego fallbacku) — potwierdzone w kodzie (`mo9_agrorami.cjs`, brak `catch` maskującego błąd).
- Przypisanie dróg dostarczania (`url`/`mail`/`upload`) do MO1–MO10 — zgodne co do litery z `db/snapshot.db`, tabela `suppliers` (zweryfikowane bezpośrednio zapytaniem SQL).
- Godziny (cron CSV 6:00, Selly 12:00, Tor 2 04:30) — zgodne z `docs/cutover.md` i `docs/spec-backend/wpis-121.md`.
- Ścieżka pliku CSV na stagingu (`sellycsv-staging.csv`, `test.agritires.eu/ex-port-files/`) — zgodna z `tools/deploy-staging.sh:42-45`.
- Większość nazw przycisków/komunikatów zweryfikowana poprawnie: „Synchronizuj"/„Synchronizuję…", „Wgraj plik", „Plik wczytany", „Błąd uploadu", `.csv,.xml,.xlsx`, kolumny Archiwum, placeholder szukajki Stagingu, treść pytania o generowanie CSV, komunikat „✓ Wygenerowano…", „✓ Synchronizacja OK…" — wszystkie dosłowne cytaty zgadzają się z `rebuild/frontend/src/`.
- Roadmapa nietknięta, pliki spoza własności karty TEST.2 (`docs/cutover.md`, `docs/przeglad-12-widokow.md`, `docs/instrukcja-pelnego-testu.md`) nie zostały ruszone.

### Missing lub deviating ✗
- Krok 2.2 odcinka 2 (Staging → „Kolumny") jest technicznie niewykonalny dla 4 z 6 pól — patrz BLOCKER.
- Krok 3 planu („domknięcie karty") nie wykonany — `karta.md` nadal w stanie „do zrobienia", brak `wejscie-150.md` dla TEST.1/TEST.3.
- Wynik bramek backendu nieudokumentowany, gałąź niezsynchronizowana z `origin/develop` (6 commitów w tyle).

### Definition of done
- [x] Dowód równoważności generatorów przeprowadzony na jednej bazie, wynik w `raport.md` — zweryfikowany niezależnie, zgodny.
- [x] `docs/instrukcja-testu-sciezki-krytycznej.md` — pięć odcinków, forma zgodna z `instrukcja-testow-I10-v2.md`.
- [x] Odcinek 4 podaje wynik dowodu i odsyła do testu nagłówka, nie powtarza dowodu.
- [x] Odcinek 5 opisuje oba warianty Selly i wskazuje docelowy wprost.
- [x] Osobna sekcja „czego na stagingu sprawdzić NIE MOŻNA" z trzema blokadami.
- [ ] Nazwy ekranów, przycisków i kolumn zweryfikowane w `rebuild/frontend/src/` — **NIE w pełni**: krok 2.2 cytuje etykiety poprawnie, ale nie odczytał sąsiadującego kodu/komentarza mówiącego, że te konkretne przełączniki nic nie robią (patrz BLOCKER 1).
- [ ] `docs/karty/TEST.2/karta.md` opisuje STAN — nie spełnione, karta nadal w stanie wyjściowym.
- [ ] Ustalenia dla TEST.1/TEST.3 w `wejscie-150.md` — pliki nie istnieją; roadmapa faktycznie nietknięta.
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE` — nie spełnione, gałąź 6 commitów w tyle, brak zapisanego wyniku bramek.

## Parallel-test concerns

None — ticket nie dodaje żadnych testów automatycznych (wyłącznie dokumentacja + jednorazowy dowód ręczny wykonany w katalogu tymczasowym poza repo).

## Overall assessment

Rdzeń dokumentu — dowód równoważności generatorów CSV — jest solidny i **potwierdzony niezależnym powtórzeniem przez reviewera bajt w bajt**; to najważniejsze i najtrudniejsze do sfałszowania twierdzenie ticketu i ono się broni. Większość faktów o UI (przyciski, komunikaty, ścieżki) jest rzetelnie zweryfikowana w źródłach. Problem jest jeden, ale poważny: krok opisany jako „najważniejszy punkt instrukkcji" każe Ani włączyć w Stagingu cztery kolumny, które — zgodnie z jawnym komentarzem w tym samym pliku, który autor cytuje jako źródło — fizycznie nigdy się nie pokażą. Do tego proces domknięcia ticketu jest niekompletny: karta TEST.2 nie została zamknięta, gałąź nie jest zsynchronizowana z `develop`, a wynik bramek backendu nie został zapisany mimo obietnicy w raporcie. Przed przekazaniem dokumentu Ani trzeba poprawić krok 2.2 (przez „Szczegóły", nie „Kolumny") i domknąć proces ticketu.
