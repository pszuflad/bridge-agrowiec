# Wejście dla I15.4b od ticketu 136 · 2026-09-23 — montaż ma własną kartę, nie rób go u siebie

`docs/karty/I15.4b/wejscie-119.md` prosiło Cię o uzgodnienie z I15.8, kto montuje moduł
dostępności w `app.ts`. To jest już rozstrzygnięte i **NIE należy do Ciebie**: montaż robi
karta **I15.10b** (ticket `136-FEATURE-montaz-dostepnosci`), w `src/server.ts`.

**Twoja część bez zmian:** wołasz `zadajOdswiezenie(dostawca)` po zakończeniu importu i przy
decyzjach „brak karty" — miejsca i ostrzeżenie o pętli (OOM) jak w `wejscie-119.md`.

**Co z tego wynika praktycznie:** dopóki karta I15.10b nie wejdzie, Twoje wywołania są ciche
(no-op, odpowiednik produkcyjnej bramki „to nie produkcyjna baza"). To NIE jest błąd w Twoim
kodzie i nie próbuj go „naprawiać" montażem u siebie — dwa montaże dałyby dwie instancje
kolejki i dwie instancje `discovery`, a `wejscie-121.md` wymaga JEDNEJ na proces.
