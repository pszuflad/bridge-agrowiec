# 228-FEATURE-partnerzy-model-zamowien — Code review

> Reviewed: 2026-10-10
> Branch: claude/peaceful-gates-a8yebr
> Diff: 16 plików (+608/-5), 1 commit (76672f0)

## BLOCKER

- [ ] `rebuild/backend/src/partnerzy/zamowienie-xml.ts:52` — regex tokenizera ma kwadratowy backtracking (ReDoS) na niedomkniętym znaczniku: `<([^\s/>!?]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>`.
  - Reason: nazwa `[^\s/>!?]+` i grupa atrybutów `[^>"']` obejmują te same znaki, więc przy braku `>` silnik próbuje każdego podziału nazwa/atrybuty, a każdy to skan do końca wejścia. Zmierzone lokalnie (`<DOCUMENTORDER><` + N × `a`, bez `>`): 5 tys. znaków = 83 ms, 10 tys. = 0,3 s, 20 tys. = 1,2 s, 40 tys. = 4,9 s. Wzrost jest kwadratowy, więc plik ~1 MB blokuje główny wątek Node (backend Fastify, wspólny z całym API) na kilkadziesiąt minut. Wejście pochodzi od partnera (FTP/e-mail w 7.2), a parser nie ma limitu rozmiaru. Kod nie jest też odporny na zwykły, uciętej transmisji plik (urwany w środku nazwy znacznika).
  - Suggestion: zastąpić regex pisanym ręcznie skanerem (`indexOf('>')` z obsługą cudzysłowów, jeden przebieg), albo rozdzielić nazwę od atrybutów separatorem, którego nazwa nie zawiera (`<([^\s/>!?]+)(?=[\s/>])`, atrybuty po nim). Dodać test wydajnościowy z wejściem 100–200 KB (limit czasu).
- [ ] `rebuild/backend/src/partnerzy/zamowienie-xml.ts:94` — brak limitu rozmiaru wejścia (i `surowy_xml` zapisywany w całości).
  - Reason: niezaufane wejście bez górnego limitu = DoS pamięci/CPU, nawet po naprawie regexa. Nie ma też limitu liczby pozycji ani głębokości (głębokość jest bezpieczna, bo czytnik jest iteracyjny — 200 tys. zagnieżdżeń przeszło w 163 ms — ale drzewo `Wezel` rośnie liniowo bez ograniczenia).
  - Suggestion: na wejściu `parsujZamowienie` odrzucić `xml.length > N` (np. 2 MB) błędem `BladZamowienia`; opcjonalnie limit liczby pozycji (np. 5000).

## SHOULD-FIX

- [ ] `rebuild/backend/src/repos/partnerzy-zamowienia.ts:26-57` — idempotencja oparta na „SELECT, potem INSERT” w transakcji domyślnie `DEFERRED`.
  - W jednym procesie (better-sqlite3 jest synchroniczny) jest poprawnie. Ale baza ma WAL i `busy_timeout=5000` (`src/db/index.ts:17-20`), a kroki wdrożenia, CLI i przyszły odbiornik 7.2 mogą pisać z drugiego połączenia. Wtedy dwa równoległe zapisy tego samego `NUMBER` dają `SQLITE_BUSY` przy awansie transakcji do zapisu albo wyjątek `UNIQUE constraint failed`, zamiast `nowe: false`.
  - Suggestion: `db.transaction(fn, { behavior: "immediate" })` (drizzle to wspiera) albo `INSERT … ON CONFLICT(partner_id, numer_partnera) DO NOTHING` + sprawdzenie `changes`. Dodać test: dwa kolejne zapisy w jednej transakcji / przechwycenie wyjątku UNIQUE.
- [ ] `rebuild/backend/src/repos/partnerzy-zamowienia.ts:25` — `skrot` liczony z surowego tekstu, więc inny zapis końców linii / BOM / wcięć tego samego zamówienia daje `zmieniony: true`.
  - Fałszywe alarmy „zmieniony” przy ponownym pobraniu z FTP po przeformatowaniu. Rozważyć skrót z postaci znormalizowanej (np. z `Zamowienie`, nie z XML) albo udokumentować w `wpis-228.md`, że to świadome.
- [ ] `rebuild/backend/src/partnerzy/zamowienie-xml.ts:49` — wykrywanie DOCTYPE/ENTITY regexem na całym tekście.
  - Odrzuci też poprawny plik, w którym `<!DOCTYPE` występuje w CDATA lub komentarzu (np. nazwa/uwaga). Praktycznie rzadkie, a kierunek błędu bezpieczny (odrzucenie), więc nie blokuje. Zabezpieczenie XXE/billion laughs jest skuteczne: encje poza 5 predefiniowanymi i numerycznymi nie są rozwijane (`dekoduj`, :36-44), a dekodowanie jest jednoprzebiegowe (`&amp;lt;` → `&lt;`). Dodać test z DOCTYPE w CDATA, żeby zachowanie było jawne.
- [ ] `rebuild/backend/src/partnerzy/zamowienie-xml.ts:56,71` — tekst niebędący białymi znakami poza elementem głównym (przed/po `DOCUMENTORDER`) jest przyjmowany do `korzen.tekst` i ignorowany.
  - Bardziej restrykcyjnie: odrzucać niepuste (po `trim`) fragmenty tekstu poza korzeniem. Teraz `śmieci<DOCUMENTORDER>…</DOCUMENTORDER>śmieci` przechodzi.
- [ ] `rebuild/backend/src/partnerzy/zamowienie-xml.ts:112` — `ORDERQUANTITY` o dużej wartości (np. `99999999999999999999`) przechodzi `Number.isInteger`, ale nie jest bezpieczną liczbą całkowitą; zapis do INTEGER traci precyzję. Dodać `Number.isSafeInteger` (lub rozsądny górny limit).
- [ ] `rebuild/backend/test/partnerzy.zamowienie-xml.test.ts` — brak testów odporności: duże/ucięte wejście (patrz BLOCKER), niedomknięty znacznik, niezakończony komentarz/CDATA, zagnieżdżenie. Dopisać razem z poprawką regexa.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/partnerzy/zamowienie-xml.ts:85` — `mapa()` pomija dzieci złożone i przy powtórzonych nazwach ostatnia wygrywa; wystarczy teraz, ale przy prawdziwych plikach (karta ma „…”) może gubić dane. Odnotowane w raporcie jako follow-up.
- [ ] `rebuild/backend/src/repos/partnerzy-zamowienia.ts:83` — `JSON.parse` bez zabezpieczenia; kolumny mają `DEFAULT '{}'` i piszemy je sami, więc OK, ale przy ręcznej edycji bazy wyjątek wycieknie do wywołującego.
- [ ] `rebuild/backend/src/repos/partnerzy-zamowienia.ts:54` — pozycje wstawiane pojedynczo; przy dużych zamówieniach można jednym `values([...])` (ostrożnie z limitem zmiennych SQLite — 999/32766).
- [ ] `numer_partnera` nie jest normalizowany (spacje są obcinane przez `trim`, wielkość liter nie) — `A01` i `a01` to dwa zamówienia. Zdecydować w 7.2, czy to zamierzone.
- [ ] Brak indeksu na `partner_zamowienia(partner_id, pobrano)` pod `listaZamowien`; UNIQUE pokrywa tylko filtr po `partner_id`. Przy małej skali bez znaczenia.

## Plan compliance

### Done ✓
- Migracja `028_partner_zamowienia.sql` (dwie tabele, `UNIQUE(partner_id, numer_partnera)`, `numer_wlasny` NULL, status bez CHECK) — zgodna z konwencjami `rebuild/schema/README.md`: `CREATE … IF NOT EXISTS`, nagłówek ⚠ „NOWE tabele, nie odtworzenie produkcji”, wiersz w tabeli README, FK z `ON DELETE CASCADE` do `partnerzy`, brak ALTER/danych.
- Numeracja: na `origin/develop` ostatnia migracja to `027_partner_logi.sql`, więc 028 nie koliduje (sprawdzone `git ls-tree origin/develop`). Ryzyko: równoległa karta może zająć 028 przed merge'em — sprawdzić `tools/sync-z-develop.sh` tuż przed PR.
- Modele Drizzle `partnerZamowienia` / `partnerZamowieniaPozycje` zgodne z DDL (nazwy kolumn, unikaty, indeks).
- Liczniki: `db.migracje.test.ts` (lista migracji, 55 tabel, 28 indeksów, drugi `53`→`55`), `db.migracje-produkcja.test.ts` (nowe tabele i indeks) — spójne z DDL (+2 tabele, +1 indeks). Pozostałe trafienia `53` w repo to nie liczniki migracji.
- Parser bez zależności, DOCTYPE/ENTITY odrzucane, `CODE` jako tekst (test na `011200284`).
- Repo: idempotencja po `(partner_id, numer_partnera)`, flaga `zmieniony`, brak nadpisania; testy kaskady i izolacji partnerów.
- Brak zmian kontraktu/API — GATE kontraktu nie dotyczy (zgodnie z planem).

### Missing or deviating ✗
- Parser nie jest odporny na złośliwe/duże wejście (BLOCKER wyżej) — plan deklaruje „bez XXE i billion laughs”, ale nie rozważa ReDoS ani limitu rozmiaru.
- Plan: „raport: Deviations — Brak”, ale gałąź została zresetowana do `origin/develop` (opisane w raporcie) — OK, nie jest odstępstwem kodu.

### Definition of done
- [ ] Parser i repo z testami zielonymi; bramki — testy zielone wg raportu (172 pliki / 2437 testów), lecz kryterium bezpieczeństwa parsera niespełnione (ReDoS, limit rozmiaru); brak testów odporności.
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE` — do potwierdzenia po poprawkach (sync + `gh pr view --json mergeable,mergeStateStatus`).

## Parallel-test concerns

None — wszystkie nowe testy używają `stworzSrodowiskoTestowe()` (baza w katalogu tymczasowym) lub bazy w pamięci; brak stałych portów i ścieżek.

## Overall assessment

Model danych i migracja są poprawne i zgodne z konwencjami; idempotencja jest prawidłowa w obrębie jednego procesu, a zabezpieczenie przed XXE/entity expansion skuteczne (DOCTYPE/ENTITY odrzucane, brak rozwijania własnych encji, czytnik iteracyjny — głębokość nie jest problemem). Głównym problemem jest własny tokenizer XML: regex znacznika ma kwadratowy backtracking (zmierzone 4,9 s dla 40 KB) i brak limitu rozmiaru, co przy plikach od partnerów pozwala zablokować cały backend — to trzeba naprawić przed merge'em. Do tego warto utwardzić transakcję zapisu (`IMMEDIATE`/`ON CONFLICT`) i dopisać testy odporności.
