# Wejście dla I15.8 od ticketu 104 (koordynator) · 2026-09-22 — harmonogram Selly: kod vs opis Ani

**Kod `origin/main` (`selly/scheduler_selly.cjs`, źródło prawdy dla portu 1:1):**
- Tor 1 (delta): o **HH:55** dla dostawców z auto-pull o HH:54 + fallback **co 15 min** dla wszystkich (ręczne aktualizacje).
- Tor 2 (pełny mirror + auto-create): codziennie **04:30**, rotacja per dzień tygodnia: pn MO1+MO2, wt MO3+MO4,
  śr MO5+MO6, czw MO9, pt MO10, **pierwsza sobota miesiąca MO7, pierwsza niedziela miesiąca MO8**.
**Opis Ani (runda 3, 1.2):** „aktualizacja całego dostawcy w nocy między 3–4 rano codziennie inna partia dostawców”.
Rozjazd godziny (3–4 vs 04:30) jest drobny — odtwarzamy **kod**; odnotuj w karcie i w wejściu dla I15.9.
**CSV:** plik o 6:00 (cron systemowy — #102, karta I15.3), Selly pobiera go o **12:00** (nie o 6:00, jak pisały
wcześniejsze dokumenty) — ważne dla testów po cutoverze.
