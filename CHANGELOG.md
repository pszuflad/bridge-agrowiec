# CHANGELOG

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
