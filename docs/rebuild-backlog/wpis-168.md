# Backlog — wpisy ticketu 168 (`168-DOCS-pamiec-nazw-i-demo`) · 2026-09-30

### #168.1 · 2026-09-30 · [BACKEND][BAZA] · akceptacja: `nazwa_pamiec` może cofnąć nazwę z poprawki Marty (`manual_overrides`)

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-30 |
| **Kategoria** | BACKEND + BAZA |
| **Pliki** | `rebuild/backend/src/import/akceptacja.ts` (`applyNazwaPamiec` po zbudowaniu rekordu), `rebuild/backend/src/import/polityka/fabryka.ts:467-468`, `rebuild/backend/src/import/legacy/bridge_ext.cjs:189` |
| **Commit** | — |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — (hipoteza z czytania kodu; nie sprawdzona na danych produkcyjnych) |

**Opis biznesowy.** Ticket 164 wgrywa 174 poprawne nazwy opon (MO1/MO2/MO4/MO5/MO7/MO8), które
dzielą `kod_importu` z inną oponą tego samego dostawcy, jako poprawki Marty (`manual_overrides`,
klucz: dokładny produkt). Przyczyną sklejenia było `nazwa_pamiec` kluczowane po `kod_importu`.
Na imporcie poprawka wygrywa z pamięcią, więc w stagingu widać dobrą nazwę. **Przy akceptacji
pamięć nazw działa jeszcze raz, a poprawki nie** — jeśli grupa ma wpis w `nazwa_pamiec`,
do katalogu może trafić znów nazwa sklejona. Kolejny import znów pokaże zmianę w stagingu.

**Szczegół techniczny (dla rebuildu).** Kolejność i dowody: `docs/spec-backend/wpis-168c.md`.
Zachowanie akceptacji jest wiernym portem oryginału (scenariusz charakteryzacji
`pamiec-nazwy-nadpisuje-nazwe-z-pliku`), więc to NIE jest błąd portu, tylko luka w połączeniu
mechanizmów: pamięć (po `kod_importu`) i poprawki (po produkcie).

**Do sprawdzenia na bazie produkcyjnej przed decyzją:**
- czy `nazwa_pamiec` ma wpisy dla `kod_importu` z ticketu 164 (np. 326606, 395214);
- ile z 174 pozycji trafiło do stagingu po imporcie i jaką nazwę ma po akceptacji.

**Opcje (decyzja Ani).** (a) usunąć/zaktualizować wpisy `nazwa_pamiec` dla tych grup (zmiana
danych, bez zmiany kodu); (b) nakładać poprawki `manual_overrides` także w akceptacji, po
pamięci (zmiana zachowania względem produkcji); (c) zostawić — jeśli sprawdzenie pokaże, że
wpisów dla tych grup nie ma.

**Rekomendacja (moja).** Najpierw pomiar na bazie; jeśli wpisy są — (a), bo nie zmienia kodu
ani zachowania oryginału.

### #168.2 · 2026-09-30 · [BACKEND] · nazwa z „DEMO" na końcu, gdy kod dostawcy zawiera „demo"

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-30 |
| **Kategoria** | BACKEND |
| **Pliki** | `rebuild/backend/src/import/polityka/nazwa-demo.ts`, `parsuj.ts`, `polityka/fabryka.ts`, `akceptacja.ts`, `bulk.ts` |
| **Commit** | PR #205 (parsowanie), PR #210 (po pamięci nazw i poprawkach Marty); na `main` w #206 i #211 |
| **Do nowej wersji?** | ✅ **TAK** — decyzja Anny 2026-09-30 |
| **Status** | ✅ **wdrożone** — deploy `deploy-produkcja` po #211 zakończony sukcesem |

**Opis biznesowy.** Produkcja dopisywała „demo" do nazwy tylko wtedy, gdy słowo było w samej
nazwie z cennika. Teraz, gdy kod dostawcy zawiera „demo" (np. `M036506034TRdemo`), nazwa
kończy się „DEMO" — także dla produktów z wpisem w `nazwa_pamiec` i z poprawką `nazwa`.

**Skutek przy następnym imporcie.** Produkty demo, które w katalogu mają nazwę bez „DEMO",
wejdą do stagingu jako „zmiana nazwy" i wymagają akceptacji (w próbce MO3: 3 z 4 produktów
demo bez „DEMO" w nazwie były już w katalogu). Test charakteryzacji silnika wyłącza tę regułę
mockiem (porównuje z oryginałem); regułę pokrywają `nazwa-demo.test.ts` i
`nazwa-demo.silnik.test.ts`.

**Szczegół techniczny (dla rebuildu).** Korekta stoi za adapterem, nie w `legacy/`, bo
`src/import/legacy/` musi pozostać bajt-w-bajt kopią oryginału (test integralności portu).
