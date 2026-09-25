## Ticket
`163-FEATURE-cd-produkcja` — drugie środowisko: CD produkcji z gałęzi `main`

## Summary
Nowe środowisko **produkcyjne obok testowego**, budowane z `main` i wdrażane po każdym merge'u do `main`. Test (`develop` → `test.agritires.eu`) zostaje nietknięty poza jedną zmianą nazwy bazy. **Zero zmian w `rebuild/` i `contract/`** — to wyłącznie warstwa wdrożeniowa.

| | Test | Produkcja |
|---|---|---|
| gałąź | `develop` | `main` |
| domena | `test.agritires.eu` | `panel.agritires.eu` |
| katalog | `public_html/test` | `public_html/panel` |
| port / PM2 | 5001 / `bridge-backend-staging` | 5000 / `bridge-backend-prod` |
| baza | `data-test.db` | `data-prod.db` |

## Changes
- **`tools/deploy-produkcja.sh`** (nowy) — wierne odbicie `deploy-staging.sh`; różnice tylko w konfiguracji na górze pliku plus **trzy bramki produkcyjne**: baza musi istnieć (pusta oznaczałaby pusty CSV dla Selly i wyzerowane stany w sklepie), docroot musi istnieć (inaczej `publikuj-frontend.sh` utworzyłby go pustym razem z zniknięciem `ex-port-files`), PM2 `bridge-backend` starego stosu nie może istnieć (D9 — dwa schedulery na jednej bazie).
- **`tools/przygotuj-produkcje.sh`** (nowy) — jednorazowe przygotowanie serwera, idempotentne, **niczego nie kasuje**: kopie bezpieczeństwa, drzewo `bridge-prod/`, klon `main`, `data-prod.db` i `data-test.db` przez `.backup` (nie `cp` — WAL), szkielet `.env` z sekretami przepisanymi ze starego stosu, klucz SSH. Tryb `--sucho`.
- **`.github/workflows/deploy-produkcja.yml`** (nowy) — `push` do `main`, `environment: produkcja` (pozwala wymusić ręczne zatwierdzenie).
- **`deploy/produkcja/htaccess`** (nowy) — proxy na 5000, 301 z `agritires.eu/panel/` na subdomenę, **wyjątek na `ex-port-files/`**.
- **`tools/deploy-staging.sh`** — `DATA_DB` → `data-test.db` + nota o odbiciu produkcyjnym.
- **`docs/wdrozenie-produkcji.md`** (nowy) — podział na trzy grupy (repo / serwer / GitHub), instrukcja GitHuba, kolejność całości.

## Design decisions
- **Osobny skrypt, nie parametryzacja jednego.** Parametryzowany skrypt oznaczałby, że pomyłka w jednej zmiennej wdraża testowy build na produkcję albo odwrotnie. Dwa pliki + nota „zmieniasz jeden, sprawdź drugi" są czytelniejsze niż `if [ "$SRODOWISKO" = … ]` w dziesięciu miejscach.
- **`ex-port-files/` z własną regułą przed przekierowaniem.** Katalog panelu jest widoczny pod dwoma adresami; nowy frontend ma absolutne ścieżki do assetów, więc pod `agritires.eu/panel/` by się nie załadował — stąd 301. Ale Selly pobiera plik **właśnie spod tego adresu**, a 301 zerwałoby pobranie. Reguła `^ex-port-files/ - [L]` stoi przed przekierowaniem.
- **`.env` produkcji startuje z `SELLY_TRYB=tylko-odczyt`.** `pelny` sam z siebie otwiera zapis do żywego sklepu niezależnie od `SELLY_SCHEDULER` (`server.ts:90` montuje moduł dostępności, a ten po imporcie woła Tor 1). Faza 2 to świadome przestawienie po smoke-testach.
- **`data-test.db` powstaje jako KOPIA, `data-nowy.db` zostaje.** Siatka bezpieczeństwa na wypadek, gdyby wdrożenie testu z nową nazwą poszło nie tak. ⚠ Kolejność: najpierw skrypt na serwerze, potem merge tego PR-a — odwrotnie pierwszy deploy testu utworzyłby pustą bazę i zmigrował ją.
- **Osobny klucz SSH.** Klucz stagingu ma wymuszone `command="…deploy-staging.sh"`, a wymuszone polecenie ignoruje to, o co prosi klient.

## Tests
`bash -n` na obu skryptach, walidacja YAML workflow. Bramek `rebuild/backend` nie uruchamiano — ticket nie dotyka `rebuild/`.

## Breaking changes
Po wdrożeniu **`main` przestaje być lustrem starej produkcji**, a staje się gałęzią wdrożeniową. Zapis w `docs/rebuild-roadmap.md` §1a trzeba będzie odświeżyć — zadanie koordynatora, poza tym ticketem.

---
Ticket docs: `docs/tickets/163-FEATURE-cd-produkcja/`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
