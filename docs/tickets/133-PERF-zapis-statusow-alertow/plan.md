# 133-PERF — zapis statusów alertów porcjami (ODŁOŻONY)

> Status: **Odłożony — nie uruchamiać bez wyzwalacza**
> Założony: 2026-09-23 przy tickecie `132-CHORE-limity-testow`, decyzją użytkownika
> („wariant A teraz, wariant B jak będą problemy”)

## Wyzwalacz — kiedy ten ticket ma ruszyć

Uruchom, gdy **budżet czasu zostanie przekroczony na WOLNEJ maszynie**, czyli gdy CI albo
lokalny bieg pokaże:

```
::warning::czas-testow: poza budżetem — paczka równa limitowi 20 000 id: <ponad 45> s …
```

i `load average` w czasie biegu był niski (na CI to domyślny stan). Drugi, równorzędny
wyzwalacz: zgłoszenie od użytkownika panelu, że masowe oznaczanie alertów „trwa długo”.

**Nie uruchamiaj**, gdy warning pojawia się tylko przy kilku równoległych sesjach agentów —
to obciążenie maszyny, nie regresja kodu (pomiary w `132-CHORE-limity-testow/plan.md`).

## Problem (gdyby wyzwalacz zadziałał)

`ustawStatusyKatalogu()` (`rebuild/backend/src/repos/alerty-katalogu.ts:106-140`) wykonuje
w jednej transakcji **osobny `insert(...).onConflictDoUpdate(...)` na każdy wiersz**. Przy
paczce 20 000 identyfikatorów to 20 000 zapytań budowanych i wykonywanych pojedynczo.
Dziś kosztuje to ~3–5 s na wolnej maszynie, czyli mieści się w normie — ale skaluje się
liniowo i jest wrażliwe na obciążenie.

## Proponowany zakres

1. Zmierzyć stan wyjściowy (`console.time` albo bieg z budżetem) — bez pomiaru nie zaczynamy.
2. Zamienić pętlę na wstawianie porcjami (np. po 500 wierszy, `values([...])` z jednym
   `onConflictDoUpdate`) albo na ponownie używane zapytanie przygotowane.
3. Pilnować semantyki: dziś zostaje **ostatni** odcisk dla powtórzonej pary (produkt, reguła) —
   test `paczka równa limitowi 20 000 id` tego pilnuje i musi zostać zielony bez zmian asercji.
4. Zmierzyć po zmianie, zaktualizować `zmierzone_s` w `rebuild/backend/test/budzety-czasu.json`
   i obniżyć budżet, żeby dalej pilnował czegoś sensownego.

## Czego NIE robić

- Nie zmniejszać paczki w teście do „ładniejszej” liczby — 20 000 to zadeklarowany limit trasy
  (`MAKS_ID_W_ZADANIU`) i test ma pokrywać właśnie granicę.
- Nie podnosić dalej limitu czasu zamiast naprawy — od tego jest ten ticket.
