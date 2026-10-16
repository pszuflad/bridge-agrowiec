# Podręcznik Bridge — rozdział 9: Historia i Archiwum importów

> Wersja robocza (2026-10-16). Konwencje: [rozdział 0](00-start-i-nawigacja.md).
> Oba ekrany **tylko pokazują** dane (Archiwum pozwala pobierać pliki) — ćwiczenia są bezpieczne także na produkcji.

---

# Część A — Historia

📍 **Jak tu wejść:** menu po lewej → **Historia** (dziewiąta pozycja od góry, ikona zegara).
Skrót: kafelek „Ostatni eksport CSV" na Pulpicie.

## Do czego służy

Dziennik zmian w katalogu: co, kiedy i kto zmienił. Zapisują się **importy**, **eksporty** i **edycje** (ręczne zmiany
produktów oraz akceptacje w kolejce Atrybutów). Historia nie pokazuje importów z adresów URL ani ręcznych
synchronizacji — tylko zmiany w katalogu.

## Jak wygląda ekran

- Nagłówek „Historia zmian".
- **Pasek filtrów:** szukajka („Szukaj po kodzie produktu, dostawcy lub treści zmiany…"), lista **Typ**
  (Wszystkie typy / Importy / Eksporty / Edycje) i lista **Dostawca**.
- **Tabela:** Data, Typ (kolorowa odznaka), Dostawca, Użytkownik, Pozycji (ile produktów dotyczy wpis), treść zmiany.
- **Na dole:** „Na stronie:" i przyciski stron — da się dojść do najstarszych wpisów (bez limitu).

### ✍️ Ćwiczenia 9A — Historia
1. Menu po lewej → **Historia**. Odczytaj kilka najnowszych wpisów.
2. Z listy **Typ** wybierz **Edycje**. Co widzisz? (Twoje zmiany z Katalogu, akceptacje z Atrybutów.)
3. Wróć do „Wszystkie typy" i z listy **Dostawca** wybierz jednego dostawcę.
4. W szukajce wpisz kod produktu, który ostatnio edytowałaś/eś w Katalogu. Czy wpis jest na liście?
5. Na dole zmień „Na stronie" na większą wartość i przejdź na ostatnią stronę.

✅ *Umiesz, gdy:* potrafisz odnaleźć, kto i kiedy zmienił dany produkt.

---

# Część B — Archiwum importów

📍 **Jak tu wejść:** menu po lewej → **Archiwum importów** (dziesiąta pozycja, ikona archiwum — tuż pod „Historią").

## Do czego służy

Tu leżą **surowe pliki od dostawców** (pobrane automatycznie, z adresu URL albo wgrane ręcznie z panelu). Przydaje się,
gdy chcesz **pobrać oryginał** cennika i porównać go z katalogiem.

## Jak wygląda ekran

1. Nagłówek „Archiwum importów", a w **prawym górnym rogu** przycisk **Odśwież**.
2. **Trzy listy filtrów:** **Dostawca**, **Miesiąc**, **Status** (OK / BŁĄD).
3. **Pasek zajętości archiwum** — ile miejsca zajęte z limitu, ile plików, ile dni pliki są trzymane.
4. **Tabela:** Data, Dostawca, (Źródło), Plik, Rozmiar, Rekordy, Status (OK/BŁĄD) i **ikona pobierania ⬇** na końcu wiersza
   (po prawej). Przy pliku ze statusem BŁĄD pod nazwą widać, co poszło nie tak.

> Listy Dostawca i Miesiąc pokazują tylko to, co jest na aktualnie przefiltrowanej liście — np. po wybraniu statusu BŁĄD
> zostaną w nich tylko dostawcy z błędami. To nie usterka.

### ✍️ Ćwiczenia 9B — Archiwum
1. Menu po lewej → **Archiwum importów**. Odczytaj pasek zajętości.
2. Z listy **Status** wybierz **BŁĄD**. Przeczytaj powód pod nazwą pliku. Wróć do wszystkich statusów.
3. Z listy **Dostawca** wybierz jednego dostawcę, a z **Miesiąc** — bieżący miesiąc.
4. Kliknij **ikonę ⬇** w wybranym wierszu (prawy koniec wiersza). Plik zapisze się w „Pobranych" **pod tą samą nazwą,
   którą miał u dostawcy**. Otwórz go.
5. Porównaj kilka pozycji z pliku z Katalogiem (wyszukaj kod w Katalogu).
6. Kliknij **Odśwież** (prawy górny róg) — lista wczyta się na nowo.

✅ *Umiesz, gdy:* potrafisz znaleźć i pobrać plik konkretnego dostawcy z konkretnego dnia.
