# PR.1 ⭐ — Archiwum importów: trzy trasy + widok z POBIERANIEM pliku

> **Stan:** ⬜ gotowe
> **Iteracja:** przegląd 12 widoków · **Wpisy backlogu:** — · **Zależy od:** —
> **Ticket:** —

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Jedyny w całym projekcie **czysty brak funkcji obecnej w produkcji** (`archive-injection.js`
+ `archive_module.cjs`, trzy trasy). Zakres doprecyzowany odpowiedzią Ani 12.1: używa archiwum do
porównywania, czy plik zgadza się z katalogiem, i do weryfikacji brakujących pozycji — więc widok
MUSI pozwalać pobrać plik, nie tylko pokazać listę.

## Pliki (wyłączna własność)
Nowe trasy archiwum + nowy widok — rozłączne ze wszystkim innym.

## Decyzje
**Świadomy wyjątek od kolejności** (5 → 6 → 7 → 9 → 10 → przegląd): warto puścić wcześniej, bo
rozłączna ze wszystkim innym.

## Dowiezione
—

## Do koordynatora
—
