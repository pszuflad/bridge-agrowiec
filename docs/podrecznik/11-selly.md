# Podręcznik Bridge — rozdział 11: Selly

> Wersja robocza (2026-10-16). Konwencje: [rozdział 0](00-start-i-nawigacja.md).
> ⛔ **Na produkcji ten ekran steruje żywym sklepem Selly.pl.** „Wyślij do Selly" tworzy i zmienia produkty w sklepie
> i **nie da się tego cofnąć z panelu**. Ćwicz tylko na środowisku testowym (**https://training.agroopony.eu**),
> gdzie integracja jest **celowo wyłączona**; produkcyjnych ćwiczeń tu nie ma.

📍 **Jak tu wejść:** menu po lewej → **Selly** (dwunasta pozycja od góry, ikona otwartego pudełka).

## Do czego służy

Integracja Bridge ze sklepem Selly.pl: codzienny plik CSV, który Selly pobiera, wysyłka produktów przez API,
automatyczne usuwanie z Selly i historia tych operacji.

## Jak wygląda ekran

Nagłówek „Integracja Selly.pl", a pod nim **siedem kart jedna pod drugą** (bez zakładek — przewijasz w dół):
1. **Status połączenia** — czy Bridge łączy się z Selly (✓ Połączono).
2. **Codzienna synchronizacja CSV** — status pliku CSV, przycisk **Wygeneruj CSV teraz**, link **Pobierz / podgląd CSV ↗**.
3. **Mapowanie dostawców** — tabela: Dostawca / W Bridge / W Selly / Błędy.
4. **Sync dostawcy** — wysyłka produktów jednego dostawcy.
5. **Usuwanie z Selly** — stan automatycznego usuwania (np. „Działa — nie ma czego usuwać").
6. **Usunięte z Selly** — lista usuniętych (z przyciskiem **Pobierz CSV** — cała historia).
7. **Historia operacji** — dziennik wysyłek i generowań z przyciskami filtra rodzaju, szczegółami i „Pokaż więcej".

> **Na środowisku testowym** zobaczysz komunikat **„Integracja Selly wyłączona na tym środowisku"** — to poprawne.
> Sekcje czytające dane lokalne (status pliku CSV, mapowanie, historia) działają normalnie.
> Nie myl tego z **Wygeneruj CSV teraz** — ten przycisk **działa** i plik po nim powstaje.

## 1. Plik CSV

📍 Druga karta od góry — **„Codzienna synchronizacja CSV"**.

Plik jest generowany codziennie o 6:00 i pobierany przez Selly. Kryterium „OK": plik wygenerowany **dzisiaj** i niepusty.
W tabeli statusu: **Status**, **Ostatnia synchronizacja** (z liczbą minut temu), **Liczba produktów w pliku**, **Rozmiar pliku**.
Czerwony napis „✗ Błąd synchronizacji — plik nieaktualny lub pusty" oznacza, że plik jest stary.

### ✍️ Ćwiczenia 11.1 (środowisko testowe)
1. Menu po lewej → **Selly**. Odczytaj kartę **Status połączenia**.
2. Zjedź do karty **Codzienna synchronizacja CSV**. Zapisz „Ostatnia synchronizacja" i „Liczba produktów w pliku".
3. Kliknij **Wygeneruj CSV teraz**, przeczytaj pytanie, potwierdź. Poczekaj kilkanaście sekund na „✓ Wygenerowano…".
4. Sprawdź, że data w „Ostatnia synchronizacja" się zmieniła.
5. Kliknij **Pobierz / podgląd CSV ↗** i obejrzyj plik.

## 2. Mapowanie i Sync dostawcy

Karta **Mapowanie dostawców** pokazuje, ile pozycji danego dostawcy jest w Bridge, a ile w Selly.
Karta **Sync dostawcy** zawiera: listę **Dostawca**, pole **Limit (0=wszystko)**, haczyk „tylko zmienione od ostatniego
syncu" oraz dwa przyciski: **Test dry-run (5 szt.)** (próbny przebieg bez zmian w sklepie) i **Wyślij do Selly**
(prawdziwa wysyłka, z potwierdzeniem „Wysłać produkty do Selly?"). Wynik pokazuje: Utworzono, Zaktualizowano, Pominięto, Błędy.

### ✍️ Ćwiczenia 11.2 — tylko oglądanie
1. Przejrzyj kartę **Mapowanie dostawców** i porównaj kolumny „W Bridge" i „W Selly".
2. W karcie **Sync dostawcy** wybierz dostawcę z listy i przeczytaj opcje. **Nie klikaj „Wyślij do Selly"** na produkcji.
3. Na środowisku testowym kliknij **Test dry-run (5 szt.)** — dostaniesz komunikat o wyłączonej integracji.

## 3. Usuwanie i historia

- **Usuwanie z Selly** — pokazuje stan automatycznego usuwania; statusy: „Działa — nie ma czego usuwać",
  „Działa — usunięto produkty", „Sieroty pominięte (kontrola tożsamości)", „Wstrzymane bezpiecznikiem", „Wyczerpany limit dobowy",
  „Brak uprawnień…", „Błąd przebiegu".
- **Usunięte z Selly** — tabela: Kiedy, Kod, Nazwa, EAN, Dostawca, Akcja, Selly (produkt / wariant). **Pobierz CSV** pobiera całą historię.
- **Historia operacji** (ostatnia karta): rząd przycisków rodzaju operacji, tabela (Data, Operacja, Dostawca, Błąd, Skip, Status)
  i **ikona Szczegóły** na końcu wiersza — pokazuje przyczyny błędów lub co dokładnie usunięto. **Pokaż więcej (N starszych)** na dole.

### ✍️ Ćwiczenia 11.3 — historia
1. Zjedź na sam dół do karty **Historia operacji**.
2. Kliknij przyciski filtra rodzaju operacji i obserwuj listę.
3. Przy wpisie z liczbą błędów kliknij **Szczegóły** i przeczytaj przyczyny.
4. Kliknij **Pokaż więcej**, jeśli jest.
5. Karta **Usunięte z Selly** → **Pobierz CSV** i otwórz plik.

✅ *Umiesz, gdy:* sprawdzasz, czy plik CSV jest dzisiejszy, i wiesz, że „Wyślij do Selly" jest operacją na żywym sklepie.
