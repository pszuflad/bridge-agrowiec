# 25-FEATURE-analityka-dostepnosc-rotacja — Code review

> Reviewed: 2026-09-04
> Branch: `feature/25-analityka-dostepnosc-rotacja`
> Diff: 23 pliki, 5 commitów (`26aaf99`…`4bef817`)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/analityka/SekcjaRotacji.tsx:64` — stan `dni` (pole „Bez ruchu
      dni") mieszka w komponencie, który jest DZIECKIEM `TabsContent value="marza"`. Radix
      `Tabs.Content` bez `forceMount` **unmountuje** nieaktywny panel (`Presence present={forceMount
      || isSelected}` — zweryfikowane w `node_modules/@radix-ui/react-tabs/dist/index.mjs:163`,
      żaden `TabsContent` w `Analityka.tsx` nie dostaje `forceMount`). Scenariusz: użytkownik
      wpisuje „365" w polu, przechodzi na zakładkę „Dostępność" i wraca na „Marża i rotacja" —
      `SekcjaRotacji` remontuje się, `useState("60")` resetuje pole do wartości domyślnej i leci
      nowe zapytanie o `?days=60`, cichо gubiąc wpisaną wartość. W oryginale stan `l` (`useState("60")`,
      `frontend-index.js:27805`) mieszka w komponencie widoku `zM()`, który nie jest warunkowo
      montowany razem z zakładką, więc przełączanie zakładek NIE resetuje pola. Plan sam
      dopuszczał obie lokalizacje („`Analityka.tsx` albo `SekcjaRotacji` — decyzja przy
      implementacji"), ale nie przewidział tego efektu ubocznego wyboru lokalnego stanu, a
      `raport.md` go nie odnotowuje jako świadomego odstępstwa.
  - Suggestion: przenieść `useState("60")` do `Analityka.tsx` i przekazać `dni`/`ustawDni` jako
    props do `SekcjaRotacji` — dokładnie wzorem, w jaki `wybor`/`ustawWybor` już tam mieszkają.

- [ ] `rebuild/frontend/src/pages/analityka/SekcjaRotacji.tsx:74` — układ karty to
      `<CardContent className="p-0">` z osobnymi blokami `border-b`, czyli DOKŁADNIE ten sam
      wzorzec co pozostałe karty (`SekcjaMarze`, `SekcjaCykluZycia` itd.). Oryginał ma dla tej
      jednej karty inny layout: `className: "p-4 space-y-3"` bez linii `border-b` między tytułem,
      kontrolką „Bez ruchu dni" i tabelą (`deminified/frontend-index.js:28563` — potwierdzone
      odczytem). Sam plan to wprost zapowiadał w Kroku 7: „`SekcjaRotacji` niesie […] układ karty
      `p-4 space-y-3` — tu oryginał ma inny layout niż pozostałe karty", ale w kodzie ten punkt
      zniknął — karta wygląda wizualnie jak pozostałe, nie jak oryginał. `raport.md` nie
      wspomina o tej rozbieżności jako świadomej decyzji.
  - Suggestion: zamienić `CardContent` na `className="p-4 space-y-3"` i zdjąć `border-b` z bloku
    tytułu/kontrolki, żeby markup wrócił do zapowiedzianego w planie kształtu — albo, jeśli to
    świadome ujednolicenie z resztą kart, dopisać je do `raport.md` jako nazwane odstępstwo.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/repos/analityka.ts:363` — stała nazywa się `LIMIT_TEMPA_SCHODZENIA`,
      podczas gdy plan.md (Krok 1) zapowiadał `LIMIT_SELL_THROUGH`. Czysto kosmetyczne (polska
      nazwa jest zresztą spójniejsza z resztą pliku), ale warto zsynchronizować nazewnictwo
      w dokumentacji, gdyby ktoś szukał tej stałej po nazwie z planu.

## Plan compliance

### Done ✓
- Sześć agregatów `analityka.ts` (`dostepnoscProduktow`, `tempoSchodzenia`,
  `sezonowoscMiesieczna`, `cyklZyciaModeli`, `rotacjaNieaktywnych`, `osCzasuImportow`) — SQL
  porównany znak po znaku z `mirror/backend/analytics_module.cjs:156-184,279-303,334`, zgodny
  1:1 łącznie z obiema gałęziami `hasHistory`, różnymi kolumnami/sortowaniami między gałęziami
  i limitami.
- Sześć tras w `routes/analytics.ts`, kolejność rejestracji jak w oryginale, `requireAuth`
  wszędzie, jedyna trasa czytająca `req.query` to `rotation/inactive`.
- Port `safeAll` → `bezpiecznieWiersze` — niezależnie zweryfikowane: `historia_cen` faktycznie
  nie ma kolumny `nazwa` ani w `db/schema.sql`, ani w `rebuild/schema/001_schema.sql`, ani
  w Drizzle-schema (`rebuild/backend/src/db/schema.ts:283-299`) — odkrycie jest poprawne, a port
  `safeAll` jest wierną reprodukcją zachowania produkcji, nie maskowaniem błędu nowego kodu.
  Zakres jego użycia (tylko sześć zapytań 10e) jest uzasadniony w komentarzu i faktycznie
  poprawny — pięć tras 10a nie ma zapytań, które mogłyby się wywrócić na nieistniejącej
  kolumnie.
- GATE (`analityka.dostepnosc.gate.test.ts`, 14 przypadków) + testy jednostkowe
  (`analityka.dostepnosc.agregaty.test.ts`, 20 przypadków) — realnie nadrabiają słabość czterech
  pustych fixtures: kształt wiersza, obie gałęzie `hasHistory`, `GROUP_CONCAT` miesięcy braków,
  zaciski `?days` (w tym `NaN` → `null`), sortowania i limity są dowiedzione bezpośrednio na
  SQL-u, a nie na assercjach „na pustej liście, która przeszłaby też przy zepsutym kodzie" —
  np. test `dostepnoscProduktow` bez historii realnie sprawdza kolejność i wartości
  `dostepnoscPct`/`stan`, a nie tylko `rows.length === 0`. Testy charakteryzacyjne D1/odkrycia
  „brak `nazwa`" faktycznie zamrażają zachowanie (asercja `{ hasHistory: true, rows: [] }` przy
  realnie zasianej historii — to nie jest test na sucho, bo dowodzi, że dane BYŁY, a wynik mimo
  to jest pusty).
- Zakładka `dostepnosc`: trzy karty (4.1, 4.2, 4.4) w kolejności oryginału, kolumny 1:1
  potwierdzone porównaniem z `frontend-index.js:28417-28513` (nazwy, kolejność, `mono`/`right`).
- Zakładka `marza`: `SekcjaMarze` z 10a nietknięta funkcjonalnie — refaktor do `NaglowekSekcji`
  zachowuje identyczny markup i `data-testid` (`marze-licznik-filtra`, `marze-pominiete`),
  potwierdzone diffem. Pod nią rotacja i cykl życia, kolumny 1:1 z `:28562-28631`.
- `?days` jako jedyny filtr serwerowy: `useRotacjeNieaktywnych` buduje klucz jako jeden segment
  (`queryKey.join("/")` z `lib/queryClient.ts` na tablicy jednoelementowej nie wstawia
  ukośników) — działa poprawnie, `encodeURIComponent` jest we właściwym miejscu (na wartości
  pola, nie na całym adresie).
- Generyk `zastosujFiltry`: semantyka OR-wewnątrz/AND-między zachowana i pokryta testami
  (`analityka.dostepnosc.filtrowanie.test.ts`), `null`/puste wartości wymiaru poprawnie
  odpadają, gdy wymiar filtruje. `zastosujFiltryMarz` jako cienka nakładka — stare testy 10a
  przechodzą bez zmian merytorycznych (potwierdzone uruchomieniem).
- Wykres sezonowości (`SekcjaSezonowosci.tsx`): jedna oś Y, jedna seria (bez legendy — zgodnie
  z regułą „przy jednej serii nigdy"), paleta `KOLOR_SERII`/`KOLOR_SIATKI`/`KOLOR_ETYKIET`
  z `chart.tsx` nietknięta, tabela pod wykresem obowiązkowo obecna. Reguły `chart.tsx` (nigdy
  dwie osie Y, maks. 4 serie, kolor należy do bytu) nie są złamane.
- Testy 10a (`analityka.test.tsx`, `analityka.filtrowanie.test.ts`) przechodzą — zmiana w
  `analityka.test.tsx` (zawężenie `getByText("Brak danych")` do `within(tabela-marze)`) jest
  uzasadniona koniecznością (trzy nowe tabele w tej samej zakładce), nie osłabieniem asercji —
  weryfikacja jest ostrzejsza niż wcześniej (sprawdza konkretną tabelę, nie stronę globalnie).
- Backlog #32/#33 dopisany, uzasadniony dowodami z nagrań, status „do decyzji Ani" — zgodne
  z Krokiem 10 planu.
- Uruchomione lokalnie: backend lint/typecheck czyste, `analityka.dostepnosc.*.test.ts` (34/34
  zielone); frontend lint/typecheck czyste, pięć plików testowych bloku (56/56 zielonych).

### Missing lub deviating ✗
- Układ karty „Rotacja / produkty bez aktualizacji" (`p-4 space-y-3` bez `border-b` — patrz
  SHOULD-FIX wyżej) nie trafił do implementacji, mimo że plan (Krok 7) wprost go zapowiadał jako
  odstępstwo od wzorca pozostałych kart. Funkcjonalnie karta działa poprawnie, ale wizualnie nie
  jest 1:1 z oryginałem i rozjazd nie jest odnotowany w `raport.md`.
- Stan pola „Bez ruchu dni" nie przetrwa przełączenia zakładek (patrz SHOULD-FIX wyżej) — plan
  zostawiał wybór lokalizacji stanu otwarty, ale nie przewidział, że lokalizacja w
  `SekcjaRotacji` wprowadzi zachowanie inne niż oryginał (reset przy powrocie do zakładki).

### Definition of done
- [x] Sześć tras `/api/analytics/*` odpowiada kształtem 1:1 z fixtures i waliduje się wg
      `openapi.yaml`
- [x] Żadna odpowiedź nie zawiera `_przyciete`
- [x] Kształt wiersza czterech tras z pustym fixture'em pokryty testem jednostkowym
- [x] Pułapka SQL `sell-through` udokumentowana testem charakteryzacyjnym + wpisem w backlogu
- [x] Zakładka `dostepnosc` niesie trzy karty (4.1, 4.2, 4.4) z kolumnami 1:1 z oryginałem
- [x] Zakładka `marza`: karta marż z 10a nietknięta, pod nią rotacja i cykl życia
- [x] Pole „Bez ruchu dni" zmienia `?days` w zapytaniu (jedyny filtr serwerowy bloku) — działa,
      choć ze skutkiem ubocznym opisanym w SHOULD-FIX (reset przy przełączeniu zakładek)
- [x] Wykres sezonowości: jedna seria, tabela pod nim, paleta z `chart.tsx` nieruszona
- [x] `PasekDostepnosci` wydzielony i opisany w `pages/analityka/README.md`
- [x] Testy 10a (`analityka.test.tsx`, `analityka.filtrowanie.test.ts`) przechodzą bez zmian
      merytorycznych
- [x] `lint`, `typecheck`, `build`, `test` czyste w backendzie i frontendzie (build nie był
      uruchamiany w tej sesji review — lint/typecheck/test tak; raport.md deklaruje build czysty)

## Parallel-test concerns

None — testy tego bloku używają `stworzTestowaBaze()`/`stworzSrodowiskoTestowe()` (baza
tymczasowa) i renderują `<App/>` z MSW; nic nie trzyma na sztywno portu ani ścieżki pliku.
Wszystkie testy równoległe.

## Overall assessment

Bardzo solidna robota jak na najsłabszą siatkę bezpieczeństwa całej Iteracji 10 — kluczowe
odkrycie (`historia_cen` bez kolumny `nazwa`) jest zweryfikowane niezależnie i poprawne, port
`safeAll` jest uzasadnioną, nie maskującą odbudową, a testy jednostkowe realnie nadrabiają
puste fixtures zamiast asertować na sucho. SQL wszystkich sześciu tras jest zgodny znak po
znaku z oryginałem, kolumny tabel i kolejność kart są 1:1, a karta marż z 10a nie ucierpiała.
Jedyne dwa zastrzeżenia dotyczą frontendu i są kosmetyczno-behawioralne, nie merytoryczne: stan
pola „Bez ruchu dni" nie przetrwa przełączenia zakładek (realny, choć drobny regres UX wobec
oryginału) i karta rotacji nie dostała zapowiedzianego w planie unikalnego layoutu. Żadne z
tego nie blokuje merge'a, ale oba warto poprawić, zanim 10f dołoży do tej karty przycisk „CSV".
