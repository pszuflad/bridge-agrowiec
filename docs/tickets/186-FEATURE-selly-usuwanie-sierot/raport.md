# 186-FEATURE-selly-usuwanie-sierot — raport

## Summary
Dodano Tor 3: po każdym przebiegu Toru 1 (HH:10/25/40/55) usuwa z Selly produkty/warianty, których nie ma już w Bridge, z historią
(kod, nazwa, EAN, id w Selly, dostawca, godzina) w widoku „Historia” i w „Historii operacji” Selly.

## Changes
- **New:** `rebuild/backend/src/selly/rest/sync-usuwanie.ts`; `rebuild/backend/test/selly.usuwanie.test.ts` (12 testów)
- `selly/rest/scheduler.ts` (Tor 3 po Torze 1, opcja `usuwanie`), `config/env.ts` (`SELLY_USUWANIE`, domyślnie true), `server.ts`
- `historia/mapowanie.ts` — akcja `selly_usuniecie` (typ `edycja`); `test/historia.mapowanie.test.ts` — osiem akcji zamiast siedmiu

## Deviations from plan
None.

## Test results
- Gate fixtures/kontrakt: N/D (kształty API bez zmian; testy historii zielone).
- Backend: lint, typecheck, build, `npm test` zielone (137 plików, 2159 testów), na atrapie Selly (żadnych wywołań do prawdziwego sklepu).

## Breaking changes
Po wdrożeniu na produkcji (przy `SELLY_TRYB=pelny` i `SELLY_SCHEDULER=true`) zacznie realnie usuwać z Selly. Wyłączenie: `SELLY_USUWANIE=false`.

## Follow-up
- Na produkcji mogło się nazbierać sierot z przeszłości (rotacje kodów, scalenia, hurtowe czyszczenia); schodzą po 20 na przebieg, a przy >30% mapowań
  przebieg się wstrzymuje (wpis „wstrzymano” w Historii operacji). Pierwszy tydzień warto obejrzeć wpisy.
- Nie zweryfikowano, czy konto API Selly na produkcji ma prawo `DELETE` (zakres `READWRITE`); pierwszy przebieg to pokaże (wpis „błąd” z komunikatem HTTP).
- Czas w historii to UTC (jak reszta bazy).

## Review fixes applied
Review (`review.md`): 2 BLOCKER, 9 SHOULD-FIX, 6 NICE-TO-HAVE. Naprawione:
- **BLOCKER 1:** ponowne sprawdzenie predykatu sieroty i użycia wariantu przez żywe mapowanie tuż przed `DELETE` (produkt mógł wrócić w trakcie przebiegu). Test z powrotem produktu po odczycie z Selly; mutacyjnie potwierdzony.
- **BLOCKER 2:** mapowanie bez wariantu, a produkt w Selly ma warianty → nic nie usuwa; kasuje cały produkt tylko gdy nie ma w nim żadnych wariantów.
- **Tożsamość jak `sprawdzCelSelly` (184):** EAN ALBO nazwa muszą zgadzać się ze znanymi danymi (historia cen / historia); bez znanej tożsamości nic nie usuwa; zgodność „DEMO”.
- **Atomowość:** zapis historii po udanym `DELETE` w `try/catch` (nie przerywa reszty), dziennik zamykany w `finally`; status odpowiedzi `DELETE` spoza 2xx nie jest sukcesem.
- **Nakładanie przebiegów:** flaga „w toku”. **Limit dobowy** 200 usunięć (z `audit_log`). **Próg sierot** konfigurowalny (`SELLY_USUWANIE_MAKS_UDZIAL`, domyślnie 0.3) — odblokowuje zaległość >30% po świadomym przejrzeniu.
- **Testy:** 21 (wariant NULL, powrót w trakcie, brak tożsamości/DEMO, 5xx na DELETE, awaria audytu, równoległe przebiegi, limit dobowy, próg); harmonogram czeka na skutek, a nie stałe 400 ms.
Nie zmieniane (świadomie): 404 na odczycie produktu sprząta mapowanie (przy błędnej konfiguracji sklepu mogłoby to czyścić mapowania — do obserwacji w pierwszych dniach);
ochrona EAN nie sprawdza `products_scalone` (scalenia `scal-karty-auto` idą osobną ścieżką i nie są widoczne dla Toru 3).
