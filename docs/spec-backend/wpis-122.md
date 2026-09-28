# Wpis do spec-backend od ticketu 122 (karta I15.3) · 2026-09-23

**Sekcja:** §2 (panel Selly — eksport CSV, kontynuacja ustalenia z 8a) i §5 (model `products` —
kontynuacja ustalenia z 107/`uwagaCena`, w zakresie tego, co `GET /api/products` faktycznie oddaje).

**Potwierdzone w 122** (`122-FEATURE-i15-3-blokady-platnosci-csv`, 2026-09-23, karta I15.3), port
z `origin/main` @ `88fa31c` (produkcja zamrożona 23.09):

## 1. `GET /api/products` NIE oddaje `blokowaneFormyPlatnosci` — zgodnie z produkcją

Karta zakładała, że I15.1 ukryła to pole jako stan przejściowy i że I15.3 ma je ujawnić (73 klucze).
Pomiar to obalił.

**Pomiar** (metoda ticketu 38, którym rozstrzygnięto `uwagaCena`): piaskownica `git archive 88fa31c
mirror/backend` na kopii `db/snapshot.db`, baza doprowadzona do stanu produkcji własnym modułem
oryginału — `payment_blocks.ensurePaymentBlocks(<ścieżka>)` → `{ ok: true, rows: 7405 }`, kolumna
`blokowane_formy_platnosci` obecna, oba triggery założone. `GET /api/products?limit=5` na żywym
`index.cjs` → **72 klucze, bez `blokowaneFormyPlatnosci`**.

**Mechanizm:** `grep -c blokowane_formy_platnosci mirror/backend/index.cjs` = **0**. Bundle nie zna
kolumny dokładanej runtime'owym `ALTER TABLE` przez `payment_blocks.cjs`; trasa produktów czyta
Drizzle bez jawnej listy pól → oddaje pola MODELU, nie schematu tabeli. **To trzeci udokumentowany
przypadek tego mechanizmu** (pierwszy: `products.uwaga_cena`/`uwagaCena_patch.cjs`, ticket 38) —
reguła z `CLAUDE.md`: obecność kolumny w bazie produkcji nie znaczy, że API ją oddaje, sprawdzaj
model, nie schemat tabeli.

**Skutek:** `blokowaneFormyPlatnosci` zostaje w `KOLUMNY_POZA_KONTRAKTEM.products`
(`src/repos/kolumny.ts`) razem z `uwagaCena`; strażnicy 72 kluczy (`test/katalog.gate.test.ts`,
`test/produkty.mutacje.test.ts`) bez zmian. Kolumnę „Blokowane formy płatności" w `/katalog` liczy
front z kodu dostawcy (`pages/katalog/formatowanie.tsx`, port `payment-blocks-injection.js`) —
dokładnie jak w produkcji, gdzie API nie miało jej skąd wziąć. `contract/fixtures/` i
`contract/openapi.yaml` bez zmian.

## 2. Dwie pułapki metodologiczne przy pomiarze na oryginale

- **`mirror/` na `develop` bywa nieaktualny względem `main`** — w chwili pomiaru nie miał
  `payment_blocks.cjs`, a `extensions.cjs` był w wersji sprzed 10.09. `tools/record-write-fixtures.cjs`
  nagrywa wtedy ze **złej wersji oryginału, bez ostrzeżenia**. Przed nagraniem trzeba sprawdzić, czy
  `mirror/` odpowiada commitowi uznanemu za źródło prawdy; jeśli nie — zbudować piaskownicę przez
  `git archive <commit> mirror/backend`.
- **`payment_blocks.cjs` ma zaszytą ścieżkę produkcyjną** (`/home/admin/private_apps/bridge/data.db`),
  więc przy zwykłym lokalnym starcie `ensurePaymentBlocks()` **po cichu pada** (log: „BŁĄD inicjalizacji
  blokowanych form płatności: Cannot open database because the directory does not exist") i
  piaskownica nie ma kolumny. Pomiar „pole nie wychodzi" bez ręcznego wywołania modułu z jawną
  ścieżką byłby bezwartościowy — ten sam gatunek pułapki co `atrybuty`/`pending` z `CLAUDE.md`.

## 3. Generator CSV Selly — stan po tickecie

`src/selly/generator-csv.ts`: **60 kolumn** (było 59), 60. = `Blokowane-formy-platnosci` (wartość z
kolumny bazy, fallback z zamrożonej mapy MO→formy przy wartości pustej, port `getBlockedPaymentForms`);
`Kategoria` przez `nazwaKategoriiSklepu` (port `toSellyCategoryName`, z jawnym `ł`→`l` po NFD — NFD
samo nie rozkłada `ł`); tylko produkty `status='aktywny'`; zapis atomowy (`.tmp-<pid>` + `rename` w
tym samym katalogu, sprzątanie tmp przy błędzie); stdout `Liczba produktow aktywnych:` (bez nawiasów —
tekst produkcji ewoluował `(aktywnych)` → `(aktywnych i wstrzymanych)` → `aktywnych`, `88fa31c` ma
ostatnią formę). Linia nagłówkowa naszego generatora jest bajt w bajt równa pierwszej linii realnego
pliku produkcji z `88fa31c`.

**Nowe wejście CLI** `src/selly/csv-cli.ts` (`npm run selly:csv` / `selly:csv:dev`), wzorcem
`migrate`/`migrate:dev` — woła tę samą `wygenerujCsvSelly()` co trasa `POST /api/selly/generate-csv`,
więc plik z crona i plik z panelu są identyczne. Polecenie dla operacyjnego przepięcia crona:
`docs/cutover.md`.

Szczegóły: `docs/tickets/122-FEATURE-i15-3-blokady-platnosci-csv/`.
