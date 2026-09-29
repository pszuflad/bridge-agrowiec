## Ticket
166-FEATURE-nawigacja-do-brakow-wagi — nawigacja do produktów bez wagi po dociągnięciu

## Summary
Po uruchomieniu „Dociągnij wagę" (ticket 156) użytkowniczka widziała tylko liczby w toaście —
nie miała sposobu, żeby zobaczyć KTÓRE konkretnie produkty zostały bez wagi. Prośba wprost z
czatu: możliwość przejścia do tych produktów, żeby uzupełnić je ręcznie.

## Problem / Motivation
Po dociągnięciu część produktów zostaje bez wagi, bo w katalogu nie ma żadnego pasującego
„bliźniaka" tej samej marki/rozmiaru/bieżnika. Docelowo: każde kolejne dociągnięcie będzie
pełniejsze, bo raz ręcznie uzupełniony produkt staje się kandydatem-źródłem dla innych.

## Solution
- Nowy filtr statusu „Brak wagi" w `/katalog` (puste/zerowe `waga`, ten sam próg co backendowe
  `jestPustaWaga()`).
- Deep link `?status=brak_waga` — `Katalog.tsx` czyta parametr URL przy montowaniu i od razu
  stosuje filtr (wouter `useSearch()`, z walidacją przeciw nieznanym wartościom).
- Wynik „Dociągnij wagę" (Konfiguracja → Katalog) trzymany w stanie i renderowany jako TRWAŁY
  komunikat (nie tylko w znikającym toaście) z linkiem „zobacz je w katalogu" do
  `/katalog?status=brak_waga` — widoczny tylko, gdy po operacji coś zostało bez wagi.

## Design decisions
- Filtr działa lokalnie po stronie klienta, tak jak cała reszta filtrów katalogu (`plan.md D2`
  z odbudowy — katalog pobiera całą tabelę i filtruje u siebie).
- Link chowa się automatycznie, gdy wszystko zostało zaktualizowane albo katalog kandydatów był
  pusty (`wszystkichKandydatow === 0`).

## Tests
- Frontend: `npm run lint && npm run typecheck && npm run build && npm test` — 1005/1005 zielone.
- Backend: nietknięty tym ticketem.

## Breaking changes
None.

## Follow-up
- Samo ręczne uzupełnianie wagi (skąd Ania weźmie liczby) zostaje poza zakresem — to praca
  redakcyjna, nie kod.
- Automatyczny przelicznik/szacowanie wagi bez pasującego produktu (np. po samym rozmiarze, bez
  marki) świadomie pominięty — byłby odstępstwem od klucza dopasowania z decyzji 1 (ticket 155)
  i wymaga osobnej decyzji użytkowniczki.

## Review
<details>
<summary>Code review</summary>

0 BLOCKER / 1 SHOULD-FIX (naprawiony — reset wyniku poprzedniego przebiegu przy błędzie
kolejnego) / 2 NICE-TO-HAVE (potwierdzone jako OK bez zmian: próg pustości wagi zgodny z
backendem, warunek widoczności linku poprawny dla pustego katalogu kandydatów).
Pełna treść: `docs/tickets/166-FEATURE-nawigacja-do-brakow-wagi/review.md`.

</details>

---
Ticket docs: `docs/tickets/166-FEATURE-nawigacja-do-brakow-wagi/`
Zsynchronizowane z `develop`; bramki zielone.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_011c43M9EaKacPhHiN8RSDpT
