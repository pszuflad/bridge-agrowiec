# 102-DOCS-przeglad-widokow-aktualizacja — przegląd widoków do stanu develop (karta PR.6)

> Status: Approved
> Branch: `docs/102-przeglad-widokow-aktualizacja`
> Worktree: `.worktrees/102-DOCS-przeglad-widokow-aktualizacja`

## Ticket description
PR.6 — aktualizacja `docs/przeglad-12-widokow.md` do stanu po wszystkich kartach przeglądu
(PR.1–PR.5) i planu P. Ania przechodzi dokument jeszcze raz przed pełnym testem, więc ma
opisywać STAN develop, a nie stan z 2026-09-08.

## Context
- Warunek startu: PR.1 (#108), PR.2 (#112), PR.3 (#105), PR.4 (#106), PR.5 (#114) — wszystkie
  zmergowane w `origin/develop` (79cda97).
- Wejścia w `docs/karty/PR.6/`: 77 (Alerty Import/Katalog, Pulpit), 91 (Archiwum), 92 (polskie
  znaki w alertach, 435 + 2219), 93 (Selly „Wygeneruj CSV” + drugi krok), 97 (kafle KPI),
  101 (filtr marek ALLIANCE).
- Przegląd całości: każda sekcja zweryfikowana z kodem develop przez trzech researcherów
  (§0–3, §4–7, §8–12 + Archiwum + sekcje zbiorcze).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
Brak — ticket DOCS, nie dotyka `rebuild/` ani `contract/`. Gate nie obowiązuje.

## Decisions
- **D1 (użytkownik):** Archiwum jako nowa sekcja „10.” zaraz po Historii, przenumerowanie
  kolejnych (Konfiguracja 11, Selly 12, Moje konto 13). Tytuł „Przegląd widoków”, liczba
  ekranów w treści poprawiona na 13. Nazwa pliku bez zmian (linkują do niego inne dokumenty).
- **D2:** Czytelniczką jest Ania — zero nazw plików, tras API, tabel, numerów ticketów i wpisów
  backlogu w treści. Układ „Ma się pokazać / Do kliknięcia ✅/❌” zostaje.
- **D3:** Punkty nadal prawdziwe zostają bez zmian.
- Brak odstępstw od zachowania oryginału — ticket tylko opisuje stan.

## Implementation plan
1. Nagłówek: tytuł, data przygotowania, liczba ekranów.
2. Sekcje 0–9 zgodnie z raportami weryfikacji i wejściami (Pulpit, Katalog/marki, Narzuty,
   Atrybuty, Alerty, Waga, Analityka, Historia).
3. Nowa sekcja 10 Archiwum importów; przenumerowanie 11–13; Selly z drugim krokiem.
4. Sekcje zbiorcze: usunąć naprawione, dopisać nowe świadome różnice.
5. `docs/karty/PR.6/karta.md` — stan, dowiezione, „Do koordynatora” (przegląd do zamknięcia,
   pytanie 12.6 nieaktualne, wymagania stagingu).

## Testing strategy
Każde twierdzenie o zachowaniu sprawdzone z kodem develop (raporty researcherów z dowodami
`plik:linia`) + review subagentem pod tym kątem. Brak testów automatycznych (DOCS).

## Out of scope
Zmiany w `rebuild/`, `contract/`, roadmapie, `docs/pytania-do-ani-2026-09-18.md`.

## Definition of done
- [ ] Dokument opisuje stan develop, z sekcją Archiwum i numeracją 0–13.
- [ ] Wszystkie wejścia PR.6 uwzględnione.
- [ ] Sekcje zbiorcze bez rzeczy naprawionych.
- [ ] Karta PR.6 oznaczona jako zrobiona.
