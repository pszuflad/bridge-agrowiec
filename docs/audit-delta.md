# Bridge — delta audytu: 2026-07-22 → 2026-08-17

Co zmieniło się w produkcji między moim audytem (`audit-2026-07-22.md`) a świeżym
stanem pobranym z VPS (kod 2026-08-13, wiedza 2026-08-17).

**Źródła:** `mirror/` + `db/schema.sql` + `db/snapshot.db` (świeże z VPS),
`knowledge/CHANGELOG.md` i transkrypty sesji Perplexity (`knowledge/space/`).

**Wniosek jednym zdaniem:** Ania pracowała intensywnie — **część moich krytycznych
ustaleń z lipca została naprawiona** (auth API, duplikaty tras), ale największy
problem frontendu (rozjazd kontraktu + skrypty injection) **trwa**, a kod nadal
szybko ewoluuje — co potwierdza sens ciągłego sync.

---

## 1. Liczby — 22.07 → teraz

| Metryka | 22.07 | 13–17.08 | Zmiana |
|---|---:|---:|---|
| `index.cjs` MD5 | `3eca99b8…` | `b745bf95…` | **zmieniony** |
| tabele (bez `sqlite_sequence`) | 26 | 26 | bez zmian |
| `products` — kolumny | 71 | **72** | +`nieobecnosc_pod_rzad` |
| `products` — wiersze | 6 941 | 7 405 | +464 |
| `atrybuty_wartosci` | 6 510 | **5 144** | −1 366 (czyszczenie) |
| `staging_items` | 0 | **3 362** | import czeka na akceptację |
| `manual_overrides` | 12 616 | 12 620 | +4 |
| endpointy (rdzeń+moduły)\* | ~98 | ~141 | wzrost (patrz nota) |

\* Liczby endpointów nie porównuj 1:1 — teraz liczę z **deminified** (czytelny),
w lipcu z surowego bundla; część „przyrostu" to lepsza ekstrakcja, nie same nowe
trasy. Kierunek jednak realny: powierzchnia API urosła.

---

## 2. ✅ Moje lipcowe ustalenia, które produkcja NAPRAWIŁA

**2.1 🔴→✅ API katalogu było publiczne — teraz chronione JWT** *(06.08, sesja `626ef740`)*
W lipcu `/api/products` nie miał autoryzacji (`e.get("/api/products",(c,u)=>…)`).
Teraz jest `we` (middleware JWT):
```
.get("/api/dostawcy", we, n)   .get("/api/suppliers", we, n)
.get("/api/products", we, …)   .post("/api/products", we, …)
```
To było moje ustalenie krytyczne o otwartym API. **Domknięte.** Changelog:
*„API było publicznie dostępne bez logowania; Selly nadal pobiera statyczny CSV,
więc kontrakt integratora się nie zmienia."*

**2.2 🔴→✅ Podwójna/potrójna rejestracja tras atrybutów — duplikaty usunięte** *(06.08)*
Mój §8.11 wskazywał 6 tras `/api/atrybuty*` przesłaniających moduł. Teraz w rdzeniu
`index.cjs` **nie ma żadnej** trasy `/api/atrybuty` — ujednolicono do jednej
chronionej ścieżki w module. Changelog: *„duplikaty tras powodowały konflikty
i maskowały właściwy moduł."*

**2.3 Słownik atrybutów przeczyszczony** *(06.08)*
`atrybuty_wartosci`: usunięto 1 755 z 6 899 wartości nieużywanych przez żaden
produkt (6 510 → 5 144). Potwierdzone liczbowo w snapshotcie.

---

## 3. 🆕 Nowe zmiany (nie istniały w lipcu)

**Backend / schemat**
- **`products.nieobecnosc_pod_rzad`** (nowa kolumna) + logika: produkt trafia do
  stagingu jako `wycofana` dopiero po **3 kolejnych** nieobecnościach w imporcie
  dostawcy. *Powód:* mniej fałszywych wycofań z niepełnego pliku. *(06.08)*
- **Klasyfikator `Zc()` rozszerzony** — skid-steer z częścią dziesiętną, `VF`,
  ułamki, modele `TR-`, sygnały `PR TL/TT`. *(06.08)*
- **`/api/password/change`** — działa jako operacja zalogowanego użytkownika. *(31.07)*

**Frontend (nowe warianty bundla)**
- **„Zapamiętaj mnie"** — token w `localStorage` (zaznaczone) lub `sessionStorage`.
  Wymagało zmiany nazw funkcji po kolizji ze zminifikowanym Radix UI Toast.
  → warianty `index-REMEMBER…`. *(31.07)*
- **Eksport boolean „Tak"/pusto, konstrukcja R→Radialna, PR jako `{n}PR`**
  → wariant `index-BOOLEXP…`. *(31.07)*
- **Format ceny sprzedaży** → `index-PRICEFMT…` (obecnie żywy bundle). *(31.07)*
- **Szerokość opony — zera dziesiętne, `16x6-8`→`16x6`** → `index-WIDTHFIX…`. *(31.07)*
- **Ekran logowania** nie pokazuje już przykładowych kont. *(31.07)*

**Parsery / Selly**
- **Handlopex**: brak etykiety → `null`, nie `0`; czyszczenie śniegu bez `MS/3PMSF`. *(31.07)*
- **Selly**: stabilny eksport HTTP `ex-port-files` (pełny CSV, BOM, `;`), ograniczony
  na serwerze do **IP integratora Selly**. *(31.07)*

---

## 4. ⚠ Wciąż otwarte / tylko częściowo rozwiązane

**4.1 Rozjazd kontraktu frontend↔backend — TRWA**
Żywy bundle (`PRICEFMT`) nadal woła **jedno i drugie**:
- `/api/attributes` (ang.) — **14 wywołań**, `/api/attribute-kinds` — w kodzie React
- `/api/atrybuty` (pol.) — 9 wywołań (z łatek/injection)

Backend ma `/api/atrybuty`. Czyli React wciąż używa starych angielskich ścieżek,
a **3 skrypty injection dalej łatają UI na produkcji**: `pending-injection.js`,
`selly-injection.js`, `freq-injection.js`. Mój lipcowy problem (§5.4) **nie zniknął** —
backend uporządkowano, ale frontendowy React nadal mówi w złym „języku".

**4.2 Niezmienione względem lipca**
- **`JWT_SECRET` z zahardkodowanym fallbackiem** — changelog nie wspomina naprawy.
- **Twardo zapisane dane testowych kont w bundlu** — changelog to potwierdza jako
  otwartą pozycję (ukryto je tylko z ekranu, nie z kodu).
- **Dryf schematu** (`kod_importu`, `atrybuty_wartosci_pending` bez kodu tworzącego) —
  brak śladu domknięcia.
- **Frontend nadal bez źródeł** — potwierdzone ponownie 24.07 (*„aktywny frontend
  to zbudowany bundle z injection scripts, bez pełnego drzewa React/Vite"*).

**4.3 Sprostowanie infrastrukturalne (ważne dla wdrożenia)**
Changelog precyzuje: frontend serwuje **Apache** z
`/home/admin/domains/agritires.eu/public_html/panel/`. Katalog
`/home/admin/private_apps/bridge/public/` na porcie 5000 to **nieużywany fallback**.
(W lipcu miałem tylko config nginx — to był ślad myłący; realnie serwuje Apache.)
Poprawki bundla muszą trafiać do pierwszej ścieżki.

---

## 5. Stan operacyjny — coś wymaga uwagi teraz

- **`staging_items` = 3 362 czeka na akceptację**: `zmiana_kluczowa` 1457,
  `wycofana` 1297, `nowa` 419, `blad` 189. W lipcu staging był pusty. Ktoś powinien
  przejrzeć i zaakceptować/odrzucić ten import (albo to normalny bufor pracy Ani).
- **Feedy dostawców** — changelog nie porusza; warto sprawdzić, czy MO3/MO4/MO5
  z lipcowej delty nadal padają (osobny tor).

---

## 6. Co to znaczy dla odbudowy

1. **Kontrakt API do zamrożenia będzie czystszy niż w lipcu** — auth jest już na
   katalogu, duplikaty tras atrybutów zniknęły. Zamrażamy stan po tych poprawkach.
2. **Frontend contract trzeba naprawić u źródła przy odbudowie** — nowy panel woła
   `/api/atrybuty` (poprawnie), bez injection. To eliminuje 3 skrypty łatające.
3. **Kod ewoluuje szybko** (gęsta seria zmian 24.07–06.08) — potwierdza wartość
   producenta na VPS. Bez ciągłego sync gubilibyśmy ten obraz.
4. **`audit-2026-07-22.md` pozostaje aktualny w ~85%** — rdzeń architektury,
   schemat i reguły biznesowe bez zmian; różnice to powyższe punkty.

---

*Re-audyt (Krok 7 bootstrapu) — 2026-08-17. Delta liczona bezpośrednio z mirror/
+ snapshotu + CHANGELOG, nie z pamięci.*
