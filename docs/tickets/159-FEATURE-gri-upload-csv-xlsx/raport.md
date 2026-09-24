# 159-FEATURE-gri-upload-csv-xlsx — Raport implementacji

## Podsumowanie

Zgłoszenie (pierwotnie 158) prosiło o sprawdzenie, czy GRI (MO10) może wgrywać CSV i XLSX
w Konfiguracja → Dostawcy. Weryfikacja wykazała, że **funkcjonalność już działa 1:1** — input
frontendu ma wspólny `accept=".csv,.xml,.xlsx"`, multer nie filtruje po rozszerzeniu, a parser
`mo10_gri.cjs` wykrywa realny format po sygnaturze bajtów, niezależnie od rozszerzenia. Jedyną
luką był brak próbki `MO10.csv` i testu dowodzącego działania tej ścieżki. Ten ticket dodaje
wyłącznie ten test — bez zmian w kodzie produkcyjnym.

## Changes

- **New:** `rebuild/backend/test/charakteryzacja/probki/MO10.csv` — próbka CSV wygenerowana
  z istniejącej `MO10.xlsx` (te same 223 wiersze/nagłówki), Windows-1250, separator `;`.
- `rebuild/backend/test/dostawcy.upload.test.ts` — nowy test `"wgrywa cennik CSV dostawcy MO10
  (GRI, ten sam adres co XLSX)"` obok istniejącego `it.each(["MO8","MO10"])` testu XLSX.

## Deviations from plan

None.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** N/D — ticket nie zmienia kształtu ani zachowania API,
  tylko dodaje dowód testowy dla istniejącej ścieżki `POST /api/dostawcy/:kod/upload`.
- Unit/integration: ✓ — `npx vitest run test/dostawcy.upload.test.ts` (16/16 zielone), pełne
  `npm test` w `rebuild/backend/`: **1845 passed | 12 skipped** (żadnych regresji). Szum na
  stderr (`DB_PATH: Required`, `kopia-bazy: brak DB_PATH`) to oczekiwane zachowanie dwóch
  istniejących testów, nie usterka (`CLAUDE.md`, sekcja „Środowisko").
- `npm run lint` / `npm run typecheck` / `npm run build`: ✓ zielone.
- E2E: nie dotyczy (brak zmian frontendu/UI).

## Breaking changes

None.

## Follow-up

- Nagranie prawdziwego wzorca charakteryzacji 3a (`MO10.expected.json` z realnego pliku CSV od
  GRI, przez oryginalny backend) nie zostało zrobione — nie mamy dostępu do realnego pliku CSV
  od dostawcy, próbka jest zrekonstruowana z XLSX. Gdyby kiedyś pojawił się prawdziwy plik CSV
  od GRI, warto podmienić próbkę i porównać z produkcją bajt w bajt.
