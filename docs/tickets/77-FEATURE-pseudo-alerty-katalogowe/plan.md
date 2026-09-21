# 77-FEATURE-pseudo-alerty-katalogowe — P6.2: pseudo-alerty katalogowe jako zakładka „Katalog" na /alerty

> Status: Implemented
> Branch: `feature/77-pseudo-alerty-katalogowe`
> Worktree: `.worktrees/77-FEATURE-pseudo-alerty-katalogowe`

## Opis ticketa

Karta P6.2 (Iteracja 6, „Poprawki po testach Ani"). Wracają pseudo-alerty liczone z katalogu
(marża ujemna, bardzo niska marża, nie-opona, brak importu cennika) jako druga zakładka
„Katalog" strony `/alerty`, obok „Import" (dzisiejsza lista alertów importu z P6.1).
Ania, 2026-09-21: „tak, potrzebuję jej w nowym Bridge" (lista) i „używam obu" (przyciski
„Oznacz jako przejrzany" / „Rozwiąż"). **Bloker cutoveru.** Pełna treść wejścia: backlog #26,
roadmapa blok „Iteracja 6".

## Kontekst

- **Źródło silnika — WYŁĄCZNIE `origin/main`:**
  `git show origin/main:mirror/frontend/assets/index-PRICEFMT1783512500.js` (żywy bundel,
  potwierdzony `index.html` na main). Develop i `deminified/` są sprzed łatek 04.09.
  Funkcje (offsety znakowe w tym bundlu, do ponownego odszukania `grep -bo`):
  - `h2` (słowa dyskwalifikujące, po `tr_fix` — BEZ `"tr-"`), `y2` (słowa „opona"),
    `g2`/`x2` (regexy rozmiaru), `v2(nazwa, kategoria)` (klasyfikator) — ok. znak 313266–314950;
  - `w2 = new Set(["MO7","MO8"])`, `Ey=7`, `Py=30`, `k2` (regex reguły wyłączonej);
  - `pv(produkty, statusy)` — silnik (ok. znak 315109);
  - `N2()` — Pulpit (czyta `alerty-statusy`, `pv(...).filter(nowy)`, top 5 kryt./ostrz.);
  - `HT()` — widok `/alerty` (ok. znak 500052): filtry poziom/status, ukrycie rozwiązanych,
    „Zaakceptuj wszystko", przyciski, zapis statusów do IndexedDB (debounce 300 ms) +
    `window.dispatchEvent("alerty-statusy-updated")`.
- **Reguły po łatkach 04.09 (zweryfikowane na main, 1:1):**

  | Reguła | Warunek | Poziom | `id` | `opis` |
  |---|---|---|---|---|
  | Marża ujemna — sprzedaż pod kosztem | `typeof marzaPct==="number" && marzaPct<0` | krytyczny | `${id}-marza-ujemna-${Math.round(marzaPct*10)/10}` | `${kod\|\|"-"} · ${nazwa.slice(0,60)} (marża X.X%, zakup Y.YY zł, sprzedaż Z.ZZ zł)` |
  | Bardzo niska marża | `else if marzaPct<5` | ostrzezenie | `${id}-marza-niska-${…}` | `… (marża X.X%)` |
  | Nie-opona w katalogu — błąd parsera | `v2(nazwa,kategoria)`: `!isTire && confidence==="wysoka"` | krytyczny | `${id}-nie-opona-${(nazwa\|\|'')+'\|'+(kategoria\|\|'')}` | `… (${reason})` |
  | Brak importu cennika | dni od MAX(`dataAktualizacji`) produktów dostawcy: `>=30` / `>=7`; pomijani `MO7`,`MO8` i dostawcy bez daty | krytyczny / ostrzezenie | `dostawca-${kod}-brak-importu-${dni}`, `productId=-1` | `Dostawca X: ostatni import N dni temu (próg krytyczny: 30 dni)` / `(próg ostrzeżenia: 7 dni)` |

  `data` alertu produktowego = `dataAktualizacji || teraz`; dostawcy = data najnowszej
  aktualizacji. Sortowanie: waga poziomu (krytyczny 0, ostrzezenie 1, info 2), potem data malejąco.
  Dwie reguły `if(false)` („Brak stanu magazynowego", „Znaki w rozmiarze sklejone z nazwą") —
  NIE przenosimy jako działających (odnotowane w komentarzu silnika).
- **Fakty z oryginału, które warto znać:**
  - „Brak importu" NIE czyta `/api/suppliers` — liczy z produktów. Dni są w `id`, więc status
    alertu dostawcy „resetuje się" co dobę (nowy dzień ⇒ nowy `id` ⇒ „nowy"). To skutek łatki
    ackalerts pkt 1 — przenosimy 1:1.
  - `v2()` to INNY klasyfikator niż backendowy `czyOpona` (`import/silnik/klasyfikator.ts`,
    port `Zc()` z importu) — portujemy `v2()` osobno we froncie, nie reużywamy `czyOpona`.
  - Snapshot (`db/snapshot.db`, 7405 produktów): 0 z marżą <0, 15 z marżą 0–5, `marza_pct`
    nigdy NULL; kody `MO7` (Nokian) i `MO8` (Trelleborg) istnieją — wykluczenie działa realnie.
  - „Marża" = `marzaPct` z `GET /api/products` (procent NARZUTU, instrukcja I4 §1 pkt 4) —
    używamy wprost, nie przeliczamy.
- **Odbudowa dziś:** `/alerty` = tylko `TabelaAlertow` (P6.1). Wspólne: `pages/alerty/statusy.ts`
  (`STATUS_*`, `ETYKIETY_STATUSU`, `akcjeStatusu`), `PrzyciskiStatusu.tsx`; filtr domyślny
  P6.1 = `FILTR_NIEROZWIAZANE` (`pages/alerty/grupowanie.ts:55-59`). Pulpit
  (`pages/Pulpit.tsx`, `pages/pulpit/kpi.ts`) karmi kafel i kartę alertami importu
  (odstępstwo O-10f-1) i już pobiera `["/api/products"]` (`pulpit/api.ts:71-73`).
  Komponent `components/ui/tabs.tsx` istnieje, nieużywany.
- **Backend:** wzorzec `routes/alerts.ts` + `repos/alerts.ts`, rejestracja w `app.ts`;
  „kto" = `req.user?.id` / `req.user?.imieNazwisko` (`routes/config.ts:75-76`); migracje
  w `rebuild/schema/`, testy dostają je automatycznie (`test/gate/baza.ts`).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

- **Nowa trasa (odstępstwo, decyzja 2):** `GET` i `PUT /api/alerty-katalogu/statusy` — dopisana
  do `contract/openapi.yaml` ręcznie, z ręcznymi schematami POZA generowanym blokiem
  (`tools/generate-openapi-schemas.cjs` przepisuje tylko swój blok i jednowierszowe `content`;
  odpowiedzi opisujemy wielowierszowo, żeby generator ich nie zdejmował —
  `--sprawdz` musi przejść). Nagrania z produkcji **nie ma i być nie może** (w oryginale
  status żyje w IndexedDB), więc **NIE dokładamy fixture'a** — `contract/fixtures/` bez zmian,
  bramki FE nie zależą od nowej trasy przez fixtures.
- **Trasy czytane, bez zmian:** `GET /api/products` (goła tablica, `GET_products_bez-parametrow.json`),
  `GET /api/alerts` (`GET_alerts.json`) — ich kształt nietknięty.
- GATE: test BE waliduje odpowiedzi nowej trasy względem schematu w `openapi.yaml`
  (`sprawdzZgodnoscZKontraktem`); `test/kontrakt.spojnosc.test.ts` + `--sprawdz` zielone.

## Decyzje

Pięć decyzji użytkownika z 2026-09-21 (backlog #26) — wykonujemy:
1. **Gdzie:** zakładki „Import" / „Katalog" na `/alerty`. Domyślnie „Import" (dzisiejszy widok,
   pierwsza w kolejności z decyzji); zakładka w adresie `?zakladka=katalog`, żeby Pulpit mógł
   linkować wprost do właściwej.
2. **Status na serwerze** (odstępstwo od IndexedDB — jak D1 z I6). Nowa tabela + trasa.
3. **Pulpit pokazuje oba źródła z podziałem** — unieważnienie zapytań zamiast `dispatchEvent`.
4. **Ukrywanie rozwiązanych wchodzi** (odwrócenie D3 z 13e).
5. **Liczenie w przeglądarce** — z pomiarem kosztu na snapshocie (wynik w raporcie; jeśli
   odczuwalny — STOP i pytanie).

Decyzje z Q&A tej karty (2026-09-21, wszystkie zgodnie z rekomendacją):
- **Q1 migracja:** P6.2 bierze `007`; PR.3 dostaje `008` — nota wpisana do bloku PR.3 w roadmapie.
- **Q2 sprzątanie:** „wypieranie + sierotki" — zapis statusu kasuje wpisy tej samej pary
  (produkt/dostawca, reguła) z innym odciskiem, a przy każdym zapisie kasowane są wpisy
  produktów, których nie ma już w `products`. Tabela ≤ ~1 wiersz na parę. Bez procesu w tle.
  Świadoma różnica: powrót marży do dokładnie starej wartości daje „nowy", nie stary status.
- **Q3 filtr statusu:** jak P6.1 — „Nierozwiązane" (domyślny), „Wszystkie statusy" (z rozwiązanymi),
  „Nowy", „Przejrzany", „Rozwiązany". Domyślny widok = widok oryginału (rozwiązane ukryte).
- **Q4 „Otwórz ponownie":** tak, ten sam komponent co w Imporcie; „nowy" = skasowanie wpisu.

Decyzje Mastera (zlecone przez decyzję 3, opisane w raporcie):
- **Kafel „Aktywne alerty"** = liczba alertów w statusie `nowy` z OBU źródeł (import + katalog),
  podpis `N krytycznych` liczony łącznie (alerty importu nie mają poziomu `krytyczny`, więc
  w praktyce to krytyczne z katalogu). Zgodne z oryginałem (tam kafel liczył pseudo-alerty
  `nowy`) i z O-10f-1 (import) naraz.
- **Karta „Najnowsze powiadomienia"** — dwie sekcje „Import" i „Katalog", każda do 5 pozycji
  (ten sam dobór i sortowanie co dziś: kryt./ostrz., waga, data malejąco); nagłówek
  „N aktywnych alertów łącznie"; sekcja bez alertów znika, karta znika, gdy obie puste.
  Wiersze linkują do właściwej zakładki.

Świadome odstępstwa od oryginału w tym tickecie:
- O-P62-1: status na serwerze zamiast IndexedDB (decyzja 2), zapis natychmiastowy (bez debounce 300 ms).
- O-P62-2: filtr statusu z opcją „Nierozwiązane" i „Wszystkie" pokazujące rozwiązane (Q3).
- O-P62-3: akcja „Otwórz ponownie" (Q4).
- O-P62-4: wypieranie starych odcisków (Q2).
- O-P62-5: Pulpit łączy dwa źródła (decyzja 3); zakładki na `/alerty` (decyzja 1).

## Plan implementacji

### Krok 1 — BE: migracja `007_alerty_katalogu_statusy.sql`
```sql
CREATE TABLE IF NOT EXISTS alerty_katalogu_statusy (
  id TEXT PRIMARY KEY,               -- id alertu z odciskiem, dokładnie jak liczy front
  klucz TEXT NOT NULL,               -- id bez odcisku: „123-marza-ujemna", „dostawca-MO1-brak-importu"
  produkt_id INTEGER,                -- NULL dla alertu dostawcy
  status TEXT NOT NULL CHECK (status IN ('przejrzany','rozwiazany')),
  uzytkownik_id INTEGER,
  uzytkownik_imie TEXT,
  kiedy TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerty_katalogu_statusy_klucz ON alerty_katalogu_statusy(klucz);
```
`nowy` nie jest zapisywany — brak wiersza = „nowy" (jak `t[o] || "nowy"` w `pv`). Model Drizzle
w `db/schema.ts`. Dopisanie do listy w `test/db.migracje.test.ts`, jeśli ją wylicza.

### Krok 2 — BE: repo `repos/alerty-katalogu.ts` + trasa `routes/alerty-katalogu.ts`
- `rozbierzIdAlertu(id)` — rozpoznaje 4 formy: `^(\d+)-(marza-ujemna|marza-niska|nie-opona)-(.*)$`
  (s-flag, bo nazwa może mieć wszystko) i `^dostawca-(.+)-brak-importu-(\d+)$`; zwraca
  `{klucz, produktId|null}` albo `null` (nieznana forma ⇒ 400).
- `listStatusyKatalogu(db)` → `[{id, status, kto, kiedy}]` (jawna projekcja).
- `ustawStatusyKatalogu(db, ids, status, uzytkownik)` w JEDNEJ transakcji:
  `status==="nowy"` ⇒ DELETE po `id`; inaczej UPSERT + DELETE wierszy o tym samym `klucz`
  i innym `id` (wypieranie); na końcu DELETE wierszy z `produkt_id` spoza `products` (sierotki).
- `GET /api/alerty-katalogu/statusy` (`requireAuth`) → goła tablica.
- `PUT /api/alerty-katalogu/statusy` (`requireAuth`), ciało `{ids: string[], status}`:
  400 gdy `status` spoza trzech, `ids` puste/nie-tablica/>10000/element nie-string lub >2000
  znaków, lub nieznana forma id. Odpowiedź `{ok: true, zmienione: n}`. Bez `audit_log`
  (spójnie z `PATCH /api/alerts/:id`, D4 z I6; „kto/kiedy" niesie sama tabela).
- Rejestracja w `app.ts`.

### Krok 3 — Kontrakt
`contract/openapi.yaml`: ścieżka `/api/alerty-katalogu/statusy` (get, put) z komentarzem-blokiem
„ODSTĘPSTWO OD PRODUKCJI — P6.2" i ręcznymi schematami (`StatusAlertuKatalogu`,
`PUTAlertyKataloguStatusyZadanie`, `…Odpowiedz200`) poza generowanym blokiem.
`node tools/generate-openapi-schemas.cjs --sprawdz` zielone.

### Krok 4 — BE: testy
`test/alerty-katalogu.gate.test.ts`: kontrakt GET/PUT, 401 bez tokenu, 400-ki, „kto/kiedy",
`nowy` kasuje, wypieranie tej samej pary (marża 3.2 → 4.1), brak wypierania między parami
(`marza-niska` vs `nie-opona` tego samego produktu), sierotki po usunięciu produktu,
`id` z `|`, spacjami, polskimi znakami i myślnikami w nazwie.

### Krok 5 — FE: silnik `pages/alerty/silnik-katalogu.ts`
Port 1:1: `SLOWA_NIE_OPONA` (h2 po tr_fix), `SLOWA_OPONA` (y2), `REGEX_ROZMIARU` (g2/x2),
`klasyfikujOpone(nazwa, kategoria)` (v2), `WYKLUCZENI_Z_BRAKU_IMPORTU` (w2),
`policzAlertyKatalogu(produkty, statusy, teraz = Date.now())` (pv). Czyste funkcje; typ
`AlertKatalogu {id, productId, poziom, typ, opis, dostawca, data, status}`.

### Krok 6 — FE: dane `pages/alerty/katalog-api.ts`
`useStatusyKatalogu()` (`["/api/alerty-katalogu/statusy"]` → mapa `id→status`),
`useAlertyKatalogu()` = `useProdukty()` + statusy + `useMemo(policzAlertyKatalogu)` — JEDNO
miejsce, z którego korzystają zakładka i Pulpit (wspólny cache react-query).
`zmienStatusyKatalogu(ids, status)` — jeden PUT; mutacja z `invalidateQueries` klucza statusów.

### Krok 7 — FE: zakładka `pages/alerty/ListaAlertowKatalogu.tsx` + powłoka `pages/Alerty.tsx`
- Port `HT()`: nagłówek-podpis „X krytycznych · Y ostrzeżeń · alerty wyliczane na żywo z katalogu"
  (liczone ze statusu `nowy`), filtr poziomu (Wszystkie/Krytyczny/Ostrzeżenie/Info), filtr
  statusu (Q3, stała `FILTR_NIEROZWIAZANE` importowana z P6.1), „Zaakceptuj wszystko"
  (wszystkie widoczne po filtrach, nie-rozwiązane ⇒ `rozwiazany`, jeden PUT, bez pytania —
  jak oryginał), licznik „N alert/alertów", pusty stan „Brak alertów spełniających filtr.",
  karta z lewym paskiem dla `nowy` kryt./ostrz., `KT`-plakietka poziomu, data `toLocaleString("pl-PL")`,
  „· dostawca X", plakietka surowego statusu, `PrzyciskiStatusu` (import z P6.1), toast po zapisie.
- `Alerty.tsx`: `Tabs` Import / Katalog, stan zakładki w `?zakladka=`, nagłówek strony wspólny.

### Krok 8 — FE: Pulpit
`pulpit/kpi.ts`: kafel i karta z dwóch źródeł (decyzja Mastera wyżej); `Pulpit.tsx` renderuje
dwie sekcje. Komentarz O-10f-1 zaktualizowany (Pulpit znów liczy też pseudo-alerty).

### Krok 9 — FE: testy + pomiar
- `test/alerty.silnik-katalogu.test.ts`: każda reguła osobno; progi marży −0.01 / 0 / 4.99 / 5;
  dni 6/7/29/30; MO7/MO8 wykluczeni (i dostawca bez daty); zmiana marży ⇒ nowy `id` ⇒ status „nowy";
  BKT z `TR-135` ⇒ nie „nie-opona"; dętka/`tube` ⇒ „nie-opona"; `if(false)` reguły nie wychodzą;
  sortowanie.
- `test/alerty.katalog.test.tsx` (MSW): zakładki, filtr domyślny ukrywa rozwiązane,
  przyciski wysyłają PUT, „Zaakceptuj wszystko" wysyła widoczne.
- `test/pulpit*.test.*`: kafel sumuje, karta ma dwie sekcje.
- **Pomiar:** skrypt w scratchpadzie — snapshot → produkty w kształcie API → `policzAlertyKatalogu`
  (mediana z 20 biegów); wynik + liczba alertów w raporcie.

## Strategia testów
- GATE: nowa trasa waliduje się względem `openapi.yaml`; istniejące GATE `GET /api/alerts`
  i `GET /api/products` bez zmian (nie ruszamy ich kodu). Fixtures bez zmian.
- Bramki BE i FE: lint, typecheck, build, test.
- Bez mocków bazy — BE testy na tymczasowej bazie z migracjami; FE — MSW tylko na granicy HTTP.

## Poza zakresem
- Sprostowanie `docs/instrukcja-testow-I6.md` (§5, §4 pkt 9) — karta P6.3 (follow-up).
- Pliki P6.1 (`TabelaAlertow.tsx`, `grupowanie.ts`, `repos/alerts.ts`) — tylko importy.
- Migracja PR.3, `src/historia/**`, `routes/history.ts`, `routes/export-shoper.ts`.
- Reguły `if(false)` oryginału.
- „Zaakceptuj wszystko" na zakładce Import (oryginał miał je tylko w widoku pseudo-alertów).

## Definition of done
- [ ] Migracja 007 + tabela + model; trasa GET/PUT z walidacją, wypieraniem i sierotkami.
- [ ] `openapi.yaml` opisuje trasę; `--sprawdz` i `kontrakt.spojnosc` zielone.
- [ ] Silnik 1:1 z `origin/main` (4 reguły, h2 bez `tr-`, MO7/MO8, odciski).
- [ ] Zakładki „Import"/„Katalog", filtry jak P6.1, „Zaakceptuj wszystko", wspólne przyciski.
- [ ] Pulpit: kafel sumuje oba źródła, karta z dwiema sekcjami, odświeżenie po zmianie statusu.
- [ ] Testy reguł z progami, MO7/MO8, odciskiem, BKT TR-135.
- [ ] Pomiar czasu liczenia na snapshocie w raporcie.
- [ ] Bramki BE i FE zielone.
- [ ] Roadmapa (podblok P6.2, nota o 008 w PR.3), backlog #26 (Status) zaktualizowane.
