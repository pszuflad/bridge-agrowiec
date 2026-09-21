# 80-DOCS-instrukcja-testow-i9-v2 — delta instrukcji testów I9 dla Ani (karta P9.2)

> Status: Approved (zakres i format narzucone promptem karty; decyzje otwarte niżej)
> Branch: `docs/80-instrukcja-testow-i9-v2`
> Worktree: `.worktrees/80-DOCS-instrukcja-testow-i9-v2`

## Ticket description

P9.2 — delta instrukcji testów Wagi gabarytowej dla Ani (`docs/instrukcja-testow-I9-v2.md`),
w formacie „Zgłosiłaś → Jest teraz → Sprawdź” (decyzja użytkownika z 2026-09-18). Stary
`docs/instrukcja-testow-I9.md` dostaje tylko banner. Roadmapa: P9.2 zrobiona, Iteracja 9
zamknięta, pytanie o progi palety jako otwarte po stronie Ani.

## Context

- Warunek startu spełniony: P9.1 (ticket 76, PR #92) i P9.1b (ticket 84, PR #97) w develop.
  P9.1b powstała, bo przy pierwszym starcie tej karty wyszło, że P9.1 nie zrobiła mocniejszego
  okna dla wybranego przewoźnika (prośba Ani z §3.11).
- Ticket 80 jest kartą z okresu przejściowego `docs/karty/README.md` (worktree sprzed ticketu 82)
  — kończy po staremu, w roadmapie.
- Źródła odpowiedzi Ani: PDF I9 (§3.11, §3.13 — cytaty w prompcie), runda 2 z 2026-09-21
  (backlog #27, #28). Odpowiedź 9.1 nie ma zapisanego cytatu — tylko wybrany wariant
  „każdy zalogowany”, więc instrukcja opisuje decyzję, nie cytuje.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Brak — ticket DOCS, nie dotyka `rebuild/` ani `contract/`. Twierdzenia instrukcji weryfikowane
z kodem na develop (`rebuild/frontend/src/pages/WagaGabarytowa.tsx`,
`pages/waga-gabarytowa/{TabelaPrzewoznikow,KalkulatorPaletowy}.tsx`,
`rebuild/backend/src/waga-gabarytowa/formula.ts`, `repos/config.ts`).

## Decisions

- Format delty jak I4-v2/I5-v2: rozdziały „Zanim zaczniesz”, „Zgłosiłaś”, „Zdecydowałaś”,
  „Co przestało być prawdą”, „Podsumowanie”, „Jak zgłosić”.
- Liczby kalkulatora paletowego policzone prawdziwą funkcją `obliczWageGabarytowa` na ustawieniach
  z `db/snapshot.db` (55 / 80 / 10 / 0.000167): 50×60×25 → 21.042 kg; 70×60×25 → 28.056 kg.
- Pytania otwarte do użytkownika: patrz sekcja w raporcie (ramka mocnego okna „przeliczy wynik”).

## Implementation plan

1. `docs/instrukcja-testow-I9-v2.md` — nowy plik.
2. `docs/instrukcja-testow-I9.md` — banner na górze (wzorzec I5), treść bez zmian.
3. `docs/rebuild-roadmap.md` — P9.2 ✅, Iteracja 9 zamknięta, pytanie o progi palety w tabeli
   „Po stronie użytkownika — decyzje, które zostały” (jako otwarte po stronie Ani).
4. `raport.md`, review (reviewer sprawdza każde twierdzenie z kodem).

## Testing strategy

Brak testów automatycznych (DOCS). Weryfikacja: liczby paletowe wywołaniem prawdziwej formuły
(tsx + kopia `db/snapshot.db`); teksty UI cytowane z kodu znak w znak; review z kodem.

## Out of scope

Zmiany kodu (w tym tekstu okien), `docs/rebuild-backlog.md`, `docs/karty/`, inne instrukcje.

## Definition of done

- [ ] I9-v2 w układzie delty, cytaty Ani znak w znak, zero żargonu technicznego.
- [ ] Banner w I9.
- [ ] Roadmapa: P9.2 ✅, Iteracja 9 zamknięta, pytanie o progi otwarte.
- [ ] Review bez BLOCKER-ów; PR do develop.
