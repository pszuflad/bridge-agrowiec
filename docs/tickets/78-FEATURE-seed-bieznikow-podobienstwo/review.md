# 78-FEATURE-seed-bieznikow-podobienstwo — Code review

> Reviewed: 2026-09-21
> Branch: feature/78-seed-bieznikow-podobienstwo
> Diff: 11 plików, 4 commity (vs `origin/develop`)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/test/atrybuty.podobienstwo.test.ts:110-114` — test „reguła plusów działa
  też przy różnej wielkości liter" (`czySugerowacAlias("bkt+", "BKT")` → `false`) odpada już na
  progu podobieństwa (0,75 < 0,9), więc realnie nie testuje reguły „+" na postaci znormalizowanej
  — tę sprawdza dopiero sąsiedni przypadek `"abcdefghij+"`/`"ABCDEFGHIJ"` (0,909). Nazwa testu
  sugeruje, że oba przypadki dowodzą reguły „+"; pierwszy dowodzi tylko progu.
  - Sugestia: albo dobrać parę bliższą progu (żeby faktycznie trafić w gałąź „+"), albo
    doprecyzować nazwę/komentarz, że to przypadek brzegowy progu, nie reguły „+".

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/repos/atrybuty-pending.ts:163-193` (`listaPending`, niezmieniona w tym
  ticketcie) — dla każdej pozycji kolejki osobne zapytanie o kandydatów ze słownika (N+1). Po
  sprzątaniu D1 kolejka jest krótsza (61 zamiast 498 na snapshocie), więc presja praktyczna
  spadła, ale przy dużym słowniku `bieznik` (1665 wartości) i częstym `GET pending` to nadal
  potencjalny hot path. Poza zakresem tego ticketa — tylko odnotowanie.

## Plan compliance

### Done ✓
- `normalizujDoPorownania`, `podobienstwo` na postaci znormalizowanej, `czySugerowacAlias` z
  self-match na surowych napisach + regułą „+" na znormalizowanych (D1, D6) —
  `atrybuty-pending.ts:83-135`.
- `usunZKolejkiObecneWSlowniku` — `DELETE … WHERE EXISTS`, porównanie BINARY (brak `COLLATE
  NOCASE` w `atrybuty_wartosci`/`atrybuty_wartosci_pending`, `rebuild/schema/001_schema.sql:223-247`
  potwierdzone) — `atrybuty-pending.ts:340-352`.
- Wołanie sprzątania na końcu `skanujNoweWartosci` (kształt odpowiedzi `staty` bez zmian, liczba
  usuniętych tylko w `console.log`) — `atrybuty-pending.ts:315-318`.
- Wołanie sprzątania przy starcie procesu, w `try/catch`, zaraz po `zasiejSlownikAtrybutow`,
  bez importu cyklicznego — `app.ts:104-112`.
- Hook skanu po `POST /api/staging/accept` (`staging-mutacje.ts:195-199`) i trasa
  `POST /api/atrybuty/scan-pending` (`routes/atrybuty.ts:501-514`) wołają tę samą
  `skanujNoweWartosci` — sprzątanie działa identycznie w obu miejscach, audyt trasy
  `scan-pending` (`atrybut_pending_skanowano`, `szczegoly: staty`) nietknięty, hook `accept` nie
  audytuje skanu (jak przed ticketem).
- Seed `bieznik` z `SELECT DISTINCT bieznik FROM products` zamiast `model`, `INSERT OR IGNORE`
  bez zmian — `atrybuty.ts:381-387`.
- `pomiar-kolejki.ts`: wzór oryginału (`podobienstwoOryginal`/`czySugerowacOryginal`) zgodny znak
  w znak z `mirror/backend/pending_module.cjs:57-72`, w tym `nowa !== kanoniczna` przepuszczające
  self-match — sprawdzone bezpośrednio w oryginale.
- Testy: `atrybuty.podobienstwo.test.ts`, `atrybuty.pending.test.ts`, `atrybuty.crud.test.ts`,
  `atrybuty.niezmiennik.test.ts` — odwrócenia opisane komentarzami „świadome odstępstwo" z
  odniesieniem do decyzji Ani 2026-09-21, przypadki bez różnic wielkości liter (np. `AGRI STAR
  II`→`AGRISTAR II` 92%, reguła „ABCDEFGHIJKLMNOPQRSU+") zostały nietknięte.
- Komentarze w `src/`: żadne miejsce nie wspomina już „bieżnik z modelu", „nie czyści kolejki"
  ani „skan nigdy nie usuwa" (grep czysty) — treść zastąpiona opisem świadomego odstępstwa.
- `usunZKolejkiObecneWSlowniku` nie wchodzi do kształtu odpowiedzi `scan-pending`
  (`atrybuty.pending.test.ts:186-189` sprawdza dokładny zestaw kluczy) i nie zostawia wpisu w
  `audit_log` (D4) — potwierdzone brakiem odniesień do audytu w diffie `atrybuty-pending.ts`.
- Bramki: `npm run lint` ✓, `npm run typecheck` ✓, `npm run build` ✓, `npm test` ✓
  (88 plików / 1411 testów) na Node 20.20.2 — zgodne z raportem.

### Missing or deviating ✗
- Brak — plan i raport spójnie opisują jedyne odejście od planu (`atrybuty.niezmiennik.test.ts`
  zmieniony zamiast pozostawiony nietkniętym), które jest udokumentowaną decyzją użytkownika po
  pytaniu zwrotnym (raport, sekcja „Deviations from plan").

### Definition of done
- [x] Seed `bieznik` z `products.bieznik`, test to potwierdza (`atrybuty.crud.test.ts:346-367`).
- [x] Pozycja kolejki obecna dosłownie w słowniku znika po skanie i po starcie; test na ≥ 2
      rodzajach (`atrybuty.pending.test.ts:186-210`, rodzaje `marka` i `kategoria`).
- [x] Nigdy nie ma sugestii identycznej z pozycją; różnica tylko wielkości liter lub spacji daje
      sugestię 100 (`atrybuty.podobienstwo.test.ts` sekcje self-match i normalizacja).
- [x] `Ą`/`ą` się zrównują (test) — `atrybuty.podobienstwo.test.ts:75-80`.
- [x] Skan nadal dokładny (`bkt` przy `BKT` w kolejce) —
      `atrybuty.pending.test.ts:212-229`, `atrybuty-pending.ts` D7.
- [x] `atrybuty.niezmiennik.test.ts` i `atrybuty.gate.test.ts` zielone — `niezmiennik` zmieniony
      świadomie po zwrotnym pytaniu do użytkownika (odstępstwo od pierwotnego planu, opisane w
      raporcie), oba pliki zielone w pełnym przebiegu testów.
- [x] Pomiar przed/po na snapshocie w raporcie, z odpowiedzią na ALLIANCE/Alliance — raport.md,
      sekcje „Kolejka" i „ALLIANCE/Alliance (#92)".
- [x] lint, typecheck, build, test zielone — zweryfikowane bezpośrednio w tym review.

## Parallel-test concerns

None — wszystkie nowe testy używają bazy tymczasowej na środowisko testowe (`srodowisko.db`),
bez portów ani wspólnych plików. `pomiar-kolejki.ts` kopiuje `db/snapshot.db` do
`mkdtempSync`/tymczasowego katalogu przed użyciem (backup, nie odczyt bezpośredni), więc też nie
koliduje z równoległą pracą — ale to skrypt pomiarowy uruchamiany ręcznie, nie część `npm test`.

## Overall assessment

Zmiana jest precyzyjnie dopięta do planu: trzy świadome odstępstwa (D1 sprzątanie/brak
self-matchy, D5 źródło seedu `bieznik`, D6 normalizacja podobieństwa) są zaimplementowane
dokładnie tak, jak opisano, z komentarzami w kodzie odsyłającymi do decyzji Ani zamiast starych
opisów „quirka". Porównanie BINARY (brak `COLLATE NOCASE` w schemacie) i miejsce wywołania
sprzątania (koniec skanu + start po seedzie, poza importem cyklicznym) są zgodne z D1/D7.
Kształt odpowiedzi `scan-pending`/`pending` i audyt `PRZEPISANIA_Z_KOLEJKI` z P7.1 pozostają
nietknięte. Jedyne odejście od pierwotnego planu (`atrybuty.niezmiennik.test.ts`) jest
udokumentowaną, świadomą decyzją użytkownika po zwrotnym pytaniu, a nie samowolką. Wszystkie
cztery bramki (lint, typecheck, build, test — 1411 testów) przechodzą lokalnie. Jedyne uwagi to
kosmetyczna nieścisłość w nazwie jednego testu (SHOULD-FIX) i odnotowanie istniejącego wcześniej
wzorca N+1 w `listaPending` (NICE-TO-HAVE, poza zakresem).
