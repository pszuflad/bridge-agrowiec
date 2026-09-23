# Wejście dla I15.8 od ticketu 114 (koordynator) · 2026-09-23 — ze specyfikacji Selly od Ani

**Harmonogram — potwierdzenie i doprecyzowanie** (kod `scheduler_selly.cjs` pozostaje źródłem prawdy):
- Tor 1: **HH:55** (po auto-pull dostawców o HH:54) oraz fallback **HH:10, HH:25, HH:40** dla ręcznych
  aktualizacji; każdy cykl to `syncDelta` po kolei dla wszystkich dostawców; przebieg dla dostawcy bez zmian
  trwa poniżej sekundy. Tick schedulera: co 60 s wewnątrz procesu backendu.
- Tor 2: **04:30**, rotacja per dzień tygodnia; cache kodów Selly budowany raz na batch (`buildCache: i===0`).
  ⚠ Specyfikacja Ani podaje dla środy „MO5", kod ma „MO5 + MO6" — wygrywa kod.

**Decyzja do podjęcia w tej karcie (do przedstawienia użytkownikowi):** produkcja zostawia **osierocone wpisy
`selly_sync_log` ze statusem `w_trakcie`** po restarcie procesu (przykład Ani: id 2725, MO2, wisi od 10.09) —
scheduler nie zamyka przerwanych cykli przy starcie. Odtworzyć 1:1 czy zamykać przy starcie (świadome
odstępstwo, poprawia diagnostykę `GET /api/selly/sync-status`)? Rekomendacja koordynatora: **naprawić** —
to czysta diagnostyka, nie zmienia niczego w sklepie.

**Trasa `GET /api/selly/sync-status`** oddaje ostatnie 20 wpisów `selly_sync_log` — tak to opisuje Ania.
