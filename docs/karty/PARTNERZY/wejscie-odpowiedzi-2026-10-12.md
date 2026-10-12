# PARTNERZY — decyzje użytkowniczki z 2026-10-12 (odpowiedzi A–G, 46 pytań)

Stan: zapis ustaleń, **nie** zaimplementowane. Numeracja = numeracja pytań. Nie zawiera haseł ani danych klientów.

## Pliki i FTP
1. Układ katalogów zostaje obecny. 2. Nazwy plików: `adtyres_agrowiec_<kraj>.csv`, `tyreworld_agrowiec.csv`.
3–4. Zamówienia idą z serwera partnera (`customer/orders` → `done`); nazwy plików nadają partnerzy (np. `2026-103176690.xml`).
5. Folder `marketplace` (prawdopodobnie Ceneo/XML) — do sprawdzenia później.
6–7. Protokół FTP; konta i struktura już przygotowane, każdy partner ma własne konto.
8. Nagłówki z końcową spacją — niewymagane.
9. Stary system wyłączony; pliki stoją od 06.10.2026.
10, 18. Co 60 min nowy plik z bazy katalogu trafia na serwer (jak dziś CSV dla Selly).
33. Archiwum do miesiąca wstecz, **jeden plik na dzień** (najnowszy zastępuje starszy).

## Ceny
11. Narzuty ustawia użytkowniczka, osobno na kraj. 12. Paliwo/myto/pakowanie ~15 EUR „per dostawca" (do doprecyzowania).
13. Kurs: NBP lub ręczny — panel musi pokazywać aktualnie używany kurs. 14. Paliwo Geodis ustawia użytkowniczka (dziś 44%), myto 9,92.
15. Eksport wszystkich magazynów oprócz MO8, MO7, MO6. 16. Kolumny jak w obecnych plikach. 17. Zaokrąglenie do 2 miejsc.
19. Koszty dodatkowe w EUR, tylko status „aktywny". 20. Transport: cały kraj. 21. Reguły cen / min. opłacalność: ta sama hierarchia co „narzuty i promocje".
22. Partnerzy aktywni od początku (data początkowa).

## Numeracja
23. Numer katalogowy = `<EAN>-<numer dostawcy>` (np. `745384925-M04`). 24. Schemat KK PP NNNNN nieużywany. 25. Mapowanie producentów nie obowiązuje.

## Zamówienia
30. Oboje partnerzy wrzucają zamówienia na serwer. 31. EUR, netto. 32. Przyjmujemy wszystkie, handlowiec weryfikuje ręcznie (brak kontroli tolerancji ceny).
34. Bez powiadomień do partnera. 35. Cały import zamówienia 1:1 do Selly/Bridge; użytkowniczka sprawdza, anuluje/dzwoni. 36. Numer zamówienia nadaje Selly.
37–40. Skrzynki na naszym serwerze, hasła wpisuje użytkowniczka, bez rotacji. 41–42. Bez testów na środowisku testowym; odbiór e-mail od razu na produkcji.
43. Selly `POST /api/orders` — wg badania możliwe; wymaga weryfikacji na sklepie testowym (nie tworzyć zamówień na żywym).
45–46. Format pliku trackingu nieznany (folder pusty); operator w Bridge wpisuje numer przewoźnika po nadaniu.

## Wpływ na obecną implementację
- Numer katalogowy `EAN-dostawca` zmienia kolumnę CatNumber i `znajdzPozycjeKatalogu`.
- Koszty dodatkowe: PLN → EUR. Walidacja zamówień ma być informacyjna (nie blokuje).
- Archiwum: dziś kopia przy każdej generacji → ma być 1/dzień.
- Ryzyko: aktywny partner z narzutem 0 opublikowałby ceny zakupu → blokada generacji do czasu ustawienia narzutu.
