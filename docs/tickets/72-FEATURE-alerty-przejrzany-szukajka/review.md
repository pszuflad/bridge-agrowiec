# 72-FEATURE-alerty-przejrzany-szukajka — Code review

> Reviewed: 2026-09-21
> Branch: feature/72-alerty-przejrzany-szukajka
> Diff: 12 plików, 3 commity (BE, FE, raport)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:2949`, `docs/rebuild-backlog.md` (#26, #90) — roadmapa i backlog nie
  zostały zaktualizowane, mimo że to jawny punkt Definicji ukończenia w `plan.md:140`.
  - Reason: wiersz P6.1 w roadmapie dalej ma placeholder „⬜ gotowe” (brak daty i ID ticketa, wbrew
    zasadzie „roadmapa opisuje STAN, nie zamiar” z `CLAUDE.md`), wpis #26 dalej mówi „Status: — nie
    zaczęte” mimo że karta P6.1 jest jego częścią, a #90 dalej ma „karta niezałożona”. Branch nie ma
    committa analogicznego do „sync docs” z innych ticketów (por. `61-FEATURE`, `65-DOCS`). To
    dosłownie niespełniony punkt DoD z `plan.md:140`, nie kosmetyka.
  - Suggestion: dopisać commit aktualizujący oba pliki — P6.1 na „✅ zrobione” z datą i ID ticketa
    72, #26 zaktualizować o zakres faktycznie dowieziony (trzeci status na alertach importu), #90
    oznaczyć jako zrobione.

## SHOULD-FIX

Brak — nie znaleziono innych zastrzeżeń tego poziomu. Testy komponentowe (MSW, stan w pamięci) są
w pełni równoległe; logika filtrowania/grupowania i reguła `akcjeStatusu` są poprawne i pokryte
testami, które faktycznie coś sprawdzają (nie ma pustych/atrapowych asercji).

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/alerty/TabelaAlertow.tsx:315` (funkcja `przelaczRozwiniecie` /
  klucz grupy) — klucz grupy zawiera `status`, więc po akcji zmieniającej status grupy (np.
  „Oznacz jako przejrzany”) grupa dostaje NOWY klucz i wraca zwinięta, nawet jeśli poprzednia była
  rozwinięta. To zachowanie sprzed tego ticketu (klucz zawsze zawierał `status`), nie regresja —
  tylko warto rozważyć w P6.2/UX follow-upie, czy nie warto pamiętać rozwinięcia po
  `(dostawca, typ)` zamiast pełnego klucza.

## Plan compliance

### Done ✓
- BE: `StatusAlertu` poszerzony o `przejrzany` (`repos/alerts.ts`), komentarz w `routes/alerts.ts`
  zaktualizowany, nowy test GATE „PATCH na `przejrzany`” z przywróceniem stanu w `finally`.
- FE: nowy wspólny moduł `statusy.ts` (stałe, etykiety, `akcjeStatusu`) i `PrzyciskiStatusu.tsx`,
  bez zależności od `TabelaAlertow`/`grupowanie` — gotowe do reużycia przez P6.2.
- `api.ts` re-eksportuje `STATUS_NOWY`/`STATUS_ROZWIAZANY` — import w `pages/pulpit/kpi.ts` działa
  bez zmian, Pulpit nietknięty.
- `grupowanie.ts`: `FILTR_NIEROZWIAZANE`, `FiltryAlertow.fraza`, `filtrujAlerty` łączy status +
  dostawca + typ + fraza operatorem AND; filtrowanie idzie PRZED grupowaniem, więc semantyka D3
  („grupa z samych trafień”) jest zagwarantowana konstrukcyjnie (`widoczne = filtrujAlerty(...)`,
  potem `grupy = pogrupujAlerty(widoczne)` w `TabelaAlertow.tsx:130-131`).
- `TabelaAlertow.tsx`: pole wyszukiwania z `aria-label="Szukaj w treści alertu"` i
  `data-testid="input-alert-search"`, opcja „Nierozwiązane” w filtrze statusu, `PrzyciskiStatusu`
  na grupie i na wpisie, usunięte `przeciwnyStatus`/`etykietaAkcji`/`button-toggle-*`.
- Testy: `alerty.grupowanie.test.ts` (30 testów) i `alerty.test.tsx` (22 testy) zgodne z liczbami
  z raportu; pokrywają dokładnie to, co wymagał plan (trzy statusy jako trzy grupy, domyślny filtr,
  status nieznany, wyszukiwarka AND ze słowami, AND z filtrami, częściowe niepowodzenie, `akcjeStatusu`
  dla czterech przypadków łącznie z nieznanym statusem).
- `contract/`, migracje, `pages/Alerty.tsx`, `pages/pulpit/**` — potwierdzone bez zmian (`git diff`
  puste dla tych ścieżek).
- Stare komentarze/testidy „Oznacz jako rozwiązane”, „przeciwnyStatus”, „button-toggle-*” usunięte;
  jedyne pozostałe wystąpienie „Oznacz jako rozwiązane” to celowa asercja negatywna w teście
  (`alerty.test.tsx:280`).

### Missing or deviating ✗
- Roadmapa (`docs/rebuild-roadmap.md`) i backlog (#26, #90) nie zostały zsynchronizowane ze stanem
  — patrz BLOCKER wyżej. Raport.md mówi „Odstępstwa od planu: Brak”, co jest nieścisłe względem tego
  punktu DoD.

### Definicja ukończenia
- [x] `StatusAlertu` w BE zawiera `przejrzany`; GATE BE zielony razem z nowym testem (85 plików /
  1318 testów, zweryfikowane uruchomieniem).
- [x] Domyślny widok pokazuje `nowy` + `przejrzany`; oznaczenie grupy jako przejrzanej nie chowa jej
  (potwierdzone testem i logiką `pasujeStatus`/`FILTR_NIEROZWIAZANE`).
- [x] Przyciski według D2 na grupie i na wpisie; komunikat częściowego niepowodzenia uczciwy
  (test „Zmieniono 18 z 23 alertów”).
- [x] Wyszukiwarka po `opis` łączy się AND z filtrami; licznik i akcja grupy obejmują tylko
  trafienia (potwierdzone konstrukcją kodu + testami).
- [x] Statusy, etykiety i przyciski we wspólnym module (`statusy.ts`, `PrzyciskiStatusu.tsx`) bez
  zależności od reszty widoku alertów importu.
- [x] `lint`, `typecheck`, `build`, `test` zielone w BE i FE — zweryfikowane uruchomieniem
  wszystkich czterech bramek w obu katalogach.
- [ ] Roadmapa (wiersz P6.1) i backlog (#90, #26) opisują stan — NIE spełnione, patrz BLOCKER.

## Parallel-test concerns

None — testy FE korzystają z MSW i stanu w pamięci per plik testowy (`zamockujApi` tworzy nową
atrapę z lokalną tablicą `baza`), testy BE (`alerty.gate.test.ts`) używają środowiska testowego
z bazą tymczasową i przywracają stan w `finally`. Brak twardych portów, wspólnych plików czy
bazy współdzielonej między testami.

## Overall assessment

Implementacja jest solidna: logika filtrowania/grupowania jest poprawna i jej semantyka („grupa
z samych trafień”, AND filtrów, `akcjeStatusu`) wynika wprost z konstrukcji kodu, a nie tylko
z testów — trudno tu o regresję przy przyszłych zmianach. Moduł `statusy.ts`/`PrzyciskiStatusu.tsx`
jest czysto odseparowany i faktycznie gotowy pod P6.2. Jedyny realny problem to niespełniony,
jawnie wymieniony w DoD obowiązek zsynchronizowania roadmapy i backlogu — łatwy do naprawienia,
ale bez niego następna sesja (P6.2) dostanie nieaktualny stan wejściowy, co CLAUDE.md wprost
nazywa źródłem powtarzających się błędów w tym projekcie.
