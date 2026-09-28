# Wejście dla TEST.1 od ticketu 145 (koordynator) · 2026-09-24 — PRIORYTETY testu (decyzja użytkownika)

**Decyzja użytkownika 2026-09-24.** Instrukcja pełnego testu ma być uporządkowana według ryzyka biznesowego,
nie według ekranów. Kolejność i waga:

## ⭐ Ścieżka główna — bez niej nie przełączamy (80% uwagi Ani)

1. **Import od dostawców → parsery → baza.** Dla każdego z dziesięciu dostawców: czy plik/API w ogóle
   przychodzi, czy liczba pozycji się zgadza, czy dane w katalogu wyglądają poprawnie (rozmiar, marka,
   bieżnik, EAN, cena, stan). Trzy drogi dostarczania — `url` (MO2, MO3, MO4, MO5, MO9), `mail`
   (MO1, MO7, MO8, MO10) i `upload` (MO6) — mają w instrukcji osobne, KRÓTKIE scenariusze.
   **MO9 to jedyny dostawca z API** (Agro-Rami/BKT) — sprawdzenie osobno, bo nie da się go wywołać plikiem.
2. **Eksport → plik CSV → Selly → sklep.** Czy plik powstaje (cron o 6:00 albo polecenie ręczne), czy Selly
   go zaciąga (o 12:00) i czy zmiany faktycznie widać w sklepie. Do tego dwa tory API: aktualizacja cen
   i stanów w ciągu dnia oraz nocna pełna synchronizacja.
   ⚠ Na stagingu Selly jest WYŁĄCZONE (`SELLY_TRYB=wylaczony`) — napisz wprost, co Ania sprawdzi na stagingu
   (powstanie pliku, jego zawartość), a co dopiero po przełączeniu na produkcji (zaciągnięcie przez sklep,
   tory API). Nie udawaj, że da się to sprawdzić wcześniej.

## Reszta — niższy priorytet (20%)

Panel administracyjny i pozostałe ekrany (alerty, atrybuty, analityka, waga gabarytowa, archiwum, konto):
krótka lista kontrolna „wejdź, sprawdź że działa i wygląda sensownie", bez rozpisanych scenariuszy.
Podstawą zostaje `docs/przeglad-12-widokow.md` — nie przepisuj go, odeślij do niego.

## Forma

Bez zmian: polecenie Ani z 22.09 — na punkt „co zmieniliśmy → polecenie → rezultat", bez ściany tekstu,
rozbieżności do osobnej sekcji „Do Twojej decyzji".
