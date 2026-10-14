# Wpis do spec-backend od PR 413 (bez numeru ticketu) · 2026-10-14

**Sekcja:** integracja Selly — CSV i REST (Tor 1, Tor 2), koszt zakupu.

Numer `413` to numer PR (`fix/selly-purchase-contract-20261014`, wdrożony 2026-10-14 09:13 CEST,
commit produkcyjny `8a50415`), nie ticketu — ta praca nie miała ticketu. Źródło ustaleń: raport
„Bridge i Selly: poprawka cen zakupu przed wdrożeniem" (14.10) oraz log importu Selly z 13.10.

## Ustalone fakty

- **Selly ma DWA kanały zapisu cen i kosztów, niezależne od siebie.**
  1. REST z Bridge — Tor 1 (`HH:55`, `HH:10/25/40`) i Tor 2 (04:30, rotacja dni).
  2. Własny cron importu Selly z pliku CSV (`SELLY_CSV_URL`). Log z 2026-10-13: start 12:00,
     koniec 12:31 (31 min), „dodano 87, zaktualizowano 10675 (w tym 5339 wariantów), pominięto 0,
     ostrzeżeń 82". Ostrzeżenia dotyczyły wyłącznie zdjęć (404 i nieprawidłowy `.webp`), nie cen.
  Import CSV nadpisuje wartości ustawione przez REST, więc **plik CSV musi być aktualny i poprawny
  semantycznie**, inaczej cofa to, co zrobił REST.
- **Kolumna `Cena-zakupu` w CSV trafia do pola „Wariant: Cena zakupu" i oczekuje wartości BRUTTO.**
  Bridge trzyma koszt NETTO. Przed poprawką CSV niósł netto (np. 830,93), a Selly traktował to jako
  brutto (wariant: 675,55 netto / 830,93 brutto). Poprawka liczy brutto w eksporcie
  (`src/selly/koszt-zakupu.ts`, tylko kolumna `Cena-zakupu`): 830,93 × 1,23 = **1022,04**. Baza i
  parsery zostają netto — przeliczenie należy do granicy eksportu. W Selly NIE wolno włączać
  dodatkowego mnożnika 1,23 (VAT doliczony dwa razy).
- **Cena sprzedaży w Bridge była poprawna** (`floor(zakup × (1+narzut) × (1+VAT))`, np.
  830,93 × 1,06 × 1,23 → 1083). Rozjazd dotyczył kosztu zakupu i odświeżania pliku, nie formuły ceny.
- **Odświeżanie CSV.** Wcześniej plik był regenerowany tylko po imporcie zmieniającym
  *dostępność* (wstrzymanie/przywrócenie; `fabryka.ts`, flaga `dostepnoscZmieniona`) albo ręcznie
  (`POST /api/selly/generate-csv`, `npm run selly:csv`). Dostawca bez stanów (MO1 Bohnenkamp: stan
  opon `null`, `mo1_bohnenkamp.cjs:135`) zmienia prawie wyłącznie ceny, więc jego import nie
  odświeżał pliku, a import Selly pobierał starą kopię. Od PR 413 cicha aktualizacja importera,
  która zmienia koszt, sprzedaż albo stan, zgłasza odświeżenie CSV (po transakcji; nie w trybie
  `reconcileOnly`). NIE obejmuje to każdej innej ścieżki edycji (np. ręczne i stagingowe zmiany
  ceny), a harmonogram pobrania przez Selly się nie zmienił.
- **Koszt produktu głównego (`price_purchase`) vs wariant.** Kontrakt REST wariantu nie ma pola
  kosztu, więc REST nie może go poprawić; wariant aktualizuje wyłącznie CSV. Przy kilku wariantach
  w Selly albo kilku aktywnych ofertach Bridge wspólnego `price_purchase` NIE ustawiamy (jedna
  oferta nadpisałaby koszt pozostałych). Tor 2 ma tę samą ochronę. Zwykły PUT ceny/stanu nie
  nadpisuje już `cena_zakupu_wyslana` (wysłanie ceny sprzedaży nie potwierdza wysłania kosztu).
- **Przełączniki (w kodzie domyślnie `false`):**
  `SELLY_CSV_KOSZT_BRUTTO` — na produkcji `true` od 14.10;
  `SELLY_KOSZT_PRODUKTU_JEDNEGO_WARIANTU` — na produkcji celowo `false` (zbiorcza naprawa
  kosztów produktu głównego przez API nie została uruchomiona).
- **Pomiar na produkcji po wdrożeniu:** CSV opublikowany 09:14:21, 5359 aktywnych ofert,
  60 kolumn; zmieniło się 5359 komórek zakupu i zero komórek poza tą kolumną. Opona kontrolna
  `MO1_15231071` (EAN 8903635013211, produkt Selly 5088, wariant 5865): CSV `MO115231071` →
  1022,04 brutto; Bridge nadal 830,93 netto, sprzedaż 1083, stan 8.

## Niepotwierdzone (nie traktować jako faktów)

- Efekt importu Selly o 12:00 po wdrożeniu — nie zweryfikowany; dopiero odczyt wariantu 5865
  (oczekiwane 830,93 netto / 1022,04 brutto) to potwierdzi.
- Znaczenie jednostki `price_purchase` produktu głównego w panelu (netto czy brutto) — nie ustalone;
  produkt 5088 miał 919,94, nie wiadomo, skąd ta kwota.
- Hipoteza z analizy kodu: Tor 1 dla MO1 może w każdym cyklu dosyłać całą ofertę, bo `stan` jest
  `null`, a warunek wyboru zawiera `sp.stan_wyslany IS NULL` (`sync-delta.ts`, `findDeltaProducts`).
  Nie sprawdzone na danych; skutek to obciążenie i dłuższe cykle, nie błędna wartość ceny.
- Próba zapisu kosztu w rzeczywistym Selly nie została wykonana.

Powiązane: `docs/rebuild-backlog/wpis-413.md`, `docs/spec-backend/wpis-139.md` (montaż dostępności
i odświeżanie CSV).
