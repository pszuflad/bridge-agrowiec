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

## Zakres — już zawężony, nie pytaj o niego ponownie

Koordynator zawęził I15.11 do panelu **„Braki w cenniku”** jeszcze przed wydaniem promptu do
ticketu `142-FEATURE-braki-w-cenniku`. Pierwsza wersja tej noty (ticket 140) kazała wracać
z pytaniem o zakres — **to było zbędne i zostało skreślone** ticketem `145-DOCS-ustalenia-i15-5`
(2026-09-24).

Fakt, który zostaje w mocy i który warto znać, zanim ruszysz ten widok:

**Gałąź `absenceReview` jest już dowieziona** — stara karta obok możliwego odpowiednika, ocena
zgodności EAN i DOT, stan obu kart i wybór jednej karty siedzą w
`src/pages/staging/OknoRozstrzygniecia.tsx` (ticket 140). Pochodziły z
`mirror/frontend/assets/staging-policy-injection.js` @ `88fa31c`, a **nie** z żywego bundla
`index-PRICEFMT1783512500.js`, jak sugerował opis „podgląd starej karty” w `wejscie-110.md`.

⚠ Uwaga na `docs/karty/I15.11/karta.md`: jej sekcja „Zakres” nadal wymienia „**i podgląd starej
karty**”, a jako źródło prawdy podaje `abe5f14` zamiast `88fa31c`. To Twój plik — popraw go
w miejscu przy zamykaniu karty (CLAUDE.md reguła 1), zamiast dopisywać sprostowanie obok.

Co żywy bundel faktycznie dokłada do tej samej sprawy, sprawdź diffem — nie opisem:
`git diff 7d6cfc9 abe5f14 -- mirror/frontend/assets/index-PRICEFMT1783512500.js`
(CLAUDE.md: nazwa daje ETYKIETĘ, nie treść).

## Pułapka MSW (przypomnienie z CLAUDE.md)

`onUnhandledRequest: "error"` (`test/setup.ts`) NIE wywala testu przy brakującym handlerze —
MSW rzuca wewnątrz przechwycenia żądania, `fetch()` odrzuca obietnicę, a React Query zamienia
to po cichu w stan `error`. Nowe zapytanie dodane do widoku bez dopisania handlera do
`handleryStagingu()` przejdzie istniejące testy, sprawdzając stan błędu zamiast danych — dopóki
nikt nie doda asercji na treść.
