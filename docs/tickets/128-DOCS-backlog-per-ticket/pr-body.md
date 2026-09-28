## Ticket
128-DOCS — backlog bez konfliktów: jeden plik na ticket

## Summary
`docs/rebuild-backlog.md` dostaje to samo rozwiązanie, które wcześniej zdjęło konflikty
z roadmapy i `spec-backend.md`: nowe wpisy idą do `docs/rebuild-backlog/wpis-<numer ticketu>.md`,
a identyfikator wpisu to `#<ticket>.<kolejny>`. Doszło narzędzie `tools/stan-backlogu.sh`,
żeby rozbicie na pliki nie utrudniło przeglądu.

## Problem / Motivation
Plik miał trzy punkty, w które dopisywały wszystkie karty naraz: koniec listy wpisów, bloki
`*Pominięte — triaż …*` i akapity podsumowań na górze. Dowód na to, jak to się kończy, jest
w samym pliku: blok ticketu 104 stoi przed blokiem ticketu 94, bo tak je poskładał git.
Osobno kolidowała numeracja — dwa równoległe triaże sięgały po ten sam „następny numer”.

## Solution
- `docs/rebuild-backlog/README.md` — reguła („oś podziału = PLIK”), numeracja `#<ticket>.<kolejny>`,
  szablon wpisu, sposób czytania, ścieżka wyjścia dla karty w toku, która zdążyła dopisać się
  na koniec starego pliku.
- Trzy **stałe** wskaźniki w `docs/rebuild-backlog.md` (góra pliku, przed blokami „Pominięte”,
  koniec listy) — zamiast miejsc do dopisywania.
- `tools/stan-backlogu.sh` — zestawienie z obu źródeł: `| Wpis | Data | Do nowej wersji? | Status |
  Etykieta | Plik |`; filtry: numer ticketu oraz `--do-decyzji` (to, na co czeka użytkownik).
- `.claude/commands/triaz-zmian.md` — triaż pisze wpisy i listę „Pominięte” do własnego pliku.
- `CLAUDE.md` — reguła dopisana przy punkcie 0, razem z roadmapą i `spec-backend`.

## Design decisions
- **Numeracja per ticket** zamiast ciągłej — kolizja numeru przestaje być możliwa, a nie tylko
  mniej prawdopodobna. Stare `#1`–`#108` zostają, odnośniki do nich są nadal ważne.
- **Historia nie jest przenoszona** — przenoszenie tekstu spod kart w toku dałoby dokładnie ten
  konflikt, któremu zmiana zapobiega (ta sama decyzja co przy `spec-backend`).
- **Wyjątek: `Do nowej wersji?` i `Status`** wolno zmienić w miejscu w cudzym wpisie — to jedna
  linia, a decyzja użytkownika i status wdrożenia muszą stać przy wpisie, nie obok niego.

## Tests
`tools/stan-backlogu.sh` na realnych danych: 109 wpisów, 14 z ⬜ (`--do-decyzji`), filtr po numerze
ticketu. Zestawy symboli dla decyzji i statusu są rozdzielone, bo komórka „Status” bywa cytatem
decyzji z ✅. Zmiana jest wyłącznie dokumentacyjno-narzędziowa: kod `rebuild/` nietknięty.

## Breaking changes
Zmiana procesu: triaż i tickety nie dopisują już do `docs/rebuild-backlog.md`.
Karta w toku, która zdążyła dopisać `### #N` na koniec, dostanie tam konflikt — rozwiązanie
opisane w `docs/rebuild-backlog/README.md` (przenieść do własnego pliku, przyjąć wersję `develop`).

## Follow-up
Brak.

## Review
Bez subagenta — zmiana dokumentacyjna + jeden skrypt, sprawdzona na realnych danych backlogu.

---
Ticket docs: `docs/tickets/128-DOCS-backlog-per-ticket/`
