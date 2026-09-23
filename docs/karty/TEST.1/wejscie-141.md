# Wejście dla TEST.1 od ticketu 141 (karta DEC.1) · 2026-09-23

**Trzy rzeczy, które Ania zobaczy podczas pełnego testu i może zgłosić jako błąd.**
Wszystkie są ZNANE, zmierzone i świadomie odłożone po cutover (decyzja użytkownika 2026-09-23:
„co da się zrobić po cutoverze — robimy po cutoverze"). Taniej uprzedzić ją w instrukcji niż
naprawiać przed wdrożeniem — ale jeśli TEST.1 ich nie wymieni, wrócą jako zgłoszenia i będą
kosztować rundę wyjaśnień w najgorszym momencie.

Forma zgodna z poleceniem Ani z 2026-09-22 (`docs/karty/I15.9/wejscie-104b.md`): krótko,
na punkt, bez ściany tekstu.

---

### 1. `/atrybuty`, rodzaj „bieznik" — cztery bieżniki widoczne podwójnie
**Co zobaczy:** `FLOTATION T422` i `Flotation T422`, `LOGGER KING TRS-2` i `Logger King TRS-2`,
`MAGLIFT LIP` i `Maglift LIP`, `MG121 PROWADZĄCA` i `MG121 prowadząca` — 8 wierszy zamiast 4.
**Dlaczego:** migracja `010_marka_caps.sql` objęła marki (`products.marka` i słownik rodzaju
`marka`), ale **nie** słownik rodzaju `bieznik`. `PanelWartosci.tsx` listuje słownik bez
deduplikacji.
**Status:** backlog `#98` pkt 2, 🕒 po cutoverze. Zmierzone: 4 pary przy 1665 wartościach.
**Uwaga:** `MG121 PROWADZĄCA` ma polski znak — `UPPER()` w SQLite jest ASCII-only, więc
automatyczne złączenie par wymaga innego podejścia niż przy markach (zob. `CLAUDE.md`).

### 2. Karta 4.4 „Sezonowy wzorzec cen" — `Alliance` i `ALLIANCE` jako dwie marki
**Co zobaczy:** dla miesiąca **07** dwa osobne wiersze tej samej marki, z różną średnią ceną.
**Dlaczego:** `sezonowoscMiesieczna()` (`rebuild/backend/src/repos/analityka.ts:1507-1521`) robi
`GROUP BY miesiac, marka` na surowym `historia_cen.marka`, a migracja `010` świadomie nie ruszała
historii („dziennik stanu w chwili rejestracji", komentarz `010_marka_caps.sql:24-26`).
Zmierzone: `Alliance` 953 wiersze, `ALLIANCE` 650; zakresy dat nakładają się w lipcu.
**Status:** backlog `#98` pkt 3, 🕒 po cutoverze.
**Uwaga dla TEST.1:** uzasadnienie w samym wpisie backlogu („ma znaczenie dopiero, gdy grupowanie
po marce dostanie UI") jest **obalone** — to UI istnieje od 2026-09-04, czyli sprzed wpisu.

### 3. Karta 4.1 „Historia dostępności" — kilka pozycji z niewłaściwym EAN-em i zawyżonym %
**Co zobaczy:** przy dokładnym sprawdzaniu — 9 pozycji, w których EAN nie pasuje do reszty
wiersza, oraz procenty dostępności policzone z podwójnie liczonych migawek.
**Dlaczego:** `dostepnoscProduktow` (`analityka.ts:1398,1404`) bierze gołe `h.ean` obok
`GROUP BY h.dostawca, h.kod`, a `COUNT(*)` liczy surową historię. Defekt odziedziczony
po produkcji, odsłonięty dopiero przez P10.1 (wcześniej karta była trwale pusta, `#32`).
Zmierzone: 9 par z >1 EAN-em, 30 grup / 67 wierszy zdublowanych migawek.
**Status:** backlog `#94`, 🕒 po cutoverze. Naprawa gotowa koncepcyjnie (CTE
`HISTORIA_BEZ_DUPLIKATOW_KLUCZA`), ~0,5 dnia, i **nie wymaga przenagrania fixture'a**.

---

**Czego NIE trzeba jej mówić:** śmieci w polu marki (`21x7.00-15`, `18x8.50-8`, po 1 produkcie)
**nie wychodzą** do filtrów katalogu — `listaMarek()`
(`rebuild/frontend/src/pages/katalog/filtrowanie.ts:152-163`) odrzuca wartości zawierające cyfrę.
Ania ich nie zobaczy, więc nie ma o czym pisać.

**Pytanie, na które TEST.1 powinien zebrać odpowiedź przy okazji:** backlog `#89` — kratka
„Czy brak pola «priorytet» w formularzu reguły Ci przeszkadza?" (`docs/instrukcja-testow-I4-v2.md`
§6.3) wisi bez odpowiedzi od 2026-09-19. Skala dziś zerowa (`markups` = 1 wiersz z domyślnym
priorytetem, `promotions` = 0), więc to pytanie na przyszłość, nie blokada.
