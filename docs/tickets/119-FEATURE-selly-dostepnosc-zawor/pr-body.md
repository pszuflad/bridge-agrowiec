## Ticket
119-FEATURE-selly-dostepnosc-zawor — dostępność w Selly: Tor 1 i Tor 2 + moduł odświeżania (karta I15.10)

## Summary
Do odbudowy przeniesiona zmiana „dostępność” z `origin/main:abe5f14`, której karty I15.6 i I15.7 nie
mogły mieć (zamknęły się na starszym `7d6cfc9`): w Torze 1 i Torze 2 status, stan i cena są czytane
z bazy tuż przed wysyłką, a warunek wyboru kandydatów Toru 1 uwzględnia wstrzymane z wariantem
i mapowane warianty bez EAN. Dołożony moduł odświeżania dostępności (port `availability_sync.cjs`),
celowo niewpięty. Zamiast zaworu na kolizje `kod_importu` — po wyjaśnieniu Ani z 23.09 — wszedł sam
mechanizm raportowania: wysyłka pozostaje 1:1 z produkcją.

## Problem / Motivation
Karta I15.10 (wpis backlogu #104) domyka zakres produkcji z `abe5f14`. Bez żywego odczytu odbudowa
wysyłałaby do Selly stan sprzed cyklu — produkt wstrzymany lub wyzerowany w trakcie biegu i tak
poszedłby jako aktywny. Wpis #108 (kolizje `kod_importu`) domagał się decyzji, co robić z grupami
dzielącymi klucz snapshotu.

## Solution
- `rebuild/backend/src/selly/rest/sync-delta.ts` — WHERE z `abe5f14` (wykluczenie wstrzymanych
  mających inną aktywną ofertę w grupie; EAN wymagany tylko bez gotowego mapowania wariantu),
  projekcja `p.id, p.status`, żywy odczyt `status`/`stan`/`cena_sprzedazy` przed wysyłką, nowa
  funkcja `grupyKolizyjne()`, licznik `kolizje_kod_importu` i lista `kolizje` w wyniku oraz
  w `szczegoly_json`.
- `rebuild/backend/src/selly/rest/sync-full.ts` — żywy odczyt `status`/`stan` na starcie pętli;
  produkt wstrzymany lub usunięty po rozpoczęciu cyklu → `skip`.
- **Nowy** `rebuild/backend/src/selly/dostepnosc.ts` — kolejka odświeżeń (drenaż, generator CSV raz
  na partię, `syncDelta` sekwencyjnie, błąd tylko logowany), fabryka, rejestr i punkt wejścia
  `zadajOdswiezenie()`. **Celowo niewpięty** — montaż jest przedmiotem otwartego ustalenia (niżej).
- Testy: +10 (`selly.dostepnosc`), +10 (`selly.sync-delta`), +2 (`selly.sync-full`).
- Dokumentacja: `docs/spec-backend/wpis-119.md`, karta `I15.10` rozliczona,
  `docs/karty/I15.4b/wejscie-119.md` (ostrzeżenie o OOM przy bezwarunkowym wołaniu
  `zadajOdswiezenie()` z wnętrza `syncDelta` — potwierdzone eksperymentalnie), statusy #104 i #108.

## Design decisions
- **Zawór na kolizje `kod_importu` WYCOFANY** (decyzja Ani, 23.09): współdzielony `kod_importu` bywa
  zamierzoną wielomagazynowością, więc pomijanie grup zatrzymałoby też poprawne produkty. Zostaje
  wykrywanie i raportowanie; wysyłka 1:1 z produkcją.
- **Kolizja dotyczy wyłącznie pary `(dostawca, kod_importu)`** — snapshot `selly_products` jest
  kluczowany tą parą. „Różni dostawcy, ten sam `kod_importu`” to wielomagazynowość, nie kolizja.
- **`row.stan = live.stan` w Torze 2 zportowane 1:1 mimo że jest martwe** (payload Toru 2 nie niesie
  stanu, `markProductSynced` nie zapisuje `stan_wyslany`; w oryginale tak samo) — wierność ponad
  „porządek”. Realny skutek poprawki Toru 2 to wyłącznie `skip`.
- **Moduł dostępności niewpięty** — montaż wymaga rozstrzygnięcia sprzecznych ustaleń (niżej).

## Tests
Bieg po scaleniu z `develop` (80 commitów bazy): `lint` ✓, `typecheck` ✓, `build` ✓, `vitest run` ✓.
GATE fixtures/kontraktu: N/D — ticket nie dotyka tras z `contract/openapi.yaml`, zmienia funkcje
wewnętrzne i dokłada moduł bez wywołań; kształt `GET /api/selly/log` bez zmian (treść idzie do
wolnego pola `szczegoly_json`, pisanego surowym SQL-em).

## Breaking changes
Brak zmian w API. Dwie zmiany kontraktu wewnętrznego, obsłużone w repo: `StatystykiDelta` ma pole
`kolizje_kod_importu`, `WynikSyncDelta` — `kolizje`; `szczegoly_json` wpisu `sync_delta` ma klucz
`kolizje`.

## Follow-up
1. **Montaż `availability_sync` — sprzeczne ustalenia do rozstrzygnięcia przez koordynatora.**
   Ten ticket przekazał montaż do I15.4b (`docs/karty/I15.4b/wejscie-119.md`), a `wejscie-121.md`
   (od I15.8, przyszło PO zamknięciu ticketu) mówi, że montaż należy do I15.10. Kod jest gotowy
   w obu wariantach — `zadajOdswiezenie()` to jedyny punkt wejścia.
2. **Generator CSV in-process** — `wejscie-122.md` (I15.3) pokazuje `wygenerujCsvSelly()` do wołania
   w procesie; `dostepnosc.ts` uruchamia go w osobnym procesie, 1:1 za oryginałem. Do decyzji:
   wierność czy uproszczenie.
3. **#108 pozostaje otwarty** — rozstrzygnięcie semantyczne przypadku „ten sam dostawca” to decyzja
   handlowa Ani; mamy teraz tylko liczby z każdego cyklu.
4. **`docs/spec-backend/wpis-109.md:14` jest nieaktualny** (mówi „EAN wymagany w Torze 1”); korekta
   w `wpis-119.md`, cudzego pliku nie ruszano.
5. **Czułość zestawu testów na obciążenie maszyny** — `test/alerty-katalogu.gate.test.ts`
   i `test/silnik.charakteryzacja.test.ts` (oba poza diffem) ocierają się o limit 20 s i przy
   kilku równoległych sesjach wypadają na TIMEOUT. Osobny ticket.

## Review
`docs/tickets/119-FEATURE-selly-dostepnosc-zawor/review.md` — BLOCKER (brak aktualizacji karty,
wejścia i backlogu) usunięty commitami `685f2cf` i `d6c266a`; SHOULD-FIX o mylącym komentarzu
w teście kolejki poprawiony.

---
Ticket docs: `docs/tickets/119-FEATURE-selly-dostepnosc-zawor/`
Gałąź zsynchronizowana z `develop` (merge `56afb96`), bramki przebiegnięte po synchronizacji.
