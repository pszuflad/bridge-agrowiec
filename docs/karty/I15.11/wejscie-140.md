# Wejście dla I15.11 od ticketu 140 (okno „Rozstrzygnij”, frontend) · 2026-09-23

Okno „Rozstrzygnij”/„Sprawdź kartę” i okno „Nie zapisano zmian” są gotowe na `/staging`.
Poniżej trzy konkretne punkty wejścia zostawione w kodzie i ostrzeżenie o zakresie.

## Gdzie się wpiąć

1. **`rebuild/frontend/src/pages/Staging.tsx`** — panel „Braki w cenniku” wchodzi w pasek
   narzędzi/nagłówek widoku, obok filtra „Typ sprawy” (`select-filter-type`, ok. linii 230).
2. **`rebuild/frontend/src/pages/staging/OknoRozstrzygniecia.tsx`** — podgląd starej karty
   dochodzi do sekcji „Stara karta w katalogu”; komponent `KartaPorownania` przyjmuje dowolną
   listę linii, więc nie trzeba ruszać struktury okna. Komentarz `⭐ PUNKT WPIĘCIA DLA KARTY
   I15.11` jest w nagłówku pliku (linie 33–36).
3. **`rebuild/frontend/test/msw/staging.ts`** — nowe trasy dokłada się do `handleryStagingu()`,
   rozszerzając typ `OpcjeHandlerowStagingu`, a NIE osobnym plikiem mocków ani `server.use` w
   pliku testu. Komentarz `⭐ PUNKT WEJŚCIA DLA KARTY I15.11` w nagłówku pliku (linia 16).
   Kolejność handlerów ma znaczenie: `*/api/staging/paged` musi stać PRZED `*/api/staging/:id`
   (ten drugi dopasowuje też `id = "paged"`) — patrz komentarz w nagłówku tego pliku.

## Co się zmieniło w plikach, które I15.11 też rusza

Żeby tamta sesja nie zdziwiła się diffem względem stanu sprzed ticketu 140:

- `TabelaStagingu` ma nowy WYMAGANY prop `otworzRozstrzygniecie`.
- Mutacja `akcja` w `Staging.tsx` przyjmuje `{wykonaj, akceptacja}` zamiast gołej funkcji —
  `akceptacja: true` kieruje błąd mutacji do okna „Nie zapisano zmian”, `false` do
  dotychczasowego paska komunikatów.
- `zamockujApi()` w `test/staging.test.tsx` deleguje teraz do `handleryStagingu()` z
  `test/msw/staging.ts`, zamiast tworzyć handlery lokalnie.

## Ostrzeżenie o zakresie — ZMIANA PRZYPISANIA, nie fakt dokonany

`docs/karty/I15.11/wejscie-110.md` przypisuje do I15.11 „podgląd starej karty” razem z panelem
„Braki w cenniku”. **Gałąź `absenceReview`** (stara karta obok możliwego odpowiednika, ocena
zgodności EAN i DOT, wybór jednej karty) **JEST JUŻ DOWIEZIONA w tickecie 140** — siedziała w
`mirror/frontend/assets/staging-policy-injection.js` @ `88fa31c`, nie w żywym bundlu
`index-PRICEFMT1783512500.js`, jak sugerował prompt karty I15.5. Zanim zaczniesz I15.11:
rozłóż diffem, co żywy bundel faktycznie dokłada do tej samej sprawy
(`git diff 7d6cfc9 abe5f14 -- mirror/frontend/assets/index-PRICEFMT1783512500.js`) — nie
zakładaj z góry, że „podgląd starej karty” z `wejscie-110.md` to coś więcej niż to, co już
jest w `OknoRozstrzygniecia.tsx`. To do rozstrzygnięcia z koordynatorem: czy w zakresie
I15.11 zostaje jeszcze cokolwiek poza panelem „Braki w cenniku” (CLAUDE.md: nazwa/etykieta
daje etykietę, nie treść — sprawdź diff, nie ufaj opisowi).

## Pułapka MSW (przypomnienie z CLAUDE.md)

`onUnhandledRequest: "error"` (`test/setup.ts`) NIE wywala testu przy brakującym handlerze —
MSW rzuca wewnątrz przechwycenia żądania, `fetch()` odrzuca obietnicę, a React Query zamienia
to po cichu w stan `error`. Nowe zapytanie dodane do widoku bez dopisania handlera do
`handleryStagingu()` przejdzie istniejące testy, sprawdzając stan błędu zamiast danych — dopóki
nikt nie doda asercji na treść.
