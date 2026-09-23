# 119-FEATURE-selly-dostepnosc-zawor — raport z realizacji

## Podsumowanie

Domknięta karta I15.10. Do odbudowy przeniesiona zmiana „dostępność” z `origin/main:abe5f14`,
której karty I15.6 i I15.7 nie mogły mieć (zamknęły się na starszym `7d6cfc9`): w Torze 1 i Torze 2
status, stan i cena są czytane z bazy tuż przed wysyłką, a warunek wyboru kandydatów Toru 1
uwzględnia wstrzymane z wariantem i mapowane warianty bez EAN. Dołożony moduł odświeżania
dostępności (port `availability_sync.cjs`) — celowo niewpięty, czeka na kartę I15.4. Zamiast
zaworu na kolizje `kod_importu` wszedł, po wyjaśnieniu Ani z 23.09, sam mechanizm raportowania:
wysyłka pozostaje 1:1 z produkcją.

## Zmiany

- `rebuild/backend/src/selly/rest/sync-delta.ts` — WHERE z `abe5f14` (wykluczenie wstrzymanych
  mających inną aktywną ofertę w grupie; EAN wymagany tylko bez gotowego mapowania wariantu),
  projekcja `p.id, p.status`, żywy odczyt `status`/`stan`/`cena_sprzedazy` przed wysyłką,
  nowa funkcja `grupyKolizyjne()`, licznik `kolizje_kod_importu` i lista `kolizje` w wyniku
  oraz w `szczegoly_json`.
- `rebuild/backend/src/selly/rest/sync-full.ts` — żywy odczyt `status`/`stan` na starcie pętli;
  produkt wstrzymany lub usunięty po rozpoczęciu cyklu → `skip`.
- **Nowy:** `rebuild/backend/src/selly/dostepnosc.ts` — kolejka odświeżeń: drenaż, generator CSV
  raz na partię, `syncDelta` sekwencyjnie, błąd tylko logowany; fabryka
  `stworzSynchronizacjeDostepnosci()`, rejestr `ustawDomyslnaSynchronizacjeDostepnosci()`
  i punkt wejścia `zadajOdswiezenie()` dla karty I15.4.
- **Nowy:** `rebuild/backend/test/selly.dostepnosc.test.ts` — 10 testów semantyki kolejki.
- `rebuild/backend/test/selly.sync-delta.test.ts` — 10 nowych testów (#104 i #108) + aktualizacja
  dwóch asercji o nowe pola `stats.kolizje_kod_importu` i `szczegoly_json.kolizje`.
- `rebuild/backend/test/selly.sync-full.test.ts` — 2 nowe testy (#104).

## Odstępstwa od planu

**Jedno, wykryte w trakcie implementacji.** Plan zakładał test Toru 2 „stan zmieniony w trakcie
cyklu → wysyłany jest ŻYWY stan” (T8). Test nie przeszedł i okazało się, że **efekt nie istnieje
ani u nas, ani w oryginale**: `row.stan = live.stan` nie ma żadnego odbiorcy — payload Toru 2
(`toSellyPayloadV2`) nie niesie stanu, a `markProductSynced` nie zapisuje `stan_wyslany`.
W oryginale jest dokładnie tak samo (`sync_full.cjs:291` — przypisanie bez odczytu). Przypisanie
zostało zportowane 1:1 (wierność), test usunięty jako sprawdzający nieistniejące zachowanie,
a fakt opisany komentarzem w kodzie. **Realny skutek poprawki Toru 2 to wyłącznie `skip`.**

Pozostałe punkty planu bez zmian.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** `contract/openapi.yaml` nie
  ma tras `/api/selly/sync-delta`, `/sync-full` ani dostępności (montaż tras to karta I15.8);
  zmieniamy wyłącznie funkcje wewnętrzne i dokładamy moduł, którego nikt jeszcze nie woła.
  Kształt `GET /api/selly/log` się nie zmienia — dokładamy treść do wolnego pola `szczegoly_json`.
  Pułapka projekcji Drizzle nie dotyczy tego kodu: `selly_sync_log` jest pisany surowym SQL-em.
- **Unit/integracyjne: ✓ 1654 przechodzi, 3 pominięte, 101 plików.** Baseline przed ticketem:
  1632 / 3 / 100 — czyli +22 nowe testy i **zero regresji**.
- **Bezpieczeństwo: ✓** atrapa Selly wstrzykiwana, generator CSV i `syncDelta` w testach modułu
  podmienione; żaden test nie woła sieci ani nie zapisuje pliku CSV.
- `lint` ✓, `typecheck` ✓, `build` ✓ (Node v20.20.2).

## Breaking changes

Brak zmian w API. Dwie zmiany kontraktu wewnętrznego, obie obsłużone w repozytorium:
- `StatystykiDelta` ma nowe pole `kolizje_kod_importu`, a `WynikSyncDelta` — `kolizje`.
  Każdy `toEqual` na `stats` musi je uwzględnić (zaktualizowane).
- `szczegoly_json` wpisu `sync_delta` ma dodatkowy klucz `kolizje`.

## Pomiar #101 (z `docs/karty/I15.10/wejscie-114.md`) — zmierzone, NIE naprawiane

**Payload REST Toru 1 i Toru 2 nigdy nie niósł blokad form płatności.** `budujPayloadProduktuV2`
w `src/selly/rest/mapper-v2.ts` nie ma pola `blokowane_formy_platnosci` ani żadnego
`payment_form*`; tak samo oryginał `mirror/backend/selly/mapper_v2.cjs` na `88fa31c` (zero trafień
grepem w obu). Blokady istnieją wyłącznie w dwóch miejscach:
1. kolumna `products.blokowane_formy_platnosci` dokładana runtime'owym `ALTER TABLE`
   (`payment_blocks.cjs`) — ten sam wzorzec co `uwaga_cena_patch.cjs` z `CLAUDE.md`;
2. ostatnia, 60. kolumna CSV eksportu (`generate_selly_export.cjs:75`).

Wniosek: zgłoszenie Ani („nowe produkty mają to pole puste") **nie może być regresją synchronizacji
REST**, bo REST nigdy tego pola nie wysyłał. Kandydaci do sprawdzenia: CSV albo karta produktu
po stronie Selly. Naprawa = decyzja użytkownika, poza tym ticketem.

## Poprawki po review

- **SHOULD-FIX (naprawione):** test „błąd przerywający partię…" w `selly.dostepnosc.test.ts` miał
  nazwę i komentarz przeczące własnej asercji — sugerował, że zgłoszenie wraca do kolejki, podczas
  gdy asercja dowodzi, że dostawca z przerwanej partii PRZEPADA. Zachowanie jest wierne oryginałowi
  (pętla czyści `oczekujace` przed przetwarzaniem), ale opis mylił. Poprawiona nazwa, komentarz
  i — co ważniejsze — docstring modułu, bo to on jest wejściem dla karty I15.4.
- **NICE-TO-HAVE (przyjęte):** pole `rozne_ceny_lub_stany` w `grupyKolizyjne()` wykracza poza plan;
  udokumentowane w `docs/spec-backend/wpis-119.md` i przy wpisie #108 w backlogu.
- **Zweryfikowane niezależnie przez recenzenta i potwierdzone:** port Toru 1 i Toru 2 zgodny 1:1
  z `git diff 7d6cfc9 abe5f14` (linia po linii), pusty diff `abe5f14..88fa31c`, wycofanie zaworu
  w kodzie, grupowanie po PARZE `(dostawca, kod_importu)` oraz teza o martwym `row.stan` w Torze 2.

## Zastane, niezwiązane z ticketem

`test/alerty-katalogu.gate.test.ts:267` bywa czerwony pod obciążeniem: u recenzenta przekroczył
limit 20 s (37–50 s), u mnie przechodzi w izolacji w ~12 s i przeszedł w pełnym biegu. Plik jest
POZA diffem tego ticketa (`git diff --name-only origin/develop...HEAD` go nie zawiera), więc to
wrażliwość zastana, ujawniana przez równoległą pracę kilku agentów — nie regresja z tej karty.
Warta osobnego ticketa (podniesienie limitu albo odchudzenie przypadku).

## Follow-up

1. **#108 pozostaje otwarty.** Wykrywanie kolizji daje teraz liczby z każdego cyklu, ale sama pętla
   wysyłek trwa (zgodnie z decyzją). Rozstrzygnięcie semantyczne — deduplikacja, agregacja stanu
   czy rozdzielenie grup — to decyzja handlowa Ani. Danych nie ruszano.
2. **Uwaga dla karty I15.4 (punkt wpięcia).** Hook nie może wołać `zadajOdswiezenie()` z wnętrza
   biegu `syncDelta` bezwarunkowo — moduł drenuje kolejkę w pętli, więc bezwarunkowe zgłoszenie
   z wnętrza delty daje pętlę nieskończoną (potwierdzone eksperymentalnie: wysyp OOM w teście,
   zanim dołożono bezpiecznik). Produkcja jest bezpieczna, bo woła `refreshAvailability` z końca
   `importer()`, a nie ze środka synchronizacji. Szczegóły: `docs/karty/I15.4/wejscie-119.md`.
3. **`row.stan = live.stan` w Torze 2 jest martwe** (patrz „Odstępstwa”). Gdyby Tor 2 kiedyś zaczął
   wysyłać stan, linia zacznie działać sama z siebie — warto o niej pamiętać, nie usuwać.
4. **Moduł dostępności jest niewpięty** — dopóki I15.4 albo I15.8 nie zawoła
   `ustawDomyslnaSynchronizacjeDostepnosci()`, `zadajOdswiezenie()` jest świadomym no-opem.
