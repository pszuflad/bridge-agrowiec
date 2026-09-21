# 90-FEATURE-ozywienie-kart-dostepnosci — P10.1: ożywienie kart „Dostępności" i ich eksportów + #33, #31, #35

> Status: Implemented
> Branch: `feature/90-ozywienie-kart-dostepnosci`
> Worktree: `.worktrees/90-FEATURE-ozywienie-kart-dostepnosci`
> Karta: `docs/karty/P10.1/karta.md` · Backlog: #31, #32, #33, #35

## Ticket description
P10.1 — Iteracja 10: ożywienie dwóch kart „Dostępności" („4.1 Historia dostępności pozycji",
„4.2 Tempo schodzenia z magazynu") i ich eksportów CSV (#32) + trzy poprawki towarzyszące
(#33 duplikat klucza w `sell-through`, #31 idempotentny `bootstrap-current`, #35 nieznany widok
eksportu → 404). Wejście biznesowe: Ania, 2026-09-21, pytanie 10.1 — „tak chcę, żeby zaczęły
działać". Wszystkie cztery punkty to ŚWIADOME ODSTĘPSTWA od produkcji; warunek startu (PR #94
w `develop`) spełniony — merge `d7ee11e`.

## Context
- `repos/analityka.ts`: `dostepnoscProduktow` i `tempoSchodzenia` pytają `historia_cen` o `MAX(nazwa)`
  — kolumny nie ma, `bezpiecznieWiersze` (port `safeAll`) połyka błąd → `rows: []`.
- `repos/analityka-eksport.ts`: `eksportDostepnosciProduktow` (`GROUP BY … nazwa`),
  `eksportTempaSchodzenia` (`MAX(nazwa)`) — ta sama usterka → CSV z samego BOM.
- `routes/analytics.ts` `export/:view`: `WIDOKI_EKSPORTU[widok]?.(db) ?? []` — nieznany widok → 200 + BOM;
  do tego `WIDOKI_EKSPORTU` to zwykły literał obiektu, więc `toString`/`constructor` z prototypu
  też „trafiają" w mapę (wywołanie `Object.prototype.toString(db)`).
- `zbudujSnapshotBiezacy`: `INSERT … SELECT` bez warunku → każde wywołanie dubluje migawkę.
- Frontend: `TabelaAnalityki` renderuje komórki przez `formatuj()` (`formatowanie.ts:14-20`), który
  zamienia `null`/`undefined`/`""` na „—”. Typy FE (`api.ts:406-429`) mają już `nazwa: string | null`.
  **Zmiana kodu FE niepotrzebna** — tylko komentarze nagłówkowe dwóch sekcji i test widoku.

### Pomiary przed kodem (db/snapshot.db, kopia produkcji z 2026-08-13)
- `historia_cen`: 14 513 wierszy (fixture statusu z późniejszej chwili: 15 597). **Wszystkie**
  `zarejestrowano_at` w formacie `toISOString()` — 24 znaki, `T`, strefa `Z` (UTC).
- Duplikaty klucza `(dostawca, kod, zarejestrowano_at)`: **30 grup, 67 wierszy**.
- 5 184 par `(dostawca, kod)` w historii; 1 897 z nich nie ma już w katalogu (→ pusta nazwa).
- `products.kod` jest **globalnie `UNIQUE`** (`001_schema.sql:24`); kod z historii obecny w katalogu
  u INNEGO dostawcy: 0 par.
- **#33 — który wiersz zostaje w `products`:** silnik importu (`import/tk.ts`) wczytuje katalog RAZ
  (`katalogDoImportu`, :174) i nie mutuje obiektu `dopasowany`; każda linia cennika liczy `autoPatch`
  względem stanu SPRZED importu i robi osobny `UPDATE`. Test na prawdziwym silniku (dwie linie `P1`
  w jednym cenniku, obie różne od katalogu): `products` = linia **OSTATNIA**, `historia_cen` = dwa
  wiersze o tym samym kluczu, `MAX(id)` = linia ostatnia → zgodne z decyzją. Niuans pól: jeśli
  ostatnia linia ma `stan` równy stanowi sprzed importu (a różni się np. ceną), `stan` nie wchodzi
  do jej `autoPatch` i w `products` zostaje `stan` linii wcześniejszej, a wiersz historii linii
  ostatniej niesie `stan` sprzed importu (= jej własny). `MAX(id)` zawsze daje stan OSTATNIEJ linii
  pliku; z katalogiem rozjeżdża się tylko w tym przypadku mieszanym. To NIE jest „wygrywa pierwszy"
  — warunek stopu z promptu nie zachodzi; niuans idzie do raportu i follow-upu (import, poza zakresem).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
- `GET /api/analytics/availability/products` ↔ `GET_analytics_availability_products.json`
- `GET /api/analytics/availability/sell-through` ↔ `GET_analytics_availability_sell-through.json`
- `GET /api/analytics/export/{view}` — fixture'a brak (CSV); kontrakt: dochodzi `404`.
- `POST /api/analytics/bootstrap-current` — fixture'a brak; kształt `{ok, inserted, at}` bez zmian.

**Rozjazd z nagraniami — celowy.** Oba fixtures to nagrania produkcji z `rows: []`. Po naprawie
nasze trasy oddają wiersze. Fixtures **zostają nietknięte** (`contract/README.md`: fixture'a nie
poprawiamy pod nowy kod). `WyjatekGate` NIE jest potrzebny i nie wolno go dodać: `gate/ksztalt.ts`
nie zagląda do elementów, gdy fixture ma pustą tablicę (`if (wzorcowa.length === 0) return`),
więc różnicy nie ma, a wyjątek bez pokrycia zapala test (samoczyszczenie). GATE dla tych dwóch
tras dowodzi jak dotąd koperty `{hasHistory, rows}`; kształt wiersza niosą testy agregatów.
Test wyroczni analityki (porównanie z uruchomionym oryginałem) **nie istnieje** — nie ma czego wyłączać.

## Decisions
Wszystkie podjęte 2026-09-21 (backlog, boksy „⭐ DECYZJA"); tu tylko wykonanie:
1. **#32 wariant (a)** — `LEFT JOIN products p ON p.dostawca = h.dostawca AND p.kod = h.kod`,
   nazwa `MAX(p.nazwa)` (dashboard, eksport sell-through) / `p.nazwa` w `GROUP BY` (eksport
   availability — zachowuje grupowanie oryginału po `ean`). Usunięty produkt → `nazwa: null`
   (JSON) / pusta komórka (CSV); widok pokazuje „—” przez istniejące `formatuj()`.
2. **#33** — wspólne CTE `zwiniete`: z każdej grupy `(dostawca, kod, zarejestrowano_at)` wiersz
   o `MAX(id)`; `LAG` liczone dopiero na nim. Jeden fragment SQL w `repos/analityka.ts`,
   używany przez dashboard i eksport `sell-through` (DRY). Karta 4.1 / eksport availability
   liczą dalej `COUNT(*)` po surowej historii — decyzja #33 ich nie obejmuje (odnotowane w follow-upie).
3. **#31** — `INSERT … SELECT … WHERE status='aktywny' AND id NOT IN (SELECT produkt_id FROM
   historia_cen WHERE produkt_id IS NOT NULL AND substr(zarejestrowano_at, 1, 10) = <dzień UTC>)`.
   „Ten sam dzień" = **dzień kalendarzowy UTC** z prefiksu `YYYY-MM-DD` znacznika. Powód:
   100% danych to ISO-UTC; reszta analityki tnie daty tym samym `substr` (miesiące `1,7`);
   prefiks działa też dla formatu domyślki schematu `YYYY-MM-DD HH:MM:SS` (UTC w SQLite).
   Konsekwencja: „dzień" kończy się o 01:00/02:00 czasu polskiego. Obejmuje migawki z OBU
   pisarzy (bootstrap i auto-zatwierdzanie importu) — produkt z dzisiejszą zmianą ceny z importu
   nie dostaje drugiej migawki. `NOT IN` + `IS NOT NULL`, bo `NOT IN` z `NULL` w liście daje pusty
   wynik. Bez indeksu unikalnego, bez migracji.
4. **#35** — `widokEksportu(nazwa)` w `repos/analityka-eksport.ts` (`Object.hasOwn` na
   `WIDOKI_EKSPORTU` — jedno źródło prawdy, bez drugiej listy); trasa: brak → `404 {error}`;
   `filename` składany z nazwy już zwalidowanej jako klucz mapy. `openapi.yaml`: `404` dla
   `/api/analytics/export/{view}` (blok opisany jako odstępstwo P10.1).

### Świadome odstępstwa od oryginału
#32, #33, #31, #35 — wszystkie cztery (decyzje Ani/użytkownika 2026-09-21).

## Implementation plan
1. `repos/analityka.ts` — `dostepnoscProduktow` (gałąź historii) i `tempoSchodzenia`: JOIN + CTE
   `zwiniete` (wyeksportowany fragment `HISTORIA_BEZ_DUPLIKATOW_KLUCZA`); przepisanie komentarzy
   (nagłówek `bezpiecznieWiersze` — helper bez zmian, zmienia się opis „dwie trasy trwale puste").
2. `repos/analityka-eksport.ts` — oba widoki; `widokEksportu()`; komentarze.
3. `routes/analytics.ts` — 404 dla nieznanego widoku; komentarz.
4. `zbudujSnapshotBiezacy` — warunek dnia.
5. `contract/openapi.yaml` — `404` dla `export/{view}`.
6. Testy BE (niżej), komentarze w FE (`SekcjaDostepnosciProduktow.tsx`, `SekcjaTempaSchodzenia.tsx`)
   + test widoku FE.

## Testing strategy
- **Zmieniane jawnie** (komentarz „świadome odstępstwo, #32, 2026-09-21" / #31 / #35):
  `analityka.dostepnosc.agregaty.test.ts` (2 charakteryzacje pustki), `analityka.dostepnosc.gate.test.ts`
  (`toEqual({rows: []})`), `analityka.eksport.agregaty.test.ts` (blok „trwale puste"),
  `analityka.eksport.gate.test.ts` (BOM dla #32, „nieznany → 200"), `analityka.agregaty.test.ts`
  (bootstrap „rośnie"), FE `analityka.dostepnosc.test.tsx` (charakteryzacja pustki).
- **Nowe:** obie karty i oba eksporty zwracają wiersze; nazwa po parze dostawca+kod (kod K
  w historii u A i B, katalog ma K tylko u A → A z nazwą, B z `null`; plus dwa kody u dwóch
  dostawców → dwie nazwy); produkt usunięty → `null` / pusta komórka CSV; duplikat klucza → stan
  z `MAX(id)` i wynik identyczny w dwóch wywołaniach; duplikat powstały z PRAWDZIWEGO importu
  (dwie linie tego samego kodu) → karta 4.2 zgodna z ostatnią linią; bootstrap 2× tego samego
  dnia → drugie `inserted = 0`, a migawka z innego dnia nie blokuje; nieznany view → 404 (+ widok
  z prototypu `toString`), każdy znany → 200 + właściwa nazwa pliku; przez HTTP: trasy nie wpadają
  w gałąź połykania błędu (wiersze na zasianych danych).
- Pomiar na `db/snapshot.db` (liczby wierszy, czasy) — w raporcie.
- Bramki: lint/typecheck/build/test w `rebuild/backend` i `rebuild/frontend`.

## Out of scope
Kafle KPI (PR.2), kafel „Ostatni eksport CSV" (P10.2), filtry eksportu (P10.3), Pulpit/alerty,
waga gabarytowa, import (tylko czytany), `docs/instrukcja-testow-I10.md` (P10.4 — raport wskazuje
nieaktualne paragrafy), roadmapa (koordynator), `bezpiecznieWiersze` globalnie.

## Definition of done
- [x] Obie karty i oba eksporty zwracają wiersze na danych `historia_cen` (test + pomiar na snapshocie)
- [x] Nazwa z katalogu po dostawca+kod, usunięty → pusto / „—”
- [x] Duplikat klucza → `MAX(id)`, stabilnie
- [x] Bootstrap idempotentny w obrębie dnia UTC, `inserted` bez zmiany kształtu
- [x] Nieznany widok → 404, opisane w `openapi.yaml`
- [x] Fixtures nietknięte, gate zielony; bramki BE i FE zielone
