# Ticket 184: Selly, nieaktualne mapowania i rozjazdy ceny bazowej

02.10.2026. Zlecenie Anny: naprawiać od razu, sprawdzić cały katalog, nie zmieniać cen produktów wielomagazynowych (decyzja 16:29 CEST).

## Wykonane operacje danych

- Po osobnej zgodzie poprawiono cenę bazową 523 z 752 na 20169 oraz 834 z 314 na 17901.
- Kolejna operacja: 50 aktywnych mapowań przeniesiono do potwierdzonych istniejących produktów i wariantów; 54 nieaktualne mapowania zachowano jako pełne JSON w `selly_products_quarantine_184`, usuwając z aktywnego cache.
- 42 mapowania wskazywały nieistniejące ID; 8 dotyczyło starych kart BKT z nowymi odpowiednikami. Cel sprawdzono przez EAN, nazwę, `provider_code`, kod aktualnego źródła Bridge i magazyn wariantu.
- Baza SQLite: backup WAL-safe `data/backups/data-prod_before_selly184_20261002141122.db`, `integrity_check=ok`.
- Brak zmian kolumn katalogu `products`, parserów i ustawień REST. `SELLY_TRYB=tylko-odczyt`, `SELLY_SCHEDULER=false` pozostają.
- Nie kasowano produktów Selly ani wariantów. Szczegóły operacji Selly, ceny i widoczność: wiki projektu oraz raport w plikach projektu, nie Bridge CHANGELOG.

## Przyczyna

`selly_products_old`: 523 było powiązane z obcym CEAT `MO110001661` za 752 zł, a 834 z GLOBE `MO2GLO00143` za 314 zł. Mapowania i czasy operacji `update_prices` odpowiadają historii pokazanej na zrzutach; pełnego historycznego żądania HTTP nie zachowano. Nowsza poprawna cena wariantu nie wyrównywała ceny bazowej produktu.

## Kod

- `src/selly/rest/bezpieczenstwo.ts`: przed zapisem odczytuje rzeczywisty cel. Wymaga zgodnego EAN lub znormalizowanej nazwy, rozróżnia DEMO, sprawdza ID produktu/wariantu i magazyn dostawcy. Brak danych lub błąd HTTP zatrzymuje zapis.
- `sync-delta.ts`: ochrona celu przed PUT; żywy SELECT statusu/ceny/stanu po odczycie HTTP. Po udanym PUT wariantu wyrównuje pole `price` produktu wyłącznie przy jednym wariancie i dodatniej cenie. Błąd PUT bazowej nie potwierdza snapshotu wysyłki.
- `sync-full.ts`: ochrona celu również przed aktualizacją metadanych; ponowna kontrola aktywności po HTTP. Cena bazowa jednego wariantu pochodzi z aktualnego wariantu Selly, nie z dowolnego dostawcy. Dla wielu wariantów payload nie zawiera ceny bazowej.
- `klient.ts`: typy rzeczywistych pól odczytu, w tym `variants`, EAN, nazwa, cena.
- `discovery.ts`: typ źródłowej nazwy. Nie przebudowywano algorytmu auto-create ani polityki kodów importu w tym ticketcie.

## Testy i ograniczenia

Lint, typecheck i build przeszły. Pełny backend: 133 pliki testów, 2110 testów zaliczonych, 7 pominiętych; 12 nowych testów sprawdza obcą oponę, DEMO, magazyn, przynależność wariantu, błąd HTTP, brak nadpisania ceny wielomagazynowej i błąd ceny bazowej.

Pełny odczyt 7398 szczegółów produktów trwa; nie twierdzimy na tym etapie, że wszystkie produkty zostały sprawdzone lub wszystkie kandydatury do scalania są potwierdzone. Analiza duplikatów uwzględnia znormalizowaną nazwę i EAN, ale sam zgodny EAN/nazwa nie uprawnia do utraty wariantów ani stanów. Dwa źródła mogą prawidłowo oferować tę samą oponę w różnych cenach.

Ta poprawka dotyczy zapisów REST Toru 1/2. Nie zmienia konfiguracji zewnętrznego importera CSV Selly; sprawdzenie skutków kolejnego importu jest osobnym dowodem, nie zastępują go testy na atrapie.
