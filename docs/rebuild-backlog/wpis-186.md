# Backlog — wpisy ticketu 186 (`186-FEATURE-selly-usuwanie-sierot`) · 2026-10-05

### #186.1 · 2026-10-05 · [BACKEND] · stałe usuwanie z Selly produktów, których nie ma w Bridge (realizacja #100)

| Pole | Wartość |
|---|---|
| **Data** | 2026-10-05 |
| **Kategoria** | BACKEND (Selly REST) — nowa funkcja |
| **Pliki** | `rebuild/backend/src/selly/rest/sync-usuwanie.ts`, `scheduler.ts`, `historia/mapowanie.ts` |
| **Commit** | — |
| **Do nowej wersji?** | ✅ **TAK** (decyzja użytkownika, 2026-10-05) |
| **Status** | wdrożone w kodzie; działa po wdrożeniu przy `SELLY_TRYB=pelny` i `SELLY_SCHEDULER=true` |

Realizuje #100. Szczegóły i bezpieczniki: `docs/spec-backend/wpis-186.md`.
