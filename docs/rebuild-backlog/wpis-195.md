# Wpisy backlogu od sesji 195 · 2026-10-07

### #195.1 — Eksporty CSV nie neutralizują komórek zaczynających się od `=`, `+`, `-`, `@`

**Status:** ⬜ do decyzji (nic nie zmieniono)
**Do nowej wersji?** ⬜ do decyzji
**Źródło:** review ticketu 195 (nowy eksport `GET /api/selly/usuniete/csv`). `escapujKomorke` (`src/analityka/csv.ts`, port
`csvEscape` z oryginału) zakłada cudzysłów tylko przy `;`, `"` i złamaniu wiersza. Komórka zaczynająca się od `=`, `+`, `-`
albo `@` może zostać potraktowana przez Excel jako formuła („wstrzyknięcie CSV”). Nowy eksport trzyma ten sam wzorzec, żeby
wszystkie pliki Bridge zachowywały się tak samo; ryzyko dotyczy nazw produktów z cennika dostawców. Jeśli zmiana ma być
zrobiona, to dla WSZYSTKICH eksportów naraz (analityka, Selly CSV, usunięte z Selly), jednym wspólnym miejscem.

### #195.2 — Karta „Usunięte z Selly”: `offset` nie jest przycinany do `total`

**Status:** ⬜ do decyzji (nic nie zmieniono)
**Do nowej wersji?** ⬜ do decyzji
**Źródło:** review ticketu 195. Historia usunięć jest wyłącznie dopisywana (nic jej nie kasuje), więc `offset` poza
zakresem nie wystąpi. Gdyby kiedyś dodać czyszczenie historii, karta powinna wracać na ostatnią stronę.
