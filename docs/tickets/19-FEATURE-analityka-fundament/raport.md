# 19-FEATURE-analityka-fundament — raport z implementacji

## Podsumowanie

Iteracja 10, blok **10a** dowieziony: pięć tras `/api/analytics/*` za `requireAuth`
(agregaty przepisane z `mirror/backend/analytics_module.cjs`) plus widok `/analityka` —
szkielet pięciu zakładek w układzie oryginału, nagłówek KPI, sześć wyszukiwalnych filtrów
globalnych i jedna wypełniona sekcja („Marża per dostawca/kategoria/marka") jako wzorzec
dla bloków 10b–10e. GATE zielony za pierwszym uruchomieniem: cztery fixtures zgodne
kształtem 1:1, pięć operacji waliduje się wg kontraktu.

Blok wszedł z ustaloną poprawką: prompt opisywał ekran, którego oryginał nie ma. Rozjazd
zgłoszono przed planem i rozstrzygnięto czterema decyzjami użytkownika (D1–D4), a to, co
zostało zbudowane ponad oryginał, jest nazwane jako odstępstwa O-10a-1..4.

---

## Zmiany

### Backend

- **Nowy:** `rebuild/backend/src/repos/analityka.ts` — agregaty pięciu tras. Limity list
  filtrów (bez limitu / 500 / 1000 / 1000 / 300 / 300), progi marż 5 i 80, limity 1000/200/200,
  `status='aktywny'` w KPI i marżach oraz jego świadomy BRAK w listach filtrów.
- **Nowy:** `rebuild/backend/src/routes/analytics.ts` — `trasyAnalityki({ db })`, pięć tras
  z `requireAuth`.
- `rebuild/backend/src/app.ts` — rejestracja routera po `trasyHistorii`.
- **Nowy:** `rebuild/backend/test/analityka.gate.test.ts` — GATE (11 testów).
- **Nowy:** `rebuild/backend/test/analityka.agregaty.test.ts` — semantyka agregatów (17 testów).

### Frontend

- **Nowy:** `src/components/ui/popover.tsx` — wrapper Radiksa.
- **Nowy:** `src/components/ui/chart.tsx` — infrastruktura wykresów (Recharts 3.x + tokeny
  palety + reguły z `dataviz` w nagłówku).
- **Nowy:** `src/components/WyborZWyszukiwarka.tsx` — wyszukiwalny multi-select.
- **Nowy:** `src/pages/Analityka.tsx` — widok z pięcioma zakładkami.
- **Nowy:** `src/pages/analityka/` — `api.ts`, `filtrowanie.ts`, `formatowanie.ts`,
  `TabelaAnalityki.tsx`, `NaglowekKpi.tsx`, `FiltryGlobalne.tsx`, `SekcjaMarze.tsx`
  oraz **`README.md` — wzorzec sekcji dashboardu dla 10b–10e**.
- `src/App.tsx` — trasa `/analityka`, ładowana **leniwie** (`lazy` + `Suspense`).
- `src/pages/placeholdery.ts` — zdjęty wpis `/analityka`.
- `package.json` — `recharts@^3.10.1`, `@radix-ui/react-popover@^1.1.0`.
- `test/msw/kontrakt.ts` — cztery loadery fixtures analityki, zdejmujące klucze techniczne.
- **Nowe:** `test/analityka.test.tsx` (17 testów), `test/analityka.filtrowanie.test.ts` (9 testów).

---

## Odstępstwa od planu

**Trzy rzeczy wyszły dopiero przy pisaniu kodu; wszystkie rozstrzygnięte w duchu planu,
żadna nie zmienia zakresu.**

**1. Filtry globalne działają na sekcji marż tylko w dwóch wymiarach z sześciu.**
Plan mówił „filtry globalne działają na sekcji marż (klient)" i milczał o tym, że
`GET /api/analytics/margins` grupuje po `dostawca`/`kategoria`/`marka` — `GROUP BY` zwija
model, rozmiar i oba indeksy, więc w odpowiedzi ich **nie ma i nie ma na czym filtrować**.
Zamiast po cichu zwracać pustą tabelę (co wyglądałoby na awarię), sekcja stosuje wymiary,
które potrafi, i wypisuje pozostałe: „Ta sekcja grupuje po dostawcy, kategorii i marce, więc
nie stosuje filtrów: Modele, Rozmiary". Mechanizm (`wymiaryNieobslugiwane`) jest częścią
wzorca — sekcje 10b–10e niosące te kolumny zastosują je normalnie.

**2. `/analityka` ładowana leniwie — poza planem, na podstawie pomiaru.**
Recharts podniósł wspólny bundle z **451 kB do 837 kB** (gzip 140 → 254 kB), a używa go
wyłącznie ten jeden widok. Każde wejście na logowanie, katalog czy staging płaciłoby tę cenę.
Po `lazy` + `Suspense`: wspólny bundle 452 kB, osobny chunk `Analityka` 385 kB ładowany
tylko przy wejściu na `/analityka`. Bloki 10b–10e dokładają wykresy do tego samego chunku.

**3. `TabelaAnalityki` dokłada stopkę „Pokazano 300 z N".**
Oryginał robi `slice(0, 300)` i nie mówi o tym użytkownikowi ani słowa (`:27953`). Przy
filtrach klienckich cichy limit wyglądałby na zepsuty filtr, więc pod tabelą stoi jedno
zdanie z liczbą uciętych wierszy. Sam limit zostaje 1:1.

Poza tym implementacja jest zgodna z planem. Kroki 1–8 wykonane w kolejności; wzorzec
udokumentowany w `rebuild/frontend/src/pages/analityka/README.md`, jak zapowiadał krok 8.

---

## Wyniki testów

### Gate odbudowy (fixtures/kontrakt): ✓ zgodne

Sprawdzone w `rebuild/backend/test/analityka.gate.test.ts` — **przeszedł za pierwszym
uruchomieniem, bez ani jednego `WyjatekGate`**.

| Operacja | Kontrakt (openapi) | Fixture (kształt 1:1) | 401 bez tokenu |
|---|---|---|---|
| `GET /api/analytics/filters` | ✓ | ✓ `GET_analytics_filters.json` | ✓ |
| `GET /api/analytics/status` | ✓ | ✓ `GET_analytics_status.json` | ✓ |
| `GET /api/analytics/kpi` | ✓ | ✓ `GET_analytics_kpi.json` | ✓ |
| `GET /api/analytics/margins` | ✓ | ✓ `GET_analytics_margins.json` | ✓ |
| `POST /api/analytics/bootstrap-current` | ✓ | **brak fixture'a** (metody zapisujące nienagrane, `contract/README.md:38`) | ✓ |

**Siła tej siatki, nazwana wprost — jest słabsza niż w poprzednich blokach, w trzech miejscach:**

1. **Kontrakt nie mówi nic o kształcie.** `contract/openapi.yaml` nie ma dla ŻADNEJ trasy
   analityki schematu odpowiedzi — tylko `responses: {200, 400, 401}` i `security`.
   Walidacja kontraktowa dowodzi więc wyłącznie, że ścieżka istnieje, status jest
   zadeklarowany i ciało jest JSON-em. Cały ciężar niosą fixtures.
2. **`bootstrap-current` nie ma fixture'a wcale.** Zamiast niego: walidacja openapi, test 401
   i cztery testy jednostkowe (kopiuje tylko aktywne, znakuje partię jednym `toISOString()`,
   zwraca `inserted`, nie jest idempotentna).
3. **`margins.low` i `margins.high` są w fixture PUSTE**, bo cała produkcja mieściła się
   w marży (5, 80). Harness nie zagląda do elementów pustej tablicy (`gate/ksztalt.ts:50`),
   więc kształtu tych wierszy nagranie nie dowodzi — pokrywa go test jednostkowy.

**Potwierdzone przy okazji:** `_przyciete` w fixtures to adnotacja nagrywarki
(`contract/README.md:29`), a nie pole API. Backend go nie zwraca; osobny test asercją wprost
pilnuje, że odpowiedź `filters` ma dokładnie sześć kluczy.

**Auth nie jest tu odstępstwem D1** — inaczej niż przy `markups`/`promotions`/`history`
wszystkie pięć ścieżek ma w kontrakcie `security: [{bearerAuth}, {cookieAuth}]`, a oryginał
podaje `requireAuth` w każdej rejestracji. Zgodność pełna.

### Testy jednostkowe i widoku

- **Backend:** ✓ 631/631 (38 plików), w tym 11 nowych GATE + 17 nowych semantyki agregatów.
- **Frontend:** ✓ 304/304 (20 plików), w tym 17 nowych widoku (MSW na fixtures) + 9 filtrowania.
- **Integracyjne / E2E:** pominięte świadomie — projekt nie ma harnessu E2E, a widok jest
  pokryty testem MSW renderującym całą `App` na nagranych odpowiedziach.

### Bramki

| | lint | typecheck | build | test |
|---|---|---|---|---|
| `rebuild/backend` | ✓ | ✓ | ✓ | ✓ 631 |
| `rebuild/frontend` | ✓ | ✓ | ✓ | ✓ 304 |

### Walidacja palety wykresów (skill `dataviz`)

Uruchomiona skryptem, nie oceniona na oko. Tokeny `--chart-1..5` pochodzą z arkusza
produkcji i chroni je `test/tokeny.test.ts`, więc **nie zostały zmienione**:

```
jasny  #d98e26,#3969ac,#33998d,#e87d30,#435670  (tło #f9fafb)
  PASS pasmo jasności · PASS CVD ΔE 11.5 · PASS widzenie normalne ΔE 16.4
  FAIL próg chromy #33998d (0.094), #435670 (0.049) · WARN kontrast #d98e26 (2.61), #e87d30 (2.76)
ciemny #e6a64c,#709ddb,#4dcbbd,#e68c4c,#9cb3c9  (tło #161d27)
  PASS CVD ΔE 12.4 · PASS widzenie normalne ΔE 15.0 · PASS kontrast
  FAIL pasmo jasności (5/5) · FAIL próg chromy #9cb3c9 (0.041)
```

Twarde checki — rozróżnialność przy daltonizmie i przy widzeniu normalnym — przechodzą
w obu trybach. Ostrzeżenia zdjęte ulgą przewidzianą przez skill i wpisaną w reguły wzorca:
tabela z tymi samymi liczbami pod każdym wykresem, wartości przy końcach słupków, maksymalnie
cztery serie, kolejność slotów 1-2-4-3-5. Wykres marż jest jednoserialny, więc problem
rozróżniania kategorii kolorem w ogóle w nim nie powstaje.

---

## Breaking changes

Brak. Wszystkie zmiany są addytywne: nowy router (nowe ścieżki), nowa trasa FE zamiast
placeholdera, dwie nowe zależności FE. Pozycja „Analityka" była już w sidebarze i nie
zmieniła adresu.

---

## Follow-up (świadomie odłożone)

1. **`/katalog` nadal używa multi-selectu bez wyszukiwarki.** `pages/katalog/WyborWielokrotny.tsx`
   i nowy `components/WyborZWyszukiwarka.tsx` rozwiązują ten sam problem; API są zgodne, więc
   migracja to podmiana importu. Poza zakresem 10a — dotknęłaby widoku odtworzonego 1:1 w I2.
2. **Przycisk „CSV" w karcie marż.** Oryginał go ma (`onClick: () => M("margins")` →
   `GET /api/analytics/export/margins`, `:28524`); dowozi go blok **10f** razem z trasą
   `analytics/export/{view}`. Świadomie pominięty, bo przycisk wiodący donikąd byłby gorszy
   niż jego brak.
3. **`margins.low` / `margins.high` bez konsumenta w UI.** Backend je zwraca (progi <5% i >80%),
   oryginalny frontend ich nie renderuje i nasz też nie. Gdyby Ania chciała listę produktów
   ze skrajnymi marżami, jest to gotowe do pokazania — ale byłoby to nowe odstępstwo.
4. **Wspólny bundle FE ma 452 kB (gzip 141 kB) i nikt tego dotąd nie dzielił.** 10a dołożyło
   podział tylko dla własnej trasy. Reszta widoków dalej ładuje się jednym kawałkiem —
   kandydat na osobny ticket porządkowy, nie na blok Iteracji 10.
5. **Nagranie fixture'a dla `POST /api/analytics/bootstrap-current`.** Faza 4 planu kontraktu
   przewiduje nagrywanie metod zapisujących przeciwko `db/snapshot.db`. Dopóki go nie ma,
   ta trasa ma najsłabsze pokrycie z całej piątki.
