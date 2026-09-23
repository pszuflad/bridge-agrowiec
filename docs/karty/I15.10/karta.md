# I15.10 — dostępność w Selly: `dostepnosc.ts` + zmiany w delcie (Tor 1) i pełnym cyklu (Tor 2)

> **Stan:** ✅ 2026-09-23 · 119-FEATURE-selly-dostepnosc-zawor
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #104 (dowieziona), #108 (pozostaje otwarty), #101 (zmierzona, nienaprawiona)
> **Ticket:** 119-FEATURE-selly-dostepnosc-zawor

Przepisana z karty-rezerwy przez koordynatora (ticket 110, triaż 22.09 wieczór). Źródło prawdy: `origin/main`
na `88fa31c` (diff `abe5f14..88fa31c` na obu plikach Toru 1 i Toru 2 jest PUSTY — zamrożenie produkcji z 23.09
tych plików nie dotknęło, treść ta sama co na `abe5f14`).

## Zakres
- **`src/selly/dostepnosc.ts` (nowy moduł):** `zadajOdswiezenie(dostawca)` kolejkuje odświeżenie — uruchamia
  generator CSV **w tym samym procesie** (świadome odstępstwo od produkcyjnego `execFileSync`), a po nim
  `syncDelta` sekwencyjnie dla dotkniętych dostawców; okresowa synchronizacja zostaje mechanizmem ponawiania;
  błąd tylko loguje. Fabryka `stworzSynchronizacjeDostepnosci()` + rejestr
  `ustawDomyslnaSynchronizacjeDostepnosci()` zamiast modułowego singletona (testy Vitest w jednym procesie).
  Celowo **niewpięty** — montaż i wołanie robi karta I15.4 (`docs/karty/I15.4/wejscie-119.md`).
- **`src/selly/rest/sync-delta.ts` (Tor 1, zmiany z #104):** warunek `WHERE` obejmuje wstrzymane z wariantem,
  ale **wyklucza** te, które mają inną aktywną ofertę w tej samej grupie `(dostawca, kod_importu)`; mapowany
  wariant bez EAN też się zeruje; tuż przed wysyłką czytany jest ŻYWY `status`/`stan`/`cena_sprzedazy`
  produktu — przy `wstrzymany` bez innej aktywnej oferty w grupie wysyłany jest stan 0, przy `wstrzymany`
  z inną aktywną ofertą albo gdy produkt zniknął — `skip`.
- **`src/selly/rest/sync-full.ts` (Tor 2, #104):** tuż przed wysyłką czytany jest żywy `status`/`stan`; produkt
  wstrzymany lub usunięty po rozpoczęciu cyklu jest pomijany (`skip`). Efekt poprawki jest wyłącznie `skip` —
  `row.stan = live.stan` jest martwe (payload Toru 2 nie niesie stanu, patrz „Do koordynatora").
- **Wykrywanie kolizji `kod_importu` (Tor 1, TYLKO raportowanie — bez pomijania):** `grupyKolizyjne()` — jeden
  SQL, grupowanie po PARZE `(dostawca, kod_importu)`, `HAVING COUNT(*) > 1` na aktywnych produktach. Licznik
  `stats.kolizje_kod_importu`, lista `kolizje` w wyniku i w `selly_sync_log.szczegoly_json`. Wysyłka pozostaje
  1:1 z produkcją — nic nie jest pomijane. Przypadek „różni dostawcy, ten sam `kod_importu`"
  (wielomagazynowość) NIE jest raportowany jako kolizja.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/rest/sync-delta.ts` i `sync-full.ts` (tylko zmiany z #104 + wykrywanie kolizji),
nowy `rebuild/backend/src/selly/dostepnosc.ts`; testy (`selly.dostepnosc.test.ts`,
`selly.sync-delta.test.ts`, `selly.sync-full.test.ts`).
NIE: generator CSV (I15.3, tylko wołany), staging i auto-wstrzymania (I15.4), harmonogram i trasy (I15.8),
`app.ts` (nietknięty — montaż domyślnej instancji to I15.4/I15.8).

## Decyzje
Decyzje D1–D9 z bloku I15 obowiązują. Port Toru 1 i Toru 2 1:1 z `abe5f14` (zweryfikowany linia po linii).

**⭐ Rewizja zakresu (23.09, w trakcie ticketa):** `wejscie-116.md`/`wejscie-117.md` kazały kolizyjne grupy
`kod_importu` POMIJAĆ (zawór). Ania wyjaśniła, że współdzielony `kod_importu` to ZAMIERZONA
wielomagazynowość Selly — różne EAN-y tej samej opony u różnych dostawców nie znaczą, że to inna opona
(klasyfikuje nazwa, model, indeks nośności i prędkości); ten sam produkt trafia w Selly do jednej karty
z różną ceną i magazynem. Pomiar na migawce `db/snapshot.db` (13.08, 6898 aktywnych produktów): przypadek
A „ten sam dostawca, ten sam `kod_importu`" (grupowanie po parze) = 121 grup / 259 produktów (116 grup z
różnymi cenami/stanami — to realny problem #108); przypadek B „różni dostawcy, ten sam `kod_importu`"
(wielomagazynowość) = 793 grupy / 1734 produkty — zawór po parze NIGDY go nie dotykał. **Decyzja: wykrywamy
i raportujemy, NIE pomijamy.** Zawór grupujący po parze `(dostawca, kod_importu)` został WYCOFANY z kodu.

## Dowiezione

- Tor 1 (`sync-delta.ts`): WHERE z `abe5f14` (wstrzymany wchodzi tylko wariantem, bez innej aktywnej oferty
  w grupie `(dostawca, kod_importu)`; EAN wymagany tylko bez gotowego mapowania wariantu), projekcja
  `p.id, p.status`, żywy odczyt `status`/`stan`/`cena_sprzedazy` tuż przed wysyłką.
- Tor 2 (`sync-full.ts`): żywy `status`/`stan` na starcie pętli; wstrzymany/usunięty po rozpoczęciu cyklu →
  `skip`.
- Nowy moduł `src/selly/dostepnosc.ts` — semantyka kolejki oryginału (drenaż `while`, jeden CSV na partię,
  `syncDelta` sekwencyjnie, błąd tylko logowany, restart z `finally`) odtworzona wiernie, łącznie z mniej
  oczywistym przypadkiem: zgłoszenie dostawcy z partii przerwanej wyjątkiem PRZEPADA w tym obrocie (pętla
  czyści zbiór oczekujących przed przetwarzaniem) — nadrabia dopiero okresowa synchronizacja; to zachowanie
  oryginału, nie błąd. Celowo NIEWPIĘTY, `app.ts` nietknięty.
- Wykrywanie kolizji `kod_importu`: `grupyKolizyjne()`, `stats.kolizje_kod_importu`, lista `kolizje` w
  wyniku i w `szczegoly_json`. Dodatkowo (ponad plan): pole `rozne_ceny_lub_stany` w każdej grupie.
- 22 nowe testy (T1–T11 planu); bramki (`lint`, `typecheck`, `build`, `test`) zielone; 1654 przechodzi
  (baseline 1632), 3 pominięte, zero regresji w zakresie ticketu.
- Pomiar #101 (blokady form płatności) — patrz „Do koordynatora".

## Do koordynatora

1. **`generator-csv.ts` NIE pochodzi z karty I15.3** — jest z ticketu 28 (wcześniejsza iteracja) i był na
   `develop` od początku, `wygenerujCsvSelly(db, sciezki)` jest dostępne i synchroniczne. Zależność
   I15.10 → I15.3 była pozorna. I15.3 ma dołożyć do generatora inne rzeczy (zapis atomowy, kolumna
   `Blokowane-formy-platnosci`), nie sam fakt istnienia.
2. **Pomiar #101 (blokady form płatności):** payload REST Toru 1 i Toru 2 NIGDY nie niósł blokad form
   płatności — ani `src/selly/rest/mapper-v2.ts` (`budujPayloadProduktuV2`), ani oryginał
   `mirror/backend/selly/mapper_v2.cjs` na `88fa31c` nie mają pola `blokowane_formy_platnosci` ani
   `payment_form*`. Pole istnieje tylko w kolumnie `products.blokowane_formy_platnosci` dokładanej
   runtime'owym `ALTER TABLE` (`payment_blocks.cjs`) oraz jako 60. kolumna CSV
   (`generate_selly_export.cjs:75`). Zgłoszenie Ani nie może więc być regresją synchronizacji REST.
   Zmierzone, NIE naprawiane — naprawa to decyzja użytkownika.
3. **`row.stan = live.stan` w Torze 2 jest martwe** — nie ma odbiorcy ani w odbudowie, ani w oryginale
   (`sync_full.cjs:291`): payload Toru 2 nie niesie stanu, `markProductSynced` nie zapisuje `stan_wyslany`.
   Zportowane 1:1 dla wierności; realny skutek poprawki Toru 2 to wyłącznie `skip`.
4. **#108 pozostaje OTWARTY** — mamy teraz liczby z każdego cyklu (`kolizje_kod_importu`), ale pętla
   wysyłek trwa (zgodnie z decyzją z 23.09). Rozstrzygnięcie semantyczne przypadku A (deduplikacja /
   agregacja stanu / rozdzielenie grup) to decyzja handlowa Ani. Danych nie ruszano.
5. **Nieaktualne zdanie w cudzym pliku — do rozstrzygnięcia przez koordynatora.**
   `docs/spec-backend/wpis-109.md:14` mówi, że w Torze 1 „EAN jest wymagany". Ticket 119 to obalił:
   po porcie `abe5f14` EAN jest wymagany **tylko wtedy, gdy nie ma jeszcze mapowania wariantu**
   (`(sp.selly_variant_id IS NOT NULL OR (p.ean IS NOT NULL AND p.ean != ''))`) — mapowany wariant
   bez EAN-u też się zeruje. Plik jest własnością ticketu 109, więc go NIE edytowaliśmy; korekta
   jest zapisana w `docs/spec-backend/wpis-119.md`. Zgodnie z regułą „jeden plik na ticket" to
   wystarcza, ale odnotowuję, bo czytający sam `wpis-109.md` dostanie nieaktualny obraz.
