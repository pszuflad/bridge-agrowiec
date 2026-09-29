## Ticket
167-FEATURE-oszacuj-pozostale-wagi — przycisk „Oszacuj pozostałe wagi"

## Summary
Trzecia nadbudowa nad mechanizmem wagi (155 dziedziczenie, 156 przycisk, 166 nawigacja do
braków). Dla produktów, którym dokładne dopasowanie (marka+rozmiar+bieżnik) nic nie znalazło,
nowy, świadomie mniej dokładny krok: przelicznik szacujący wagę jako średnią wszystkich innych
produktów TEGO SAMEGO rozmiaru w katalogu (bez marki i bieżnika).

## Problem / Motivation
Po „Dociągnij wagę" część produktów (w praktyce Ani: ~470) zostaje bez wagi, bo w katalogu nie
ma żadnego identycznego „bliźniaka". Użytkowniczka poprosiła wprost o drugi krok: uzupełnić je
przelicznikiem tam, gdzie się da, i oznaczyć wynik jako szacunek, nie potwierdzoną wagę.

## Solution
- Nowa kolumna `products.waga_szacowana` (migracja 015).
- `kluczRozmiaru`/`sredniaWagaDlaRozmiaru`/`oszacujWageWstecznie` w `dziedziczenieWagi.ts` —
  ten sam wzorzec ochrony co dziedziczenie (pomija chronione ręczną poprawką, jedna transakcja).
- Nowa trasa `POST /api/products/oszacuj-wage` + skrypt CLI `npm run oszacuj-wage`.
- Nowy przycisk „Oszacuj pozostałe wagi" (Konfiguracja → Katalog), osobny od „Dociągnij wagę".
- Nowy tooltip w tabeli katalogu — amber `AlertTriangle` (nie niebieska `Info` z dziedziczenia),
  treść jasno mówi „SZACOWANA, nie potwierdzona".

## Design decisions
- Klucz dopasowania: TYLKO rozmiar (szerokość+profil+średnica) — bez marki i bieżnika,
  zgodnie z decyzją użytkowniczki.
- Działa tylko tam, gdzie w katalogu jest choć jeden inny produkt tego rozmiaru z wagą.
- Osobny przycisk/trasa, nie scalone z „Dociągnij wagę" — świadomy, osobny krok.
- Priorytet: `wagaAutoUzupelniona` (dokładne) > `wagaSzacowana` (przybliżone) — backend nigdy
  nie ustawia obu naraz, bo działa tylko na pustej/zerowej wadze.

## Tests
- Backend: `npm run lint && npm run typecheck && npm run build && npm test` — 1897/1897 zielone.
- Frontend: `npm run lint && npm run typecheck && npm run build && npm test` — 1011/1011 zielone.
- Skrypt `npm run oszacuj-wage` zweryfikowany ręcznie.

## Breaking changes
None.

## Follow-up
Brak nowych — mechanizm kompletny wobec ustaleń z Q&A. Produkty bez żadnego „bliźniaka" tego
samego rozmiaru zostają do ręcznego uzupełnienia (link do filtra „Brak wagi" z ticketu 166
nadal działa po tym kroku).

## Review
<details>
<summary>Code review</summary>

0 BLOCKER / 1 SHOULD-FIX (naprawiony — dopisany test ochrony `manual_overrides` dla
`oszacujWageWstecznie`) / 2 NICE-TO-HAVE (świadomie odłożone, opisane w raporcie).
Pełna treść: `docs/tickets/167-FEATURE-oszacuj-pozostale-wagi/review.md`.

</details>

---
Ticket docs: `docs/tickets/167-FEATURE-oszacuj-pozostale-wagi/`
Zsynchronizowane z `develop`; bramki zielone.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_011c43M9EaKacPhHiN8RSDpT
