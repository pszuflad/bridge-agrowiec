## Ticket
144-DOCS-do-zrobienia-przed-testami — lista do rozliczenia przed testami I15

## Summary
Ticket wyłącznie dokumentacyjny, **zero zmian w `rebuild/` i `contract/`**. Na polecenie użytkownika (2026-09-24) zbiera w jednym miejscu to, co ticket 139 (karta I15.10b, montaż modułu dostępności) zostawił otwarte, tak żeby wypłynęło dokładnie wtedy, gdy wszystkie karty I15 będą zrobione i zaczniemy podchodzić do testów.

## Problem / Motivation
Ticket 139 zamknął się z czterema pozycjami rozsypanymi po `raport.md`, `review.md` i wpisach backlogu. Użytkownik chce je mieć w jednym miejscu i wskazał **moment**, nie plik: „jak wszystkie karty z iteracji 15 zostaną zrobione i będziemy podchodzić do testów". PR #153 był już zmergowany, więc nie dało się tego dołożyć do tamtego ticketu.

## Solution
- **Nowy** `docs/karty/I15.9/wejscie-144.md` — pełna lista czterech pozycji.
- **Nowy** `docs/karty/TEST.1/wejscie-144.md` — to samo przełożone na ryzyko przy pisaniu instrukcji testów.

## Design decisions
- **Te dwie karty, bo one czytają wskazany moment.** I15.9 to faza 6, ostatnia karta I15 (domknięcie); TEST.1 to ostatni dokument przed cutoverem. Wpis `#139.2` jest dodatkowo wyłapywany mechanicznie przez `tools/stan-backlogu.sh --do-decyzji`, więc decyzja nie zginie nawet wtedy, gdy nikt nie otworzy kart.
- **Nowe pliki `wejscie-144.md`, a nie dopiski do `wejscie-139.md`** — CLAUDE.md reguła 2 (ustalenie dla przyszłej karty = nowy plik od numeru ticketu).
- **Nie ruszamy trzech nieaktualnych zdań w cudzych plikach**, tylko je zgłaszamy — regulaminy `docs/spec-backend/README.md` i `docs/rebuild-backlog/README.md` zabraniają obcym ticketom edycji cudzych wpisów. Decyzja, czy je poprawić, należy do koordynatora.

## Co konkretnie jest na liście
1. **Decyzja `#139.2`** — czy dokładamy bramkę na `SELLY_CSV_DIR` (domyślka to katalog produkcyjny; jedyną ochroną poza produkcją jest `.env`). Nie jest to dług ticketu 139 — ścieżka otwarta od I15.3 przez `POST /api/selly/generate-csv`.
2. **Konfiguracja przed testami** — `SELLY_TRYB` musi być świadomie ustawiony. Przy `wylaczony` odświeżanie dostępności jest **niewidocznie** wyłączone (bez błędu, bez komunikatu w UI), więc testerka zgłosi usterkę, której nie ma.
3. **Trzy nieaktualne zdania** w `docs/spec-backend/wpis-119.md:57-58`, w polu „Do nowej wersji?" wpisu `#104` w `docs/rebuild-backlog.md` i w wierszu `#104` w `docs/rebuild-backlog/wpis-129.md`.
4. **Znany brak pokrycia testowego** — test montażu nie wykrywa podmiany `discoverySelly` na świeżą instancję; jest nieobserwowalna z zewnątrz procesu.

Żadna z tych pozycji nie blokuje domknięcia I15.

## Tests
Nie dotyczy — ticket nie rusza kodu, zmiana obejmuje wyłącznie `docs/`. Bramki `rebuild/backend/` nieuruchamiane, bo nie ma czego sprawdzać.

## Breaking changes
None.

## Follow-up
Same pozycje z listy — patrz `docs/karty/I15.9/wejscie-144.md`.

## Review
Nie uruchamiano — ticket wyłącznie dokumentacyjny, bez zmian w kodzie i bez wpływu na kontrakt.

---
Ticket docs: `docs/tickets/144-DOCS-do-zrobienia-przed-testami/`
Zsynchronizowane z `develop` (`b0bccac`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
