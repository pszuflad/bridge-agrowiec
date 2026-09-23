# Wejście dla TEST.2 od ticketu 151 (I15.9) · 2026-09-24 — delta I15 gotowa, czytaj ją PRZED tym dokumentem

`docs/instrukcja-testow-I15.md` jest gotowa (11 punktów do sprawdzenia + sprostowania +
sekcja „Do Twojej decyzji"). Ania czyta ją PRZED `instrukcja-testu-sciezki-krytycznej.md`. Nie
powtarzaj opisu zmian z I15 wymienionych w jej rozdziale 1 — odeślij do niej linkiem.

## Co z delty jest istotne dla tego dokumentu

- **Kolumna „Blokowane formy płatności" w `/katalog` pokazuje NUMERY identyfikatorów Selly**
  (np. dla MO1: `203, 204, 205, … 219`), **nie nazwy form płatności**. Mapy numer→nazwa nie ma
  nigdzie w repo. Nie powtarzaj błędu z `docs/karty/I15.9/wejscie-122.md` (przykład „Płatność
  odroczona, Kredyt kupiecki" jest zmyślony — złapany dopiero recenzją ticketu 151). Skoro TEST.2
  porównuje zawartość CSV, sprawdź tam też: kolumna `Blokowane-formy-platnosci` w pliku ma tę
  samą postać (numery, przecinki), nie nazwy.
- **W `/katalog` NIE MA filtra „Zastosowanie"** — jest filtr **„Kategoria"**; `zastosowanie` nie
  jest w polach szukajki.
- **Pliku CSV nie da się pobrać z panelu** — powstaje na serwerze o 6:00, Selly zabiera go
  o 12:00. To dokładnie odcinek 3 waszego zakresu („Eksport → plik CSV") — delta odsyła całość
  weryfikacji zawartości CSV do TEST.2, nie opisuje jej u siebie.
- **Przyciski na ekranie Selly** („Test dry-run (5 szt.)", „Wyślij do Selly") wysyłają JEDNEGO
  dostawcę przez `POST /api/selly/sync-supplier` — **nie** uruchamiają torów harmonogramu
  (dzienny/nocny 04:30). Nie mylić z przepięciem produkcyjnym opisanym w waszym odcinku 5.
- ⚠ `POST /api/selly/sync-supplier` z `dry_run=false` realnie zapisuje do cudzego sklepu Selly.

## Trzy tematy, które delta zostawia u siebie samo „jest teraz tak" i odsyła do was — rozpiszcie je w całości

- **MO9** — import z Agro-Rami przez API (GraphQL, `AGRORAMI_EMAIL`/`AGRORAMI_PASSWORD`). Delta
  tylko potwierdza, że jest testowalny na stagingu (dane logowania uzupełnione 24.09), bez
  scenariusza „import przechodzi, stany sensowne, ile pozycji".
- **Staging v2** (przycisk „Rozstrzygnij", blokada błędnego EAN) — delta ma tylko sprostowanie
  („EAN naukowy nie jest już pusty" zastępuje starą obietnicę), bez scenariusza testowego.
- **CSV dla Selly** — delta tylko wspomina o istnieniu 60. kolumny i pełnych nazwach kategorii;
  cały dowód (generowanie, zawartość, porównanie ze starym generatorem) to wasz odcinek 3–4.

## Sześć decyzji Ani czeka w rozdziale 4 delty

Godzina synchronizacji Selly (04:30), środa vs. inny dzień dla MO5+MO6, brak przycisków ręcznych
dla torów harmonogramu, pusty ekran „Braki w cenniku", niewidoczne dowody kompletności importu,
numery zamiast nazw form płatności (4.6, nowa po recenzji). Odpowiedzi mogą zmienić zakres tego
dokumentu, zwłaszcza 4.6 — jeśli Ania zechce nazwy form płatności zamiast numerów, wpłynie to na
to, co pokazuje CSV w waszym porównaniu ze starą wersją.
