# 74-FEATURE-slad-kolejki-atrybutow — ślad akcji kolejki atrybutów w Historii (#39) + jedna mapa rodzaj→kolumna (#41)

> Status: Approved
> Branch: `feature/74-slad-kolejki-atrybutow`
> Worktree: `.worktrees/74-FEATURE-slad-kolejki-atrybutow`
> Karta: **P7.1** (plan P, Iteracja 7) · backlog **#39**, **#41**

## Ticket description

P7.1 — Iteracja 7: akcje kolejki atrybutów zostawiają ślad w Historii (#39) + uzgodnienie map
rodzaj→kolumna (#41). Wejście biznesowe: odpowiedzi Ani z 2026-09-21, runda 2, pytanie 7.1
(„tak, ma zostawiać ślad w historii”) i 7.4 („trzeba naprawić”). Oba punkty to świadome
odstępstwa od produkcji, zatwierdzone przez Anię. Warunek startu (P5.1, ticket 69, PR #85
zmergowany 2026-09-21 14:21) spełniony: `SLOWNIK_AKCJI` + `akcjeHistorii()` są w develop.

## Context

- Kolejka pending (`routes/atrybuty.ts`, port `pending_module.cjs`) nie pisze do `audit_log` —
  oryginał nie dostaje funkcji audytu (`pending_module.cjs:199`). Dwie trasy
  (`akceptuj-z-edycja`, `akceptuj-jako-alias`) robią masowy `UPDATE products SET <kol>=? WHERE <kol>=?`.
- Widok Historii (`historia/mapowanie.ts`) przepuszcza tylko akcje z `SLOWNIK_AKCJI`. Dla typu
  `edycja` mapowanie ma na sztywno `liczbaPozycji = 1` i `uwagi = null`, a `kodProduktu` bierze
  z `encja_id`. Front (`TabelaHistorii.tsx:80-96`) przy `edycja` pokazuje TYLKO `kodProduktu`
  (pogrubiony mono) i listę `zmienionePola` — `uwagi` ignoruje. Samo dopisanie akcji do
  słownika dałoby wiersz „Pozycji: 1” przy operacji na setkach produktów — mylący.
- Dwie mapy rodzaj→kolumna: `repos/atrybuty.ts` `RODZAJ_KOLUMNA` (15) i
  `repos/atrybuty-pending.ts` `RODZAJE_KOLUMNY` (13, bez `model`/`zastosowanie`).

### Pomiar rozbieżności #41 (fakt)

1. `origin/main:mirror/backend/pending_module.cjs` — jedyny commit to baseline (`e03e2aa`,
   2026-08-13); mapa `RODZAJE_KOLUMNY` (`:22-36`) identyczna jak na develop, 13 rodzajów.
   **Produkcja we wrześniu NIE zmieniła zakresu skanu.**
2. `db/snapshot.db`, `atrybuty_wartosci_pending`: `bieznik` 296, `rozmiar` 99, `marka` 68,
   `indeks_nosnosci` 27, `kategoria` 7, `konstrukcja` 1 — **0 wierszy `model`/`zastosowanie`**.
   Jedynym pisarzem tabeli jest skan (13 rodzajów), w oryginale i w rebuild.
3. Źródło rozjazdu: `docs/instrukcja-testow-I7.md:317-320` (§4 pkt 4) mówi nieprawdziwie „Te dwa
   rodzaje trafiają do kolejki”. Ania odpowiadała na podstawie tego zdania, a nie błędu
   zaobserwowanego w danych. Backlog #41 („nieosiągalne dzisiejszą ścieżką UI”) miał rację.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

- **Kształt odpowiedzi żadnej trasy się nie zmienia.** Trasy kolejki (`contract/openapi.yaml`,
  `/api/atrybuty/pending*`, `/api/atrybuty/scan-pending`) oddają dokładnie to samo ciało;
  fixture `GET_atrybuty_pending.json` bez zmian (skan i lista nietknięte).
- `GET /api/history/paged` i `/meta` — kształt wpisu (12 pól) bez zmian, `typ` pozostaje w enumie
  `import|eksport|edycja`. Gate: `test/historia.gate.test.ts` (fixtures) i
  `test/historia.wyrocznia.test.ts` (porównanie z oryginałem na snapshocie) muszą zostać
  zielone. Snapshot nie ma wierszy `atrybut_pending_*`, a mapowanie `edycja_produktu` się nie
  zmienia, więc wynik na snapshocie jest identyczny. Różnica wobec produkcji pojawi się dopiero
  przy nowych zdarzeniach kolejki.
- `GET /api/atrybuty/liczniki`, `/uzycie` — gate `test/atrybuty.gate.test.ts` bez zmian (ta sama
  15-pozycyjna mapa).

## Decisions

- **D1 (#39, decyzja Ani 7.1 = odstępstwo).** Wszystkie trasy kolejki, które coś zmieniają,
  piszą do `audit_log` przez istniejące `audytuj()` (try/catch, PO udanej operacji, poza
  transakcją repo, tak jak CRUD słownika). Akcje:
  | trasa | akcja | szczegóły |
  |---|---|---|
  | `POST …/:id/akceptuj` | `atrybut_pending_zaakceptowano` | `{rodzaj, wartosc}` |
  | `POST …/:id/akceptuj-z-edycja` | `atrybut_pending_zaakceptowano_z_edycja` | `{rodzaj, kolumna, z, na, produktow_zaktualizowano}` |
  | `POST …/:id/akceptuj-jako-alias` | `atrybut_pending_zaakceptowano_jako_alias` | `{rodzaj, kolumna, z, na, produktow_zaktualizowano}` |
  | `POST …/:id/odrzuc` | `atrybut_pending_odrzucono` | `{rodzaj, wartosc}` |
  | `DELETE /api/atrybuty/pending` | `atrybut_pending_wyczyszczono` | `{rodzaj, usunieto}` |
  | `POST /api/atrybuty/scan-pending` | `atrybut_pending_skanowano` | statystyki skanu |
  `encja_typ = "atrybut_pending"`, `encja_id` = id pozycji (dla DELETE/skanu `null`).
  Nazwy w czasie przeszłym, spójne z `atrybut_wartosc_dodano|zmieniono|usunieto`. Klucze
  `z`/`na`/`produktow_zaktualizowano` = te same, co w odpowiedzi trasy.
  Wpis powstaje także przy `produktow_zaktualizowano = 0`, bo akcja użytkownika i tak zmienia
  słownik i kolejkę. Skan wywoływany hookiem `POST /api/staging/accept` NIE jest audytowany:
  to nie trasa kolejki, a akceptację stagingu audytuje jej własna trasa.
- **D2 (#39, decyzja użytkownika 2026-09-21: „Mapowanie dla 2 akcji”).** W Historii widać TYLKO
  dwie akcje przepisujące produkty, zmapowane na ISTNIEJĄCY typ `edycja`. Bez nowego typu,
  bez zmian we froncie, w filtrze i w kontrakcie. Dopisanie ich do `SLOWNIK_AKCJI` to odstępstwo
  wprost z decyzji Ani. Przy porcie Historii świadomie tego nie robiliśmy (D2 ticketu 15,
  backlog #21 dotyczy importów/synchronizacji, nie kolejki). W `naWpisHistorii()` dochodzi gałąź
  TYLKO dla tych dwóch akcji; `edycja_produktu` mapuje się dalej 1:1 z oryginałem:
  - `liczbaPozycji` = `produktow_zaktualizowano` (realna liczba z `UPDATE`);
  - `kodProduktu` = `marka: „NOKIAN HAKKA” → „NOKIAN”` (kolumna + wartość przed → po);
  - `zmienionePola` = `["marka (alias z kolejki)"]` / `["marka (edycja z kolejki)"]`;
  - `uwagi` = `Kolejka atrybutów — alias: marka „NOKIAN HAKKA” → „NOKIAN”, produktów: 312`.
    Front go przy `edycja` nie pokazuje, ale łapie go wyszukiwarka, która przeszukuje cały wpis.
  Pozostałe cztery akcje są tylko w `audit_log` (i w `GET /api/audit-log`).
  Jedno źródło: mapa `PRZEPISANIA_Z_KOLEJKI` (akcja → etykieta wariantu) w `mapowanie.ts`,
  z której `SLOWNIK_AKCJI` bierze swoje wpisy, a `naWpisHistorii()` rozpoznaje gałąź. Druga
  lista akcji nie powstaje, a `akcjeHistorii()` obejmuje nowe akcje automatycznie.
- **D3 (#41, decyzja Ani 7.4 + użytkownika: „wariant bezpieczny”).** Jedna mapa
  `RODZAJ_KOLUMNA` (15, `repos/atrybuty.ts`) dla liczników, użycia i OBU akceptacji.
  `RODZAJE_KOLUMNY` znika. Zakres skanu to jawna, osobna lista `ZAKRES_SKANU` (13 rodzajów,
  kolejność z oryginału `:22-36` — decyduje o kolejności INSERT-ów, czyli o `id` pozycji),
  typowana jako podzbiór kluczy mapy. Węższy zakres jest celowy (#40: `model` zalałby kolejkę),
  nie jest kolejnym rozjazdem. Nieznany rodzaj (spoza 15) nadal daje 400
  `Nieznany rodzaj: <rodzaj>`.

### Świadome odstępstwa od oryginału
1. Audyt sześciu tras kolejki (oryginał: zero) — #39, Ania 7.1.
2. Dwie akcje w słowniku Historii + ich mapowanie (liczba, opis) — #39, Ania 7.1 + D2.
3. Akceptacje przyjmują `model` i `zastosowanie` (oryginał: 400) — #41, Ania 7.4.

## Implementation plan

1. **#41 — jedna mapa** (`repos/atrybuty-pending.ts`, `repos/atrybuty.ts`):
   import `RODZAJ_KOLUMNA` do repo kolejki; `ZAKRES_SKANU: readonly RodzajSlownika[]`;
   `kolumnaRodzaju()` czyta `RODZAJ_KOLUMNA`; `skanujNoweWartosci()` iteruje `ZAKRES_SKANU`.
   Komentarze przy obu mapach przepisane (stan, nie rozjazd). Seed, kandydaci i podobieństwo
   nietknięte (P7.2). Testy: crud `:290-301` (asercja na `ZAKRES_SKANU`), pending `:239-250`
   (model → 200 i przepisuje `products.model`), nowe: `zastosowanie` z edycją i aliasem,
   nieznany rodzaj → 400, skan nie tworzy `model`/`zastosowanie`.
2. **#39 — audyt tras kolejki** (`routes/atrybuty.ts`): wywołania `audytuj()` wg D1, komentarz
   sekcji kolejki i nagłówek repo zaktualizowane. Test `:456-474` odwrócony: każda akcja
   zostawia właściwy wpis, a awaria audytu nie zmienia odpowiedzi 200.
3. **#39 — Historia** (`historia/mapowanie.ts`): `PRZEPISANIA_Z_KOLEJKI`, wpisy w `SLOWNIK_AKCJI`,
   gałąź w `naWpisHistorii()`, poprawiony komentarz słownika (#21 vs #39). Testy: jednostkowe
   w `historia.mapowanie.test.ts`, integracyjny end-to-end: akceptacja → `GET /api/history/paged`
   pokazuje wpis, `?typ=edycja` go zawiera, pozostałe cztery akcje go nie mają.
4. Bramki: lint, typecheck, build, test.

## Testing strategy

- Bez mocków, prawdziwa baza z `stworzSrodowiskoTestowe()`.
- Gate: `historia.gate.test.ts`, `historia.wyrocznia.test.ts`, `atrybuty.gate.test.ts` zielone
  bez zmian w fixtures.
- Nowe/zmienione: `atrybuty.pending.test.ts` (audyt, model/zastosowanie, skan),
  `atrybuty.crud.test.ts` (asercja o zakresie skanu), `historia.mapowanie.test.ts` (gałąź),
  test end-to-end kolejka → Historia.

## Out of scope

- Frontend (w tym nieaktualne komentarze „bez audytu (#39)” w `rebuild/frontend/src/pages/atrybuty/api.ts`
  i „pięć akcji” w `pages/historia/dane.ts`) → follow-up.
- `contract/`, fixtures.
- Seed `bieznik`, kandydaci aliasów, podobieństwo (P7.2: #40, #42).
- Zakres skanu (I15, jeśli kiedyś).
- Sprostowanie `docs/instrukcja-testow-I7.md` §4 pkt 4 i pkt 7 → karta P7.4 (follow-up).

## Definition of done

- [ ] Sześć tras kolejki pisze wpisy `atrybut_pending_*` wg D1, a błąd audytu nie daje 500.
- [ ] Akceptacja z edycją i alias są widoczne w `GET /api/history/paged` jako `edycja` z realną
      liczbą produktów i opisem przed → po; cztery pozostałe akcje nie są widoczne.
- [ ] Akceptacje dla `model` i `zastosowanie` przepisują właściwą kolumnę; skan nadal ich nie
      tworzy; rodzaj spoza 15 daje 400 z dotychczasowym komunikatem.
- [ ] Jedna mapa rodzaj→kolumna + jawny `ZAKRES_SKANU`.
- [ ] Wyrocznia i gate Historii zielone; lint/typecheck/build/test zielone.
- [ ] Backlog #39/#41 i wiersz P7.1 w roadmapie zaktualizowane.
