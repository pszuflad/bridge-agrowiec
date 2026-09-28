# 18-FEATURE-waga-gabarytowa — Iteracja 9: Waga gabarytowa

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/18-waga-gabarytowa`
> Worktree: `.worktrees/18-FEATURE-waga-gabarytowa`

## Opis ticketa

Realizacja **Iteracji 9** wg `docs/rebuild-roadmap.md` §5. Jedna sesja (BE+FE), zależy od I2 (gotowe).

CEL (Ania klika): otwiera `/waga-gabarytowa`, liczy wagę gabarytową dla opony (formularz → wynik).

ZAKRES z promptu:
- Backend: `POST /api/waga-gabarytowa/oblicz` — formuła odtworzona 1:1 z oryginału.
- Frontend: widok `/waga-gabarytowa` — formularz + wynik, wpięty w istniejący shell/router.
- Decyzja „lokalnie vs API"; ustalenie statusu mechanizmu „waga pamięć".

## Kontekst

### ⚠ ODKRYCIE, KTÓRE WYWRACA ZAŁOŻENIE ROADMAPY

Roadmapa (`docs/rebuild-roadmap.md:1039`) rekomendowała „liczyć przez API — jedno źródło logiki",
zakładając, że backend i frontend liczą **ten sam wzór** w dwóch miejscach. **Nie liczą.**
To dwa merytorycznie różne kalkulatory, przypadkiem nazwane tym samym słowem:

**Backend** (`deminified/backend-index.cjs:48749-48769`) — waga **paletowa/oponowa**,
sterowana configiem `waga_gab.*` (`:45633-45637`, domyślne wartości siane przy starcie):

```js
p = waga_gab.szer_polpaleta  (default "55")
f = waga_gab.szer_paleta     (default "80")
d = waga_gab.wys_palety      (default "10")
m = waga_gab.wspolczynnik    (default "0.000167")   // opis: "DPD 1/6000 (1 m³ = 167 kg)"
h = body.szerokosc || "0";  _ = body.dlugosc || "0";  k = body.wysokosc || "0"   // parseFloat

h <= p → T = 60, v = `Szerokość ${h} cm ≤ ${p} cm (półpaleta) → zaokrąglone do 60 cm`
h <= f → T = f,  v = `Szerokość ${h} cm > ${p} cm, ≤ ${f} cm (paleta) → zaokrąglone do ${f} cm`
else   → T = h,  v = `Szerokość ${h} cm > ${f} cm → użyto oryginału`

g = k + d
x = T * _ * g * m
→ { wagaGabarytowa: Math.round(x*1e3)/1e3, szerokoscEfektywna: T, wysokoscZPaleta: g,
    wspolczynnik: m, opis: v }
```

**Frontend** (`deminified/frontend-index.js:26514-26953`, komponent `nM`) — waga **wolumetryczna
kurierska** z dzielnikiem per przewoźnik, liczona lokalnie, **zero wywołań API**
(potwierdzone: brak `fetch`/`apiRequest` w całym komponencie):

```js
wagaGabarytowa = dlugosc * szerokosc * wysokosc / dzielnik
objetoscM3     = dlugosc * szerokosc * wysokosc / 1e6
wagaDoWyceny   = wagaRzeczywista ? Math.max(wagaGabarytowa, wagaRzeczywista) : null
```

Widok ma dodatkowo **pełny edytor przewoźników i dzielników** (`:26774-26936`) — nie jest to
sam kalkulator. Cały stan trwały w IndexedDB (`:9165-9193`), nie w API.

**Wniosek:** rekomendacja „przez API" była oparta na fałszywej przesłance. Nie ma czego
deduplikować — przełączenie FE na API **odebrałoby Ani** edytor przewoźników, wybór dzielnika,
objętość m³ i wagę do wyceny, podmieniając wzór wolumetryczny na paletowy. Dowozimy oba 1:1.

### Stan `rebuild/` — co już jest

- `rebuild/frontend/src/pages/placeholdery.ts:38-42` — placeholder `/waga-gabarytowa`
  („Iteracji 9") czeka na zdjęcie, dokładnie jak `/narzuty` przed sesją 4b.
- `rebuild/frontend/src/lib/magazynKV.ts` — **port IndexedDB 1:1 już istnieje**
  (`odczytajKV`/`zapiszKV`, baza `bridge-store-v2`, store `kv`, połykanie błędów). Reużywamy.
- `rebuild/frontend/src/components/ui/` — `card`, `input`, `label`, `select`, `button`,
  `toast` — komplet potrzebnych prymitywów jest.
- `rebuild/backend/src/repos/config.ts` — `odczytajKonfiguracje(db, klucz)`, wycinek
  `U.allConfig()`. Potrzebne cztery klucze `waga_gab.*`; pełne `GET/PUT /api/config` to I11.
- `rebuild/backend/test/gate/` — harness GATE (`sprawdzZgodnoscZKontraktem`, `wczytajKontrakt`,
  `stworzSrodowiskoTestowe`).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ścieżki kontraktu w zakresie:** `POST /api/waga-gabarytowa/oblicz` (`contract/openapi.yaml:1155-1163`)
— jedna operacja, jedyna, jakiej ta iteracja dotyka.

**Fixtures w zakresie: BRAK.** `ls contract/fixtures/ | grep -i waga` → pusto (potwierdzone).
Roadmapa to zakładała (`:1041` — „brak fixtura GET"). To **istotnie osłabia siatkę**: nie mamy
nagrania produkcji do porównania kształtu. Rekompensujemy dwoma rzeczami, i nazywamy to wprost
w teście gate'u (wzorem `test/narzuty.gate.test.ts`, gdzie tak samo opisano asymetrię siły
przy pustym `GET_promotions.json`):
1. walidacja odpowiedzi przez `sprawdzZgodnoscZKontraktem` (ścieżka, metoda, kod, content-type);
2. **test jednostkowy formuły** na przykładach wyliczonych ręcznie z kodu oryginału — to jest
   tu główny dowód zgodności, nie fixture.

**Znane rozjazdy i jak je rozstrzygamy:**

| Rozjazd | Rozstrzygnięcie |
|---|---|
| Prompt ticketa mówi „za requireAuth"; `openapi.yaml:1157` mówi `security: []` (PUBLICZNE, komentarz „stan faktyczny"); oryginał rejestruje trasę bez middleware `we` | **Kontrakt i oryginał mają rację co do faktu** — produkcja ma to publiczne. Mimo to świadomie zakładamy `requireAuth` (D2 niżej), dokładnie jak `GET /api/markups`, który ma identyczną sytuację (`openapi.yaml:713` `security: []`, a `routes/markups.ts:30` daje `requireAuth`). |
| Kontrakt deklaruje kody `200` i `400`; z `requireAuth` dochodzi **401, którego kontrakt nie zna** | Precedens `test/narzuty.gate.test.ts:149-156`: 401 asertujemy **wprost** (`expect(status).toBe(401)`), a przez `sprawdzZgodnoscZKontraktem` przepuszczamy tylko odpowiedź 200. Kontraktu **nie ruszamy** — jest zamrożony. |
| Kontrakt deklaruje `400`, ale oryginał **nigdy go nie zwraca** (brak walidacji; `parseFloat(x \|\| "0")`) | Odtwarzamy oryginał: zawsze 200. Kod 400 zostaje w kontrakcie nieosiągalny — tak jest w produkcji. |
| `spec-frontend.md:79` („liczona w przeglądarce, choć endpoint istnieje") vs prompt sugerujący, że FE ma wołać API | Spec zgadza się z oryginałem. Zostajemy przy 1:1 (D1). |

## Decisions

**D1 — Dowozimy OBA kalkulatory, każdy 1:1 z oryginałem.** (Q&A: „Oba, 1:1 jak oryginał")
FE liczy lokalnie wzorem wolumetrycznym z dzielnikiem przewoźnika i **nie woła** endpointu;
BE dostaje własną, paletową formułę, przetestowaną jednostkowo, ale nieużywaną przez FE —
tak jak w produkcji. *Za:* zero utraty funkcji dla Ani, obie rzeczy przez GATE, iteracja
domknięta. *Przeciw:* dwa wzory w repo — ale to dwie różne funkcje biznesowe, nie duplikat.
Rekomendacja roadmapy („przez API") **odrzucona ze wskazaniem powodu**: jej przesłanka
(„jedno źródło logiki") była fałszywa, bo wzory nie są tożsame.

**D2 — ⚠ ODSTĘPSTWO ŚWIADOME: `POST /api/waga-gabarytowa/oblicz` idzie za `requireAuth`.**
(Q&A: „requireAuth") W produkcji i w `openapi.yaml:1157` trasa jest publiczna. Kontynuujemy
decyzję **D1 z I1** — w `rebuild/` wszystkie trasy danych są pod auth (precedensy: `markups`,
`products`, `staging`, `overrides`, wszystkie z `security: []` w kontrakcie). Endpoint czyta
config (`waga_gab.*`), więc nie jest czysto bezstanowy. Kształt odpowiedzi bez zmian.
Odstępstwo udokumentowane komentarzem w kodzie, wzorem `routes/markups.ts:25-30`.

**D3 — Edytor przewoźników i dzielników w pełnym zakresie 1:1.** (Q&A: „Pełny 1:1")
Tryb edycji, zmiana nazwy i dzielnika per wiersz, usuwanie z blokadą „min. 1 przewoźnik",
dodawanie własnego (`custom_${Date.now()}`), „Przywróć domyślne", kolumna „Przykład dla paczki
60×50×50" (`150000/dzielnik`). Trwałość w IndexedDB. To ~40% kodu widoku, ale Ania to dziś ma.

**D4 — „Waga pamięć" POZA ZAKRESEM I9 (ustalenie, nie decyzja).**
`rememberWaga`/`applyWagaPamiec`/`ensureWagaPamiecTable` (`mirror/backend/bridge_ext.cjs:207-249`,
tabela `waga_pamiec`) to logika **import-side** — wołana wyłącznie z `acceptStaging` /
`addProductsBulk` (`docs/rebuild-roadmap.md:419, 1145`). Port `bridge_ext` domknięty w **3d-2**
(2026-08-27, ticket 9); wywołanie z `addProductsBulk` odłożone do **Iteracji 12**. Ani handler
kalkulatora, ani widok FE nigdy nie dotykają `waga_pamiec`. I9 nie ma tu nic do zrobienia.

## Implementation plan

### Backend

1. **`rebuild/backend/src/domain/waga-gabarytowa.ts` (NOWY)** — czysta funkcja
   `obliczWageGabarytowa(wymiary, ustawienia)` odtwarzająca `:48749-48769` krok po kroku:
   progi półpalety/palety, stała 60, `g = wysokosc + wys_palety`, `Math.round(x*1e3)/1e3`,
   trzy warianty tekstu `opis` z dokładnym brzmieniem i znakami `≤`, `>`, `→`.
   Zachowujemy semantykę `parseFloat(x || "0")` — brak pola i wartość nieparsowalna dają 0.
2. **`rebuild/backend/src/repos/config.ts`** — dopisać `USTAWIENIA_WAGI_GABARYTOWEJ`
   (cztery domyślne wartości z `:45633-45637`) i odczyt czterech kluczy `waga_gab.*`
   z fallbackiem na domyślne, dokładnie jak `l["waga_gab.x"] || "55"` w oryginale.
3. **`rebuild/backend/src/routes/waga-gabarytowa.ts` (NOWY)** — `trasyWagiGabarytowej({ db })`,
   `router.post("/api/waga-gabarytowa/oblicz", requireAuth, ...)` z komentarzem
   „⚠ ODSTĘPSTWO ŚWIADOME (D2)" wzorem `markups.ts`. Bez walidacji i bez 400 — jak oryginał.
   Bez `zapiszAudyt` — oryginał nic nie audytuje na tej trasie.
4. **`rebuild/backend/src/app.ts`** — `app.use(trasyWagiGabarytowej({ db }))`.

### Frontend

5. **`rebuild/frontend/src/pages/waga-gabarytowa/przewoznicy.ts` (NOWY)** — `PRZEWOZNICY_DOMYSLNI`
   (6 pozycji 1:1 z `frontend-index.js:9169-9192`: GEIS 10000/domyślny, DPD 6000, GLS 4000,
   InPost 5000, UPS 5000, DHL 5000), typ `Przewoznik`, cztery klucze IndexedDB.
6. **`rebuild/frontend/src/pages/waga-gabarytowa/obliczenia.ts` (NOWY)** — czysta funkcja
   `policzWage(wymiary, przewoznik)` + walidacja (`Number.isFinite && > 0`, przecinek→kropka).
   Wydzielona, żeby dała się przetestować jednostkowo bez renderu.
7. **`rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx` (NOWY)** — edytor z D3.
8. **`rebuild/frontend/src/pages/WagaGabarytowa.tsx` (NOWY)** — dwie kolumny
   (`grid lg:grid-cols-2`): „Wymiary paczki" (formularz) i „Wynik"; pod spodem
   `TabelaPrzewoznikow`. `PageHeader title="Waga gabarytowa" subtitle="Kalkulator + ustawienia
   przewoźników w jednym miejscu"`. Wszystkie `data-testid` 1:1 z oryginałem
   (`input-dlugosc`, `input-szerokosc`, `input-wysokosc`, `input-waga-rzecz`,
   `select-przewoznik`, `button-oblicz`, `text-wynik-waga`, `text-waga-do-wyceny`,
   `button-edycja-przewoznikow`, `button-przywroc-domyslne`, `input-nazwa-{id}`,
   `input-dzielnik-{id}`, `button-usun-{id}`, `input-nowy-nazwa`, `input-nowy-dzielnik`,
   `button-dodaj-przewoznika`).
   Stan początkowy: `"60"`, `"50"`, `"50"`, `""` — hydratacja z IndexedDB w `useEffect`,
   z flagą „wczytano" gatującą autozapis (oryginał: `f`, `:26562-26565`), żeby pierwszy render
   nie nadpisał zapamiętanych przewoźników domyślnymi.
   Formatowanie 1:1: waga `toFixed(2)` kg, objętość `toFixed(4)` m³, dzielnik w tabeli
   `toLocaleString("pl-PL")`, wiersz „Obliczenie" jako `dł × szer × wys ÷ dzielnik`.
9. **`rebuild/frontend/src/App.tsx`** — import + `<Route path="/waga-gabarytowa" component={WagaGabarytowa} />`.
10. **`rebuild/frontend/src/pages/placeholdery.ts`** — usunąć wpis `/waga-gabarytowa`,
    zaktualizować komentarz nagłówkowy (liczba tras routera zostaje 12).

## Testing strategy

**GATE (`rebuild/backend/test/waga-gabarytowa.gate.test.ts`, NOWY)**
- `POST /api/waga-gabarytowa/oblicz` z tokenem → 200, `sprawdzZgodnoscZKontraktem`.
- Bez tokenu → 401 asertowane wprost (poza checkerem kontraktu — 401 nie jest w openapi
  dla tej ścieżki; precedens `narzuty.gate.test.ts:149`). Test ma komentarz nazywający
  **brak fixtura** i wynikającą z tego słabszą siłę siatki.
- Kształt odpowiedzi: dokładnie pięć kluczy `wagaGabarytowa`, `szerokoscEfektywna`,
  `wysokoscZPaleta`, `wspolczynnik`, `opis` — ani jednego więcej.

**Jednostkowe BE (`rebuild/backend/test/waga-gabarytowa.formula.test.ts`, NOWY)** — główny dowód
zgodności. Przykłady wyliczone ręcznie z `:48749-48769`, po jednym na każdą gałąź progu
szerokości (≤55 → 60; 55<h≤80 → 80; h>80 → h) plus: puste ciało (wszystko 0), pola jako stringi,
pola nieparsowalne, zaokrąglenie do 3 miejsc, dokładne brzmienie każdego z trzech `opis`,
wpływ nadpisanego configu `waga_gab.*` na wynik.

**Jednostkowe FE (`rebuild/frontend/test/waga-gabarytowa.obliczenia.test.ts`, NOWY)** — wzór
wolumetryczny, `wagaDoWyceny` w obie strony (gabarytowa > rzeczywista i odwrotnie), objętość m³,
walidacja odrzucająca zero/ujemne/NaN, przecinek jako separator dziesiętny.

**Renderowe FE (`rebuild/frontend/test/waga-gabarytowa.test.tsx`, NOWY)** — wypełnienie
formularza → klik „Oblicz" → wynik w `text-wynik-waga`; toast przy niepoprawnych wymiarach;
edytor: dodanie przewoźnika, usunięcie, blokada usunięcia ostatniego, „Przywróć domyślne".
Bez mocka IndexedDB tam, gdzie nie trzeba — `magazynKV` sam połyka brak IndexedDB w jsdom
i cofa się do wartości domyślnych, co jest zachowaniem oryginału.

**Czego nie testujemy:** porównania z fixture'em (nie istnieje — nazwane wprost w gate'cie);
`waga_pamiec` (poza zakresem, D4); `GET/PUT /api/config` (I11).

Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/`
**i** `rebuild/frontend/`.

## Out of scope

- **„Waga pamięć"** (`waga_pamiec`, `applyWagaPamiec`, `rememberWaga`) — import-side, port
  domknięty w 3d-2, reszta w I12 (D4).
- **`GET/PUT /api/config`** — pełna obsługa configu należy do Iteracji 11. Tu tylko odczyt
  czterech kluczy `waga_gab.*` z fallbackiem na domyślne.
- **Podłączenie FE do endpointu** — świadomie nie (D1).
- Inne widoki i trasy.

## Definition of done

- [ ] `POST /api/waga-gabarytowa/oblicz` zwraca pięć pól o wartościach zgodnych z formułą
      oryginału na wszystkich trzech gałęziach progu szerokości
- [ ] Endpoint za `requireAuth`; 401 bez tokenu; 200 waliduje się przez `sprawdzZgodnoscZKontraktem`
- [ ] `/waga-gabarytowa` zdjęte z placeholderów, wpięte w `App.tsx`, renderuje kalkulator
      + edytor przewoźników z kompletem `data-testid` z oryginału
- [ ] FE liczy lokalnie (wolumetrycznie, dzielnik per przewoźnik), nie woła API — jak oryginał
- [ ] Stan (przewoźnicy, wybór, ostatnie wymiary, ostatni wynik) trwały w IndexedDB
      przez `magazynKV`, z gatowaniem autozapisu do czasu hydratacji
- [ ] Testy: gate + jednostkowe formuły BE + jednostkowe FE + renderowe FE — zielone
- [ ] `lint`, `typecheck`, `build`, `test` czyste w `rebuild/backend/` i `rebuild/frontend/`
- [ ] Decyzje D1–D4 zapisane w plan.md i raport.md; roadmapa i backlog zaktualizowane
