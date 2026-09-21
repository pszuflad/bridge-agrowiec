# 72-FEATURE-alerty-przejrzany-szukajka — P6.1: trzeci status „przejrzany” i wyszukiwarka po treści alertu

> Status: Approved
> Branch: `feature/72-alerty-przejrzany-szukajka`
> Worktree: `.worktrees/72-FEATURE-alerty-przejrzany-szukajka`

## Opis ticketa
Karta P6.1 (Iteracja 6, „Poprawki po testach Ani”, `docs/rebuild-roadmap.md`). Lista alertów importu
na `/alerty` dostaje:
1. trzeci status `przejrzany` z akcjami na grupie i na pojedynczym wpisie (backlog #26, decyzja Ani
   z 2026-09-21: „używam obu”, runda 2, pytanie 1b);
2. wyszukiwarkę po treści alertu (backlog #90, Ania: „ta przydałaby się”, 2026-09-21, pytanie 6.4).

Obie rzeczy Ania rozstrzygnęła. **To nie jest zadanie wierności 1:1**: `/alerty` w odbudowie to nasz
widok na realnych alertach importu (D1 z I6). Oryginał `HT()` pokazuje pod tym adresem pseudo-alerty
katalogowe (to zakres P6.2), więc służy tu tylko jako źródło słownictwa.

## Kontekst
- **Backend.** `PATCH /api/alerts/:id` nie waliduje statusu (`routes/alerts.ts`, D4 z I6), a kolumna
  `alerts.status` nie ma `CHECK`. Wystarczy poszerzyć typ `StatusAlertu` (`repos/alerts.ts:16`).
- **Pulpit.** `aktywneAlerty()` (`pages/pulpit/kpi.ts:73`) filtruje `status === "nowy"`, tak jak
  oryginał (`frontend-index.js:16852`), więc alert `przejrzany` sam wypada z powiadomień. **Pulpitu
  nie ruszamy.** `kpi.ts` importuje `STATUS_NOWY` z `alerty/api.ts`, dlatego to eksport musi zostać.
- **Słownictwo oryginału** (`HT()`, `deminified/frontend-index.js:25177-25340`):
  - przyciski: „Oznacz jako przejrzany” (tylko przy `nowy`) i „Rozwiąż” (przy każdym
    statusie ≠ `rozwiazany`); oryginał nie ma akcji cofającej;
  - filtr statusu: „Wszystkie statusy” / „Nowy” / „Przejrzany” / „Rozwiązany”;
  - plakietka statusu pokazuje surową wartość (`rozwiazany` bez ogonka);
  - wyszukiwarki w `HT()` nie ma.
- **Wzorzec wyszukiwarki:** `filtrujSzukajka` (`pages/katalog/filtrowanie.ts:59-76`) i pole
  w `Katalog.tsx:431-443`. Fraza jest dzielona na słowa, a każde słowo musi się znaleźć w tekście
  (AND). Porównanie `toLowerCase().includes`, bez debounce.
- **Odwrócenie wcześniejszej decyzji.** Plan `18-FEATURE-widok-alerty` (D8) odrzucił wyszukiwarkę po
  `opis` jako follow-up. Teraz wraca na wyraźne życzenie Ani (#90). To świadoma zmiana, a nie
  przeoczenie D8.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
- `GET /api/alerts` (`contract/openapi.yaml:18762-18775`): `status` to `string` bez enuma.
  Fixture `contract/fixtures/GET_alerts.json`: kształt się nie zmienia.
- `PATCH /api/alerts/{id}` (`:18777-18785`): ciało to `{type: object}` bez listy statusów, odpowiedź
  `{ok:true}`. Brak nagranego fixture'a.
- **Kontrakt się nie zmienia.** GATE sprawdza, że dotychczasowe testy zgodności z fixture'em
  i kontraktem przechodzą oraz że `PATCH` na `przejrzany` zapisuje się i wraca przez `GET` w kształcie
  zgodnym z kontraktem.

## Decyzje
- **D1 — domyślny filtr: „Nierozwiązane”** (`status ≠ rozwiazany`, czyli `nowy` + `przejrzany`
  + ewentualny nieznany status). Bez tego oznaczenie „przejrzany” chowałoby alert i działałoby jak
  „Rozwiąż”. W filtrze statusu dochodzi opcja „Nierozwiązane”, a obok niej zostają „Wszystkie
  statusy” i pojedyncze statusy wyliczane z danych. *(użytkownik, rekomendacja)*
- **D2 — słownictwo przycisków z oryginału, plus akcja cofająca.** Przyciski zależą od statusu:
  - „Oznacz jako przejrzany”, gdy `status = nowy`;
  - „Rozwiąż”, gdy `status ≠ rozwiazany`;
  - „Otwórz ponownie” (powrót do `nowy`), gdy `status ≠ nowy`.

  Ta sama reguła obowiązuje na grupie (z licznikiem, np. „Rozwiąż (5)”) i na pojedynczym wpisie.
  Znikają dotychczasowe „Oznacz jako rozwiązane” i binarny przełącznik. *(użytkownik, rekomendacja)*
- **D3 — trafienie wyszukiwarki = filtr wpisów PRZED grupowaniem.** Grupa zostaje, jeśli pasuje choć
  jeden jej wpis. „N×” liczy tylko pasujące wpisy, a akcja na grupie zmienia tylko je. Licznik
  i przycisk mówią więc prawdę o tym, co widać. *(użytkownik, rekomendacja)*
- **D4 — zakres wyszukiwania: sam `opis`** *(moja decyzja, w raporcie)*. Dostawca i typ mają własne
  filtry, a wpisanie „MO3” łapałoby wtedy każdy alert tego dostawcy. Porównanie bez rozróżniania
  wielkości liter, fraza dzielona na słowa łączone AND, jak w Katalogu. Polskie znaki porównujemy
  dosłownie (JS `toLowerCase` poprawnie obsługuje `Ą→ą`). Bez obejść pod zepsute kodowanie `B??d`,
  bo dane naprawia PR.3.
- **D5 — plakietka statusu pokazuje surową wartość, a opcje filtra mają polskie etykiety** („Nowy”,
  „Przejrzany”, „Rozwiązany”), tak jak w `HT()`. Nieznany status z bazy pokazuje się w filtrze pod
  surową nazwą.
- **D6 — wspólny moduł pod P6.2.** Definicja statusów, ich etykiety i reguła „jakie akcje przy jakim
  statusie” trafiają do `pages/alerty/statusy.ts`, a komponent przycisków do
  `pages/alerty/PrzyciskiStatusu.tsx`. Komponent jest osobnym plikiem, bo reguła
  `react-refresh/only-export-components` zabrania mieszać eksport komponentu i stałych.
  `api.ts` re-eksportuje `STATUS_NOWY` i `STATUS_ROZWIAZANY`, bo z `api.ts` importuje je Pulpit,
  którego nie ruszamy.

**Odstępstwa od oryginału** (świadome, widok jest naszym projektem):
- akcja „Otwórz ponownie” (oryginał nie ma drogi powrotnej);
- akcja „Oznacz jako przejrzany” na całej grupie (oryginał ma tylko „Zaakceptuj wszystko” →
  `rozwiazany`);
- wyszukiwarka (oryginał jej nie ma);
- domyślny filtr „Nierozwiązane” (w oryginale domyślnie „Wszystkie statusy”, a łatka `ackalerts`
  chowa w nim `rozwiazany`, więc efekt jest ten sam).

## Plan implementacji
1. **BE** `repos/alerts.ts`: `StatusAlertu = "nowy" | "przejrzany" | "rozwiazany"` i komentarz.
   W `routes/alerts.ts:46` aktualizuję zdanie „Widok wysyła wyłącznie `nowy`/`rozwiazany`”, bo
   inaczej komentarz kłamie. To jedyna zmiana w tym pliku i jest tylko w komentarzu.
   `test/alerty.gate.test.ts`: nowy test „PATCH na `przejrzany` zapisuje się i wraca w GET”
   ze sprawdzeniem zgodności z kontraktem i przywróceniem stanu w `finally`.
2. **FE** nowy `pages/alerty/statusy.ts`:
   - stałe `STATUS_NOWY`, `STATUS_PRZEJRZANY`, `STATUS_ROZWIAZANY` i typ `StatusAlertu`;
   - `ETYKIETY_STATUSU` oraz `etykietaStatusu(s)` (wraca do surowej wartości, gdy etykiety brak);
   - `akcjeStatusu(status): {cel, etykieta}[]` według reguły D2.

   `api.ts` zamiast definicji dostaje re-eksport.
3. **FE** nowy `pages/alerty/PrzyciskiStatusu.tsx`. Props: `status`, `liczba`, `zablokowane`,
   `onZmien(cel)`, `testId` (sufiks) i `wariant`. Na każdą akcję renderuje przycisk
   `data-testid="button-status-<cel>-<sufiks>"` z etykietą `„<etykieta> (N)”` przy N > 1.
4. **FE** `grupowanie.ts`:
   - `FiltryAlertow` dostaje `fraza: string`;
   - stała `FILTR_NIEROZWIAZANE` i `FILTRY_POCZATKOWE = {status: nierozwiązane, …, fraza: ""}`;
   - `filtrujAlerty` obsługuje „nierozwiązane” i frazę po `opis`, wszystko łączone AND;
   - dokumentacja semantyki trafienia (D3).
5. **FE** `TabelaAlertow.tsx`:
   - pole wyszukiwania (`Input` + ikona `Search`, `data-testid="input-alert-search"`,
     placeholder „Szukaj w treści”);
   - opcja „Nierozwiązane” i etykiety w filtrze statusu;
   - `PrzyciskiStatusu` na grupie i na wpisie; usunięcie `przeciwnyStatus` i `etykietaAkcji`.

   Mutacja i toast „Zmieniono X z N alertów” zostają bez zmian (porcje po 8).
6. **Testy FE:**
   - `alerty.grupowanie.test.ts`: uogólnienie „dwa statusy → dwie grupy” na trzy; domyślny filtr
     = nierozwiązane (widać `przejrzany`, nie widać `rozwiazany`); wyszukiwarka (słowa AND,
     wielkość liter, łączenie AND z filtrami, tylko `opis`); `akcjeStatusu` dla trzech statusów
     i statusu nieznanego;
   - `alerty.test.tsx`: nowe testidy i etykiety; akcja „Oznacz jako przejrzany (23)” wysyła
     23 PATCH-y `przejrzany`, a grupa zostaje widoczna jako `…|przejrzany`; „Otwórz ponownie”;
     wyszukiwarka zawęża grupę i licznik „N×”, a akcja na grupie zmienia tylko pasujące wpisy;
     komunikat częściowego niepowodzenia „Zmieniono X z N alertów”.

## Strategia testów
- GATE BE: istniejące testy fixture'a i kontraktu `GET`/`PATCH` oraz nowy test zapisu `przejrzany`.
- Testy jednostkowe logiki (`grupowanie.ts`, `statusy.ts`) i testy komponentu przez MSW
  (bez prawdziwego backendu, jak w dotychczasowych testach widoku).
- Bramki po obu stronach: `lint`, `typecheck`, `build`, `test`.

## Poza zakresem
- P6.2: pseudo-alerty katalogowe, zakładki w `pages/Alerty.tsx`.
- P6.3: delta instrukcji I6 dla Ani.
- PR.3: naprawa kodowania typów w danych.
- Pulpit, kontrakt, migracje.

## Definicja ukończenia
- [ ] `StatusAlertu` w BE zawiera `przejrzany`; GATE BE jest zielony razem z nowym testem.
- [ ] Domyślny widok pokazuje `nowy` + `przejrzany`; oznaczenie grupy jako przejrzanej nie chowa jej.
- [ ] Przyciski według D2 na grupie i na wpisie; komunikat częściowego niepowodzenia jest uczciwy.
- [ ] Wyszukiwarka po `opis` łączy się AND z filtrami; licznik i akcja grupy obejmują tylko trafienia.
- [ ] Statusy, etykiety i przyciski są we wspólnym module, który P6.2 może importować.
- [ ] `lint`, `typecheck`, `build` i `test` zielone w BE i FE.
- [ ] Roadmapa (wiersz P6.1) i backlog (#90, #26) opisują stan.
