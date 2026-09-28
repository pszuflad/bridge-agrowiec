# Wejście dla P10.4 od ticketu 90 (P10.1) · 2026-09-22

**Fakt.** Karta P10.1 ożywiła karty „4.1 Historia dostępności pozycji" i „4.2 Tempo schodzenia
z magazynu" oraz ich eksporty CSV — dziś zwracają wiersze z `historia_cen` zamiast być trwale
puste (#32), i naprawiła bootstrap migawki (#31, idempotentny w obrębie dnia UTC) oraz nieznany
widok eksportu (#35, `404` zamiast `200` + sam BOM). Dowód: `docs/tickets/90-FEATURE-ozywienie-kart-dostepnosci/raport.md`.

**Co to obala w `docs/instrukcja-testow-I10.md`:**
- `:20` — boks „Dwie karty są puste ZAWSZE, niezależnie od danych";
- `:275-276` — tabela: 4.1 i 4.2 „PUSTA ZAWSZE", eksport „✔ (pusty plik)";
- `:302-311` — sekcja **6.1** „Karty 4.1 i 4.2 są puste ZAWSZE";
- `:327-331` — sekcja **6.3** „Dwa eksporty CSV dają PUSTY plik";
- `:434-439` — **7.5** „Eksport z kart 4.1 i 4.2 … plik jest pusty. To poprawne";
- `:483` i `:491` — checklista: „4.1 i 4.2 puste — poprawne", „pliki z 4.1 i 4.2 są puste".

**Co P10.4 ma z tym zrobić.** Zastąpić powyższe opisem nowego, prawdziwego zachowania — dla
Ani do sprawdzenia:
- karty 4.1 i 4.2 mają wiersze (dane z `historia_cen`);
- pozycja usunięta z katalogu (para dostawca+kod, której już nie ma w `products`) pokazuje
  „—" w kolumnie „Nazwa" zamiast pustej karty;
- pliki CSV eksportu (`export/availability-products`, `export/sell-through`) mają nagłówek
  i wiersze, nie sam BOM;
- wywołanie nieznanego widoku eksportu (URL spoza listy) daje `404` — ale to nie jest widoczne
  z UI (front nie woła widoków spoza zamkniętej listy `WidokEksportu`), więc nie ma osobnego
  scenariusza klikania, tylko usunięcie starego zapisu o „pustym pliku";
- `bootstrap-current` (trasa bez przycisku w UI, D4) jest teraz idempotentny w obrębie dnia
  UTC — drugie wywołanie tego samego dnia nie dokłada migawek; nie dotyczy scenariuszy klikanych
  przez Anię, ale gdyby instrukcja opisywała ręczne wywołanie, warto to odnotować.
