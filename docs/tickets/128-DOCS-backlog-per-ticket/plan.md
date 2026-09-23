# 128-DOCS — backlog bez konfliktów: jeden plik na ticket

> Status: Implemented
> Branch: `docs/128-backlog-per-ticket`

## Ticket description
`docs/rebuild-backlog.md` regularnie konfliktuje przy równoległych kartach. Zastosować to samo
rozwiązanie, które zadziałało przy roadmapie (`docs/karty/`) i specyfikacji (`docs/spec-backend/`).

## Context — gdzie dokładnie konfliktował ten plik
Trzy punkty zbiorowego dopisywania, każdy w tym samym miejscu dla wszystkich kart:
1. koniec listy wpisów (każdy triaż dokłada `### #N` na końcu, dziś #108);
2. bloki `*Pominięte — triaż …*` — dowód na merge: blok ticketu 104 (linia 989) stoi PRZED
   blokiem ticketu 94 (linia 993), bo tak je poskładał git;
3. akapity podsumowań na górze („Partia #72–#83 ROZSTRZYGNIĘTA…”, „#31–#35 WDROŻONE…”).

Do tego kolizja numeracji: dwa równoległe triaże brały ten sam „następny numer”.

## Decisions
- **Oś podziału = plik**, jak w `docs/spec-backend/README.md` — `docs/rebuild-backlog/wpis-<N>.md`,
  `N` = numer ticketu (unikalny przez rezerwację katalogu w `docs/tickets/`).
- **Identyfikator wpisu `#<ticket>.<kolejny>`** (`#131.1`) zamiast ciągłej numeracji — kolizja
  numeru przestaje być możliwa. Stare `#1`–`#108` zostają bez zmian, odnośniki dalej ważne.
- **Historia nie jest przenoszona** — przenoszenie tekstu spod kart w toku dałoby ten sam konflikt,
  któremu ta zmiana zapobiega (ta sama decyzja co przy `spec-backend`).
- **Wyjątek na edycję w miejscu:** linie `Do nowej wersji?` i `Status` w cudzym wpisie wolno
  zmienić — to jedna linia, a decyzja użytkownika i status wdrożenia muszą być przy wpisie.
- **Narzędzie zamiast czytania całości** — `tools/stan-backlogu.sh` scala widok z obu źródeł,
  bo rozbicie na pliki utrudnia przegląd „co czeka na decyzję”.

## Implementation plan
1. `docs/rebuild-backlog/README.md` — reguła, numeracja, szablon, czytanie, ścieżka dla kart w toku.
2. Trzy stałe wskaźniki w `docs/rebuild-backlog.md` (góra / przed blokami „Pominięte” / koniec pliku).
3. `tools/stan-backlogu.sh` — tabela: wpis, data, decyzja, status, etykieta, plik; filtry
   `<numer ticketu>` i `--do-decyzji`.
4. `.claude/commands/triaz-zmian.md` — kroki 2b, 3 i 5 piszą do własnego pliku ticketu.
5. `CLAUDE.md` — reguła przy punkcie 0 (roadmapa / spec-backend / backlog razem).

## Testing strategy
`tools/stan-backlogu.sh` na realnych danych: 109 wpisów rozpoznanych, 14 z ⬜ przez `--do-decyzji`,
filtr po numerze ticketu, poprawne odczytanie decyzji i statusu (osobne zestawy symboli, bo
komórka „Status” bywa cytatem decyzji z ✅).

## Out of scope
- Przenoszenie wpisów `#1`–`#108` do nowych plików (świadomie, patrz Decisions).
- Zmiana formatu tabeli wpisu — zostaje 1:1.

## Definition of done
- [x] Reguła opisana tam, gdzie jej szuka następna sesja (README katalogu + CLAUDE.md + triaz-zmian)
- [x] `docs/rebuild-backlog.md` ma stałe wskaźniki i nie ma już miejsca „dopisz na końcu”
- [x] Narzędzie daje przegląd całości bez czytania wszystkich plików
