# Wejście dla P10.2 od ticketu 90 (P10.1) · 2026-09-22

**Fakt.** P10.1 zrobione (✅ 2026-09-22, ticket `90-FEATURE-ozywienie-kart-dostepnosci`) — karty
„4.1" / „4.2" i ich eksporty CSV mają teraz wiersze z `historia_cen`, `bootstrap-current` jest
idempotentny w obrębie dnia UTC (`{ok, inserted, at}` bez zmiany kształtu). Zależność P10.2 →
P10.1 jest więc spełniona. Dowód: `docs/karty/P10.1/karta.md` sekcja „Dowiezione",
`docs/tickets/90-FEATURE-ozywienie-kart-dostepnosci/raport.md`.

**Co P10.2 ma z tym zrobić.** Może zaczynać (obie zależności, P10.1 i P6.2, są ✅). P10.1 nie
dotykała kafla „Ostatni eksport CSV" ani `pages/pulpit/kpi.ts` — backlog #34 zostaje w całości
zakresem P10.2, bez zmian.
