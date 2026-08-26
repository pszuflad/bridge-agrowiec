# 8-CHORE-kopia-bazy-przed-migracja — raport z implementacji

## Podsumowanie

Deploy na staging robi teraz kopię bazy **przed** zastosowaniem migracji — ale tylko wtedy,
gdy jakieś migracje są do zastosowania. Kopia idzie przez `VACUUM INTO` (spójny snapshot mimo
WAL), rotuje się do 5 ostatnich, a jej błąd przerywa deploy. Procedura przywracania jest
w `docs/deploy-setup.md`.

Powód: PR #12 wprowadza pierwszą migrację, która PRZEBUDOWUJE tabelę (`003_szerokosc_text.sql`).
Nieudana migracja wycofa się sama (transakcja), ale udanej nikt nie cofnie.

## Zmiany

- **Nowe:** `rebuild/backend/scripts/kopia-bazy.cjs` — wykrycie oczekujących migracji
  (porównanie plików `.sql` z tabelą `_migracje`), `VACUUM INTO`, rotacja.
- **Nowe:** `rebuild/backend/test/kopia-bazy.test.ts` — 6 testów.
- `tools/deploy-staging.sh` — wywołanie kopii przed `npm run migrate` + opis w nagłówku.
- `rebuild/backend/eslint.config.js` — override dla `**/*.cjs`.
- `docs/deploy-setup.md` — „Rollback → Baza" z procedurą przywracania; sprostowanie o wersjach
  SQLite (CLI hosta 3.26 vs 3.47 w `better-sqlite3`).

## Odstępstwa od planu

Brak.

## Wyniki testów

- **Gate odbudowy:** N/D — ticket nie dotyka API ani schematu bazy. Regresja zielona.
- **Unit/integracja:** ✓ 6 nowych testów (razem 292, było 286 na `develop`):
  kopia powstaje gdy są migracje · **z kopii da się odtworzyć dane** · brak kopii gdy nie ma
  czego migrować · brak bazy = spokojne wyjście · brak `DB_PATH` = przerwanie · rotacja.
- **Weryfikacja potoku deployu (ręczna, dokładnie w formie ze skryptu):** błąd kopii daje
  `exit=1` mimo `| tee` (`pipefail` działa); ścieżka szczęśliwa tworzy plik i loguje rotację.
- `bash -n tools/deploy-staging.sh` — składnia OK.
- `npm run lint` / `typecheck` / `test` — czyste.

## Breaking changes

Brak. Skrypt jest addytywny; przy braku migracji do zastosowania nie robi nic.

## Follow-up

- **Kolejność merge'y ma znaczenie:** ten PR powinien wejść PRZED PR #12, inaczej migracja 003
  pojedzie po staging bez kopii.
- Produkcja Ani nie jest objęta — ten skrypt dotyczy wyłącznie bazy staging (`data-nowy.db`).
  Jeśli kiedyś odbudowa zacznie migrować produkcję, trzeba to świadomie rozszerzyć.
