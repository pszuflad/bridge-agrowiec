# 214 — selekcja pozycji eksportu i wycena partnera (PRT-3.1)

Karta: `docs/karty/PARTNERZY/` · poziom 3 · zależy od 208 (model), 213 (kalkulator).

## Zakres
`src/partnerzy/selekcja.ts`: `wybierzPozycje(db, partnerId)` (wybór pozycji katalogu do pliku) i `wycenPozycje(...)` (cena w EUR na kraj przez kalkulator).
Bez migracji, tras i zapisu plików (to 3.2–3.4).

## Reguły (z karty)
- Jedna pozycja katalogu = jeden wiersz, **bez agregacji magazynów**; wspólny `kod_importu` w różnych magazynach zostaje osobnymi wierszami.
- Tylko magazyny wybrane dla partnera; bez wykluczonych produktów (`partner_wykluczenia`, po `products.kod`); stan ≥ `stan_min` partnera (domyślnie 2).
- Czyszczenie tekstu (przycięcie, zwinięcie białych znaków) — defekty plików wzorcowych (spacje w nazwach/kodach) nie wracają.
- Odczyt z **jawną projekcją** pól; nie używamy mappera flag `boolean` z `products` (patrz `CLAUDE.md`, pułapka `'Tak'` w kolumnach flagowych) — te flagi nie trafiają do wyboru.
- Wycena: kurs per kraj podaje wywołujący (raz na plik, z `kursEur`); pozycja niewyceniona dla kraju dostaje `null` + wpis w `bledy`. To szablon (3.2) decyduje, czy wiersz bez ceny wypada (plik na kraj) czy zostaje z pustą komórką (jeden plik z kolumnami krajów).

## Założenia do potwierdzenia
- Do pliku idą tylko produkty `status = 'aktywny'` (jak w eksporcie CSV do Selly) i z dodatnią ceną zakupu. Karta tego wprost nie mówi — jeśli partner ma dostawać także produkty wstrzymane, to zmiana jednej linii.

## Zmiana zachowania produkcji
Brak — nowy moduł, nikt go jeszcze nie woła (tylko odczyt tabeli `products`). Nazw produktów nie dotyka.

## Testy
`test/partnerzy.selekcja.test.ts` — filtry magazynów/stanu/wykluczeń/statusu/ceny, brak agregacji, czyszczenie tekstu, wycena wielokrajowa z błędami i ostrzeżeniami.
