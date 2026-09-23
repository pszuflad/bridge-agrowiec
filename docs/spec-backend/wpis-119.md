# Wpis do spec-backend od ticketu 119 (karta I15.10) · 2026-09-23

**Sekcja:** §2 (panel Selly — kontynuacja ustaleń z 8a/108/109: model danych i logika REST, tu
„dostępność" — Tor 1/Tor 2 czytają żywy stan i wykrywanie kolizji `kod_importu`).

**Potwierdzone w 119** (`119-FEATURE-selly-dostepnosc-zawor`, 2026-09-23, karta I15.10), port z
`origin/main:abe5f14` (backlog #104; diff `abe5f14..88fa31c` pusty, więc to też stan
zamrożonej produkcji):

- **Tor 1 i Tor 2 czytają ŻYWY stan tuż przed wysyłką**, nie migawkę sprzed biegu (cykl bywa
  długi — discovery + limiter — a import może w międzyczasie wstrzymać pozycję). Tor 1
  (`sync-delta.ts`): `SELECT status, stan, cena_sprzedazy FROM products WHERE id = ?`; brak
  wiersza → `skip`; `status='wstrzymany'` z inną pozycją `aktywna` w tej samej grupie
  `(dostawca, kod_importu)` → `skip` (zerowanie zabiłoby sprzedaż wspólnego wariantu), inaczej
  wysyłany jest stan 0; poza tym `stan`/`cena_sprzedazy` biorą się z żywego odczytu. Tor 2
  (`sync-full.ts`): `SELECT status, stan FROM products WHERE id = ?`; `!live ||
  live.status!=='aktywny'` → `skip`.
- **`row.stan = live.stan` w Torze 2 jest MARTWE** — nic go nie czyta (`toSellyPayloadV2` nie
  niesie stanu, `markProductSynced` nie zapisuje `stan_wyslany`). **Tak samo w ORYGINALE**
  (`mirror/backend/selly/sync_full.cjs:291` — przypisanie bez odbiorcy), portowane 1:1. Realny
  skutek żywego odczytu w Torze 2 to wyłącznie `skip`.
- **Warunek EAN w Torze 1 zmienia się z bezwarunkowego na warunkowy** —
  `(sp.selly_variant_id IS NOT NULL OR (p.ean IS NOT NULL AND p.ean != ''))`: EAN jest wymagany
  tylko gdy nie ma jeszcze mapowania wariantu; mapowany wariant bez EAN-u też się teraz zeruje.
  **Koryguje `wpis-109.md`, zdanie „EAN nie jest wymagany (inaczej niż Tor 1)"** — od
  `abe5f14` różnica między torami jest w SPOSOBIE wymagania EAN-u (bezwarunkowo w Torze 2 vs.
  warunkowo w Torze 1), nie w tym, że Tor 1 wymaga go zawsze. `wpis-109.md` zostaje bez zmian
  (własność ticketu 109) — obowiązuje ta poprawka.
- **Wykrywanie kolizji `kod_importu` — rozszerzenie odbudowy ponad oryginał** (backlog #108).
  `grupyKolizyjne(db, dostawca)` jednym zapytaniem znajduje grupy `(dostawca, kod_importu)`,
  w których jeden dostawca ma >1 aktywny produkt: `stats.kolizje_kod_importu`, lista `kolizje`
  w wyniku `syncDelta` i klucz `kolizje` w `selly_sync_log.szczegoly_json`. **Nie zmienia
  wysyłki** — wiersze kolizyjne są nadal wysyłane, dokładnie jak w produkcji; dołożona jest
  wyłącznie widoczność. Pierwotny plan („zawór": pomijanie grup) **wycofany decyzją użytkownika
  23.09** po wyjaśnieniu Ani: współdzielony `kod_importu` to zamierzony mechanizm
  wielomagazynowości Selly (ten sam produkt u różnych dostawców = jedna karta produktu, różna
  cena/magazyn; różne EAN-y nie świadczą o różnej oponie — klasyfikuje ją nazwa/model/indeks
  nośności i prędkości). Grupowanie dlatego idzie po PARZE `(dostawca, kod_importu)`, nigdy po
  samym `kod_importu` — inaczej łapałoby wielomagazynowość (przypadek B, respektowany też przez
  `isMetadataOwner()` z 109) jako błąd. Realny problem jest tylko przy TYM SAMYM dostawcy
  (przypadek A): snapshot `selly_products` jest kluczowany `(kod_importu, dostawca)`, więc dwa
  aktywne wiersze jednej grupy nadpisują się nawzajem i obie pozycje wysyłają się w kółko.
  Pomiar (`db/snapshot.db`, 13.08, 6898 aktywnych produktów): ten sam dostawca — **121 grup /
  259 produktów, 116 z różnymi cenami lub stanami**; różni dostawcy (wielomagazynowość) —
  **793 grupy / 1734 produkty**. Zakres wykrywania: tylko Tor 1 (pętla wysyłek wynika ze
  współdzielonego snapshotu delty; Tor 2 jest pełnym cyklem i się na tym nie zapętla).
- **Nowy moduł `src/selly/dostepnosc.ts`** (port `mirror/backend/availability_sync.cjs`) —
  kolejka odświeżeń dostępności: `oczekujace: Set` + flaga biegu, drenaż całej bieżącej partii
  na raz, CSV generowany RAZ na partię, `syncDelta` SEKWENCYJNIE per dostawca, błąd tylko
  logowany (bez ponawiania — nadrabia okresowa synchronizacja). Zgłoszenie po skompletowaniu
  partii czeka na kolejny obrót pętli; dostawca z partii przerwanej wyjątkiem PRZEPADA (zbiór
  czyszczony przed przetwarzaniem) — zachowanie oryginału. Świadome odstępstwa: generator CSV
  wołany w tym samym procesie zamiast `execFileSync(...,{timeout:60000})` (tracimy izolację
  błędu i twardy limit 60 s — ryzyko ocenione jako niskie, generator nie robi I/O sieciowego);
  fabryka `stworzSynchronizacjeDostepnosci()` + rejestr `ustawDomyslnaSynchronizacjeDostepnosci()`
  zamiast modułowego singletona, bo `syncDelta` wymaga wstrzyknięcia `discovery`. Punkt wejścia
  `zadajOdswiezenie(dostawca)` bez zamontowanej instancji jest ŚWIADOMYM no-opem (odpowiednik
  bramki `staging_policy.cjs:131-134`) — moduł jest CELOWO niewpięty, wpięcie to karta I15.4.
  **Uwaga dla I15.4:** hook nie może wołać `zadajOdswiezenie()` z WNĘTRZA biegu `syncDelta`
  bezwarunkowo — daje pętlę nieskończoną (potwierdzone eksperymentalnie, OOM w teście zanim
  dołożono bezpiecznik); produkcja jest bezpieczna, bo woła `refreshAvailability` z KOŃCA
  `importer()`. Szczegóły: `docs/karty/I15.4/wejscie-119.md`.
- **Pomiar #101 — blokady form płatności nigdy nie były w payloadzie REST.**
  `budujPayloadProduktuV2` (`src/selly/rest/mapper-v2.ts`) i oryginał
  `mirror/backend/selly/mapper_v2.cjs` (na `88fa31c`) nie mają pola
  `blokowane_formy_platnosci` ani żadnego `payment_form*` (zero trafień grepem w obu). Blokady
  istnieją wyłącznie: (a) w kolumnie `products.blokowane_formy_platnosci` dokładanej
  runtime'owym `ALTER TABLE` przez `payment_blocks.cjs` (ten sam wzorzec co
  `uwaga_cena_patch.cjs`), (b) jako 60. kolumna CSV eksportu (`generate_selly_export.cjs:75`).
  Zgłoszenie „nowe produkty mają to pole puste" nie może być regresją synchronizacji REST.

Szczegóły: `docs/tickets/119-FEATURE-selly-dostepnosc-zawor/`.
