# 224 — panel partnerów: pola obliczeniowe, kolumny pliku i podgląd (PRT-5.3)

Karta: `docs/karty/PARTNERZY/` · poziom 5 · zależy od 222 (strona konfiguracji), 223 (trasy backendu).

## Zakres (frontend, strona `/partnerzy/:id`)
- **Pola obliczeniowe:** lista (nazwa + formuła), dodawanie i usuwanie, zapis `PUT …/pola-obliczeniowe`. Błędy formuł z odpowiedzi 400 (`bledy[]`) pokazane przy właściwym polu z numerem znaku; edycja pola zdejmuje komunikat. Podpowiedź składni i zmiennych (w tym `cena_<KRAJ>` dla krajów partnera).
- **Kolumny pliku:** nazwa w pliku, typ źródła (pole katalogu / cena kraju / pole obliczeniowe), źródło (lista zależna od typu), przesuwanie w górę/w dół, dodawanie, usuwanie, zapis `PUT …/kolumny`. Kolumna wskazująca nieistniejące źródło (np. usunięty kraj) jest oznaczona „źródło nie istnieje”.
- **Podgląd:** `POST …/podglad`; tekst plików w `<pre>`, listy błędów i ostrzeżeń (do 20 pozycji + „… i N kolejnych”), komunikat przy 503 i przy braku plików.

## Reguły
- Kolejność pracy: najpierw zapisz pola obliczeniowe, potem kolumny, które się do nich odwołują (źródła kolumn bierze z ZAPISANYCH pól i krajów).
- Lista pól katalogu we froncie (`POLA_KATALOGU`) jest kopią białej listy backendu; backend i tak odrzuci inne pole.

## Zmiana zachowania produkcji
Brak — nowe sekcje strony nowego modułu; backend bez zmian.

## Testy
`test/partnerzy.kolumny.test.tsx` (15) + dopasowana fikstura `partnerzy.konfiguracja.test.tsx`. Frontend: lint, typecheck, build, testy zielone.
