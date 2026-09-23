# Wejście dla I15.3 od ticketu 114 (koordynator) · 2026-09-23 — ze specyfikacji Selly od Ani

Trzy rzeczy do zakresu CSV (potwierdzone w `origin/main:mirror/backend/generate_selly_export.cjs`):

1. **Nazwy kategorii w CSV** — generator mapuje kategorie Bridge na żywe nazwy sklepu: `rolnicze` →
   „Opony rolnicze", `rolnicze male` → „Opony rolnicze", `lesne` → „Opony leśne", `przemyslowe` →
   „Opony przemysłowe", `ciezarowe` → „Opony ciężarowe". Normalizator uwzględnia polskie znaki (`ł`). To część #76.
2. **Nagłówek `R/D`** zamiast „Konstrukcja" (wymóg importera Selly, przywrócony 14.09), wartości pełne
   „Radialna"/„Diagonalna". Odbudowa to ma — potwierdź testem, nie zakładaj.
3. **Wstrzymane produkty:** stan końcowy (22.09) to **tylko aktywne w CSV** + zapis atomowy. Specyfikacja Ani
   ma w jednym miejscu starszy opis („wstrzymane ze stanem 0", 14.09) — nieaktualny, wygrywa kod z `abe5f14`.

⚠ **Dla polecenia CLI generatora (#102):** plik CSV na produkcji leży w katalogu chronionym `.htaccess`
z białą listą IP (Selly + Agrowiec). Polecenie ma nadpisywać sam plik CSV, nie ruszać `.htaccess`
(patrz `docs/cutover.md`, krok „Frontend na miejsce").
