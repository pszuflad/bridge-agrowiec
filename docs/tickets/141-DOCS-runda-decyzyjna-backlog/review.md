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
