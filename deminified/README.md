# `deminified/` — zdeminifikowany oryginał

Generowane przez `tools/deminify.sh` z `mirror/` (backend `index.cjs` + bundle FE wskazany
przez `mirror/frontend/index.html`). **Pliki w tym katalogu są ODTWARZALNE — nie edytuj ich
ręcznie**; `frontend-active-bundle.txt` jest nadpisywany przy każdym przebiegu skryptu
(`tools/deminify.sh:42`), więc notatki wpisane do niego giną.

## ⚠ `frontend-index.js` jest STARSZY NIŻ PRODUKCJA

To bundle `index-PRICEFMT1783512500.js` w stanie z **2026-08-13** (baseline `e03e2aa`).
Numery linii w komentarzach `rebuild/frontend/` odwołują się do TEJ wersji, dlatego deminifikatu
nie regenerujemy „przy okazji" — przegenerowanie przesunęłoby wszystkie odwołania naraz.

Cena tego jest taka, że plik **nie zawiera czterech zmian wdrożonych później**. Kto portuje
„z deminifikatu", odtworzy stan sprzed nich:

| łatka | data | czego brakuje w deminifikacie |
|---|---|---|
| `konstr` | 2026-09-01 11:22 | pass-through `konstrukcja` (`:n\|\|""` / `:n\|\|null` obok mapowania kodów). ⚠ Łatka trafiła do MARTWEGO `index-BRIDGEONE21783342500.js`, więc żywa produkcja też jej nie ma — odbudowa ma ją od 13c świadomie (`docs/rebuild-backlog.md` #58) |
| `tr_fix` | 2026-09-04 14:18 | token `"tr-"` usunięty z listy słów „to nie opona" (`h2`) |
| `ackalerts` | 2026-09-04 14:40 | odcisk wartości w `id` pseudo-alertu, pulpit czytający zapisane statusy, zdarzenie `alerty-statusy-updated`, ukrycie statusu `rozwiazany` |
| `szer_marka` | 2026-09-04 15:00 | `Wfmt` bez gałęzi „cała notacja `AxB`" + filtr „marka bez cyfr" na gałęzi słownikowej — **sportowane w 13e**, więc rozjazd z deminifikatem jest tu ZAMIERZONY |

Aktualny stan bundla czytaj wprost z gałęzi `main`:

```
git show main:mirror/frontend/assets/index-PRICEFMT1783512500.js
```

Kopie `.bak_<etykieta>_<data>` sprzed każdej łatki istnieją **tylko na `main`** (weszły
`31aa0e5`/`d88ac15`). `index-BRIDGEONE21783342500.js` to poprzednie wydanie — martwe od łatki
`pricefmt` z 31.07; sprawdź `mirror/frontend/index.html`, zanim uznasz któryś plik za żywy.

Rozkład diffu wszystkich czterech: `docs/tickets/47-CHORE-i13e-frontend-bridgeone/plan.md`.

## `backend-index.cjs`

⚠ Ma funkcje zdefiniowane po dwa razy — wygrywa PÓŹNIEJSZA, a cieniowanie sięga dalej niż sama
funkcja. Szczegóły i lista przypadków: `CLAUDE.md`, punkt 5.
