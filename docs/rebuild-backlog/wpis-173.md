# Wpisy backlogu od ticketu 173 · 2026-10-01

### #173.1 — Zweryfikować, ile pozycji w katalogu ma kod `AUTO` i ile z nich to duplikaty

**Status:** ⏳ do zrobienia
**Do nowej wersji?** — (zadanie weryfikacyjne)
**Źródło:** polecenie użytkowniczki 2026-10-01 (duplikaty BKT „AUTO”).

Policzyć karty z `_AUTO_` w kodzie (osobne partie DOT zakładane przez import), ile z nich ma bliźniaka
o tych samych cechach i EAN/kodzie dostawcy (duplikat), i przedstawić listę do decyzji. Użytkowniczka
usunęła ręcznie pozycje BKT; reszta nieprzeliczona.

### #173.2 — Model Continentala: „HS5” → „5” (adapter wycina znacznik techniczny)

**Status:** ❌ odrzucone 2026-10-01 — użytkowniczka: import jest dobry, zmiana niepotrzebna (parser bez zmian)
**Do nowej wersji?** ❌ NIE
**Źródło:** `CCCR22538555KCH50`. Propozycja: `TECH_MARK_RE` z `(?![A-Za-z])` na `(?![A-Za-z0-9])`.
