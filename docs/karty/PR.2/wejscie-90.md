# Wejście dla PR.2 od ticketu 90 (P10.1) · 2026-09-22

**Fakt.** P10.1 zrobione (✅ 2026-09-22, ticket `90-FEATURE-ozywienie-kart-dostepnosci`) — karty
„4.1 Historia dostępności pozycji" i „4.2 Tempo schodzenia z magazynu" oraz ich eksporty CSV mają
teraz wiersze z `historia_cen` (nie są już trwale puste), nazwa produktu dochodzi z katalogu po
parze `(dostawca, kod)`, `bootstrap-current` jest idempotentny w obrębie dnia UTC. Zależność
PR.2 → P10.1 jest więc spełniona. Dowód: `docs/karty/P10.1/karta.md` sekcja „Dowiezione",
`docs/tickets/90-FEATURE-ozywienie-kart-dostepnosci/raport.md`.

**Co PR.2 ma z tym zrobić.** Może zaczynać — dane, które kafle KPI analityki mają pokazywać,
są już ożywione. Poza zakresem P10.1 (i tym samym poza tym, co PR.2 dostaje za darmo): kafle KPI
same w sobie (agregaty liczbowe na pulpicie/widoku analityki) — P10.1 dotknęła wyłącznie kart
4.1/4.2 i ich eksportów, nie kafli KPI.
