# Backlog — wpisy ticketu 185 (`185-FEATURE-przypisanie-kategorii-zastosowania`) · 2026-10-04

### #185.1 · 2026-10-04 · [BACKEND][BAZA] · kategoria/zastosowanie nadawane w Bridge, chronione przed importem

| Pole | Wartość |
|---|---|
| **Data** | 2026-10-04 |
| **Kategoria** | BACKEND + BAZA + FRONTEND |
| **Pliki** | `rebuild/schema/021_*.sql`, `src/import/dziedziczenieKategorii.ts`, `src/import/migracje/przypisz-kategorie-zastosowanie.ts`, `akceptacja.ts`, `bulk.ts`, `frontend/src/pages/katalog/poleEdycji.ts` |
| **Commit** | — |
| **Do nowej wersji?** | ✅ **TAK** (decyzja użytkownika, 2026-10-04) |
| **Status** | wdrożone w kodzie; przypisanie na produkcji — do wykonania (`--apply`) |

**Opis biznesowy.** Kategorię i zastosowanie nadajemy w Bridge (nie dostawcy). Wózek widłowy jest tylko w Przemysłowych;
ładowarka, kompaktor i koparka są Przemysłowe; osie — Ciężarowe; kosiarka/ciągnik/przyczepa — Rolnicze. Przypisanie
ma przetrwać import, a poprawka Marty ma wygrywać. Nowe produkty biorą parę po odpowiedniku (marka + model + rozmiar).

**Poprawki Marty:** dotychczasowe poprawki na kategorii/zastosowaniu usuwane przy wdrożeniu (migracja 022); nowe działają normalnie.

**Do sprawdzenia przed wdrożeniem:** raport z dry-runu na kopii produkcji; mapy Selly pod nowe kombinacje.
