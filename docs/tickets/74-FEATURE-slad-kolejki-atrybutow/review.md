# 74-FEATURE-slad-kolejki-atrybutow — Code review

> Reviewed: 2026-09-21
> Branch: feature/74-slad-kolejki-atrybutow
> Diff: 9 plików (147+95 dokumentacji ticketu, 4 pliki źródłowe, 3 pliki testów), 5 commitów

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:3076` — wiersz `P7.1` nadal ma stan `⬜ gotowe` (nieoznaczony jako
      zamknięty, brak daty i ID ticketa).
  - Reason: Plan (Definition of done, ostatni punkt) wprost wymaga aktualizacji wiersza P7.1 w
    roadmapie i backlogu #39/#41 po zamknięciu karty. CLAUDE.md, sekcja „Roadmapa jest wejściem
    dla następnej sesji", obowiązek 1, traktuje to jako regułę stałą projektu — roadmapa ma
    opisywać STAN, nie zamiar, bo czyta ją następna sesja. Bez tej aktualizacji kolejna sesja
    planująca I7 (P7.2/P7.3/P7.4) zobaczy kartę P7.1 jako wciąż otwartą.
  - Suggestion: oznaczyć `P7.1` jako zrobione (data + `74-FEATURE-slad-kolejki-atrybutow`), tak
    jak inne zamknięte karty w tej tabeli.
- [ ] `docs/rebuild-backlog.md:2418-2456` (#39) i `:2503-` (#41) — pola „Status” nie odzwierciedlają
      naprawy dowiezionej w tym tickecie.
  - Reason: To ten sam obowiązek co wyżej — „Do decyzji” w #39 i status „nieosiągalne dzisiejszą
    ścieżką UI” w #41 opisują stan SPRZED tego ticketu. Wpis #39 wciąż brzmi jak otwarty problem
    („Do decyzji. Czy dołożyć audyt…”), mimo że audyt już jest. Kolejna sesja czytająca backlog
    dostanie fałszywy obraz zakresu.
  - Suggestion: dopisać sekcję „Co zrobił ticket 74” z odnośnikiem do PR/ticketu, zaktualizować
    pole „Status” obu wpisów.

## SHOULD-FIX

Brak. Kod merytoryczny (routes/atrybuty.ts, repos/atrybuty*.ts, historia/mapowanie.ts) jest
staranny, testy pokrywają zarówno szczęśliwą ścieżkę, jak i błędy (404/400, awaria audytu,
skan z hooka stagingu).

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/historia/mapowanie.ts:205` — `kolumna` w `przepisanieZKolejki()` bierze
      najpierw `szczegoly["kolumna"]`, potem `szczegoly["rodzaj"]` jako fallback; oba klucze są
      dziś zawsze obecne w `szczegoly` (trasa zapisuje je razem), więc fallback jest martwy kod
      poza testem jednostkowym z ręcznie spreparowanym wejściem. Nieszkodliwe, ale warto
      skomentować, że to wyłącznie zabezpieczenie na uszkodzone `szczegoly_json`, a nie realna
      ścieżka.
- [ ] `rebuild/backend/test/atrybuty.pending.test.ts:594-596` — komentarz „Kolejność po `kiedy` —
      dwie akcje w tej samej milisekundzie dałyby remis, stąd sort” dobrze tłumaczy, dlaczego test
      sortuje wynik samodzielnie zamiast ufać kolejności z API; warto ten sam wzorzec (sort po
      stabilnym kluczu zamiast po `kiedy`) mieć na uwadze przy kolejnych testach end-to-end
      Historii, które dodają więcej niż jeden wpis w tym samym callu.

## Plan compliance

### Done ✓
- #41 — jedna mapa `RODZAJ_KOLUMNA` (15 pozycji) używana przez liczniki, użycie i OBIE akceptacje;
  `RODZAJE_KOLUMNY` usunięta. `ZAKRES_SKANU` (13 pozycji) w kolejności identycznej z
  `mirror/backend/pending_module.cjs:22-36` (zweryfikowane bajt w bajt) — wpływa na kolejność
  `INSERT`-ów, czyli na `id` pozycji kolejki.
- `kolumnaRodzaju()` i `znanyRodzaj()` bezpieczne przed prototypem — `Object.hasOwn` na stałej
  mapie, `sql.raw` dostaje kolumnę wyłącznie z `RODZAJ_KOLUMNA[rodzaj]`, nigdy z surowego wejścia.
- #39 — sześć tras kolejki (`akceptuj`, `akceptuj-z-edycja`, `akceptuj-jako-alias`, `odrzuc`,
  `DELETE /api/atrybuty/pending`, `POST /api/atrybuty/scan-pending`) woła `audytuj()` PO udanej
  operacji, poza transakcją repo, przez ten sam `try/catch` helper co CRUD słownika. Ścieżki błędu
  (404 „Pozycja pending nie istnieje”, 400 „Brak nowa_wartosc”/„Brak kanoniczna_wartosc”/„Nieznany
  rodzaj”) kończą się `return` PRZED `audytuj()` — zweryfikowane czytaniem kodu i testem
  „odrzucone żądania (404, 400) nie zostawiają wpisu”. Hook skanu z `POST /api/staging/accept` nie
  audytuje — osobny test to pilnuje.
- `produktow_zaktualizowano` w szczegółach audytu = wartość zwrócona przez repo, która pochodzi z
  `wynik.changes` prawdziwego `UPDATE` (`atrybuty-pending.ts:332,355,384`), nie z długości listy
  ani z zliczenia w pamięci — zgodne z wymaganiem „liczba = realne changes”.
- Historia: `PRZEPISANIA_Z_KOLEJKI` to jedyne źródło dwóch nowych wpisów `SLOWNIK_AKCJI`;
  `akcjeHistorii()` je automatycznie obejmuje (klauzula SQL). Gałąź `przepisanieZKolejki()` w
  `naWpisHistorii()` uruchamia się WYŁĄCZNIE dla dwóch akcji kolejki — `edycja_produktu` przechodzi
  przez niezmienioną ścieżkę (kodProduktu z `encja_id`, `liczbaPozycji = 1`, `uwagi = null`,
  `zmiany` z `szczegoly["zmiany"]`). Nie powstała druga lista akcji.
- Kontrakt: brak zmian w `contract/` i `rebuild/frontend/` (zweryfikowane `git diff --stat`) —
  kształt odpowiedzi wszystkich tras kolejki i Historii bez zmian, zgodnie z sekcją „Kontrakt i
  fixtures” planu.
- Seed, generowanie kandydatów i podobieństwo (zakres P7.2) nietknięte — diff `repos/atrybuty.ts`
  to wyłącznie zmiana komentarza przy `RODZAJ_KOLUMNA`.
- Testy: bez mocków, prawdziwa baza (`stworzSrodowiskoTestowe()`), izolowana per test — brak
  współdzielonych zasobów, portów czy ścieżek na sztywno.
- Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` — wszystkie zielone
  (Node 20.20.2; 87 plików / 1360 testów przeszło).

### Missing or deviating ✗
- Aktualizacja `docs/rebuild-roadmap.md` (wiersz P7.1) i `docs/rebuild-backlog.md` (#39, #41) —
  wymagana ostatnim punktem Definition of done, nie wykonana (patrz BLOCKER wyżej).

### Definition of done
- [x] Sześć tras kolejki pisze wpisy `atrybut_pending_*` wg D1, a błąd audytu nie daje 500
      (`test/atrybuty.pending.test.ts` — „awaria zapisu audytu nie zamienia udanej akceptacji w 500”).
- [x] Akceptacja z edycją i alias widoczne w `GET /api/history/paged` jako `edycja` z realną
      liczbą produktów i opisem przed → po; cztery pozostałe akcje niewidoczne (test end-to-end
      „widok Historii pokazuje edycję i alias z kolejki, a pozostałe akcje pomija”).
- [x] Akceptacje dla `model` i `zastosowanie` przepisują właściwą kolumnę; skan nadal ich nie
      tworzy; rodzaj spoza 15 daje 400 z dotychczasowym komunikatem.
- [x] Jedna mapa rodzaj→kolumna + jawny `ZAKRES_SKANU` (kolejność zweryfikowana wobec oryginału).
- [x] Wyrocznia i gate Historii zielone; lint/typecheck/build/test zielone.
- [ ] Backlog #39/#41 i wiersz P7.1 w roadmapie zaktualizowane — NIE wykonane.

## Parallel-test concerns

None — wszystkie nowe i zmienione testy korzystają z `stworzSrodowiskoTestowe()` (baza tymczasowa,
tworzona i sprzątana per test), bez portów na sztywno ani współdzielonych plików.

## Overall assessment

Warstwa merytoryczna (backend, testy) jest bardzo solidna: gałąź w `naWpisHistorii()` dotyka
wyłącznie dwóch nowych akcji, `edycja_produktu` pozostaje bit w bit, jedno źródło prawdy dla
słownika akcji i dla mapy rodzaj→kolumna jest rzeczywiście jedno, audyt jest kompletny i
odporny na błędy zapisu, a kolejność `ZAKRES_SKANU` została zweryfikowana wobec oryginału zamiast
przyjęta na wiarę. Jedyny realny brak to dokumentacyjny: roadmapa i backlog nie zostały
zaktualizowane, mimo że plan.md i CLAUDE.md traktują to jako twardy wymóg zamknięcia karty —
to jedyne, co blokuje merge w obecnym stanie.
