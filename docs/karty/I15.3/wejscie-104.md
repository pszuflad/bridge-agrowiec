# Wejście dla I15.3 od ticketu 104 (koordynator) · 2026-09-22 — dodatkowy zakres: CLI generatora CSV (#102)

Plik CSV dla Selly o 6:00 generuje w produkcji **cron systemowy** uruchamiający `generate_selly_export.cjs` — spoza
aplikacji. Odbudowa ma tylko trasę ręczną. **Dołóż polecenie CLI** uruchamiające ten sam generator co trasa
(np. `npm run selly:csv` w `rebuild/backend/package.json` + mały plik wejścia), z tymi samymi ścieżkami `SELLY_CSV_*`
i tym samym zapisem statusu. Test: polecenie tworzy plik identyczny z tym z trasy. W „Do koordynatora”: dokładne
polecenie do wpisania w cron przy cutoverze. Selly pobiera plik o **12:00** (odpowiedź Ani 1.2).
**#101:** jeśli pomiar pokaże, że puste blokady płatności u nowych produktów wynikają z kolumny/CSV po stronie Bridge,
koordynator dopisze to do zakresu tej karty albo I15.1.
