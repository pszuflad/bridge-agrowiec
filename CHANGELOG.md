# CHANGELOG

2026-10-02 16:18
obszar: backend | baza danych

pliki: rebuild/backend/src/selly/rest/bezpieczenstwo.ts (nowy), discovery.ts, sync-delta.ts, sync-full.ts, src/selly/klient.ts, test/gate/selly-atrapa.ts, test/selly.bezpieczenstwo.test.ts (nowy), test/selly.sync-delta.test.ts, test/selly.sync-full.test.ts; kopie .bak przed edycją źródeł: /tmp/bridge-backups-184/{discovery.ts,sync-delta.ts,sync-full.ts,klient.ts,selly-atrapa.ts,CHANGELOG.md}.bak. Poprzednie testy w Git acb2faf. Produkcyjna baza: /home/admin/private_apps/bridge-prod/data/data-prod.db; backup data/backups/data-prod_before_selly184_20261002141122.db.

zmiana: ticket 184 — sprawdzenie tożsamości produktu (EAN lub nazwa, ochrona DEMO), przynależności wariantu i magazynu przed PUT Toru 1/2; cena bazowa wyrównywana wyłącznie dla jednego dodatniego wariantu, bez arbitralnej ceny wielowariantowej. Operacja danych: 50 mapowań naprawionych; 54 nieaktualne mapowania zachowane w selly_products_quarantine_184 i usunięte z aktywnego cache. Bez zmian katalogu products/parserów. Zmiany danych Selly dokumentowane wyłącznie w wiki.

powód: Anna zleciła natychmiastową naprawę i pełny audyt produktów; błędne dawne mapowania powodowały ceny obcych produktów, a aktualizacja wariantu nie wyrównywała ceny bazowej.

2026-10-02 08:27
obszar: backend

pliki: docs/tickets/183-BUG-agrorami-transport/raport.md, CHANGELOG.md; kopia CHANGELOG.md: /tmp/bridge-backups-183/CHANGELOG.md.bak; wersja raportu przed uzupełnieniem: Git 80d33dd.

zmiana: dopisano wynik wdrożenia 183 (8f5b9d6), udany import MO9 08:22:57, dodatkowy test 929 rekordów / 0 błędów / complete=true. API dostawcy odzyskało działanie już 08:14 przed wdrożeniem, więc nie przypisujemy ustąpienia upstream Internal server error wyłącznie zmianom Bridge.

powód: rzetelny raport powdrożeniowy dla użytkowniczki.

2026-10-02 08:00
obszar: backend

pliki: rebuild/backend/src/import/agrorami-worker.cjs (nowy), src/import/parsuj.ts, src/import/synchronizuj.ts, scripts/copy-parsery.mjs; kopie: /tmp/bridge-backups-183/{parsuj.ts,synchronizuj.ts,copy-parsery.mjs,CHANGELOG.md}.bak

zmiana: ticket 183 — MO9: parametr store przeniesiony z URL do nagłówka Store; timeout API 120 s i 2 ponowienia (sieć, 429/5xx, GraphQL Internal server error); proces asynchroniczny z limitem 600 s; alert bez stack trace i sekretów. Legacy parser/mapowanie nietknięte.

powód: prośba użytkowniczki 02.10; powtarzające się timeouty logowania Agrorami, po udanym logowaniu API products zwraca Internal server error. Niekompletny cennik nie jest importowany.

Wpisy od najnowszego. Migracje danych: z nazwą backupu (`VACUUM INTO …bak_full_<operacja>_<RRRRMMDDGGMMSS>` w `data/backups/`).

## 2026-10-01 — Naprawa kolejki stagingu (SPEC „Naprawa kolejki stagingu”)

- **182 · import** — `parsuj.ts`: meta kompletności cennika zdejmowana przed `zastosujDemoWNazwie` (jej `.map()` gubił `_bridgeFeedMeta`).
  Powód: od 30.09 każdy import był „niekompletny” — karty wstrzymane automatycznie nie wracały (31 kart MO4/MO5 z towarem), nieobecności nie liczone.
- **181 · migracja danych/Selly** — `scal-karty-auto`: `--zeruj-selly` i `--usun-duplikaty-selly` pomijają wariant Selly nadal mapowany
  przez aktywną kartę (`ostatni_blad = "pominięto: wariant współdzielony…"`). Powód: na produkcji 272 z 273 wierszy archiwum wskazuje wariant karty R.
- **180 · import/migracja danych/Selly** — `polityka/ean-dostawcy.ts`: EAN Handlopexu (MO4/MO5) z oznaczeniem partii (`…DO`, `…_D`, `…W2`)
  i ze złą cyfrą kontrolną traktowane jako prawidłowe; `slowniki/modele-producenta.ts`: zapis producenta (Trelleborg, Cultor, Mitas, LingLong);
  `scal-karty-auto`: duplikaty AUTO ze stanem 0 usuwane z Bridge i z Selly (`--usun-duplikaty-selly`), para bez oferty bierze stan z karty A;
  klient Selly `deleteVariant`/`deleteProduct`; migracja `020`. Powód: decyzje Ani 2026-10-01 (3 błędne EAN-y MO5, 30 kart „kilka kart AUTO”).
- **179 · import/synchronizacja** — `synchronizuj.ts`: timeout 120 s, 2 ponowienia co 120 s (AbortError, sieć, 5xx), blokada per dostawca;
  `fabryka.ts`/`tolerancja-dopasowania.ts`: próg „podejrzanie mały” od ostatniego udanego importu, lista do 20 brakujących kodów;
  nowa trasa `POST /api/dostawcy/:kod/akceptuj-mniejszy-cennik` + przycisk na karcie dostawcy; migracja `019` (tabela `supplier_feed_blocked`,
  reset `max_item_count = last_item_count`). Powód: AbortError MO3/MO5/MO4 i trwała blokada MO4 (244 przy minimum 249).
- **178 · import/normalizacja** — `polityka/normalizacja-pozycji.ts` (po parserze): dopiski osi, HS/LS Continentala, LingLong, DOT `NN`/`WWYY`,
  konstrukcja, ucięte indeksy; `kluczModelu` w porównaniach; `npm run normalizuj-katalog` (backup `bak_full_normalizacja_*`). Powód: ~40 błędów
  „Oznaczenie wskazuje inną oponę” i niespójny katalog.
- **177 · migracja danych** — `npm run scal-karty-auto` (dry-run, `--apply` z backupem `bak_full_scal_auto_*`, `--zeruj-selly`); migracja `018`
  (`products_scalone`, `selly_products_scalone`). Powód: 263 zgłoszenia „Brak starego kodu…” po zmianie 172 i zamrożony stan 3647 szt. na kartach AUTO.
- **176 · import** — `fabryka.ts`/`tolerancja-dopasowania.ts`: powrót wstrzymanej karty bez porównywania DOT; pusta cecha oferty to brak informacji.
  Powód: 48 zgłoszeń „Powrót opony wymaga sprawdzenia…”.
