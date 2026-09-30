# Backlog — wpisy ticketu 168b (`168-FEATURE-uzupelnianie-ean-999`) · 2026-09-30

### #168b.1 · 2026-09-30 · [BACKEND][BAZA] · uzupełnianie pustych EAN (prefiks 999) + tabela par kod↔EAN

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-30 |
| **Kategoria** | BACKEND + BAZA (nowa tabela) |
| **Pliki** | `rebuild/schema/017_ean_pary.sql`, `rebuild/backend/src/ean-pary/*`, `src/routes/ean-pary.ts`, `src/import/polityka/fabryka.ts`, `src/import/akceptacja.ts`, `src/import/bulk.ts` |
| **Do nowej wersji?** | ✅ **TAK** — zamówienie użytkownika (nowa funkcja, odstępstwo od 1:1) |
| **Status** | ✅ **wdrożone** w tickecie 168 |

**Opis biznesowy.** Katalog nie ma mieć pustych EAN-ów. Puste pola dostają EAN `999…` z licznikiem (bez kolizji),
a para `kod`↔EAN jest zapamiętana w bazie, więc kolejny import (także po wyczyszczeniu katalogu) nie gubi numeru.

**Szczegół techniczny (dla rebuildu).** Patrz `docs/spec-backend/wpis-168b.md`.

**Rekomendacja (moja).** ✅ Nanieść. Po wdrożeniu: `POST /api/ean-pary/uzupelnij` z `dry_run: true`, żeby zmierzyć
liczbę pustych EAN-ów w produkcji, potem zwykłe wywołanie.
