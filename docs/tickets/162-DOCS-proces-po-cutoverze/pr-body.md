## Ticket

`162-DOCS-proces-po-cutoverze` — audyt `/feature` i trzech agentów na tryb po cutoverze.

## Summary

Użytkownik zapytał, czy po cutoverze trzeba będzie zmienić `/feature` i agentów (`researcher`,
`reviewer`, `doc-checker`), skoro cała komenda jest napisana pod **wierną odbudowę**. Audyt
wykazał, że tak — ale zmienia się **jedna rzecz: premisa 1:1**, nie proces. Wynik zapisany jako
karta **`PO.0`, pierwsza po przełączeniu domeny** (decyzja użytkownika 2026-09-24).

**Ten PR niczego nie przestraja** — dopóki chodzi stary Bridge, `feature.md` musi mówić o wiernym
odtwarzaniu. Zmiana wyłącznie w `docs/`.

## Problem / Motivation

Po wyłączeniu starego Bridge instrukcje procesu zaczynają kłamać: każą traktować `deminified/`
jako „ostateczne źródło prawdy", `contract/openapi.yaml` jako „zamrożony kontrakt", a rozbieżność
z fixture jako **STOP**. Sesja, która dostanie wtedy zgłoszenie od Ani, pójdzie szukać „jak to
robi oryginał" w kodzie systemu, którego już nie ma. Każda karta po cutoverze jest realizowana
**tą komendą** — stąd priorytet.

## Solution

| Plik | Co |
|---|---|
| `docs/po-cutoverze-proces.md` | nowy — audyt z miejscami (plik:linia), lista zadań PO.0, co NIE wymaga zmian, trzy decyzje, DoD |
| `docs/rebuild-backlog/wpis-162.md` | nowy — `#162.1`, `✅ TAK` (decyzja użytkownika), `⬜ czeka na cutover` |
| `docs/rebuild-roadmap.md` | §6b Blok 2: `PO.0` pierwszym wierszem + akapit ⭐ + kolejność; Blok 5: wskaźnik i adnotacja przy D9 |
| `docs/cutover-runbook.md` | Krok 13: pozycja listy kontrolnej, z zastrzeżeniem „nie wcześniej" |

Sześć ognisk zmiany: hierarchia źródeł prawdy (odwraca się) · fixtures (wzorzec → baseline
regresji) · GATE (odbudowy → kontraktów zewnętrznych: Selly, dostawcy, FE↔BE) · `/triaz-zmian`
(umiera) · mechanika kart (zwija się) · `CLAUDE.md` (pułapki naszego kodu zostają, archeologia
oryginału odchodzi).

Świadomie **chronione przed przestrojeniem**: zasada „nie dopisuj akapitu na koniec współdzielonego
pliku" (wynika z równoległych gałęzi, nie z odbudowy) i pułapki `CLAUDE.md` o Drizzle,
`mode: "boolean"`, `UPPER()`, `safeAll()` i MSW.

## Design decisions

- Audyt do nowego pliku, nie do roadmapy — roadmapa trzyma **plan**, nie instrukcję wykonawczą.
- Priorytet zapisany w trzech miejscach, bo każde czyta ktoś inny: roadmapa (sesja planująca
  falę), backlog (`tools/stan-backlogu.sh`), runbook (człowiek w oknie).
- Roadmapę rusza ten ticket jako **koordynator** (CLAUDE.md pkt 0); sprawdzone: 0 otwartych PR-ów,
  31/31 kart ✅.
- `docs/karty/PO.0/karta.md` **nieutworzona** — D5 ticketu 158.
- Trzy decyzje (archiwizacja `mirror/`, przenagranie fixtures, naprawa schematu flag `'Tak'`)
  zapisane jako **otwarte**, nie rozstrzygnięte.

## Tests

Nie dotyczy — zero plików kodu w diffie. Bramki `rebuild/backend/` nieuruchamiane, GATE **N/D**.
Weryfikacja narzędziowa: `tools/stan-backlogu.sh 162` pokazuje `#162.1 · ✅ · ⬜`.

## Breaking changes

Brak.

## Follow-up

`PO.0` po przełączeniu domeny — `docs/po-cutoverze-proces.md` §3 to jej lista zadań, §4 DoD.

## Review

Bez subagenta — ticket dokumentacyjny, bez kodu.
