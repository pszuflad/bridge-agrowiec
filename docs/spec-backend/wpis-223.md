# Wpis 223 — kolumny pliku, pola obliczeniowe i podgląd partnera

Ticket `223-FEATURE-partnerzy-kolumny-i-podglad` (PRT-5.3a). `PUT /api/partnerzy/:id/pola-obliczeniowe` i `/kolumny` zastępują zestawy w całości (transakcja) po walidacji
(formuły: składnia + znane zmienne, błędy z pozycją; kolumny: biała lista pól katalogu, kraj partnera, istniejące pole, unikalne nazwy). `POST /api/partnerzy/:id/podglad` zwraca
pierwsze 20 pozycji jako tekst plików bez zapisu na dysk, w `partner_kursy` i w logach. Generator ma wspólny rdzeń `przygotujPliki` (`generujPlikiPartnera` + `podgladPartnera`).
