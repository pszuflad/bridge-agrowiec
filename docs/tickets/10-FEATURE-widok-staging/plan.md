# 10-FEATURE-widok-staging — Iteracja 3, sesja 3e (FRONTEND)

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/10-widok-staging`
> Worktree: `.worktrees/10-FEATURE-widok-staging`

## Opis ticketa

Widok `/staging` — ostatni blok Iteracji 3. Przegląd pozycji importu, filtry, akcje masowe,
edycja pozycji i podgląd różnic. Backend jest kompletny od 3d-2 (dziewięć tras).

## Kontekst

Dziś `/staging` to placeholder (`pages/placeholdery.ts`). Backend ma wszystko, czego widok
potrzebuje, i nic z tego nie ma interfejsu — łącznie z mechanizmem poprawek Marty, który był
sednem 3d-1 i 3d-2. **`PUT /api/staging/{id}` jest JEDYNĄ ścieżką tworzącą poprawki**, więc bez
edycji w tym widoku cały ten mechanizm pozostaje niewidoczny dla użytkownika.

Wzorzec do naśladowania: `pages/Katalog.tsx` z I2 (tabela, filtry, wirtualizacja, dialog
podglądu) i jego testy karmione fixture'ami przez MSW.

### Ustalenia ze zwiadu (fakty, nie decyzje)

1. **Wgrywanie plików NIE jest na `/staging`.** W oryginale to zakładka „wgrywanie" na stronie
   **Konfiguracja** (zakładki: dostawcy, wgrywanie, spedycja, shoper, katalog, ai), przypisanej
   do **I11**. Ma to bezpośredni skutek dla gate'u 3e — patrz D1.
2. **Widok pobiera `GET /api/atrybuty`, ale wyniku NIGDY nie używa** (`fe.js:20630-20633`;
   zmienna `c` nie występuje w całym regionie widoku). Martwe zapytanie — **nie portujemy go**,
   a I7 nie jest blokerem dla 3e.
3. **`/paged` naszego backendu przyjmuje dokładnie te parametry, których używa oryginał**
   (`page`, `pageSize`/`limit`, `typZmiany`, `search`) i zwraca kopertę
   `{items,total,page,pageSize,pages}` zgodną z `GET_staging_paged.json`. Zero pracy po
   stronie backendu.
4. **Etykiety i kolory typów są w oryginale jawne** (`fe.js:597086` — lista filtra,
   `fe.js:597593` — badge): `nowa` → „Nowa" (emerald-600), `zmiana_kluczowa` → „Zmiana
   kluczowa" (blue-600), `blad` → „Błąd" (red-700), `wycofana` → „Wycofana" (red-600).
   Filtr ma sześć opcji: Wszystkie · Nowe produkty · **Nowe produkty (stare)** · Wycofane ·
   Zmiany kluczowe · Błędy importu.
   ⚠ Wartości `nowy` i `zmiana` to POZOSTAŁOŚCI po starym schemacie — nasz silnik ich nie
   produkuje (3c/3d-1 dają wyłącznie `nowa`, `blad`, `zmiana_kluczowa`, `wycofana`).
   Odtwarzamy je mimo to, bo są w oryginale i mogą siedzieć w starych danych na staging.
5. **Kolumny tabeli** (`fe.js:20610-21100`): Typ · Kod · Nazwa · Dostawca · Stan ·
   Cena zakupu · Cena sprzedaży · Magazyn · Zmiana · Powód / co sprawdzić · Akcje.
   Stronicowanie: „Na stronie:" 25/50/100, „« Pierwsza", „Poprzednia". Stan pusty:
   „Brak elementów do wyświetlenia".

## Kontrakt i fixtures (zakres)

Ticket **nie dotyka backendu ani kontraktu** — konsumuje trasy dowiezione w 3b i 3d-2.
Gate frontendowy działa tak jak w I1b/I2: MSW karmione **prosto z `contract/fixtures/`**
(`test/msw/kontrakt.ts`), więc testy widoku sprawdzają zgodność z nagraną produkcją,
a nie z moim wyobrażeniem o kształcie danych.

| Fixture | Rola |
|---|---|
| `GET_staging_paged.json` | główne źródło danych widoku (koperta + 20 pól pozycji) |
| `GET_staging.json` | pozycja ze `snapshotJson` — podgląd różnic (24 pola) |

⚠ **`/paged` NIE zwraca `snapshotJson`** (20 pól vs 24), więc podgląd różnic MUSI dociągnąć
pozycję z `GET /api/staging/{id}` — to ustalenie z 3b, tu wchodzi w życie.

## Decyzje

**D1 — 3e buduje SAM `/staging`; wgrywanie zostaje w I11** (decyzja użytkownika 2026-09-01).
Cykl do weryfikacji przygotowujemy my: import na staging odpalamy przez
`POST /api/import/parse-file`, a Ania sprawdza w przeglądarce to, co jest przedmiotem tej sesji.
**Skutek dla gate'u:** sformułowanie „Ania klika PEŁNY cykl importu" domyka się dopiero po I11 —
zapiszę to w roadmapie jako fakt, nie jako cichą zmianę zakresu.

**D2 — pełna parzystość widoku z oryginałem** (decyzja użytkownika 2026-09-01): filtr typu,
wyszukiwarka, stronicowanie, zaznaczanie wierszy, akcje masowe (zaznaczone / widoczne /
wszystkie przefiltrowane), edycja pozycji (`PUT`), usuwanie (`DELETE`), dialog szczegółów
z podglądem różnic (`GET /{id}`). Uzasadnienie: wszystkie potrzebne trasy powstały w 3d-2,
a edycja jest jedyną ścieżką tworzącą poprawki Marty.

**D3 — martwe `GET /api/atrybuty` NIE wchodzi** (ustalenie 2 wyżej). To nie jest odstępstwo od
wierności, tylko pominięcie zapytania bez konsumenta; zapisane w raporcie i w roadmapie.

## Plan implementacji

### Krok 1 — warstwa danych (`src/lib/api.ts` + `src/pages/staging/`)
- Typy `PozycjaStagingu` (20 pól z `/paged`) i `PozycjaStaginguSzczegol` (24 pola z `/{id}`) —
  **osobne**, bo kształty realnie się różnią i UI musi to znieść.
- Funkcje: `pobierzStronieStagingu`, `pobierzPozycje`, `zatwierdz`, `odrzuc`,
  `zapiszPozycje`, `usunPozycje`.
- Invalidacja po mutacjach: `staging` + `products` (spec-frontend §91: oryginał unieważnia
  `staging`, `products`, `history`, `alerts`; dwa ostatnie to I5/I6 — dopisać, gdy powstaną).

### Krok 2 — tabela i filtry (`pages/Staging.tsx` + `pages/staging/`)
- `TabelaStagingu` — 11 kolumn wg ustalenia 5, `BadgeTypu` z etykietami i kolorami z oryginału.
- Filtr typu (6 opcji), wyszukiwarka (`input-search-staging`), stronicowanie 25/50/100.
- Stan pusty, skeleton ładowania.
- `data-testid` **1:1 z oryginałem** (`button-accept-*`, `checkbox-select-all`,
  `input-search-staging`, `select-filter-type`) — tak jak I2 zrobiła dla katalogu.

### Krok 3 — akcje masowe
Trzy warianty na akcję, jak w oryginale: zaznaczone (`ids`) · widoczne (`ids` z bieżącej
strony) · wszystkie przefiltrowane (`allFiltered` + filtry). Potwierdzenie przy „wszystkich".

### Krok 4 — dialog szczegółów i edycja
- Podgląd: dociągnięcie `GET /api/staging/{id}`, `powod` i `ostrzezenie` pokazywane
  W CAŁOŚCI (ustalenie z 3b: „UI ma je pokazywać, nie filtrować" — łącznie z odtworzonym
  błędem produkcji „zapis naukowy ma tylko null cyfr znaczących", backlog #11).
- Edycja: osiem pól dopuszczonych przez `PUT` (`nazwa`, `marka`, `model`, `kategoria`,
  `rozmiar`, `ean`, `cenaZakupuNowa`, `magazyn`) + `_reason`.
- ⚠ **Wiersz `wycofana` ma inny kształt** (`snapshotJson` null, `ean*` null, `cenaZakupuNowa`
  i `zmianaPct` null, `stanNowy` zawsze 0) — podgląd różnic MUSI to znieść zamiast się wywrócić.

### Krok 5 — testy
Patrz niżej.

## Strategia testów

**1. Testy widoku (Testing Library + MSW karmione fixture'ami)** — wzorzec z I2:
- lista renderuje się z `GET_staging_paged.json`, komplet kolumn i etykiet typów;
- filtr i wyszukiwarka wysyłają właściwe parametry do `/paged`;
- stronicowanie (zmiana strony i `pageSize`);
- zaznaczanie + trzy warianty akcji masowych wysyłają właściwe ciało (`ids` vs `allFiltered`);
- **wiersz `wycofana` renderuje się i otwiera bez wywrócenia** — osobny test, bo to jedyny
  typ z `snapshotJson: null`;
- edycja wysyła `PUT` z `_reason` i tylko z dopuszczonymi polami;
- stan pusty i stan błędu.

**2. Test integracyjny** — wzorzec `test/integracja/logowanie.integracja.test.ts`: pełny
przepływ przez PRAWDZIWY backend (bez MSW), żeby udowodnić, że FE i BE się rozumieją —
w szczególności że `allFiltered` z filtrami działa end-to-end.

**3. Regresja:** testy I1b/I2 zielone bez zmian; liczba tras routera dalej 12
(`/staging` przestaje być placeholderem, ale trasa istniała).

**4. Bramki:** `npm run lint`, `typecheck`, `test`, `build` w `rebuild/frontend/`.

## Poza zakresem

- **Wgrywanie plików / zakładka „wgrywanie"** → **I11** (D1).
- **`GET /api/atrybuty`** — martwe zapytanie, nie portujemy (D3).
- **Kolumna „Promocja", narzuty** → I4. **Historia** → I5. **Alerty** → I6.
- Backend — kompletny od 3d-2, ten ticket go nie rusza.

## Definition of done
- [ ] `/staging` przestaje być placeholderem; pełna parzystość wg D2
- [ ] Etykiety, kolory i `data-testid` 1:1 z oryginałem
- [ ] Wiersz `wycofana` obsłużony bez wywrócenia podglądu
- [ ] Edycja tworzy poprawkę Marty (widoczny skutek mechanizmu z 3d-1/3d-2)
- [ ] Testy widoku na fixture'ach + test integracyjny przez prawdziwy backend
- [ ] `lint` / `typecheck` / `test` / `build` czyste
- [ ] Roadmapa: blok 3e zamknięty, **gate przeformułowany zgodnie z D1**, Iteracja 3 rozliczona
- [ ] Instrukcja dla Ani: jak odpalić import, żeby miała co klikać
