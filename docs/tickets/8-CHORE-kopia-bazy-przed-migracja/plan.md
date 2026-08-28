# 8-CHORE-kopia-bazy-przed-migracja — kopia bazy staging przed migracjami

> Status: Approved → Implemented
> Branch: `chore/8-kopia-bazy-przed-migracja`

## Opis ticketa

> może dodanie do tego skryptu (…) deploy staging (…) on nie robi kopii bazy — może przed
> tym `run migrate` powinien zrobić kopię bazy, tak na wszelki wypadek

## Kontekst

`tools/deploy-staging.sh:82` woła `npm run migrate` przy każdym pushu do `develop`, bez
żadnej kopii bazy. Do tej pory migracje wyłącznie DOKŁADAŁY kolumny (`002_import.sql`), więc
ryzyko było teoretyczne. **Zmienia to PR #12 (I3/3d-1):** `003_szerokosc_text.sql`
PRZEBUDOWUJE tabelę `products` (SQLite nie ma `ALTER TABLE … ALTER COLUMN`, więc zmiana typu
kolumny to `CREATE` → `INSERT SELECT` → `DROP` → `RENAME`).

Runner migracji opakowuje każdy plik w transakcję, więc **nieudana** migracja wycofa się
w całości — ale **udanej** nikt nie cofnie.

## Kontrakt i fixtures (zakres)

**Brak (nie dotyka kontraktu).** Ticket nie rusza ani jednej ścieżki API ani schematu bazy —
dokłada krok do skryptu deployu i skrypt pomocniczy. Gate odbudowy nie obowiązuje; obowiązuje
regresja (`npm test` musi zostać zielone).

## Decyzje

**D1 — kopia TYLKO gdy są migracje do zastosowania.** Deploy chodzi z crona przy każdej
zmianie w `rebuild/`, więc kopiowanie za każdym razem zasypałoby dysk. Ten projekt już raz się
na to nadział na produkcji (292 pliki backup, ~6 GB — `mirror/backend/CHANGELOG.md`). Skrypt
porównuje pliki `.sql` z tabelą `_migracje` i wychodzi bez kopii, gdy nie ma nic do zrobienia.

**D2 — `VACUUM INTO` przez `node` + `better-sqlite3`, nie przez `sqlite3` CLI i nie `cp`.**
Baza chodzi w WAL: `cp` samego pliku `.db` pomija `-wal` i przy równoległym zapisie daje kopię
niespójną. `sqlite3` CLI na VPS ma **3.26**, a `VACUUM INTO` wymaga ≥ 3.27 — ale `better-sqlite3`
11.7.0 niesie własne SQLite **3.47**, więc z poziomu node działa. Deploy i tak podkłada tam
działającą binarkę tuż przed `npm run migrate`.

**D3 — błąd kopii PRZERYWA deploy.** Lepiej nie wdrożyć niż zmigrować bez punktu powrotu.
Skrypt jest w potoku z `tee`, więc sprawdzone zostało, że `pipefail` propaguje kod wyjścia.

**D4 — rotacja: 5 ostatnich kopii**, tak jak `releases/` w tym samym skrypcie.

## Plan implementacji

1. `rebuild/backend/scripts/kopia-bazy.cjs` — wykrycie oczekujących migracji, `VACUUM INTO`,
   rotacja. Konfiguracja przez env (`DB_PATH`, `KOPIE_DIR`, `KOPIE_ILE`, `ETYKIETA`).
2. `tools/deploy-staging.sh` — wywołanie PRZED `npm run migrate`.
3. `eslint.config.js` — override dla `**/*.cjs` (CommonJS jest tu świadomy, nie przypadkowy).
4. `docs/deploy-setup.md` — sekcja „Rollback → Baza" z procedurą przywracania.
5. Testy.

## Strategia testów

Nieprzetestowana kopia zapasowa jest gorsza niż jej brak — daje poczucie ochrony, którego nie ma.
Bez mocków: prawdziwy plik SQLite w katalogu tymczasowym, prawdziwe `VACUUM INTO`, skrypt
uruchamiany jako osobny proces (dokładnie jak w deployu).
Najważniejszy test: **z kopii DA SIĘ odtworzyć dane** — wiersz zapisany przed kopią jest
czytelny w skopiowanym pliku otwartym jako samodzielna baza.
Dodatkowo: brak kopii gdy nie ma czego migrować, brak bazy = spokojne wyjście, brak `DB_PATH`
= przerwanie, rotacja. Osobno zweryfikowana propagacja błędu przez potok `| tee` z `pipefail`.

## Poza zakresem

- Kopia bazy PRODUKCYJNEJ Ani — ten skrypt dotyczy wyłącznie staging (`data-nowy.db`).
- Automatyczne przywracanie — rollback bazy zostaje ręczny i udokumentowany.

## Definition of done
- [ ] Kopia powstaje przed migracjami i tylko gdy są migracje do zastosowania
- [ ] Z kopii da się odtworzyć dane (test)
- [ ] Błąd kopii przerywa deploy
- [ ] Rotacja działa
- [ ] Procedura przywracania w `docs/deploy-setup.md`
- [ ] `lint` / `typecheck` / `test` czyste
