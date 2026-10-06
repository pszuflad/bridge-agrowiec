# 186-FEATURE-selly-usuwanie-sierot — Code review

> Reviewed: 2026-10-05
> Branch: claude/clever-turing-w6da6a
> Diff: 13 plików (+772/-6), 1 commit (03f5148). Przeczytane: `sync-usuwanie.ts` w całości, diff `scheduler.ts`, `env.ts`, `server.ts`, `historia/mapowanie.ts`, testy `selly.usuwanie.test.ts`; porównanie z `bezpieczenstwo.ts` (`sprawdzCelSelly`), `discovery.ts` (zapis mapowań), `scal-karty-auto.ts`, `rozdzielKodImportu.ts`. Bramek nie uruchamiałem (ufam raportowi: 2159 testów zielonych).

## BLOCKER

- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:370-373` (+ `:218-322`) — lista sierot liczona jest RAZ na początku przebiegu, a w `usunJedna` stan „brak produktu w Bridge” nie jest sprawdzany ponownie tuż przed `DELETE`.
  - Reason: między `znajdzSieroty` a `deleteProduct` jest do 20 sekwencyjnych wywołań HTTP (GET produktu, ewentualnie GET wariantów, limiter, retry) — to minuty, w których import, akceptacja stagingu, ręczne dodanie albo `scal-karty-auto` mogą przywrócić produkt (albo przepiąć mapowanie `kod_importu`/`bridge_kod`). Wtedy usuwamy z żywego sklepu produkt, który „wrócił”. Operacja nieodwracalna, a poprawka tania.
  - Suggestion: tuż przed `deleteVariant`/`deleteProduct` (synchronicznie, bez `await` między sprawdzeniem a wywołaniem DELETE nie da się, ale sprawdzenie po ostatnim GET zawęża okno do jednego żądania) ponownie odczytaj wiersz `selly_products` po `id` i wykonaj ponownie predykaty z `CZESC_SELECT` + `wariantUzywanyPrzezZywe` dla tego jednego wiersza; przy zmianie → `pominieto`. Dodać test: produkt wraca w trakcie przebiegu (np. przez hook w atrapie `getProduct`).

- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:281-296, 298-312` — mapowanie z `selly_variant_id = NULL` omija wszystkie kontrole wariantu/magazynu i trafia do `deleteProduct`, jeśli nie ma innych wierszy `selly_products` dla tego produktu.
  - Reason: `innePozostaja` liczy `warianty.filter(...)` (wszystkie warianty różne od `null` = wszystkie), ale gałąź `s.selly_variant_id != null && innePozostaja` jest wtedy fałszywa i leci `else if (inneMapowania === 0)` → kasujemy cały produkt Selly razem z wariantami innych magazynów (także tych, których Bridge nie mapuje, np. założonych ręcznie). Kolumna jest nullable w schemacie, a Tor 1 takich wierszy nie obsługuje (wymaga wariantu), więc to wiersze „legacy” — dokładnie te, o których nic nie wiemy. Brak także weryfikacji magazynu, bo blok `if (s.selly_variant_id != null)` jest pomijany.
  - Suggestion: dla `selly_variant_id IS NULL` nie usuwać nic (`pominieto`, powód „mapowanie bez wariantu”), albo usuwać produkt tylko gdy `warianty.length === 0`. Dodać test.

## SHOULD-FIX

- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:260-263` — tożsamość produktu w Selly jest słabsza niż przy zapisie (`sprawdzCelSelly`, ticket 184): tam wymagana jest DODATNIA zgodność EAN-u lub nazwy (+ zgodność „DEMO”), tu odrzucamy tylko, gdy znamy EAN w obu miejscach i się różni. Nazwa nie jest porównywana w ogóle; gdy w `historia_cen` nie ma EAN-u (albo Selly nie ma EAN-u), jedyną kontrolą są `product_id` + `variant_id` + magazyn. Definition of done („bezpiecznik jak przy zapisie”) jest więc spełniony tylko częściowo.
  - Reason: ticket 184 powstał, bo cache ID bywa wskazówką, nie dowodem. Przy kasowaniu całego produktu (jedyny wariant) słabsza kontrola niż przy zapisie ceny jest nielogiczna.
  - Suggestion: gdy znamy nazwę z `history`/`products_scalone` i Selly ma nazwę — porównać (ta sama normalizacja co `nazwa()` w `bezpieczenstwo.ts`, plus „DEMO”); niezgodność → `pominieto`. Rozważyć też `ean` z `products_scalone.wiersz_json` jako źródło poza `historia_cen`. Świadomie opisać w raporcie, co robimy, gdy nie mamy żadnej danej do porównania.

- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:316-322, 394-396` — brak atomowości DELETE w Selly / mapowanie / audyt. Kolejność: `DELETE` w Selly → `DELETE FROM selly_products` → (dopiero w pętli) `zapiszHistorie`. Wyjątek z `zapiszHistorie` (np. SQLITE_BUSY przy równoległym imporcie) nie jest łapany — wylatuje z `usunSierotyZSelly`, wpis `selly_sync_log` zostaje `w_trakcie`, reszta sierot nie jest przetwarzana, a skasowany produkt nie ma śladu w Historii (mapowanie już zniknęło, więc następny przebieg go nie zobaczy). Podobnie wyjątek z `usunMapowanie()` po udanym DELETE daje wpis „błąd”, a przy następnym przebiegu 404 → historia mówi „już nie istniał”, tracąc fakt i czas faktycznego usunięcia.
  - Reason: decyzja użytkownika to „dokładnie który produkt i o której godzinie”; to jest jedyna gwarancja, której nie wolno zgubić przy częściowej awarii.
  - Suggestion: zapis audytu + usunięcie mapowania w jednej transakcji SQLite zaraz po sukcesie DELETE; `zapiszHistorie` w `try/catch` (błąd → `console.error` i wpis w `selly_sync_log`), a `zamknijLog` w `finally`. Dodać test na awarię zapisu po udanym DELETE.

- [ ] `rebuild/backend/src/selly/rest/scheduler.ts:236-239` — brak ochrony przed nakładaniem się przebiegów Toru 3 (i z Torem 2 o 04:30). Tor 1 + Tor 3 startują co 15 min bez blokady wzajemnej; przy wolnym Selly (limiter, 20 DELETE + GET) następny tick potrafi ruszyć, gdy poprzedni Tor 3 jeszcze trwa. Dwa równoległe przebiegi biorą te same sieroty: drugi dostaje 404 i zapisuje do Historii duplikat „już nie istniał”, a przy wyścigu na `GET` → `DELETE` mogą rozjechać się decyzje wariant/produkt (`innePozostaja` liczone z nieaktualnego GET). Tor 2 (04:30, długi) działa równolegle z Torem 3 z ticków 04:25/04:40.
  - Suggestion: flaga „w toku” w module (jak `wTrakcie` w `import/synchronizuj.ts`) — drugi przebieg wraca od razu; rozważyć pomijanie Toru 3, gdy trwa Tor 2.

- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:352-366` — bezpiecznik zbiorczy jest dwustronnie zawodny.
  - (a) Zawyżony zaległy zapas sierot (>30% mapowań) zablokuje usuwanie NA ZAWSZE: nic nie zmniejsza licznika, brak progu konfigurowalnego i brak ścieżki „zatwierdzam, usuń” — a raport sam zakłada, że na produkcji sierot z przeszłości mogło się nazbierać.
  - (b) Przy 29% sierot (np. po „Usuń nieopony” albo awarii jednego dostawcy: ~1500 z 5400 mapowań) bezpiecznik nie reaguje i system bez człowieka w pętli kasuje po 20 co 15 min (~480/dobę); nie ma limitu dobowego ani raportu „dziś usunięto N”.
  - (c) Throttling `WSTRZYMANIE_CISZA_GODZIN` zwraca `null` bez żadnego sygnału — jedyny ślad to jeden wpis na 6 h, bez powiadomienia; użytkownik może nie wiedzieć, że usuwanie od tygodnia stoi.
  - Suggestion: dodać limit dobowy (np. ≤100) oprócz limitu na przebieg; udostępnić próg w env (`SELLY_USUWANIE_MAKS_UDZIAL`) albo jednorazowy ręczny „puszczalnik”; w stanie wstrzymania logować `console.warn` przy każdym ticku (tylko wpis do bazy throttlować).

- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:89-94` — predykat sieroty jest konserwatywny w jedną stronę (dobrze), ale zakłada, że `products.kod` ≡ `selly_products.bridge_kod` i że EAN siedzi w `historia_cen` pod starym kodem. Produkt, który zmienił kod I kod_importu (scalenia ręczne, `napraw-nazwy`) i nie ma wiersza `historia_cen` pod starym kodem, nie jest chroniony — a po zmianie kodu nowa karta i tak zostanie założona w Selly przez Tor 2 jako nowy produkt, więc stare mapowanie to realnie duplikat, ale nie mamy na to dowodu poza EAN-em. Warto sprawdzić też EAN z `products_scalone.wiersz_json` i `selly_products_scalone`. Dla `scal-karty-auto` (obie ścieżki: przepięcie wiersza na R albo przeniesienie do `selly_products_scalone` + `DELETE FROM selly_products`) — OK, Tor 3 widzi tylko `selly_products`, więc wiersze archiwum są bezpieczne, a `usunDuplikatySelly` (ticket 180) działa osobno; nie ma kolizji.
  - Reason: dla „ofert wspólnych” (jeden produkt, wiele wariantów) zabezpieczenie jest poprawne (`wariantUzywanyPrzezZywe`, `inneMapowania`, test „produkt wspólny”) — ale `inneMapowania` liczy także inne SIEROTY, więc dwie sieroty tego samego produktu w jednym przebiegu przechodzą przez „usuń wariant”, potem „usuń produkt” (kolejność zależna od `ORDER BY id`) — działa, lecz nie jest przetestowane.

- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:299-319` — wynik `apiWithRetry` dla `DELETE` jest ignorowany. `apiWithRetry` po wyczerpaniu retry ZWRACA `{status: 429, ...}` zamiast rzucać (komentarz w `discovery.ts:153-171` mówi, że to martwy kod, bo `KlientSelly` rzuca `BladSelly`, ale to kontrakt niejawny). Gdyby zwrot `status===429` jednak wystąpił (zmiana klienta, atrapa), kod uzna to za sukces, usunie mapowanie i zapisze w Historii usunięcie, którego nie było.
  - Suggestion: po wywołaniu sprawdzić `status` z odpowiedzi (>=300 → rzuć), albo asercja w teście.

- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:246-252` — `404` na `GET /api/products/{id}` traktowany jako „już usunięty” → kasuje mapowanie i zapisuje do Historii „usunięto”. 404 z błędnej konfiguracji (zły `SELLY_SHOP_URL`, proxy, sklep zastępczy) po cichu wyczyści mapowania wszystkich sierot (do 20/przebieg), a przy odwróceniu błędu produkty w sklepie zostaną bez mapowania (Tor 2 założy duplikaty). Rozważyć wymóg, żeby wcześniej w przebiegu przeszedł jeden udany odczyt (np. `ping`/lista z produktem), albo nie kasować mapowania przy 404 bez potwierdzenia ze `GET .../variants`.

- [ ] `rebuild/backend/test/selly.usuwanie.test.ts` — luki: (1) mapowanie z `selly_variant_id = NULL`; (2) powrót produktu w trakcie przebiegu; (3) równoległe dwa przebiegi; (4) awaria po udanym `DELETE` (zapis mapowania/audytu); (5) 429/5xx na `DELETE` (testowane tylko `getProduct` 500); (6) `404` na `DELETE` (gałąź `:317-319`); (7) nazwa w Selly niezgodna z `history` (gdy EAN nieznany); (8) skip przez `wariantUzywanyPrzezZywe` (`:237`); (9) granica progu (dokładnie 30%), `mapowan = 0`; (10) przebieg przy `ucieto_wpisow` (`zamknijLog` > 8000 znaków); (11) parsowanie `SELLY_USUWANIE` (`"0"`, `"false"`, błędna wartość) w testach env — dziś pokryte tylko opcją `usuwanie` w harmonogramie, nie przejściem `env → server.ts`.

- [ ] `rebuild/backend/test/selly.usuwanie.test.ts:222-230` — testy harmonogramu opierają się o `setTimeout(400)` i `interwalMs: 20` (czas ścienny); przy obciążonej maszynie (user pracuje w wielu oknach) mogą być niestabilne. Lepiej czekać na warunek (polling po `deleteProduct`/stan bazy z limitem czasu).

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:156` — `encjaTyp: "produkt"`, podczas gdy w innych miejscach audytu używa się `"product"` (`scal-karty-auto.ts`) i `"staging"`/`"dostawca"`; ujednolicić (nie wpływa na widok Historii, ale na filtry `GET /api/audit-log`).
- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:139, 394-396` — akcja `juz_nie_istnial` trafia do Historii jako „… już nie istniał, usunięto mapowanie” pod nazwą akcji `selly_usuniecie`; rozważyć osobną akcję lub pole tak, by w widoku nie wyglądało na usunięcie dokonane przez Bridge.
- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:63, 167` — `kiedy` w `audit_log` to moment zapisu (`new Date().toISOString()` w `zapiszAudyt`), a `czas` w `szczegoly` to moment decyzji w formacie `YYYY-MM-DD HH:MM:SS`; dwa formaty godziny w jednym wpisie. Ujednolicić albo pominąć duplikat.
- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:99-100` — dwa zapytania z tym samym `CZESC_SELECT` (COUNT + LIMIT); `NOT EXISTS` z podzapytaniem EAN po `historia_cen` bez indeksu po `kod`/`ean` — sprawdzić plan zapytania na kopii produkcji (5–7 tys. mapowań, co 15 min).
- [ ] `rebuild/backend/src/selly/rest/scheduler.ts:236-239` — `.then(() => ...)` po `.catch` uruchamia Tor 3 także po awarii Toru 1 (np. zerwane połączenie z Selly); to dobry wybór, ale warto to zapisać w komentarzu.
- [ ] Historia w `selly_sync_log` ma `dostawca_kod='ALL'` — panel „Historia operacji” nie rozróżnia `sync_delete` od innych (sprawdzić, czy front nie zakłada zamkniętej listy `operacja`; nie znalazłem walidacji w `repos/selly.ts`).

## Plan compliance

### Done ✓
- `src/selly/rest/sync-usuwanie.ts` (Tor 3) + wpięcie w `scheduler.ts` po Torze 1 + `SELLY_USUWANIE` w `env.ts`/`server.ts`/`.env.example`.
- Akcja `selly_usuniecie` w `historia/mapowanie.ts` (typ `edycja`), test `historia.mapowanie.test.ts` zaktualizowany; fixtures bez zmian (nowa akcja pojawia się tylko przy nowych zdarzeniach — zgodne z planem).
- Tryb ≠ `pelny` → Tor 3 nic nie robi (blokada `SELLY_TRYB` zgodna); przy `SELLY_SCHEDULER=false` harmonogram w ogóle nie rusza (Tor 3 wpięty w `tick`, więc zgodne).
- Historia: audit_log (kod, nazwa, EAN, id w Selly, dostawca, godzina) + `selly_sync_log`.
- Wpisy docs (`spec-backend/wpis-186.md`, `rebuild-backlog/wpis-186.md`) zgodne z regułą nowych plików.

### Missing or deviating ✗
- „Bezpiecznik jak przy zapisie” — nie w pełni: brak dodatniej zgodności EAN/nazwy (patrz SHOULD-FIX 1) i brak kontroli dla wiersza bez wariantu (BLOCKER 2).
- Raport mówi „Deviations: None”, ale decyzja „od początku usuwa” + próg 30% + limit 20 to założenia, które powinny być wprost wymienione jako zachowanie produkcyjne przy pierwszym wdrożeniu (jest to w Follow-up, OK).

### Definition of done
- [x] Sierota = brak produktu po (dostawca, kod_importu) ORAZ po kodzie ORAZ po EAN-ie; wariant nieużywany przez żywe mapowanie — spełnione (predykat SQL + `wariantUzywanyPrzezZywe`), z zastrzeżeniem braku ponownej weryfikacji przed DELETE (BLOCKER 1).
- [ ] Bezpiecznik jak przy zapisie — częściowo (patrz wyżej).
- [x] Usunięcie wariantu / całego produktu / 404 = już usunięty — logika jest, z luką dla `variant_id = NULL`.
- [x] Historia: kod, nazwa, EAN, id w Selly, dostawca, godzina — spełnione dla powodzenia; nie gwarantowane przy częściowej awarii (SHOULD-FIX 2).
- [x] Bramki backendu zielone (wg raportu; nie weryfikowałem).

## Parallel-test concerns

None — testy używają `stworzTestowaBaze()` (SQLite w katalogu tymczasowym) i atrapy klienta, bez portów i stałych ścieżek. Jedyne ryzyko to niestabilność czasowa testów harmonogramu (`setTimeout(400)`), nie kolizja zasobów.

## Overall assessment

Kierunek i warstwa ochronna są rozsądne: predykat sieroty jest świadomie koniunkcją trzech `NOT EXISTS`, są limity i bezpieczniki zbiorcze, blokada `SELLY_TRYB` działa, a widok Historii jest poprawnie wpięty bez wpływu na istniejące fixtures. Zanim to ruszy na produkcji, trzeba domknąć dwie luki, w których operacja nieodwracalna może trafić w żywy produkt: brak ponownej weryfikacji sieroty tuż przed `DELETE` oraz kasowanie całego produktu dla mapowania bez wariantu. W drugiej kolejności: atomowość audytu z usunięciem mapowania, brak blokady nakładania się przebiegów, słabsza niż przy zapisie kontrola tożsamości i konstrukcja progu 30% (może zablokować usuwanie na stałe, a poniżej progu kasuje bez nadzoru).
