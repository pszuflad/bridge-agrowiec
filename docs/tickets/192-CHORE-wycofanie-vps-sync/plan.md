# 192-CHORE: wycofanie vps-sync i aktualizacja ustawień po przeprowadzce na vpshd86

Data: 2026-10-06. Zlecenie: Ania — „sprawdź, czy ścieżki są prawidłowe po przeniesieniu na inny serwer", potem
„zrób tak jak było zapisane w projekcie" (`docs/po-cutoverze-proces.md` §1.3).

## Kontekst (stan zmierzony)

- Produkcja i staging przeniesione 2026-10-05 na vpshd86 (ticket 188). Produkcja = odbudowa wdrażana z `main`.
- Zweryfikowane przez Anię na serwerze: `_app/.env` bridgeone ma `SELLY_CSV_URL`, `SELLY_CSV_PLIK`, `SELLY_CSV_DIR`
  na nową domenę; training ma własne wartości. Na vpshd86 działają tylko `autostart.sh` (co 5 min) i
  `selly-csv.sh` (06:00).
- `tools/vps-sync.sh` nie jest w żadnym cronie na żadnym serwerze; ostatni przebieg na vpshd1242 28.09.2026 13:00.
- Skrypt jest przywiązany do starych ścieżek i `sqlite3`, którego na vpshd86 nie ma.

## Decyzja

**Nie przenosimy crona sync na nowy serwer.** Skrypt robił snapshot STAREJ, ręcznie łatanej produkcji do `mirror/`.
Na vpshd86 uruchomiony skopiowałby kod odbudowy do `mirror/` (`rsync --delete`), skasował oryginał, który jest
wzorcem wierności, i wypchnął to na `main` (każdy push do `main` ze zmianami w `rebuild/` uruchamia
`deploy-produkcja.yml`). Zgodnie z `docs/po-cutoverze-proces.md` §1.3 po wygaszeniu starego systemu nie ma czego
triażować. Użytkownik wybrał wariant „tak jak w projekcie" (2026-10-06).

## Zmiany

| Plik | Zmiana |
|---|---|
| `tools/vps-sync.sh`, `tools/acquire.sh`, `tools/przygotuj-produkcje.sh` | blokada na początku (`exit 1` z komunikatem): skrypty wycofane, treść zostaje jako historia |
| `tools/audyt-vps.sh` | adnotacja, że to stary serwer (skrypt tylko do odczytu, bez blokady) |
| `tools/record-fixtures.sh` | domyślny `BASE` → `https://bridgeone.agroopony.eu`; ostrzeżenie, że nagranie z odbudowy to baseline, nie wzorzec oryginału (`po-cutoverze-proces.md` §3 (b)) |
| `tools/deploy-produkcja.sh` | tylko teksty komunikatów błędów: odwołują się do planu ticketu 188 zamiast do wycofanego `przygotuj-produkcje.sh` |
| `rebuild/backend/src/config/env.ts`, `rebuild/backend/.env.example` | domyślne `SELLY_CSV_DIR` i `SELLY_CSV_URL` → bridgeone (prod i staging i tak nadpisują je z `.env`/skryptu) |
| `docs/vps-syncer-setup.md` | baner „WYCOFANE" |
| `docs/cutover.md`, `cutover-runbook.md`, `deploy-setup.md`, `wdrozenie-produkcji.md` | baner „stan po przeprowadzce": ścieżki i domeny w treści to historia, aktualny układ w planie ticketu 188 |

## Poza zakresem (świadomie)

- **Stary cron `0 6 * * * npm run selly:csv` na vpshd1242** (`bridge-prod`, zamrożona baza): nie ruszamy, to serwer
  Ani. Rekomendacja: zakomentować po potwierdzeniu, że Selly pobiera plik już z bridgeone.
- **`/triaz-zmian`, `docs/triage-state.txt`, `mirror/`, `deminified/`, `CLAUDE.md`**: pozostają do karty PO.0
  (`docs/po-cutoverze-proces.md` §3). `/triaz-zmian` nie ma już wejścia (brak commitów `sync(vps)`), ale jego
  usunięcie wymaga wcześniejszego sprawdzenia otwartych wpisów backlogu (`tools/stan-backlogu.sh --do-decyzji`).
- Hardkodowane `/home/admin/private_apps/bridge/data.db` w `src/import/legacy/` to kopia oryginału (pilnuje jej
  test integralności) — bez zmian; rebuild czyta bazę z `DB_PATH`.
- Zdjęcia produktów: linki w danych (`linkZdjecia`) wskazują `agritires.eu/zdjecia-produktow/…`; katalog został
  przeniesiony na bridgeone (ticket 189). Czy dane i przekierowanie na agritires.eu pokrywają te linki — do
  sprawdzenia na serwerze, w repo nie ma kodu, który je buduje.

## Weryfikacja

`bash -n` na zmienionych skryptach; `bash tools/vps-sync.sh` kończy się kodem 1 z komunikatem; bramki backendu
(`npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/backend/`).
