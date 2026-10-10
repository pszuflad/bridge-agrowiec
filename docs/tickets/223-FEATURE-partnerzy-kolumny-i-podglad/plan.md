# 223 — kolumny pliku, pola obliczeniowe i podgląd (PRT-5.3a, backend)

Karta: `docs/karty/PARTNERZY/` · poziom 5 · zależy od 211, 215, 217. Przygotowuje ekran PRT-5.3.

## Zakres
- `PUT /api/partnerzy/:id/pola-obliczeniowe` `{pola:[{nazwa, formula}]}` — zastępuje zestaw; walidacja `sprawdzFormule` ze zmiennymi `zakup, stan, waga, dlugosc, szerokosc_paczki, wysokosc, cena_<KRAJ>` (kraje partnera); błędy z indeksem pola i pozycją znaku (`bledy[]`).
- `PUT /api/partnerzy/:id/kolumny` `{kolumny:[{nazwaWPliku, zrodloTyp: katalog|cena|pole, zrodlo}]}` — zastępuje zestaw; kolejność tablicy = kolejność kolumn. Walidacja: pole katalogu z białej listy, kraj należy do partnera, pole obliczeniowe istnieje, nazwy kolumn unikalne.
- `POST /api/partnerzy/:id/podglad` — to samo co generowanie, ale na pierwszych 20 pozycjach i **bez zapisu** (dysk, `partner_kursy`, logi); zwraca tekst plików, błędy, ostrzeżenia.
- Refaktor generatora: wspólny rdzeń `przygotujPliki` dla generowania i podglądu (zachowanie generowania bez zmian — testy 217/218/220 zielone). `SerwisPartnerow.podglad`.

## Reguły
- Kolejność zapisu w panelu: pola obliczeniowe → kolumny. Pole używane przez kolumnę nie może zniknąć (409). Usunięcie kraju (PRT-5.2) nie czyści kolumn `cena` tego kraju — generator zgłosi to jako błąd konfiguracji kolumn, a ekran 5.3 ma to pokazać.
- Trasy poza `openapi.yaml` (jak reszta `/api/partnerzy`).

## Zmiana zachowania produkcji
Brak — nowe trasy dla nowego modułu; istniejące endpointy bez zmian.

## Testy
`test/partnerzy.kolumny.test.ts` (15): walidacja pól i kolumn, kolejność, 409 dla używanego pola, podgląd bez skutków ubocznych, 503 bez serwisu.
