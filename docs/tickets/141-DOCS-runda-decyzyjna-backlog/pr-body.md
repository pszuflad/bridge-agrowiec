## Ticket
141-DOCS-runda-decyzyjna-backlog — runda decyzyjna backlogu (karta DEC.1)

## Summary
Runda decyzyjna karty **DEC.1**: 14 wpisów backlogu przejrzanych, stan faktyczny każdego zmierzony
w kodzie na `develop` (odnośnik plik:linia albo pomiar na `db/snapshot.db`), decyzje użytkownika
zapisane w polach `Do nowej wersji?` i `Status`. Po rundzie `tools/stan-backlogu.sh --do-decyzji`
pokazuje **3 pozycje zamiast 14** — wyłącznie te faktycznie czekające na Anię.
**Zero zmian w `rebuild/`, `contract/` i roadmapie.**

## Problem / Motivation
Wpis `#135.1` odnotował, że jedenaście wpisów backlogu wisi bez decyzji — najstarszy od
2026-08-24 — i że żaden nie ma gospodarza, więc przy planowaniu kolejnej fali po prostu ich nie
widać. Decyzja: nie rozstrzygać ich przy okazji innych kart, tylko osobną kartą decyzyjną.

Dwie korekty wobec promptu, obie wymuszone stanem repo:
- **wpisów jest 14, nie 11** — na `develop` @ `ab30674` doszły `#137.1` i `#137.2` (ticket 137,
  zmergowany po napisaniu promptu) oraz sam `#135.1`; lista wzięta z narzędzia, zgodnie z poleceniem;
- **katalog `docs/karty/DEC.1/` nie istniał** — koordynator go nie założył, więc zakłada go ten ticket.

## Solution
- `docs/karty/DEC.1/karta.md` (**nowy**) — zakres, stan faktyczny 14 wpisów z dowodami, decyzje,
  dowiezione, „Do koordynatora" (7 propozycji kart + 4 sprawy organizacyjne).
- `docs/karty/TEST.1/wejscie-141.md` (**nowy**) — trzy rzeczy, które Ania może zgłosić jako błąd
  podczas pełnego testu, wszystkie znane i świadomie odłożone.
- `docs/rebuild-backlog.md` — 22 linie (11 wpisów × `Do nowej wersji?` + `Status`), wyłącznie
  te dwie linie na wpis.
- `docs/rebuild-backlog/wpis-135.md` (2 linie), `wpis-137.md` (4 linie).

## Design decisions
- **Reguła nadrzędna (użytkownik, 2026-09-23):** *wszystko, co da się zrobić po cutoverze — robimy
  po cutoverze*; priorytet to szybkie wdrożenie produkcyjne. Konsekwencja: **żaden wpis nie jest
  blokerem cutoveru**; rekomendacje merytoryczne (#94, #43, #98 pkt 3) zostają w mocy, przesunięty
  jest wyłącznie termin.
- **Zamknięte (4):** `#5` ❌ NIE · `#95` ❌ nieaktualny · `#103` (Selly) ✅ dowiezione w I15.8 ·
  `#135.1` ✅.
- **Po cutoverze (7):** `#12`, `#43`, `#65`, `#88`, `#94`, `#98`, `#137.1`.
- **Czeka na Anię (3):** `#89`, `#108`, `#137.2` — stan oczekiwania odnotowany, decyzji nie
  wymuszano.
- **Nie implementowano żadnej naprawy** — zakresy opisane jako propozycje kart.

### Siedem ustaleń, które obaliły treść wpisów
1. `#43` — teza „zero 403/404/409 w całym kontrakcie" **nieprawdziwa** (404 → 6, 409 → 3).
   Ticket 129 lukę **zwęził**, nie pogłębił. GATE nie jest ślepy — **pada** na niezadeklarowany kod.
2. `#88` — wpis i test mierzą **węższy przypadek niż kod**: operator to **OR**, więc pusta *sama*
   `marka` wystarczy (1 produkt, nie 0); efekt zerowy bierze się z pustej tabeli `promotions`.
3. `#95` — **nieaktualny**, opisuje silnik, którego już nie ma (I15.4b).
4. `#98` pkt 3 — uzasadnienie odłożenia („brak UI") **obalone**: UI istnieje od 2026-09-04.
5. `#137.1` — to nie zaniedbanie, tylko **skutek świadomej decyzji użytkownika z 2026-09-08**
   (`6594525` — mirror cofnięty, bo pełny zapalił 12 bramek wierności).
6. `#12` — 84 produkty wypadają z Selly przez **wielkość liter** w `selly_kategoria_norm_map`,
   co otwiera drogę naprawy tańszą niż port CSV.
7. `#137.2` — wariant „przywróć meldunek" to **wpięcie istniejącego martwego kodu**
   (`poprawkiMarty`, zero wywołań), nie pisanie od zera.

## Tests
- **Gate odbudowy: N/D** — ticket nie dotyka API. Zweryfikowane ZERO zmian w `rebuild/**`
  i `contract/**` (`git diff --name-only`).
- `tools/stan-backlogu.sh --do-decyzji` → dokładnie 3 wpisy (`#89`, `#108`, `#137.2`) ✓
- `tools/stan-backlogu.sh` → 115 wierszy, parsuje się bez błędu ✓
- 3 wpisy z nieparsowalnym polem (`#11`, `#67`, `#68`) istniały **przed** ticketem (3 przed,
  3 po) — używają `⚠`, którego parser nie zna; nie ruszane ✓
- Unit / integracja / E2E: N/D — ticket nie zmienia kodu.

## Breaking changes
Brak.

## Follow-up
7 propozycji kart (wszystkie PO CUTOVERZE, ~3-4 dni łącznie) w `docs/karty/DEC.1/karta.md` →
„Do koordynatora" pkt 5. Poza tym:
- **`#137.1` wymaga decyzji użytkownika, nie karty** — rekomendacja wpisu kłóci się z polityką
  z 2026-09-08; dodatkowo po cutoverze `mirror/` przestaje być wzorcem, więc wpis może stać się
  bezprzedmiotowy;
- **zduplikowany numer `#103`** (dwa różne wpisy) — przenumerowanie należy do koordynatora;
- **`docs/karty/DEC.1/` nie było założone** przed promptem, wbrew „Przepływowi fali";
- **`docs/karty/I15.10b/karta.md`** ma `Stan: ⬜`, choć PR #149 jest zmergowany;
- **do zgłoszenia Ani jako fakt:** `#12` — 84 opony nie docierają dziś do Selly (tak samo
  w produkcji), to jej decyzja handlowa.

## Review
<details>
<summary>Code review — 0 BLOCKER, 3 SHOULD-FIX (wszystkie naprawione), 2 NICE-TO-HAVE</summary>

# 141-DOCS-runda-decyzyjna-backlog — Code review

> Reviewed: 2026-09-23
> Branch: `docs/141-runda-decyzyjna-backlog`
> Diff: 6 plików, 3 commity

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `docs/karty/DEC.1/karta.md:155` — odnośnik „komentarz `010_marka_caps.sql:24-26`" wskazuje
      złe linie.
  - Reason: fragment „NIE RUSZAMY: `manual_overrides`... `historia_cen.marka`..." faktycznie
    zaczyna się w `rebuild/schema/010_marka_caps.sql:31-32`, nie `:24-26` (zweryfikowane
    bezpośrednio w pliku). Treść twierdzenia jest prawdziwa, tylko cytat numeru linii nie.
  - Suggestion: poprawić na `:31-32`. Ten sam błędny odnośnik jest powielony w
    `docs/karty/TEST.1/wejscie-141.md:28`.
- [ ] `docs/karty/DEC.1/karta.md:176-177` — odnośniki `src/routes/selly-sync.ts:154` i `:168`
      wskazują złe linie.
  - Reason: zweryfikowane grepem — wywołania `runFullBatch` w handlerach `sync-full-today` /
    `sync-full-force` są w rzeczywistości na liniach **156** i **179**, nie 154/168. Treść
    (że oba tory wołają `runFullBatch`, nie `runFullTodays`) jest potwierdzona prawdziwa.
  - Suggestion: poprawić numery linii na 156/179 albo usunąć konkretne numery i zostawić nazwę
    funkcji + handler.
- [ ] `docs/tickets/141-DOCS-runda-decyzyjna-backlog/plan.md:58-63` — Definition of done ma
      wszystkie pozycje niezaznaczone (`- [ ]`), mimo że karta i `git log` pokazują ticket jako
      ukończony (`Stan: ✅ 2026-09-23` w `docs/karty/DEC.1/karta.md:3`), i brak `raport.md`
      w katalogu ticketu.
  - Reason: standardowy artefakt review (`raport.md` z „Test results") nie istnieje dla tego
    ticketu, a checkboxy DoD w `plan.md` nie zostały odhaczone — utrudnia to przyszłej sesji
    szybkie potwierdzenie, że wszystkie punkty DoD faktycznie spełnione, bez ręcznego
    porównywania z kartą.
  - Suggestion: odhaczyć DoD w `plan.md` (lub dopisać krótki `raport.md` odsyłający do sekcji
    „Dowiezione" karty), zgodnie z tym, co faktycznie dostarczono.

## NICE-TO-HAVE

- [ ] `docs/karty/DEC.1/karta.md:283-289` (sekcja „Do koordynatora" pkt 1) — dobrze, że ticket
      NIE rusza `docs/rebuild-roadmap.md` i poprawnie eskaluje zmianę polityki `#137.1` do
      koordynatora zamiast rozstrzygać ją samodzielnie; warto tylko w przyszłości od razu wskazać
      proponowaną treść poprawki linii `Status`, żeby koordynator nie musiał czytać całej karty
      ponownie.
- [ ] `docs/karty/DEC.1/karta.md:301-302` (pkt 4, „Do koordynatora") — zgłoszenie niespójności
      `docs/karty/I15.10b/karta.md` jest poza deklarowanym zakresem karty (nie dotyczy wpisu
      backlogu), ale słusznie tylko odnotowane, nie naprawione — zgodne z regułą „karty piszą
      wyłącznie we własnych plikach".

## Plan compliance

### Done ✓
- Krok 1 (stan faktyczny 14 wpisów, dowody plik:linia/pomiar) — zrobione, `docs/karty/DEC.1/karta.md`
  sekcja „Stan faktyczny — ustalenia (dowody)"; wyrywkowa weryfikacja 11 z tych odnośników w tym
  review potwierdziła treść merytoryczną (2 drobne przesunięcia numerów linii, patrz SHOULD-FIX).
- Krok 3 (zmiana WYŁĄCZNIE linii `Do nowej wersji?`/`Status`) — potwierdzone diffem: 11 hunków
  w `docs/rebuild-backlog.md` dla 11 wpisów, po 2 hunki w `wpis-135.md` i `wpis-137.md`; żadna
  inna treść („Opis", „Pliki", „Kategoria" itd.) nie została naruszona.
- Krok 4 (wypełnienie karty DEC.1 — Stan, Stan faktyczny, Decyzje, Dowiezione, Do koordynatora) —
  wszystkie sekcje obecne i wypełnione.
- Krok 5 (`#135.1` zamknięty odsyłaczem do karty) — potwierdzone w `wpis-135.md`.
- Korekta zakresu z 11 do 14 wpisów (`#137.1`, `#137.2`, `#135.1`) — udokumentowana i zgodna
  z faktycznym stanem `tools/stan-backlogu.sh --do-decyzji` na starcie.

### Missing or deviating ✗
- Brak `raport.md` w katalogu ticketu (patrz SHOULD-FIX) — proces przewiduje ten artefakt, tu go
  zastępuje wyłącznie sekcja „Dowiezione" w karcie.

### Definition of done
- [x] Każdy wpis z listy narzędzia ma wypełnione `Do nowej wersji?` i `Status` z datą — 14/14,
      potwierdzone diffem i `tools/stan-backlogu.sh`.
- [x] `--do-decyzji` pokazuje wyłącznie wpisy czekające na Anię — uruchomione, wynik: dokładnie
      `#89`, `#108`, `#137.2`, zgodnie z oczekiwaniem.
- [x] `docs/karty/DEC.1/karta.md` opisuje STAN (nie zamiar), z dowodami plik:linia — tak, choć
      2 odnośniki mają przesunięte numery linii (SHOULD-FIX).
- [x] `#135.1` zamknięty odsyłaczem do DEC.1 — potwierdzone.
- [x] Zero zmian w `rebuild/` i `contract/` — potwierdzone `git diff --name-only`
      (zmienione tylko: `docs/karty/DEC.1/karta.md`, `docs/karty/TEST.1/wejscie-141.md`,
      `docs/rebuild-backlog.md`, `docs/rebuild-backlog/wpis-135.md`, `wpis-137.md`,
      `docs/tickets/141-.../plan.md`).
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE` — poza zakresem tego review
      (weryfikacja techniczna push/PR, nie code review).

## Parallel-test concerns

Brak testów kodu w tym tickecie (ticket typu DOCS). Weryfikacja opiera się na
`tools/stan-backlogu.sh`, który czyta pliki z dysku bez współdzielonych zasobów (baza, porty) —
None — nic tu nie koliduje między równoległymi agentami.

## Overall assessment

Runda decyzyjna solidnie wykonana: 14 wpisów przejrzanych, twierdzenia poparte pomiarami, a
wyrywkowa weryfikacja 11 kluczowych odnośników plik:linia (w tym wszystkich 6 wskazanych explicite
w promptcie) potwierdziła treść merytoryczną w każdym przypadku — łącznie z nieoczywistymi
ustaleniami, które obaliły tezy oryginalnych wpisów (np. OR zamiast AND w `promocjaPasuje`, błędne
liczby 403/404/409 w kontrakcie, zdezaktualizowany wpis `#95`). Parser `tools/stan-backlogu.sh`
sklasyfikował wszystkie 14 wpisów zgodnie z intencją — nie znaleziono przypadku pułapki
„pierwszy pasujący znak" wpływającego na wynik. Jedyne realne zastrzeżenia to kosmetyczne
przesunięcia numerów linii w dwóch cytatach dowodowych i brak formalnego `raport.md`/odhaczonego
DoD w `plan.md` mimo ukończonej pracy — żadne z nich nie zmienia żadnej z 14 zapisanych decyzji.
Kierunek i jakość pracy: dobre, gotowe do merge'a po ewentualnej korekcie numerów linii.

</details>

---
Ticket docs: `docs/tickets/141-DOCS-runda-decyzyjna-backlog/`
Zsynchronizowane z `develop` (`ab30674`); bramki kodu nie dotyczą (ticket wyłącznie dokumentacyjny),
weryfikacja narzędziem `tools/stan-backlogu.sh` przebiegnięta po synchronizacji.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
