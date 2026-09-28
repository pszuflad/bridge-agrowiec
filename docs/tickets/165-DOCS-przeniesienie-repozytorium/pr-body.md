## Ticket
`165-DOCS-przeniesienie-repozytorium` — plan przeniesienia repo na konto Ani

## Summary
Nowy `docs/przeniesienie-repozytorium.md` — plan na **później**, żeby w dniu transferu nie odtwarzać go z pamięci. **Zero zmian w kodzie**, sam dokument. Nic w nim nie jest do wykonania teraz.

## Dlaczego teraz spisany, a nie wykonany
Transfer zabiera na jakiś czas działający CD (sekrety Actions **nie przechodzą**), a właśnie na nim stoi wdrażanie produkcji. Dokument ustala kolejność: cutover → stabilizacja → Pro → transfer → prywatność.

## Co zawiera
- **narzędzie** (Settings → Danger Zone → Transfer ownership) i warunki wstępne;
- **co przechodzi samo** (historia, gałęzie, tagi, issues, PR-y, przekierowania starych adresów);
- **lista kontrolna 3.1–3.6 rzeczy do odtworzenia ręcznie** — zinwentaryzowane 28.09: 10 sekretów Actions, środowisko `produkcja`, ruleset `develop` (id `21299243`), instalacja Claude GitHub App (per-konto — bez niej sesje Ani wracają do 403), klucz deploy `bridge-vps-syncer`, nadanie `admin` Pawłowi;
- ⚠ **zalecenie, żeby nie przekazywać kluczy prywatnych** — przy okazji transferu wygenerować nowe pary i podmienić `authorized_keys`;
- **konsekwencje planu**: prywatność i bramki zależą odtąd od planu **Ani**; przy Free + prywatne wracają trzy straty (ruleset — zmierzone na tym repo jako HTTP 403 dnia 23.09, required reviewers, limit minut);
- **poprawki po transferze**: `REPO_URL` w `tools/przygotuj-produkcje.sh`, link w `tools/vps-sync.sh:120`, 6 plików w `docs/`, `remote set-url` w klonach na VPS;
- **lista weryfikacyjna** i kolejność całości.

## Czego dokument świadomie nie rozstrzyga
Czy czyścić historię. Odnotowuje natomiast fakt: publiczne repo zawiera dziś **ceny zakupu** — `mirror/frontend/ex-port-files/sellycsv-*.csv` (5340 wierszy, kolumna `Cena-zakupu`, 82 commity), 10 fixtures z `cena_zakupu`, arkusze w `knowledge/`. Sekretów nie ma — `.env` nigdy nie był commitowany.

## Tests
Nie dotyczy — wyłącznie `docs/`.

---
Ticket docs: `docs/tickets/165-DOCS-przeniesienie-repozytorium/`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
