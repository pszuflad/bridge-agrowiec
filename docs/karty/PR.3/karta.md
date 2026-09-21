# PR.3 — migracja typów alertów (`B??d` → `Błąd`, 435 wierszy)

> **Stan:** ⬜ gotowe
> **Iteracja:** przegląd 12 widoków · **Wpisy backlogu:** — · **Zależy od:** —
> **Ticket:** —

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Naprawa kodowania typów alertów w danych: `B??d` → `Błąd` (435 wierszy). Tickety 72 (P6.1) i 77
(P6.2) celowo tego nie ruszały — „dane naprawia PR.3”.

## Pliki (wyłączna własność)
Nowa migracja w `rebuild/schema/` (jeśli poprawka idzie migracją SQL, jak `006_nazwa_caps.sql`).

## Decyzje
⚠ **Numer migracji:** zajęte `007` i `008` (szczegóły: `wejscie-76.md`, `wejscie-77.md`) — następny
wolny to **`009`** (sprawdzone 2026-09-21 na `origin/develop`). Rezerwacja numeru TICKETA nie
rezerwuje numeru MIGRACJI: tuż przed pushem sprawdź `ls rebuild/schema/` na `develop` ORAZ pliki
`rebuild/schema/` na gałęziach otwartych PR-ów (kolizja `007` wyszła dopiero przed pushem P6.2).

## Dowiezione
—

## Do koordynatora
—
