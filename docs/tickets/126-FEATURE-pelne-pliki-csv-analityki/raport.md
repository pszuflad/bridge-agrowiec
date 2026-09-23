# 126-FEATURE-pelne-pliki-csv-analityki — raport z wdrożenia

## Podsumowanie

Plik CSV z Analityki dostaje teraz WSZYSTKIE wiersze po filtrach — sufit `LIMIT` tras dashboardu
zdjęty wyłącznie dla eksportu, opcjonalnym parametrem `?limit=0`. Tabela nadal rysuje 300 wierszy,
kafel „Pozycje unikalne" nadal liczy 1000, a trasa bez parametru odpowiada dokładnie tak jak przed
ticketem. Zakres objął **osiem** widoków z sufitem, nie trzy z promptu: pomiar pokazał, że ucina
dziś sześć, a dwa kolejne mają sufit i zapas.

## Zmiany

**Backend**
- `rebuild/backend/src/repos/analityka.ts` — nowa `czyBezLimitu()` (tylko `"0"` zdejmuje limit,
  mapowane na BRAK klauzuli `LIMIT`, nigdy na SQL-owe `LIMIT 0`); osiem funkcji repo dostało ostatni
  parametr `bezLimitu = false` z idiomem `${bezLimitu ? sql`` : sql`LIMIT ${STAŁA}`}` (wzorzec
  `listaWartosci`). Stałe `LIMIT_*` zostały na miejscu i są nadal domyślne.
- `rebuild/backend/src/routes/analytics.ts` — osiem tras czyta `czyBezLimitu(req.query.limit)`;
  sześć handlerów zmieniło `_req` → `req`; zaktualizowany komentarz nagłówkowy o tym, które trasy
  czytają `req.query`.
- `contract/openapi.yaml` — osiem ścieżek deklaruje opcjonalny `limit` (`enum: [0]`) z opisem
  semantyki. Schematy odpowiedzi bez zmian.

**Frontend**
- `rebuild/frontend/src/pages/analityka/api.ts` — **nowe** `zAdresemBezLimitu()` i
  `pobierzPelneWiersze()`: leniwe `queryClient.fetchQuery` z `?limit=0`, dziedziczy domyślny
  `queryFn` (nagłówki, `credentials`, `on401: "returnNull"`) i wspólny cache. `null` = błąd.
- `rebuild/frontend/src/pages/analityka/eksport.tsx` — `PrzyciskCsv` dostał opcjonalny
  `pobierzPelne`; ścieżka asynchroniczna ze spinnerem (`LoaderCircle`), `disabled` na czas
  pobierania, `toast` przy błędzie i **brak pliku**. Bez propu przycisk działa synchronicznie
  jak przed ticketem.
- Siedem sekcji podpiętych (osiem przycisków): `SekcjaEan.tsx` (`unique`, `ean-comparison`),
  `SekcjaDostepnosciProduktow.tsx`, `SekcjaTempaSchodzenia.tsx`, `SekcjaCyklZyciaDostawcow.tsx`,
  `SekcjaCeny.tsx`, `SekcjaMarze.tsx`, `SekcjaRotacji.tsx` (jedyna z dwoma parametrami:
  `?days` + `?limit=0`).

**Testy**
- **Nowy** `rebuild/backend/test/analityka.limity.test.ts` — 36 przypadków.
- **Nowy** `rebuild/frontend/test/analityka.eksport-pelne.test.tsx` — 7 przypadków.

## Pomiar — liczba wierszy w pliku przed i po

Zmierzone na kopii `db/snapshot.db`, przez skompilowane repo (`dist/repos/analityka.js`):

| Widok | Sufit | Plik PRZED | Plik PO | Zysk | Czas zapytania bez limitu | JSON |
|---|---:|---:|---:|---:|---:|---:|
| `unique` — 2.5 Pozycje unikalne | 1000 | 1000 | **5109** | +4109 | 31 ms | 597 KB |
| `availability-products` — 4.1 Historia dostępności | 500 | 500 | **5184** | +4684 | 47 ms | 825 KB |
| `sell-through` — 4.2 Tempo schodzenia | 500 | 500 | **5184** | +4684 | 77 ms | 513 KB |
| `suppliers-lifecycle` — 1.2 Nowości i wycofania | 500 | 500 | **1716** | +1216 | 5 ms | 307 KB |
| `prices-last` — 3.1 Zmiany cen | 500 | 500 | **1644** | +1144 | 8 ms | 292 KB |
| `rotation-inactive` — Rotacja (`days=60`) | 1000 | 1000 | **1100** | +100 | 7 ms | 225 KB |
| `ean-comparison` — 2.1-2.4 EAN wspólne | 1000 | 769 | 769 | — | 16 ms | 139 KB |
| `margins` — Marża (grupy) | 1000 | 335 | 335 | — | 12 ms | 37 KB |

**Czas NIE jest odczuwalny.** Najcięższe zapytanie bez limitu to 77 ms, największa odpowiedź
825 KB. Do tego pobranie jest leniwe (dopiero po kliknięciu CSV) i trafia do wspólnego cache
(`staleTime: Infinity`), więc drugie kliknięcie tego samego widoku jest natychmiastowe.

⚠ **Podstawa pomiaru.** Prompt mówił o „bazie stagingu, kopii produkcji z 23.09". W repo jest
wyłącznie `db/snapshot.db` z **2026-08-13** i na niej liczone są wszystkie liczby wyżej. Na
świeższej kopii liczby będą inne (najpewniej wyższe); mechanizm i wnioski bez zmian.

## Odstępstwa od planu

**Jedno, rozszerzające zakres w ramach decyzji D1.** Plan wymieniał osiem widoków z sufitem na
podstawie `docs/instrukcja-testow-I10-v2.md`. Po pomiarze okazało się, że lista jest trafna, ale
backlog #96 i karta P10.5 liczą tylko cztery z nich. Zakres = osiem, zgodnie z D1.

Poza tym 1:1 z planem. Dwa doprecyzowania w trakcie:
- `czyBezLimitu(0)` (liczba, nie napis) też zdejmuje limit — `String(0) === "0"`. Z HTTP przyjdzie
  napis, więc to nie zmienia zachowania trasy; udokumentowane testem.
- `products.data_aktualizacji` jest `NOT NULL` w schemacie odbudowy, więc testy rotacji robią
  „bez ruchu" datą sprzed lat, nie `NULL`-em.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne. Osiem ścieżek z sekcji „Kontrakt i fixtures"
  (`/api/analytics/{ean/unique, ean/comparison, availability/products, availability/sell-through,
  suppliers/lifecycle, prices/last-import, rotation/inactive, margins}`) — GATE (`analityka.gate`,
  `analityka.ean.gate`, `analityka.ceny.gate`, `analityka.dostawcy.gate`, `analityka.dostepnosc.gate`,
  `analityka.eksport.gate`) woła je BEZ parametru i przechodzi na **nietkniętych** plikach
  `contract/fixtures/GET_analytics_*.json`. Żaden fixture nie był zmieniany. `openapi.yaml` parsuje
  się poprawnie (sprawdzone `js-yaml`), zmiana dotyczy wyłącznie `parameters`.
- **Backend:** ✓ 1668 passed, 3 skipped (101 plików). Nowy `analityka.limity.test.ts` — 36/36.
- **Frontend:** ✓ 945 passed (55 plików). Nowy `analityka.eksport-pelne.test.tsx` — 7/7.
- **Bramki:** `lint` ✓, `typecheck` ✓, `build` ✓ w obu pakietach (Node 20.20.2).

Co dowodzą nowe testy:
- **backend** — dla każdej z ośmiu tras, na zbiorze PONAD sufitem: bez parametru dokładnie `LIMIT`
  wierszy, z `?limit=0` wszystkie, i `0` nie znaczy `LIMIT 0`. Plus: `margins` nie rusza `low`/`high`
  (200), `rotation/inactive` łączy `?days` z `?limit=0`, obie gałęzie `availability/products`;
- **frontend** — handlery MSW **rozróżniają** `?limit=0` (istniejący test tego nie łapał, bo MSW
  dopasowuje po ścieżce i ignoruje query string): plik 1200 wierszy przy tabeli 300 i kaflu 400,
  filtr zawęża PEŁNY zbiór (600, nie 200), pobranie dopiero po kliknięciu, Rotacja z dwoma
  parametrami, 500 i 401 → komunikat i **zero plików**, karta bez sufitu bez drugiego zapytania.

## Poprawki po review

Review (`review.md`): **0** uwag merytorycznych do kodu — reviewer przeszedł osiem tras repo, obie
gałęzie SQL `dostepnoscProduktow`, rozdzielenie dwóch limitów `marze()`, spójność filtrów CSV vs
tabela we wszystkich siedmiu sekcjach i przepuścił GATE (69/69) oraz nowe testy. Trzy zgłoszone
BLOCKER-y dotyczyły wyłącznie artefaktów dokumentacyjnych z DoD i są rozliczone w „Docs updates"
niżej (karta P10.5, status backlogu #96, wejście dla I15.9).

- **SHOULD-FIX — brak testu stanu przycisku w trakcie pobierania (decyzja D4).** Dodany
  (`analityka.eksport-pelne.test.tsx`, commit `bc14a00`): handler `?limit=0` wisi, dopóki test go
  nie zwolni, co pozwala zaasertować stan POŚREDNI — przycisk nieaktywny, spinner widoczny, zero
  plików — a po zwolnieniu: znowu aktywny, bez spinnera, dokładnie jeden plik z pełnym zbiorem.
  Frontend: 8/8 w tym pliku, 946 w całym pakiecie.

## Zmiany łamiące zgodność

Brak. Nowy parametr jest opt-in; bez niego wszystkie osiem tras odpowiada identycznie jak przed
ticketem, co pilnują nowe testy i niezmienione fixtures.

## Follow-up

- **Kontrakt nie opisuje istniejących parametrów analityki.** `contract/openapi.yaml` nie deklaruje
  `parameters:` dla `?days`, `?ean`, `?kod`, `?group`, `?minDiffPct` — luka sprzed tego ticketu.
  Dołożyliśmy tylko `limit`; reszta zostaje do osobnej decyzji (zapisane w „Do koordynatora").
- **`lifecycle/models` ucina 1691 → 1000**, ale ta karta NIE MA przycisku CSV (nie ma jej
  w `WidokEksportu`), więc sufit nie wchodzi do żadnego pliku. Poza zakresem #96.
- **Serwerowy `GET /api/analytics/export/{view}`** nadal nie ma konsumenta we froncie
  (`repos/analityka-eksport.ts`, `LIMIT_EKSPORTU = 5000` na 6/10 widoków). Świadomie nietknięty.

## Docs updates

### `docs/karty/P10.5/karta.md`
- `Stan` z `⬜ gotowe` na `✅ 2026-09-23 · 126-FEATURE-pelne-pliki-csv-analityki`, pole `Ticket` uzupełnione.
- Sekcja „Zakres" — zdanie o „trzech dotkniętych widokach" poprawione **w miejscu** na stan faktyczny
  (osiem z sufitem, sześć realnie ucinających, z liczbami); punkt o pomiarze też z „trzech" na „ośmiu".
- **Dowiezione** (była `—`) — mechanizm `?limit=0`, osiem funkcji repo z `bezLimitu = false`, osiem
  ścieżek openapi z `enum: [0]`, leniwe dociąganie z tymi samymi filtrami co tabela, pełna tabela
  pomiaru, świadome odstępstwo (błąd → toast, brak pliku), lista nietkniętego, wyniki bramek.
- **Do koordynatora** (była `—`) — trzy punkty: rozjazd zakresu 3→8/6 z odsyłaczem do pomiaru
  i `docs/instrukcja-testow-I10-v2.md:174-179`; luka w kontrakcie (brak `parameters:` dla
  `?days`/`?ean`/`?kod`/`?group`/`?minDiffPct`); `lifecycle/models` ucina 1691→1000, ale bez przycisku CSV.

### `docs/karty/I15.9/wejscie-126.md` (NOWY)
Wejście dla karty piszącej instrukcję testów I15 dla Ani, w formacie delty: pytanie A z I10-v2 §1.3
i odpowiedź Ani, liczby przed→po dla sześciu ucinanych kart, jawne „2.1-2.4 i Marża bez zmian",
ostrzeżenie że **plik jest teraz WIĘKSZY niż N ze stopki** (to nie błąd), sprostowanie zdania
„plik ma tyle wierszy, ile mówi stopka" z I10-v2 §1.3, opis spinnera i zachowania przy błędzie,
zastrzeżenie o podstawie pomiaru (snapshot 2026-08-13 vs odświeżony staging z decyzji D2).

### `docs/rebuild-backlog.md` — wpis `#96`
- `Status` → ✅ ZAMKNIĘTE 2026-09-23 + ticket + podsumowanie mechanizmu.
- „Na czym polega" — poprawione **w miejscu**: zmierzone liczby dla wszystkich sześciu ucinanych
  widoków (dodane `suppliers-lifecycle`, `prices-last`, `rotation-inactive`).
- Zdanie o kaflu „Pozycje unikalne" — doprecyzowane, że zostaje bez zmian.
- „Powiązane" — poprawione **w miejscu** zdanie sugerujące przywrócenie serwerowego `export/:view`
  jako drogę rozwiązania: ta droga została odrzucona (odebrałaby plikowi filtry, cofnęła sens #91).
- Zakres z „trzech" na „osiem" widoków + odsyłacz do `docs/spec-backend/wpis-126.md`.
- Sprawdzone #91 i #34: #91 („limit 300 nie dotyczy pliku — CSV ma WSZYSTKIE wiersze po filtrach")
  było nieprawdziwe przez ukryty sufit SQL, ale po tym ticketcie znów jest prawdziwe — bez poprawki.

### `docs/spec-backend/wpis-126.md` (NOWY — nie dopisek do `docs/spec-backend.md`)
Osiem tras z opcjonalnym `?limit` jako świadome odstępstwo; semantyka `czyBezLimitu()`; wzorzec
wierności (limit jako domyślna wartość parametru funkcji repo); dwie osobliwości (`marze()` z dwoma
limitami, `dostepnoscProduktow()` z dwiema gałęziami SQL); **znalezisko ticketu** — przed nim żaden
test nie bronił liczbowych `LIMIT_*`, bo fixtures nagrano poniżej sufitu, a GATE porównuje kształt,
nie liczbę wierszy; tabela pomiaru z zastrzeżeniem o dacie snapshotu.

### `rebuild/frontend/src/pages/analityka/README.md` (Master)
- §7a poprawione **w miejscu**: sygnatura `PrzyciskCsv` (doszedł `pobierzPelne`) i akapit „Zakres
  pliku" — zdanie „wszystkie wiersze po filtrach" było prawdziwe tylko modulo sufit SQL.
- **Nowa §7b** — kiedy karta musi podać `pobierzPelne` (tabelka: trasa z `LIMIT` → tak, bez → nie),
  przykład użycia i cztery rzeczy, które łatwo zepsuć: filtr musi być ten sam co w tabeli, pobranie
  ma zostać leniwe, `null` to błąd a nie pusty zbiór, adres musi nieść oba parametry w Rotacji.
  Plus ⚠ pułapka testowa: **MSW dopasowuje handlery po ścieżce i ignoruje query string**, więc test
  z jednym handlerem na trasę nie dowodzi o suficie niczego.

### Pre-existing issues (zgłoszone, nienaprawione — poza własnością tego ticketu)
- `docs/instrukcja-testow-I10-v2.md:171-179` — „Plik ma tyle wierszy, ile mówi stopka" jest od teraz
  nieaktualne dla ośmiu kart z sufitem. Plik należy do karty P10.4 (zamkniętej); sprostowanie
  zapisane jako zadanie dla I15.9 w `docs/karty/I15.9/wejscie-126.md`.
