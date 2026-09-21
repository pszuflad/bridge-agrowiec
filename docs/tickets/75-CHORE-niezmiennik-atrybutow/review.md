# 75-CHORE-niezmiennik-atrybutow — Code review

> Reviewed: 2026-09-21
> Branch: `chore/75-niezmiennik-atrybutow`
> Diff: 5 plików (`docs/tickets/75-CHORE-niezmiennik-atrybutow/{plan.md,raport.md,pomiar-niezmiennika.ts,pomiar-wynik.json}`, `rebuild/backend/test/atrybuty.niezmiennik.test.ts`), 3 commity

## BLOCKER

- [ ] `docs/rebuild-roadmap.md` (brak w diffie) — wiersz P7.3 nie został zaktualizowany.
  - Reason: Plan (Implementation plan krok 3) i Definition of done ("[x] Roadmapa: P7.3
    zrobione; noty dla P7.4 i P7.2 w ich wierszach") wprost wymagają aktualizacji roadmapy. `git
    diff origin/develop...HEAD -- docs/rebuild-roadmap.md` jest pusty — plik dalej ma `P7.3 | …
    | ⬜ gotowe` (linia 3078), bez daty ani ID ticketa. To wprost narusza stałą zasadę projektu z
    `CLAUDE.md` ("Roadmapa jest wejściem dla następnej sesji… roadmapa opisuje STAN, nie zamiar")
    i checkbox w DoD jest odhaczony niezgodnie ze stanem faktycznym.
  - Suggestion: Dopisać do wiersza P7.3 datę + ID ticketa (analogicznie do innych zamkniętych
    kart), zmienić `⬜ gotowe` na `✅ zrobione`, i dodać noty dla P7.4 (np. że P7.3 dostarczyła
    materiał do delty instrukcji) oraz dla P7.2 (rozjazd A vs C / alias na samą siebie, patrz
    raport.md "Werdykt i rekomendacja"), tak jak zapowiada plan.md.

## SHOULD-FIX

- [ ] `rebuild/backend/test/atrybuty.niezmiennik.test.ts:281-297` — test „spacja na końcu obok
  wersji czystej" zależy od NIEGWARANTOWANEJ kolejności wierszy z `GROUP BY` bez `ORDER BY`
  (asercja `A: 1` i `staty.zaktualizowano === 1` wymaga, żeby grupa „P73 BIEZNIK " została
  przetworzona PO grupie „P73 BIEZNIK", żeby nadpisała jej `ile_wystapien`).
  - Reason: SQL nie gwarantuje kolejności wierszy bez jawnego `ORDER BY`; komentarz w kodzie
    (linie 274-279) słusznie tłumaczy DLACZEGO tak wychodzi w SQLite (sortowanie po kluczu
    grupowania przez tymczasowe b-drzewo, gdy nie ma indeksu), ale to detal implementacyjny
    silnika, nie kontrakt. Gdyby wersja SQLite pod `better-sqlite3` kiedyś zmieniła strategię
    wykonania tego zapytania (np. zaczęła używać innego planu), test zacznie failować pomimo że
    kod produkcyjny (predykat skanu) się nie zmienił — czyli fałszywy alarm zamiast realnej
    regresji. Ryzyko w praktyce niskie (to bardzo stabilne, wieloletnie zachowanie SQLite), ale
    warto to mieć świadomie zapisane, bo dziś nic o tym nie ostrzega poza samym komentarzem.
  - Suggestion: Nic pilnego do zmiany kodu — ewentualnie dopisać w komentarzu jedno zdanie, że
    asercja `A: 1` zależy od kolejności `GROUP BY` bez `ORDER BY` i że w razie niewyjaśnionego
    czerwonego testu na tej linii warto to sprawdzić jako pierwsze podejrzenie (żeby ktoś nie
    szukał regresji w `skanujNoweWartosci`, gdy winny jest silnik SQL).

## NICE-TO-HAVE

- [ ] `docs/tickets/75-CHORE-niezmiennik-atrybutow/pomiar-niezmiennika.ts:296-313` — pole wyniku
  `"C≠D poza aliasem na samą siebie"` liczy `w.edycja.C !== w.edycja.D` (a nie
  `w.alias.edycja...`), czyli miesza warunek dla akcji „z edycją" z etykietą sugerującą wyłącznie
  alias; w tym pomiarze wyszło zawsze 0, więc nie wpłynęło na wynik, ale nazwa pola myli przy
  ponownym użyciu skryptu.
- [ ] `rebuild/backend/test/atrybuty.niezmiennik.test.ts:96-113` — `beforeEach` robi 13 żądań
  `POST /api/atrybuty/rodzaje` w KAŻDYM z 37 testów (całość i tak działa w ~10 s, więc to czysto
  kosmetyczna uwaga o koszcie, nie problem funkcjonalny).

## Plan compliance

### Done ✓
- Krok 1 planu: skrypt pomiarowy `pomiar-niezmiennika.ts` na kopii `db/snapshot.db` w katalogu
  tymczasowym, po migracjach 001–006, każda akcja w wycofywanej transakcji — zgodnie z opisem.
- Krok 2 planu: `atrybuty.niezmiennik.test.ts` pokrywa niezmiennik główny (13 rodzajów × 2 akcje),
  brzegi predykatu (MO6, spacje, wielkość liter, NULL/pusty/spacje), „dopasowane ≠ zmienione"
  (alias na samą siebie, edycja bez zmiany) i import między skanem a akcją (4 przypadki) — 37/37
  zielone, zweryfikowane lokalnie.
- Predykaty A/B/C w komentarzach kodu i w raporcie zgadzają się z faktycznym kodem
  (`repos/atrybuty-pending.ts`, `repos/atrybuty.ts`, `routes/atrybuty.ts`) i z oryginałem
  (`mirror/backend/pending_module.cjs:84-101,289-296,311-331`, `atrybuty_module.cjs:289-296`) —
  zweryfikowane linia w linię przy tym review.
- Liczby w `raport.md` (tabele „stan" i „czysty", sumy rozjazdów) zgadzają się z
  `pomiar-wynik.json` — sprawdzone programowo, zero rozbieżności.
- Zero zmian w `rebuild/backend/src/**`, `rebuild/frontend/src/**`, `contract/` i w istniejących
  testach — potwierdzone `git diff --stat`.
- Test nie importuje map rodzaj→kolumna z repozytoriów (własna jawna lista `RODZAJE`), nie
  zakłada braku wpisów w `audit_log`, pomija `model`/`zastosowanie` — zgodnie z ograniczeniami
  równoległej karty P7.1 (ticket 74). Test powinien zostać zielony po jej merge'u.
- Bramki backendu: `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ 88 plików / 1377 testów
  — zweryfikowane ponownym uruchomieniem, zgodne z raportem.

### Missing or deviating ✗
- Krok 3 planu („raport.md z tabelą pomiaru, **roadmapa** (wiersz P7.3 + nota do P7.4 i P7.2)")
  — część „roadmapa" nie została zrealizowana (patrz BLOCKER).

### Definition of done
- [x] Pomiar na kopii snapshotu, tabela per rodzaj w `raport.md`.
- [x] `atrybuty.niezmiennik.test.ts` zielony; zero zmian w `src/`, `contract/`, istniejących testach.
- [x] Bramki backendu zielone.
- [ ] Roadmapa: P7.3 zrobione; noty dla P7.4 i P7.2 w ich wierszach — `docs/rebuild-roadmap.md`
  bez zmian w diffie, wiersz P7.3 dalej ma status `⬜ gotowe` bez daty/ID ticketa.

## Parallel-test concerns

None — test korzysta z istniejącego harnessu `stworzSrodowiskoTestowe` (baza SQLite w katalogu
tymczasowym, HTTP przez `supertest` bez nasłuchującego portu), tak jak reszta testów w
`rebuild/backend/test/`. Brak twardo zakodowanych ścieżek czy portów.

## Overall assessment

Merytorycznie karta jest solidna: niezmiennik B == C jest udowodniony konstrukcyjnie (identyczny
predykat w `uzycieAtrybutu` i w `UPDATE`) i potwierdzony pomiarem na całym snapshocie (0
rozjazdów na 4148 pomiarach), a 37 testów w bramce niezależnie przelicza każdą liczbę w SQL —
żadna asercja nie jest tautologiczna. Komentarze w kodzie, raport i liczby w `pomiar-wynik.json`
są spójne ze sobą i z oryginałem (zweryfikowane linia w linię). Jedyny realny problem to
niedotrzymana część planu/DoD — brak aktualizacji `docs/rebuild-roadmap.md` — co jest wprost
wymagane przez `CLAUDE.md` i przez własny plan karty; to trywialne do naprawienia, ale musi zostać
zrobione przed uznaniem karty za zamkniętą.
