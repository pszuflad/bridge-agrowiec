# Wpis do spec-backend od ticketu 150 (karta TEST.2) · 2026-09-24

**Sekcja:** §2 (panel Selly — eksport CSV, kontynuacja ustalenia z `wpis-122.md`).

**Potwierdzone w 150** (`150-DOCS-test-sciezki-krytycznej`, 2026-09-24, karta TEST.2): generator
CSV nowego stosu (`rebuild/backend/src/selly/generator-csv.ts`, `npm run selly:csv`) jest
**bajtowo równoważny** produkcyjnemu `generate_selly_export.cjs` z `88fa31c` **przy identycznej
zawartości bazy** — nie tylko w wierszu nagłówkowym (to już potwierdzał `wpis-122.md`), ale
w **całej treści pliku**.

**Metoda.** Kopia `db/snapshot.db` (produkcja z 13.08), nałożone migracje odbudowy 001–013,
na TEJ SAMEJ kopii uruchomione oba generatory: stary z `git show 88fa31c:mirror/backend/
generate_selly_export.cjs` (tylko dwie stałe ścieżki podmienione) i nowy przez `npm run
selly:csv`. `cmp`/sha256 obu wyjść. Pełny odtwarzalny przebieg:
`docs/tickets/150-DOCS-test-sciezki-krytycznej/dowod-csv.md`.

**Wynik:** identyczny sha256, 6899 linii (nagłówek + 6898 produktów), 3 177 786 bajtów,
60 kolumn. Kontrola nietrywialności: 60. kolumna `Blokowane-formy-platnosci` wypełniona we
wszystkich 6898 wierszach, wartościami zróżnicowanymi; 5469 linii z polskimi znakami; BOM
obecny. Dowód powtórzony niezależnie przez reviewera ticketu z tym samym sha256.

**Pułapka, na którą trafiono i którą trzeba znać przy każdym kolejnym porównaniu z „oryginałem":**
`mirror/backend/generate_selly_export.cjs` **na `develop` ma 59 kolumn**, bez
`Blokowane-formy-platnosci` — o jedną kolumnę mniej niż wersja produkcyjna z `88fa31c`. Port
tej kolumny (ticket 122) zaktualizował nowy stos, ale nie plik referencyjny w `mirror/` na
`develop`. Kto sięga po „oryginał" do porównania, ma brać `git show 88fa31c:...`, nie stan
`mirror/` na `develop` — inaczej wyjdzie fałszywy rozjazd na ostatniej kolumnie.

**Zasięg dowodu.** Jednorazowy, wykonany poza repo (katalog tymczasowy), niczego nie zmienia
w kodzie. Na bieżąco stałą strażą pozostaje wyłącznie wiersz nagłówkowy
(`rebuild/backend/test/selly.generator-csv.test.ts`). Zamiana pełnego porównania w stałą
straż CI to follow-up, nie zrobiony w tym tickecie (wymagałby trzymania w repo kopii starego
generatora z `88fa31c` jako referencji).

Szczegóły: `docs/tickets/150-DOCS-test-sciezki-krytycznej/`.
