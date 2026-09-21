# 90-FEATURE-ozywienie-kart-dostepnosci — Implementation report

## Summary
Karty „4.1 Historia dostępności pozycji" i „4.2 Tempo schodzenia z magazynu" oraz ich dwa
eksporty CSV zwracają wiersze z `historia_cen` (nazwa z katalogu po `dostawca` + `kod`, #32),
tempo schodzenia liczy się na historii ze zwiniętymi duplikatami klucza (`MAX(id)`, #33),
`bootstrap-current` nie dubluje migawki w obrębie dnia UTC (#31), a nieznany widok eksportu
dostaje 404 (#35). Wszystkie cztery punkty to świadome odstępstwa od produkcji (decyzje
2026-09-21). Warunek startu (PR #94 w `develop`) był spełniony; w trakcie scalony też PR #104
(karta P10.1 — sekcja „Pliki"), bez wpływu na kod.

## Changes
- `rebuild/backend/src/repos/analityka.ts` — nowy wspólny fragment SQL
  `HISTORIA_BEZ_DUPLIKATOW_KLUCZA` (#33); `dostepnoscProduktow` (gałąź historii) i
  `tempoSchodzenia`: `LEFT JOIN products` po parze, kolumny kwalifikowane, `LAG` na zwiniętej
  historii; `zbudujSnapshotBiezacy`: `AND id NOT IN (… produkt_id IS NOT NULL AND
  substr(zarejestrowano_at,1,10) = <dzień UTC>)`; komentarze (`bezpiecznieWiersze` — helper
  bez zmian, zmieniony opis).
- `rebuild/backend/src/repos/analityka-eksport.ts` — `eksportDostepnosciProduktow`,
  `eksportTempaSchodzenia` (JOIN + zwinięcie); typy `nazwa: string | null`; nowa
  `widokEksportu(nazwa)` na `Object.hasOwn(WIDOKI_EKSPORTU, …)` — jedyne źródło listy widoków.
- `rebuild/backend/src/routes/analytics.ts` — `export/:view`: nieznany widok → `404
  {error: "Nieznany widok eksportu"}`; `filename` tylko ze zwalidowanej nazwy.
- `contract/openapi.yaml` — `404` dla `/api/analytics/export/{view}` z komentarzem „ODSTĘPSTWO
  OD PRODUKCJI — P10.1" (bez `content` — generator zdejmuje jednowierszowe `content` tras bez
  fixture'a; `generate-openapi-schemas.cjs --sprawdz` czysty).
- Testy BE: `analityka.agregaty.test.ts` (bootstrap), `analityka.dostepnosc.agregaty.test.ts`,
  `analityka.dostepnosc.gate.test.ts`, `analityka.eksport.agregaty.test.ts`,
  `analityka.eksport.gate.test.ts`.
- FE: `SekcjaDostepnosciProduktow.tsx`, `SekcjaTempaSchodzenia.tsx` (tylko komentarze
  nagłówkowe), `pages/analityka/README.md`, `test/analityka.dostepnosc.test.tsx`.
- **Fixtures (`contract/fixtures/`) — nietknięte.**

## Pomiary (db/snapshot.db, kopia produkcji z 2026-08-13)
Przez zbudowane funkcje repo (`dist/`), na kopii bazy, średnia z 5 wywołań:

| Trasa / widok | Wierszy | w tym `nazwa: null` | Czas |
|---|---|---|---|
| karta 4.1 `availability/products` | 500 (limit; bez limitu 5 184) | 254 | 22,7 ms |
| karta 4.2 `availability/sell-through` | 500 (limit; bez limitu 5 184) | 119 | 54,7 ms |
| `export/availability-products` | 5 000 (limit; bez limitu 5 193) | 1 846 | 36,1 ms |
| `export/sell-through` | 5 000 (limit; bez limitu 5 184) | 1 852 | 56,6 ms |
| `bootstrap-current` #1 / #2 tego samego dnia | inserted 6 898 / **0** | — | 78,7 / 6,2 ms |

- `historia_cen` w snapshocie: 14 513 wierszy (fixture statusu, z późniejszej chwili: 15 597).
- **Duplikaty klucza `(dostawca, kod, zarejestrowano_at)`: 30 grup, 67 wierszy.** Na snapshocie
  zwinięcie nie zmienia żadnej z 5 184 sum `sell-through` (duplikaty mają tam równe stany),
  ale bez niego wynik zależy od implementacji SQLite.
- 1 897 par `(dostawca, kod)` z historii nie ma już w katalogu → pusta nazwa.
- `export/availability-products` ma 9 wierszy więcej niż par, bo zachowuje grupowanie oryginału
  po `ean` (para z dwoma EAN-ami w historii → dwa wiersze).

## Pomiar #33 — który wiersz zostaje w `products` (przed kodem)
Silnik importu (`import/tk.ts`) wczytuje katalog RAZ (`katalogDoImportu`) i nie mutuje obiektu
`dopasowany`; każda linia cennika liczy `autoPatch` względem stanu sprzed importu i robi
osobny `UPDATE`. Test na prawdziwym silniku (dwie linie `P1` w jednym cenniku):
- obie linie różne od katalogu → `products` = **linia ostatnia**; historia = 2 wiersze o tym samym
  kluczu, `MAX(id)` = linia ostatnia ✔ (utrwalone testem „duplikat z importu" w
  `analityka.dostepnosc.agregaty.test.ts`);
- druga linia całkiem równa katalogowi → brak `autoPatch`, jeden wiersz historii, brak duplikatu;
- **przypadek mieszany:** ostatnia linia ma `stan` równy stanowi sprzed importu, ale inną cenę →
  `stan` nie wchodzi do jej patcha, katalog zachowuje `stan` linii wcześniejszej, a wiersz
  historii linii ostatniej niesie stan sprzed importu (= jej własny). `MAX(id)` daje wtedy stan
  ostatniej linii pliku, katalog — wcześniejszej.

Wniosek: import zostawia w katalogu linię **ostatnią** (niuans dotyczy pojedynczych pól
w przypadku mieszanym), więc warunek stopu z promptu („jeśli pierwszy — wróć") nie zaszedł.
Niuans → Follow-up (import, poza zakresem).

## #31 — definicja „tego samego dnia"
Dzień kalendarzowy **UTC** = prefiks `YYYY-MM-DD` znacznika. Na snapshocie 100%
`zarejestrowano_at` to `toISOString()` (24 znaki, `T`, `Z`); reszta analityki tnie daty tym
samym `substr` (miesiące); prefiks rozpoznaje też format domyślki schematu `YYYY-MM-DD HH:MM:SS`.
Skutek: dzień kończy się o 01:00 (zima) / 02:00 (lato) czasu polskiego. Liczą się migawki obu
pisarzy (bootstrap i auto-zatwierdzanie importu). Filtr `produkt_id IS NOT NULL` chroni przed
pułapką `NOT IN` z `NULL`. Bez indeksu unikalnego, bez migracji; kształt `{ok, inserted, at}`
bez zmian; trasa nadal bez przycisku w UI (D4).

## Deviations from plan
- Test „ten sam kod u dwóch dostawców → dwie różne nazwy" z promptu jest **niewykonalny wprost**:
  `products.kod` jest globalnie `UNIQUE` (`001_schema.sql:24`), więc katalog nie pomieści kodu
  u dwóch dostawców naraz. Zastąpiony dwoma przypadkami tej samej intencji: kod K w historii
  u MO1 i MO2, w katalogu tylko u MO1 → MO1 dostaje nazwę, MO2 `null` (dowodzi, że złączenie
  nie idzie po samym kodzie); plus dwa różne kody u dwóch dostawców → dwie nazwy.
  Na snapshocie: 0 par, w których kod z historii jest w katalogu u innego dostawcy.
- Poza tym 1:1 z planem.

## Test results
- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne. `GET_analytics_availability_products.json`
  i `GET_analytics_availability_sell-through.json` — koperta `{hasHistory, rows}` zgodna,
  `sprawdzZgodnoscZFixture` i `sprawdzZgodnoscZKontraktem` zielone. Rozjazd w treści (wiersze
  zamiast `rows: []`) jest zatwierdzonym odstępstwem #32; fixtures zostają nietknięte zgodnie
  z `contract/README.md`. `WyjatekGate` **nie** został dodany: `gate/ksztalt.ts` nie zagląda do
  elementów, gdy fixture ma pustą tablicę, więc różnicy nie ma, a wyjątek bez pokrycia sam
  zapaliłby test. `export/{view}`: 200 dla każdego z 10 widoków (z właściwą nazwą pliku), 404 dla
  nieznanego — oba kody zadeklarowane w `openapi.yaml`.
- **Wyrocznia:** testu porównującego analitykę z uruchomionym oryginałem nie ma (pliki
  `*.wyrocznia*` dotyczą historii, cen i wygaszacza) — nic do wyłączania, żaden rozjazd poza
  czterema punktami.
- **„Nie wpadają w gałąź połykania błędu":** GATE przez HTTP na zasianych danych —
  `rows.length > 0` i nazwa z katalogu dla `MO9_336320` (obie karty); eksporty — nagłówek
  i wiersz z `MO9_336320` zamiast samego BOM-u.
- Backend: lint ✓, typecheck ✓, build ✓, `npm test` ✓ **90 plików / 1481 testów**.
- Frontend: lint ✓, typecheck ✓, build ✓, `npm test` ✓ **51 plików / 892 testy**.
- Testy zmienione jawnie (komentarz „świadome odstępstwo, #3x, 2026-09-21"): charakteryzacja
  bootstrapu, 2× charakteryzacja pustki kart, 2× `toEqual({rows: []})` w gate, blok „trwale puste"
  eksportu, „nieznany → 200", „BOM mimo historii", FE „obie karty puste".
- Nowe: bootstrap (drugi raz 0; 23:59/00:01 UTC; per produkt; wczoraj nie blokuje; `NULL`
  w `produkt_id`; format `YYYY-MM-DD HH:MM:SS`), karty (wiersze, para dostawca+kod, usunięty →
  `null`, duplikat → `MAX(id)` niezależnie od wartości, stabilność, duplikat z prawdziwego
  importu), eksport (kolumny, para, duplikat, `widokEksportu` odrzuca `toString`/`constructor`/
  `__proto__`), HTTP 404 z walidacją kontraktu, FE kreska dla `nazwa: null` w obu kartach.

## Review fixes applied
- SHOULD-FIX: goły `h.ean` w karcie 4.1 — komentarz w kodzie + Follow-up (bez zmiany SQL, port 1:1).
- SHOULD-FIX: Definition of done w `plan.md` odhaczona.
- NICE-TO-HAVE: komentarz o `MAX(p.nazwa)` przy `dostepnoscProduktow` (symetria z eksportem).

## Breaking changes
- `GET /api/analytics/export/<nieznany>`: 200 + BOM → **404 JSON**. Front nie woła widoków spoza
  listy (zamknięta unia `WidokEksportu` w `pages/analityka/eksport.tsx`) — grep potwierdza.
- `POST /api/analytics/bootstrap-current`: drugie wywołanie tego samego dnia UTC → `inserted: 0`.

## Nieaktualne paragrafy `docs/instrukcja-testow-I10.md` (dla P10.4 — nie ruszane tutaj)
- `:20` — boks „Dwie karty są puste ZAWSZE, niezależnie od danych";
- `:275-276` — tabela: 4.1 i 4.2 „PUSTA ZAWSZE", eksport „✔ (pusty plik)";
- `:302-311` — sekcja **6.1** „Karty 4.1 i 4.2 są puste ZAWSZE";
- `:327-331` — sekcja **6.3** „Dwa eksporty CSV dają PUSTY plik";
- `:434-439` — **7.5** „Eksport z kart 4.1 i 4.2 … plik jest pusty. To poprawne";
- `:483` i `:491` — checklista: „4.1 i 4.2 puste — poprawne", „pliki z 4.1 i 4.2 są puste".
Nowe do sprawdzenia przez Anię: karty mają wiersze, pozycje usunięte z katalogu mają „—" w kolumnie
„Nazwa", pliki CSV mają wiersze.

## Follow-up
- **Import — niuans „przypadku mieszanego"** (patrz pomiar #33): przy dwóch liniach tego samego
  kodu w jednym cenniku katalog może łączyć pola z różnych linii, a historia zapisuje stan
  ostatniej linii. Poza zakresem (import tylko czytany); do rozważenia przez kartę importu.
- Karta 4.1 i `export/availability-products` liczą `COUNT(*)`/procent po surowej historii, więc
  duplikat klucza liczy się podwójnie. Decyzja #33 obejmowała tylko `sell-through` — do ewentualnej
  osobnej decyzji.
- Karta 4.1 wybiera `h.ean` GOŁE obok `GROUP BY h.dostawca, h.kod` (port 1:1 oryginału) — przy
  parze z dwoma różnymi EAN-ami w historii EAN pochodzi z arbitralnego wiersza grupy (ta sama
  klasa co #33; snapshot: 9 par, stąd 5 193 vs 5 184 wiersze eksportu). Naprawa #32 to odsłoniła;
  poza decyzjami P10.1 — kandydat na wpis backlogu (wskazane przez review).
- `sell-through` sortuje tylko po `zeszloSztuk DESC` z `LIMIT 500` (jak oryginał); przy wielu
  zerowych wynikach wybór wierszy na granicy limitu nie jest określony. Port 1:1, bez zmiany.
