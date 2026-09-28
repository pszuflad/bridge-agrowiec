# Wejście dla TEST.1 od ticketu 151 (I15.9) · 2026-09-24 — delta I15 gotowa, czytaj ją PRZED tym dokumentem

`docs/instrukcja-testow-I15.md` jest gotowa (11 punktów do sprawdzenia + sprostowania +
sekcja „Do Twojej decyzji"). Ania czyta ją PRZED `instrukcja-pelnego-testu.md`. Nie powtarzaj
opisu zmian z I15 wymienionych w jej rozdziale 1 — odeślij do niej linkiem.

## Co z delty jest istotne dla tego dokumentu

- **Kolumna „Blokowane formy płatności" w `/katalog` pokazuje NUMERY identyfikatorów Selly**
  (np. dla MO1: `203, 204, 205, … 219`), **nie nazwy form płatności**. Mapy numer→nazwa nie ma
  nigdzie w repo. Nie powtarzaj błędu, który wszedł do `docs/karty/I15.9/wejscie-122.md`
  (przykład „Płatność odroczona, Kredyt kupiecki" jest zmyślony — złapany dopiero recenzją
  ticketu 151).
- **W `/katalog` NIE MA filtra „Zastosowanie"** — jest filtr **„Kategoria"**. Pole `zastosowanie`
  nie jest też w polach szukajki, więc szukajka go nie znajdzie. Polecenie: filtr Kategoria +
  oglądanie kolumny „Zastosowanie" (domyślnie widoczna).
- **Pliku CSV nie da się pobrać z panelu** — powstaje na serwerze o 6:00, Selly zabiera go
  o 12:00. Sprawdzenie zawartości CSV to krok poza UI (ścieżka krytyczna, TEST.2), nie sekcja
  panelu w tym dokumencie.
- **Przyciski na ekranie Selly** („Test dry-run (5 szt.)", „Wyślij do Selly") to ręczna wysyłka
  JEDNEGO dostawcy przez `POST /api/selly/sync-supplier` — **nie** uruchamiają torów harmonogramu
  (dzienny/nocny 04:30). Nie opisuj ich jako „Tor 1"/„Tor 2".
- ⚠ `POST /api/selly/sync-supplier` z `dry_run=false` realnie zapisuje do cudzego sklepu Selly —
  nie każ Ani klikać „Wyślij do Selly" na stagingu „na próbę".

## Sześć decyzji Ani czeka w rozdziale 4 delty

Godzina synchronizacji Selly (04:30), środa vs. inny dzień dla MO5+MO6, brak przycisków ręcznych
dla torów harmonogramu, pusty ekran „Braki w cenniku" (co pokazać, gdy nic nie czeka), niewidoczne
dowody kompletności importu, numery zamiast nazw form płatności (4.6, nowa po recenzji). Odpowiedzi
mogą zmienić zakres tego dokumentu (np. jeśli Ania zechce nazwy form płatności, potrzebna będzie
od niej lista numer→nazwa, bo w systemie jej nie ma).
