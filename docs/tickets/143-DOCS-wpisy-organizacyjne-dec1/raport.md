# 143-DOCS-wpisy-organizacyjne-dec1 — raport wykonania

## Podsumowanie
Trzy ustalenia organizacyjne z rundy decyzyjnej DEC.1 (ticket 141) przeniesione z sekcji
„Do koordynatora" zamkniętej karty do **backlogu**, czyli do miejsca przeglądanego rutynowo
(`tools/stan-backlogu.sh`). Jeden nowy plik, zero zmian w kodzie, kontrakcie, roadmapie
i cudzych kartach.

## Dlaczego w ogóle
Użytkownik zapytał, czy musi przekazać te punkty koordynatorowi ręcznie. Sprawdzenie wykazało,
że formalnie są w dokumentacji (`docs/karty/DEC.1/karta.md` → „Do koordynatora", zgodnie
z `docs/karty/README.md`), ale w miejscu, które **już raz zawiodło w tym projekcie**:
`docs/rebuild-backlog/wpis-137.md` powstał dokładnie dlatego, że ustalenia ticketu 130 zostały
w „Do koordynatora" zamkniętej karty I15.4b.

Dowód, że ryzyko jest realne, a nie teoretyczne:
- `grep -l "Do koordynatora" tools/*.sh` → **zero trafień** — żadne narzędzie przeglądowe nie
  wypisuje tej sekcji;
- `tools/stan-kart.sh` pokazuje **stan** karty, nie jej treść;
- DEC.1 ma `Stan: ✅`, więc wypada z pola uwagi przy planowaniu kolejnej fali.

Decyzja użytkownika 2026-09-24: przenieść do backlogu.

## Zmiany
- **Nowy:** `docs/rebuild-backlog/wpis-143.md` — trzy wpisy:
  - `#143.1` — zduplikowany numer `#103` w `docs/rebuild-backlog.md` (dwa różne wpisy: Selly
    zamknięty przez DEC.1 na `:4613` i „Braki w cenniku" nadal otwarty na `:4638`);
  - `#143.2` — katalog karty nie zakładany przed wydaniem promptu (przypadek DEC.1) wbrew
    „Przepływowi fali" z `docs/karty/README.md`;
  - `#143.3` — siedem kart z rundy DEC.1 do zaplanowania po cutoverze, z kosztami i kolejnością
    (sam plan jako całość; pojedyncze wpisy mają już własne `🕒`).
- `docs/tickets/143-DOCS-wpisy-organizacyjne-dec1/` — `plan.md`, `raport.md`, `review.md`,
  `pr-body.md`.

## Odstępstwa od planu
Jedno, wymuszone stanem `develop`: **punkt o `docs/karty/I15.10b/karta.md` NIE został
przeniesiony**, bo w międzyczasie przestał być prawdą. Nota z DEC.1 mówiła, że karta ma
`Stan: ⬜ do wstawienia w kolejkę` mimo zmergowanego PR #149; sprawdzenie 2026-09-24 na `develop`
pokazuje `Stan: ✅ 2026-09-23 · 139-FEATURE-montaz-dostepnosci`. Zamiast przepisywać fałsz,
odnotowano to w stopce pliku jako nieaktualne (CLAUDE.md, reguła 1 — karta opisuje stan).

## Wyniki testów
- **Gate odbudowy: N/D** — ticket nie dotyka API ani kodu. Potwierdzone `git diff --name-only`:
  zmiany wyłącznie w `docs/rebuild-backlog/wpis-143.md` i `docs/tickets/143-*/`.
- `tools/stan-backlogu.sh 143` → trzy wpisy, każdy `Do nowej wersji? = 🕒`, `Status = ⬜` ✓
- `tools/stan-backlogu.sh --do-decyzji` → nowe wpisy **NIE** wchodzą na listę oczekujących
  (mają `🕒`, nie `⬜`, w polu decyzji) ✓
- Zero zmian w `rebuild/`, `contract/`, `docs/rebuild-roadmap.md` oraz w `docs/karty/**`
  (w szczególności NIE edytowano cudzej karty DEC.1) ✓
- Unit / integracja / E2E: N/D.

## Breaking changes
Brak.

## Follow-up
**Nowy wpis do decyzji, który pojawił się PO rundzie DEC.1 — nie był jej częścią i nie jest
rozstrzygnięty:** `#139.2` (`docs/rebuild-backlog/wpis-139.md`, ticket 139, zmergowany
2026-09-23) — `SELLY_CSV_DIR` ma domyślkę wskazującą prawdziwy katalog produkcyjny, a ticket 139
uczynił tę ścieżkę osiągalną **automatycznie** z każdego importu (wcześniej tylko ręcznie przez
`POST /api/selly/generate-csv`). Czeka na **użytkownika**, nie na Anię.

⚠ **Niesie pozycję do sprawdzenia PRZED deployem produkcji**, niezależnie od samej decyzji:
czy `.env` produkcji ma `SELLY_TRYB=pelny` (inaczej odświeżanie w ogóle nie ruszy) i czy
`SELLY_CSV_DIR` wskazuje właściwy katalog na **każdym** środowisku, które nie ma `wylaczony` —
inaczej staging dzielący VPS z produkcją może nadpisać produkcyjny CSV. To jedyna znaleziona
pozycja „przed cutoverem" spoza listy DEC.1.

Poza tym bez zmian: siedem kart po cutoverze (`#143.3`), trzy wpisy czekające na Anię
(`#89`, `#108`, `#137.2`), `#137.1` zostawiony decyzją użytkownika 2026-09-24.
