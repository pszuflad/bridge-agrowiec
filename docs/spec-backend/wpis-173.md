# Wpis 173 — importer: pozycja czekająca w stagingu nie rusza katalogu; „DOT” w modelu; nazwa karty zostaje

> Ticket 173 (2026-10-01). **Odstępstwo od produkcji — decyzja użytkowniczki.** Dotyczy
> `import/polityka/fabryka.ts` i `import/polityka/tolerancja-dopasowania.ts`
> (`wstrzymujeKandydatowPrzyNiejednoznacznosci`, `oczyscModelZDot`, `zachowajNazweKarty`).

1. **Brak wstrzymywania kart przy niejednoznaczności.** Produkcja przy `_matchIssue` (kompletna oferta)
   wstrzymywała karty-kandydatów i zerowała ich stan. Teraz pozycja czekająca na decyzję NIE zmienia katalogu
   (u dostawcy towar jest). Karty już wstrzymane wcześniej wracają dopiero po zaakceptowanym dopasowaniu.
   Nie dotyczy przeglądu nieobecności („stara karta”) — osobna ścieżka, bez zmian.
2. **Samo „DOT” w modelu/bieżniku.** Parser wycina tylko `DOT <liczba>`; MO9 pisze „(DOT)”, więc model
   BKT miał `XL GRIP DOT`. Importer czyści słowo z `model` i `bieznik` (`XL GRIP`).
3. **Nazwa karty zostaje**, gdy różni ją od nazwy z oferty wyłącznie słowo „DOT” lub `×`/`x`.
   Każda inna różnica nazwy nadal idzie do akceptacji.

Charakteryzacja 1:1 z oryginałem (`silnik.charakteryzacja`, `silnik.polityka-zrodla`) mockuje te funkcje na
zachowanie produkcji.

**Nie ruszone — użytkowniczka (2026-10-01) zdecydowała, że zmiana niepotrzebna:** model Continentala `CONTI HYBRID HS5` → `CONTI HYBRID 5` powstaje w
`legacy/parsers/adapter.cjs` (`TECH_MARK_RE` wycina „HS” z „HS5”, bo lookahead wyklucza tylko litery).

4. **Rozstrzygnięcie człowieka nie zatrzymuje produktu** (`rozstrzygnijIZatwierdz` → `zatwierdzPozycjeZPolityka(…, true)`).
   Produkcja po akceptacji zostawiała kartę wstrzymaną bez znacznika automatycznego (wstrzymanie „ręczne”)
   jako `wstrzymany` ze stanem 0 — stan z pliku ginął. Przy „Rozstrzygnij” tego już nie robimy: karta dostaje
   stan i status z oferty. Zwykłe „Zaakceptuj” i import dalej chronią ręczne wstrzymanie.

5. **DOT wpisany ręcznie w „Rozstrzygnij”** nie jest trwałą poprawką — kolejny import ustawia DOT z pliku (decyzja 2026-10-01: zostaje tak, jak jest).
