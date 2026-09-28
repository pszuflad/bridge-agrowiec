# Wejście dla I15.9 od ticketu 139 (139-FEATURE-montaz-dostepnosci) · 2026-09-23 — montaż modułu dostępności jest zamknięty

**Karta I15.10b (`docs/karty/I15.10b/karta.md`) dowieziona.** `src/server.ts` montuje moduł
`src/selly/dostepnosc.ts` (`stworzSynchronizacjeDostepnosci` + `ustawDomyslnaSynchronizacjeDostepnosci`,
wyrejestrowanie w `zamknij()`). Wołanie z importera jest już wcześniej — I15.4b (ticket 130),
`import/polityka/fabryka.ts:988`, na końcu `importer()`. Łańcuch import → `zadajOdswiezenie()` →
moduł dostępności → CSV/Tor 1 jest więc **kompletny** od tego ticketu.

**Ważne dla weryfikacji domknięcia I15: cały łańcuch jest bezczynny przy `SELLY_TRYB=wylaczony`.**
Montaż stoi za bramką `SELLY_TRYB !== "wylaczony"` (decyzja D1, `docs/tickets/139-FEATURE-montaz-dostepnosci/plan.md`).
Domyślka i dzisiejszy staging mają `wylaczony`. Jeśli sprawdzając domknięcie I15 zobaczysz, że
import na stagingu nie generuje CSV ani nie rusza Tor 1 — **to nie jest dowód, że łańcuch jest
zepsuty**, tylko efekt bramki (identyczny z zachowaniem sprzed tego ticketu). Żeby zobaczyć
łańcuch żywy, trzeba `SELLY_TRYB=pelny` albo `tylko-odczyt` (i wtedy zwróć uwagę, że
`SELLY_CSV_DIR` domyślnie wskazuje katalog produkcyjny — patrz „Do koordynatora” w
`docs/karty/I15.10b/karta.md`).
