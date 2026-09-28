# 9-FEATURE-acceptstaging-endpointy-mutacji — Iteracja 3, sesja 3d-2 (API)

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/9-acceptstaging-endpointy-mutacji`
> Worktree: `.worktrees/9-FEATURE-acceptstaging-endpointy-mutacji`

## Opis ticketa

Brzeg HTTP silnika importu: `acceptStaging` + dziewięć endpointów mutacji stagingu i poprawek
Marty. Druga połowa podzielonego bloku 3d — 3d-1 (PR #12) dowiozła silnik, ta sesja domyka
Iterację 3 po stronie backendu.

## Kontekst

3d-1 zostawiła silnik kompletny i przetestowany przeciw uruchomionemu oryginałowi. Czego nie ma:
**nikt nie potrafi zatwierdzić pozycji ze stagingu**. Import produkuje wiersze, człowiek nie ma
ich jak przyjąć, a poprawki Marty da się dziś tylko CZYTAĆ z bazy — nie ma ścieżki, która by je
tworzyła. To ostatnia rzecz blokująca 3e (widok `/staging`).

Stan wejściowy potwierdzony przed planem:
- `src/repos/overrides.ts` ma tylko `poprawkiDla()`; `listOverrides`/`upsertOverride`/
  `deleteOverride` mają dopisać się TAM (nota z 3d-1).
- `src/import/silnik/bridge-ext.ts` most istnieje i typuje 2 z 11 funkcji — dochodzą
  `assignKodImportu`, `applyNazwaPamiec`, `applyWagaPamiec`, `rememberLink`.
- Port `bridge_ext.cjs`/`tire_dims.js` jest w repo bajt-w-bajt (sha256), razem z markerem
  `legacy/package.json` — bez niego moduł po cichu nie działa.
- Tabele `nazwa_pamiec`, `waga_pamiec`, `link_pamiec_*` są w kanonie. **Migracji nie trzeba.**
- Bezpiecznik pustego wejścia siedzi w `tk()`, więc `POST /api/staging/import` rodzi się chroniona.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

| Ścieżka | Fixture | Uwagi |
|---|---|---|
| `GET /api/overrides` | **`GET_overrides.json`** | goła tablica, 5 pozycji, 9 kluczy; `?dostawca=&kod=` filtruje |
| `POST /api/overrides` | — | upsert BEZ id (`PUT /api/overrides/{id}` NIE ISTNIEJE) |
| `DELETE /api/overrides/{id}` | — | 404 gdy brak |
| `POST /api/staging/accept` · `/reject` · `/clear` · `/import` | — | `ids[]` albo `allFiltered` + filtry |
| `PUT /api/staging/{id}` · `DELETE /api/staging/{id}` | — | `PUT` tworzy poprawki Marty |
| `GET /api/products`, `/api/staging*`, import×2 | istniejące | **regresja** — muszą zostać zielone |

**Odstępstwo D1 (auth) dotyczy `GET /api/overrides`:** w produkcji trasa jest PUBLICZNA
(brak `we` przy `:48645`), u nas wymaga tokenu — zgodnie z zasadą zaklepaną w I1 (§3
„Bezpieczeństwo"). Kształt odpowiedzi bez zmian, więc fixture obowiązuje normalnie.

## Decyzje

**D1 — `addProductsBulk` NIE wchodzi; idzie do I12 razem z `POST /api/products`**
(decyzja użytkownika 2026-08-28). Graf wywołań: `addProductsBulk` woła wyłącznie
`POST /api/products` (`:48308`), a tę trasę I2 świadomie odłożyła do I12. Budowanie pisarza
bez wywołania nie dałoby się przetestować end-to-end. `assignKodImportu` wchodzi więc TYLKO
w `acceptStaging`. Do zapisania w bloku I12: `addProductsBulk` ma dowieźć też `assignKodImportu`,
`applyDims`, `applyLinkMemory`, `applyNazwaPamiec`, `applyWagaPamiec` — port już czeka w repo.

**D2 — `__restoreZastosowanie()` NIE wchodzi; jawna luka z właścicielem**
(decyzja użytkownika 2026-08-28). `POST /api/staging/accept` woła w produkcji
`__restoreZastosowanie()` (`:44105`): czyta CSV z zahardkodowanej ścieżki produkcyjnej
(`zastosowania_master.csv`, 6823 wiersze) i robi `UPDATE products SET zastosowanie=… WHERE kod=…
AND (zastosowanie IS NULL OR TRIM(zastosowanie)='')`. Uzupełnia WYŁĄCZNIE puste wartości, więc
jego brak niczego nie psuje — po prostu nie uzupełnia. Port wymaga osobnej decyzji o modelu
wdrażania tego pliku (deploy kopiuje dziś tylko `dist/`), a sama funkcja z importem nie ma nic
wspólnego. Do zapisania w roadmapie jako luka z podejrzeniem, że to OBJAW: warto ustalić,
co kasuje `zastosowanie`, zamiast odtwarzać naprawę.

**D3 — narzuty i promocje w `acceptStaging` pomijamy (zaklepane w 3d-1).**
`__bridgePickMarkup`/`__bridgePickPromo` (`:44884-44892`) to Iteracja 4. W I3 obie tabele są
puste, więc gałąź `if (__mm || __pp)` nigdy nie wchodzi i zachowanie jest identyczne. Luka
jest już zapisana w bloku I4 roadmapy — ten ticket jej nie otwiera ponownie.

**D4 — propagacja `uwagaCena` wchodzi, endpointy NIE** (zaklepane w 3d-1, backlog #4).
`acceptStaging` czyta `uwagaCena` ze `snapshotJson` i zapisuje do `products.uwaga_cena`.
`GET /api/products/uwagi-cena` i `/hold-reasons` → I12 razem z openapi.

**D5 — `upsertOverride` NIE nadpisuje `acknowledgedSourceValue`, gdy go nie podano.**
Oryginał (`:44934`) dokłada to pole do UPDATE-u tylko przy `!== undefined`. Ma to znaczenie:
`PUT /api/staging/{id}` nie podaje ack, więc edycja pozycji nie może skasować potwierdzenia
konfliktu zrobionego wcześniej przez `acceptStaging`. Odtwarzamy dosłownie.

## Plan implementacji

### Krok 1 — repozytoria
- `src/repos/overrides.ts` (istnieje) — dopisać `listaPoprawek` (ORDER BY `createdAt` malejąco,
  `:44912`), `zapiszPoprawke` (upsert, D5), `usunPoprawke` (zwraca skasowany wiersz albo `null`).
- `src/repos/staging.ts` — `pozycjaStaginguPoId` już jest; dopisać `aktualizujPozycje`
  i `usunPozycje`.

### Krok 2 — `acceptStaging` (`src/import/akceptacja.ts`, port `:44827-44910`)
Kolejność ma znaczenie i jest odtwarzana 1:1:
1. gałąź `wycofana`: produkt → `status: "wstrzymany"`, `stan: 0`, `dataAktualizacji`; wiersz
   stagingu skasowany; **koniec** (żadnych dalszych kroków);
2. `snapshotJson` → rekord; dla każdego pola w `_srcConflict` → `zapiszPoprawke` z
   `acknowledgedSourceValue` = wartość z pliku (to domyka pętlę alarmu z 3d-1);
3. budowa rekordu produktu: pola ze stagingu nadpisują snapshot, `dataAktualizacji` = teraz;
4. wartości domyślne (`:44881`): `cenaSprzedazy` = `cenaZakupu × 1.25` gdy brak, `marzaPct = 25`,
   `marka` z pierwszego słowa nazwy, `kategoria = "Rolnicze"`, `vat = 23`,
   `status = "wstrzymany"` gdy któraś cena = 0;
5. **POMIJAMY** blok narzutów/promocji (D3) — z komentarzem wskazującym I4;
6. `bridge_ext`: `applyDims`, `applyLinkMemory`, `assignKodImportu`, `applyNazwaPamiec`,
   `applyWagaPamiec` (każde w osobnym `try/catch`, jak oryginał);
7. UPDATE albo INSERT produktu (po `kod`);
8. `rememberLink` PO zapisie;
9. propagacja `uwagaCena` (D4);
10. skasowanie wiersza stagingu.

### Krok 3 — most `bridge-ext.ts`
Dopisać do interfejsu 4 brakujące funkcje. **Nie tworzyć drugiego mostu.**

### Krok 4 — trasy (`src/routes/staging.ts`, nowy `src/routes/overrides.ts`)
Dziewięć endpointów wg listy z bloku 3d-2. Wspólny helper na `ids[] | allFiltered`
(filtry `typZmiany`/`dostawca`/`search`, `ORDER BY id DESC`) — jeden dla `accept` i `reject`,
bo oryginał ma tam identyczny kod. Audit log przy każdej mutacji, jak w oryginale.

### Krok 5 — GATE `GET_overrides.json` + testy

## Strategia testów

**1. Charakteryzacja `acceptStaging` przeciw URUCHOMIONEMU oryginałowi — próba, z jawnym planem B.**
`tk()` dało się wyciąć, bo jest samodzielnym przypisaniem. `acceptStaging` siedzi w środku
obiektu `U = {…}` (`:44695-44950`), który zależy od `X` (drizzle), `Qi` (surowy uchwyt),
obiektów tabel (`he`/`He`/`Yt`), `se`/`A`/`Ii` (eq/sql/desc) i `__BRIDGE_EXT`. **Wszystkie te
rzeczy mamy** — drizzle, nasz schemat i port `bridge_ext` — więc wycięcie całego `U` i wstrzyknięcie
zależności wygląda na wykonalne i dałoby ten sam poziom dowodu co w 3d-1.
**Plan B, jeśli powierzchnia zależności okaże się nie do opanowania:** testy zachowania pisane
z lektury oryginału, z jawnym odnotowaniem w raporcie, że to słabszy dowód niż w 3c/3d-1.
Decyzja zapadnie przy implementacji i zostanie opisana — nie chowam jej w komentarzu.

**2. Testy decyzji `acceptStaging`:** wycofana → wstrzymanie zamiast kasowania · `_srcConflict`
→ powstaje poprawka z `acknowledgedSourceValue` (i drugi import już nie alarmuje — domknięcie
pętli z 3d-1) · domyślne ceny/marża/status · `uwagaCena` ze snapshotu · wymiary z `applyDims`
· `kod_importu` z `assignKodImportu` · pozycja nowa (INSERT) vs istniejąca (UPDATE).

**3. Endpointy przez HTTP:** `ids[]` i `allFiltered` z każdym filtrem · `DELETE`/`PUT` 404
przy braku · `PUT` tworzy poprawki dla 8 pól i NIE kasuje istniejącego ack (D5) ·
`POST /api/overrides` 400 przy braku pól wymaganych · **pusta tablica w
`POST /api/staging/import` nie dociera do stagingu ani do liczników** (w 3d-1 sprawdzone na
poziomie `tk()`, tu przez HTTP) · audit log powstaje.

**4. GATE:** `GET_overrides.json` kształt 1:1 + walidacja wobec `openapi.yaml`.

**5. Regresja:** charakteryzacja 3a i silnika, GATE I2, `GET_staging*.json`, gate treści importu
— zielone bez zmian w samych testach.

## Poza zakresem

- `addProductsBulk` + `POST /api/products` → **I12** (D1).
- `__restoreZastosowanie()` → luka z właścicielem do ustalenia (D2).
- Narzuty i promocje w `acceptStaging` → **I4** (D3).
- `GET /api/products/uwagi-cena`, `/hold-reasons`, openapi, przenagranie fixtures → **I12** (D4).
- Widok `/staging` → **3e**.

## Definition of done
- [ ] `acceptStaging` odtwarza produkcję: wycofania, potwierdzanie konfliktu, domyślne wartości,
      `bridge_ext`, `uwagaCena`
- [ ] Dziewięć endpointów działa, z audit logiem i obsługą `allFiltered`
- [ ] `PUT /api/staging/{id}` tworzy poprawki Marty i nie kasuje potwierdzeń (D5)
- [ ] `GET_overrides.json` zielony; wszystkie wcześniejsze gate'y zielone
- [ ] Sposób dowodzenia `acceptStaging` (charakteryzacja albo plan B) opisany w raporcie
- [ ] `lint` / `typecheck` / `build` / `test` czyste
- [ ] Roadmapa: blok 3d-2 zamknięty, luki z D1/D2 wpisane DO bloków I12 i (nowego) właściciela
