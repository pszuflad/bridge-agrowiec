# 10-FEATURE-widok-staging — raport z implementacji

## Podsumowanie

`/staging` przestał być placeholderem. Widok ma pełną parzystość z oryginałem: filtr typu,
wyszukiwarkę, stronicowanie, zaznaczanie, trzy warianty akcji masowych, podgląd różnic
i edycję pozycji. **Iteracja 3 jest domknięta** — z jednym zastrzeżeniem do gate'u, opisanym
niżej i zapisanym w roadmapie.

Najważniejsze: **edycja pozycji daje wreszcie interfejs mechanizmowi poprawek Marty.**
`PUT /api/staging/{id}` to jedyna ścieżka, która te poprawki tworzy — do tej sesji cały
mechanizm z 3d-1 i 3d-2 działał, ale nikt nie mógł go użyć.

## Zmiany

- **Nowe:** `src/pages/Staging.tsx` — widok: filtry, akcje masowe, stronicowanie.
- **Nowe:** `src/pages/staging/dane.ts` — typy (dwa różne kształty pozycji!), opcje filtra,
  wygląd odznak, mutacje portowane z `fe.js:9118-9145`.
- **Nowe:** `src/pages/staging/TabelaStagingu.tsx` — 11 kolumn, odznaka typu.
- **Nowe:** `src/pages/staging/SzczegolyPozycji.tsx` — podgląd różnic + edycja.
- `src/App.tsx` — trasa `/staging`; `src/pages/placeholdery.ts` — zdjęty placeholder
  (liczba tras routera dalej 12).
- `test/msw/kontrakt.ts` — helpery `stronaStaginguZFixtura`, `pozycjaStaginguZFixtura`.
- **Nowe:** `test/staging.test.tsx` (16 testów), `test/integracja/staging.integracja.test.ts` (6).

## Odstępstwa od planu

Brak w zakresie.

## Wyniki testów

- **Testy widoku:** ✓ 16 — render z fixture'a, parametry `/paged` (domyślne, `search`,
  `limit` + powrót na stronę 1), trzy warianty akcji masowych z **różnymi ciałami żądania**,
  podgląd różnic dociągany po id, edycja, stan pusty, stan błędu.
- **Test integracyjny (bez mocków, przez żywy backend):** ✓ 6 — koperta `/paged` ma komplet
  pól, filtry realnie zawężają wynik po stronie backendu, `/paged` NIE zwraca `snapshotJson`
  a `/{id}` zwraca, **edycja tworzy wpis w `manual_overrides`**, akceptacja przenosi pozycję
  do katalogu, `allFiltered` czyści wszystkie pasujące.
- **Razem 126 testów FE** (było 110), `lint` / `typecheck` / `build` czyste.
- Regresja I1b/I2 zielona bez zmian.

### Skuteczność testów — 6 mutacji, wszystkie złapane (po naprawie jednej luki)

Złe nazwy parametrów filtra · `allFiltered` zamienione na puste `ids` (odrzucanie) ·
**to samo w akceptacji** · surowa wartość typu zamiast etykiety · `PUT` bez zmienionych pól ·
`wycofana` traktowana jak zwykła pozycja.

**Jedna mutacja początkowo NIE została złapana** — sprawdzałem ciało `allFiltered` tylko dla
odrzucania, a dla akceptacji nie. Dołożyłem symetryczny test (z filtrem ustawionym na
„Wycofane", żeby sprawdzić też, że filtr trafia do ciała żądania).

## Ustalenia ze zwiadu, które weszły do kodu

1. **Wgrywanie plików NIE jest na `/staging`** — w oryginale to zakładka „wgrywanie" na
   stronie Konfiguracja (I11). Skutek dla gate'u opisany niżej.
2. **`GET /api/atrybuty` jest w oryginalnym widoku martwe** — zapytanie leci
   (`fe.js:20630-20633`), ale zmienna z wynikiem nie występuje w całym regionie widoku.
   Nie portujemy go; I7 nie był blokerem.
3. **Etykiety i kolory typów wzięte z oryginału** (`fe.js:597086` i `:597593`), łącznie
   z opcją „Nowe produkty (stare)" dla wartości `nowy`, której nasz silnik nie produkuje.
4. **Kolumny, rozmiary strony i teksty** (m.in. „Brak elementów do wyświetlenia") — z oryginału.

## ⚠ Gate 3e — co się domyka, a co nie

Gate mówił: „fixtures FE + **Ania klika pełny cykl importu** na staging". Dowieziona jest
część fixtures i cały widok. **Pełny cykl NIE domyka się w tej sesji** i nie jest to
niedoróbka, tylko konsekwencja tego, gdzie w oryginale mieszka wgrywanie plików:
bez zakładki „wgrywanie" (I11) Ania nie ma z przeglądarki jak ZACZĄĆ importu.

Zgodnie z decyzją D1 import przygotowujemy my. Instrukcja dla Ani:

```bash
# 1. Zaloguj się i weź token
TOKEN=$(curl -s -X POST https://test.agritires.eu/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<email>","password":"<hasło>"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# 2. Wgraj cennik (przykład: MO1)
curl -s -X POST 'https://test.agritires.eu/api/import/parse-file?dostawca=MO1' \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @cennik_MO1.csv
```

Potem `https://test.agritires.eu/staging` ma czym się wypełnić.

⚠ **Czego Ania NIE zobaczy w stagingu i to jest poprawne:** pozycji auto-zatwierdzonych.
Import wpisuje je wprost do katalogu (zmiany samej ceny/stanu/magazynu), więc na staging
trafia tylko to, co wymaga oka człowieka. Widać je dopiero w historii cen (Iteracja 5).

⚠ **Wycofania pojawią się dopiero przy TRZECIM imporcie** tego samego dostawcy bez danej
pozycji — taka jest reguła progu. Przy pierwszym przebiegu `wycofane: 0` jest poprawne.

## Napotkane pułapki

**1. Kolizja wzorców MSW.** Handler `.../api/staging/:id` pasuje TAKŻE do
`/api/staging/paged` (dopasowuje `id = "paged"`), a MSW bierze zarejestrowany później.
Dołożenie `:id` osobnym `server.use()` przechwyciło listę i tabela była pusta. Oba handlery
rejestrujemy teraz w jednym wywołaniu, z `paged` na początku — z ostrzeżeniem w kodzie.

**2. `queryClient` jest singletonem modułowym ze `staleTime: Infinity`** (wiernie wobec
oryginału), a kluczem zapytania jest pełny adres z parametrami. Bez `queryClient.clear()`
w `beforeEach` kolejny test dostawał dane poprzedniego. Dodane.

**3. Dwie pomyłki składniowe, obie z polskich znaków:** `„tekst"` w nazwie testu (zamykający
ASCII-owy cudzysłów kończył string) i `*/api/staging/:id` w komentarzu blokowym (sekwencja
`*/` zamknęła komentarz). Obie złapane od razu przez build.

**4. Fixture `GET_staging_paged.json` zawiera wyłącznie `wycofana`** — moja asercja zakładała
`zmiana_kluczowa`. Poprawione tak, żeby oczekiwanie WYNIKAŁO z fixture'a, a nie z założenia:
test bierze typ z danych i sprawdza etykietę z mapy.

## Breaking changes

Brak. Trasa `/staging` istniała jako placeholder; liczba tras routera bez zmian (12).

## Follow-up

- **I11** — zakładka „wgrywanie" na Konfiguracji domknie gate 3e (pełny cykl z przeglądarki).
- **I5** — po akceptacji oryginał unieważnia też `history` i `alerts`; dopisać do
  `odswiez()`, gdy te widoki powstaną (dziś unieważniamy `staging` i `products`).
- **I7** — `GET /api/atrybuty` w widoku stagingu jest martwe; gdyby I7 chciała je tu ożywić,
  najpierw trzeba ustalić, po co miałoby służyć.
