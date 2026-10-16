# Podręcznik Bridge — rozdział 12: Partnerzy B2B

> Wersja robocza (2026-10-16). Konwencje: [rozdział 0](00-start-i-nawigacja.md).
> ⚠ To nowy, rozbudowany moduł. Ten rozdział jest **przeglądem na poziomie ekranów** — szczegółowe pola formularzy
> (formuły, kolumny pliku, tabele GEIS) opiszemy w osobnym rozdziale, jeśli ocenisz, że jest potrzebny.
> Ćwiczenia z ⚠ rób na środowisku testowym (**https://training.agroopony.eu**).

📍 **Jak tu wejść:** menu po lewej → **Partnerzy** (trzynasta, ostatnia pozycja od góry, ikona uścisku dłoni).

## Do czego służy

Moduł do przygotowywania **cenników w EUR dla partnerów B2B**. Każdy partner ma własne: magazyny, wykluczone produkty,
kraje z narzutami i kursami, tabele transportowe, kolumny pliku i harmonogram generowania.

## 1. Lista partnerów

Nagłówek „Partnerzy B2B" (podtytuł: „Partnerzy, którym Bridge generuje cenniki (EUR)…"). Pod nim:
- **Pole „Nazwa nowego partnera" + przycisk Dodaj partnera** (nad tabelą) — nowy partner jest **nieaktywny**.
- **Tabela:** Partner, Status (odznaka Aktywny/Nieaktywny), Harmonogram, Ostatnie generowanie (data + opis),
  a na końcu wiersza (po prawej): **Aktywuj / Dezaktywuj** i **Konfiguruj**.


**Lista partnerów**

![Lista partnerów](img/12-partnerzy.png)

1. Pole **Nazwa nowego partnera**
2. **Dodaj partnera**
3. **Aktywuj / Dezaktywuj**
4. **Konfiguruj** — ekran partnera

### ✍️ Ćwiczenia 12.1 ⚠ (środowisko testowe)
1. Menu po lewej → **Partnerzy**. Przejrzyj kolumny tabeli.
2. W polu „Nazwa nowego partnera" wpisz `Test Partner` i kliknij **Dodaj partnera**. Nowy wiersz ma status **Nieaktywny**.
3. Kliknij **Aktywuj** w jego wierszu — odznaka zmienia się na Aktywny. Kliknij **Dezaktywuj**, żeby cofnąć.
4. Kliknij **Konfiguruj** w jego wierszu.

## 2. Ekran partnera

📍 Lista partnerów → w wierszu (po prawej) **Konfiguruj**. Link **Wszyscy partnerzy** (u góry) wraca do listy.

Nagłówek „Partner: <nazwa>", pod nim karty jedna pod drugą:
- **Pasek aktywności** — odznaka Aktywny/Nieaktywny, **Aktywuj/Dezaktywuj** i **Generuj teraz** (tworzy pliki cennika;
  działa też dla nieaktywnego partnera, pliki trafiają do katalogu serwera, nie do partnera).
- **Ustawienia** — format pliku (np. XML wzorzec Ceneo), harmonogram, opcje wysyłki (FTP, e-mail) i **Zapisz ustawienia**.
- **Magazyny, z których eksportujemy** — zaznaczasz magazyny; **Zapisz magazyny**.
- **Wykluczone produkty** — lista wyłączeń; **Zapisz wykluczenia**.
- **Kraje, narzuty i kursy** — jeden blok na kraj (narzut, kurs); **Zapisz** na kraj i kosz do usunięcia kraju.
- **Tabele transportowe GEIS** — import tabel z pliku i edycja kosztów (**Zwiń / Edytuj**, **Zapisz tabelę**);
  **Podgląd kosztu przesyłki** (**Policz**).
- **Pola obliczeniowe** i **Kolumny pliku** — własne formuły i układ kolumn; **Zapisz pola**.
- **Podgląd pliku** — **Pokaż podgląd** liczy wynik bez tworzenia pliku; poniżej listy **Błędy** i **Ostrzeżenia**.
- **Logi operacji** (**Odśwież**) i **Błędy i ostrzeżenia** z ostatnich generowań.
- **Zamówienia od partnera** — **Odbierz teraz** / **Sprawdź ponownie**.

### ✍️ Ćwiczenia 12.2 ⚠ (środowisko testowe)
1. Na ekranie „Partner: Test Partner" zjedź kolejno przez wszystkie karty i odczytaj ich tytuły.
2. W karcie **Ustawienia** zmień jedno ustawienie i kliknij **Zapisz ustawienia**; odśwież stronę (F5) i sprawdź, czy zostało.
3. W karcie **Magazyny…** zaznacz jeden magazyn i **Zapisz magazyny**.
4. Zjedź do karty **Podgląd pliku** i kliknij **Pokaż podgląd**. Przeczytaj listy **Błędy** i **Ostrzeżenia**.
5. Wróć na górę do paska aktywności i kliknij **Generuj teraz** — odczytaj „Pozycji do eksportu" i listę plików.
6. Zjedź do **Logi operacji** i kliknij **Odśwież** — nowy wpis powinien się pojawić.

✅ *Umiesz, gdy:* potrafisz dodać partnera, otworzyć jego konfigurację, wygenerować plik i zajrzeć w logi.
