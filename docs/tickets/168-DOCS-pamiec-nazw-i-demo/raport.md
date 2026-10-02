# Raport — 168-DOCS-pamiec-nazw-i-demo · 2026-09-30

Ticket dokumentacyjny, bez zmian w kodzie. Zapisuje ustalenia z sesji o regule „DEMO w nazwie"
(PR #205, #210; na `main` w #206 i #211).

## Co dodano
- `docs/spec-backend/wpis-168c.md` — kolejność nakładania nazwy przy imporcie i przy akceptacji,
  pochodzenie wpisów `nazwa_pamiec`, konsekwencje dla zmian dotyczących nazwy.
- `docs/rebuild-backlog/wpis-168.md` — #168.1 (⬜ do decyzji: akceptacja nakłada `nazwa_pamiec`
  ponownie, a `manual_overrides` nie; ryzyko dla 174 poprawek z ticketu 164) i #168.2
  (✅ reguła DEMO, wdrożona).
- `CLAUDE.md` — stała pułapka „Zmiana nazwy… przechodzi przez `nazwa_pamiec` i
  `manual_overrides`": każda sesja ma o tym poinformować użytkownika przed kodem.
- `.claude/commands/feature.md`, Krok 3 — punkt w liście pytań do użytkownika.

## Czego NIE sprawdzono
- #168.1 to hipoteza z czytania kodu i istniejącego scenariusza charakteryzacji. Nie mierzono
  jej na bazie produkcyjnej (w chmurze `db/snapshot.db` nie jest dostępny): brak informacji,
  czy `nazwa_pamiec` ma wpisy dla `kod_importu` z ticketu 164.
- Wynik wdrożenia `deploy-produkcja` po #211 (run 14): sukces (workflow), bez weryfikacji na
  żywej aplikacji.
