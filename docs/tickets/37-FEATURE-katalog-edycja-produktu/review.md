# 37-FEATURE-katalog-edycja-produktu — Code review

> Reviewed: 2026-09-05
> Branch: `feature/37-katalog-edycja-produktu`
> Diff: 12 plików, 2 commity (`16deca5`, `8b4c612`)

## BLOCKER

Brak. Nie znalazłem błędów logicznych, luk bezpieczeństwa, naruszeń Definition of done ani
rozjazdu z kontraktem, które kwalifikowałyby się jako blokujące. Bramki (`lint`, `typecheck`,
`build`, `test`) uruchomione lokalnie — wszystkie czyste, 682/682 testów zielonych, `katalog.gate.test.ts`
przechodzi nietknięty.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/katalog/TabelaProduktow.tsx:140-142` — nagłówek ostatniej
  kolumny nadal pokazuje tekst „Podgląd", mimo że odstępstwo D4 zostało zniesione i kolumna
  od tej sesji mieści pełne menu „Akcje" (Edytuj/Historia/Wstrzymaj-Aktywuj/Usuń).
  - Powód: oryginał ma tu dosłownie „Akcje" (`deminified/frontend-index.js:23693-23696`).
    Komentarz tuż nad kodem (linie 14-16, dopisany w TYM tickecie) mówi wprost „kolumna
    wróciła do oryginału" — kod temu przeczy. Żaden test nie sprawdza treści tego nagłówka
    (`test/katalog.test.tsx` i `katalog.edycja.test.tsx` adresują menu przez `data-testid`/rolę,
    nie przez nagłówek tabeli), więc regres przeszedł niezauważony przez GATE. To dokładnie ten
    rodzaj literalnej niezgodności tekstu, o który dba reszta tego ticketa (etykiety pól, toasty,
    tekst potwierdzenia usunięcia) — tu akurat nie dopilnowano.
  - Sugestia: zmienić `children: "Podgląd"` na `"Akcje"` (jedna linijka) i dodać asercję
    w `katalog.test.tsx` lub `katalog.edycja.test.tsx` sprawdzającą treść `header`/`<th>` tej
    kolumny, żeby podobny regres złapał GATE, a nie code review.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/katalog/DialogEdycjiProduktu.tsx:291` — nagłówek dialogu liczy
  `String(produkt.kodDostawcy ?? "") || produkt.kod`, podczas gdy oryginał robi
  `e.kodDostawcy || e.kod` (`:24038`). Różnica ujawni się tylko, gdyby `kodDostawcy` było liczbą
  `0` (`String(0)` = `"0"`, string prawdziwościowy, więc wygrałby zamiast `kod`) — w praktyce to
  pole tekstowe z zewnętrznego importu dostawcy, więc ryzyko czysto teoretyczne. Nie blokuję,
  tylko odnotowuję na wypadek, gdyby kiedyś `kodDostawcy` zaczęło przychodzić jako liczba.
- [ ] `rebuild/frontend/src/pages/katalog/MenuAkcji.tsx:85-89` — pozycja „Wstrzymaj/Aktywuj" nie
  ma żadnego stanu `disabled`/`pending` na czas trwania mutacji, więc dwuklik przed odświeżeniem
  UI wyśle dwa `PATCH` pod rząd (drugi z odwróconą, już nieaktualną etykietą). Oryginał ma tę
  samą wadę (`:23791-23799`, zero blokady), więc to nie jest odstępstwo — tylko wskazówka, gdyby
  ktoś kiedyś chciał to poprawić przy okazji.

## Plan compliance

### Done ✓
- Krok 1 (`src/pages/katalog/api.ts`) — port `Og`/`jb`/odczytu i kasowania override'ów, bez
  własnego `fetch`, na `zadanie()`.
- Krok 2 (`src/pages/katalog/poleEdycji.ts`) — 42 pola jako dane, kolejność i dosłowne etykiety
  zweryfikowane linia po linii wobec `:24041-24095`, `KLUCZE_PAYLOADU` zgodne z
  `POLA_EDYTOWALNE_PRODUKTU` (potwierdzone testem i ręcznie).
- Krok 3 (`DialogEdycjiProduktu.tsx`) — port `LT()`: stan `zmiany` startuje pusty, `useEffect`
  resetuje przy zmianie `produkt?.id` PRZED wczesnym `return null` (kolejność hooków poprawna —
  `useQuery`×2, `useMemo`×2, `useEffect`, dopiero potem `if (!produkt) return null`), override'y
  mapowane po `fieldName` (camelCase, zgodnie z fixture'em), pole scalone „Bieznik/model" pisze
  oba klucze.
- Krok 4 (`MenuAkcji.tsx` + `TabelaProduktow.tsx`) — kolejność pozycji 1:1 (Edytuj → Historia
  disabled → separator → Wstrzymaj/Aktywuj → Usuń), toggle jako jedna pozycja — potwierdzone
  testem `katalog.edycja.test.tsx:126-138`. Wyjątek: nagłówek kolumny, patrz SHOULD-FIX.
- Krok 5 (`Katalog.tsx`) — trzy `useMutation`, toasty dosłowne (`Zapisano zmiany` /
  `Wstrzymano`/`Aktywowano` / `Usunięto produkt`), invalidacje `["/api/products"]` +
  `["/api/history"]` bez `["/api/alerts"]`/`["/api/analytics"]`, `DialogPotwierdzenia` z tekstem
  `Usunąć {kod}?`.
- Krok 6 — `PodgladProduktu.tsx` usunięty, brak martwych importów, `KOLUMNY`/`formatujKomorke`
  mają innych konsumentów.
- Krok 7 — testy: `katalog.poleEdycji.test.ts` (18), `katalog.edycja.test.tsx` (18),
  `katalog.test.tsx` zaktualizowany, `test/msw/kontrakt.ts` ma `overridesZFixtura()`.
- Cztery decyzje D1–D4 zrealizowane zgodnie z opisem w planie.

### Missing or deviating ✗
- Nagłówek kolumny „Akcje" w `TabelaProduktow.tsx` nie został przywrócony mimo zniesienia D4
  (patrz SHOULD-FIX) — jedyne miejsce w diffie, gdzie deklarowany stan („kolumna wróciła do
  oryginału") rozjeżdża się z kodem.
- Odstępstwo `onError` z toastem `destructive` — NIE jest w liście D1–D4, ale jest jawnie
  opisane i uzasadnione w `raport.md` („Odstępstwa od planu") jako spójne z konwencją reszty
  odbudowy (`narzuty/TabelaNarzutow.tsx`, `Staging.tsx`). Traktuję to jako świadome,
  udokumentowane odstępstwo, nie jako przeoczenie — zgodnie z regułą „plan.md może nie
  przewidzieć wszystkiego, ale odstępstwo musi być zapisane", co tu ma miejsce.

### Definition of done
- [x] Dialog edycji zastępuje podgląd read-only; `PodgladProduktu.tsx` usunięty, D4 zniesione.
- [x] 42 pola w kolejności oryginału, dosłowne etykiety, `dostawca` disabled, „Bieznik/model"
      pisze `model`+`bieznik`, cztery pola warunkowe działają jako select przy niepustym słowniku.
- [x] `PATCH` wysyła wyłącznie dotknięte pola i wyłącznie klucze z `POLA_EDYTOWALNE_PRODUKTU`
      (dowiedzione testem `katalog.poleEdycji.test.ts:44-49`).
- [x] Menu „Akcje" w kolejności 1:1, toggle jako jedna pozycja (samo menu — patrz uwaga o
      nagłówku kolumny w SHOULD-FIX, to nie jest część menu, ale wizualne otoczenie kolumny).
- [x] Usuwanie woła `DELETE` po potwierdzeniu w `DialogPotwierdzenia` z tekstem `Usunąć {kod}?`;
      anulowanie nie wysyła żądania.
- [x] Override'y widoczne i kasowalne przez `DELETE /api/overrides/{id}`, invalidacja
      `["/api/overrides", dostawca, kod]`.
- [x] Invalidacje `["/api/products"]` + `["/api/history"]`, bez `["/api/alerts"]`/`["/api/analytics"]`
      (asercja negatywna w teście).
- [x] Toasty z dosłownymi tekstami oryginału (cztery przypadki, zweryfikowane wobec
      `:23800-23808`, `:23899-23902`).
- [x] `lint`/`typecheck`/`build`/`test` czyste (zweryfikowane lokalnie: 682/682, `katalog.gate.test.ts`
      przechodzi nietknięty).

## Parallel-test concerns

None — wszystkie nowe testy używają MSW + efemerycznego `queryClient.clear()`/`localStorage.clear()`
w `beforeEach`, bez portów ani plików tymczasowych ze stałą ścieżką.

## Overall assessment

Bardzo wierny port — pole po polu, etykieta po etykiecie, zgodny z `LT()` i menu wierszowym co
do znaku, z solidnym testem strażniczym na zgodność `KLUCZE_PAYLOADU`/`POLA_EDYTOWALNE_PRODUKTU`
(odporny na typowe zmiany formatowania, bo liczy długość i porównuje posortowane listy zamiast
ufać samemu dopasowaniu regexu). Cztery decyzje D1–D4 zrealizowane zgodnie z planem, bez
niezatwierdzonych odstępstw poza jednym udokumentowanym (`onError`). Jedyna realna usterka to
zapomniana zmiana nagłówka kolumny „Podgląd" → „Akcje" — nieszkodliwa funkcjonalnie, ale
sprzeczna z własnym komentarzem kodu i z duchem całego ticketu, który dba o literalną zgodność
tekstów. Kierunek i jakość implementacji nie budzą zastrzeżeń, można mergować po (lub nawet bez)
poprawki nagłówka — to kosmetyczny, jednolinijkowy fix.
