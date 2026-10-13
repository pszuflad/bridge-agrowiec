# 247-FEATURE-partnerzy-reguly-narzutow — Code review

> Reviewed: 2026-10-13
> Branch: claude/peaceful-gates-a8yebr
> Diff: 15 plików, 1 commit (8b0e132). Testów pełnych nie uruchamiano (zgodnie z poleceniem).

## BLOCKER

Brak.

Sprawdzone pod kątem blokerów:
- Brak reguł: `reguly.length ? ... : null` w `selekcja.ts:163-167` daje `narzutProc = k.narzutProc`, więc kraj, warunek `> 0` i `obliczCene` dostają dokładnie te same liczby co przed zmianą. Cena jest bit-w-bit jak przedtem. Zmienił się tylko tekst błędu (patrz SHOULD-FIX 3).
- Injection: warunki idą przez `JSON.stringify` i parametryzowany Drizzle. `typ` jest ograniczony do białej listy `TYPY_WARUNKOW`. `wartosc` to tekst ≤ 80 znaków, używany tylko w `includes` i `===`, bez regexa i bez SQL. Brak wektora.
- Zasada sklepu: `wybierzRegule` odtwarza `wybierzNarzut` (`repos/ceny.ts:147`). Specyficzna reguła bije globalną, a pierwsza globalna jest zapasowa. Do tego dochodzi deterministyczny tie-break, który jest świadomą różnicą opisaną w planie.

## SHOULD-FIX

- [ ] `rebuild/backend/src/partnerzy/reguly-narzutow.ts:44-52` + `selekcja.ts:166` — `wybierzRegule` jest wołane dla każdej pary pozycja × kraj. Przy każdym wywołaniu kopiuje i sortuje całą listę reguł (`[...reguly].sort`) oraz robi `JSON.parse` warunków do 3 razy na regułę (`pasuje`, potem `warunkiReguly(...).length`).
  - Reguły są ładowane raz (dobrze), ale ich parsowanie i sortowanie dzieje się ~5 tys. × kraje × reguły razy. Przy ~5 krajach i 20 regułach to ~25 tys. sortowań i setki tysięcy `JSON.parse` na jedną wycenę, na ścieżce generowania cennika.
  - Suggestion: przed pętlą raz posortuj reguły i wstępnie sparsuj warunki (np. `PrzygotowaneReguly = {r, warunki, kraj}[]`, ewentualnie pogrupowane po kraju), a w pętli tylko filtruj i dopasowuj.
- [ ] `rebuild/backend/test/partnerzy.reguly-narzutow.test.ts` — brak testu regresji "partner bez reguł = ceny identyczne jak przed zmianą" na tym samym zestawie. Brak też testu wyceny dla: reguły z krajem spoza `partner_kraje`, reguły przy kraju z narzutem 0 % (pokrycie części pozycji, jeden błąd na kraj), pola `srednica`/`vfIf`/`bieznik`/`konstrukcja` pobieranego przez `wybierzPozycje`. Nowe pola w selekcji są jedynym nowym kontaktem z `products` na ścieżce krytycznej.
- [ ] `selekcja.ts:173` — tekst błędu zmienia się także dla partnerów bez żadnych reguł ("... i żadna reguła nie pasuje do części pozycji ..."). Jest to mylące, gdy reguł w ogóle nie ma. Testy dopasowują prefiks regexem (`partnerzy.selekcja.test.ts:143`, `konfiguracja-startowa.test.ts:108`), więc przechodzą. Jeśli ten tekst czyta UI albo log operacji, zachowanie "bez reguł" nie jest już identyczne.
  - Suggestion: stary komunikat, gdy `reguly.length === 0`.
- [ ] Reguła z krajem spoza `partner_kraje` jest cicho ignorowana (`kraj` jest walidowany tylko jako 2 litery, `repos/partnerzy-narzuty.ts:35-38`). Sugestia: odrzucić w POST/PATCH (400), jeśli partner nie ma tego kraju. Jeśli to zamierzone (kraj dodany później), warto to opisać w UI.
- [ ] `routes/partnerzy.ts:178,187` — `Number(req.params.regulaId)` bez sprawdzenia `isInteger`. `"abc"`/`"1.5"` kończy się 404, więc nie jest to błąd, ale jest niespójne z `idZParametru`. Mutacja reguły nie zmienia nic poza 404, więc niski priorytet.
- [ ] Brak wpisu w `contract/openapi.yaml`. Trasy `/api/partnerzy*` nie występują w kontrakcie w ogóle (grep), więc to spójne z dotychczasową praktyką. Brak też wzmianki o tym w `plan.md`. Trzeba potwierdzić, że moduł partnerów jest świadomie poza kontraktem.

## NICE-TO-HAVE

- [ ] `repos/partnerzy-narzuty.ts` — walidacja nie wymusza unikalności nazwy. Niski priorytet.
- [ ] Globalna reguła (bez warunków, kraj = wszystkie) przesłania WSZYSTKIE narzuty krajów (także wyższe), bo "pasująca reguła zastępuje narzut kraju". Plan to potwierdza, ale w UI warto dodać ostrzeżenie przy zapisie takiej reguły.
- [ ] Nie da się wyrazić reguły "nie publikuj" (`wartosc > 0`). Zgodne z planem. Wspomnieć w UI/dokumentacji.
- [ ] `NarzutyPartnera.tsx` — sekcja nie ma ostrzeżenia, że zmiana reguły nie przelicza niczego natychmiast. Jest to w opisie, więc wystarczy.
- [ ] `reguly-narzutow.ts:20-30` — `warunkiReguly` rzutuje `unknown` na `WarunekReguly[]` bez sprawdzenia elementów. Dla danych z walidowanego API jest bezpieczne. Przy ręcznie edytowanej bazie element `null` rzuciłby wyjątkiem w `dopasujWarunek` i przerwał wycenę. Warto odfiltrować elementy niebędące obiektami.

## Plan compliance

### Done ✓
- Migracja 033 (`partner_narzuty`, indeks), model w `schema.ts`, wpis w `schema/README.md`, aktualizacja liczników w `db.migracje.test.ts`.
- Silnik `partnerzy/reguly-narzutow.ts` reużywa `dopasujWarunek`.
- Integracja w `wycenPozycje`: reguła zastępuje narzut kraju, narzut ≤ 0 bez reguły = brak publikacji.
- API GET/POST/PATCH/DELETE `/api/partnerzy/:id/narzuty[/:regulaId]` z audytem i walidacją.
- UI `NarzutyPartnera.tsx` (z polem priorytetu), wpięty w `PartnerSzczegoly.tsx`.
- Testy backendu i frontendu, wpis `spec-backend/wpis-247.md`.

### Missing or deviating ✗
- `raport.md` jest bardzo skąpy: "Bramki w CI PR", bez wyników testów lokalnych. Gate'a na fixtures nie wykonano ani nie opisano jako niepotrzebnego.
- Sam plan nie zawiera sekcji Definition of done.

### Definition of done
- [x] Funkcjonalność z planu dowieziona w diffie.
- [ ] Wyniki testów w raporcie — niepotwierdzone, odesłano do CI.

## Parallel-test concerns

None — testy używają bazy w pamięci/katalogu tymczasowym i istniejących helperów (wg diffu brak stałych portów i ścieżek).

## Overall assessment

Zmiana jest zachowawcza dla partnerów bez reguł: te same liczby trafiają do kalkulatora, a tabela jest nowa i pusta. Walidacja jest solidna, a wektora injection nie ma. Główne uwagi dotyczą wydajności (sortowanie i parsowanie JSON per pozycja × kraj), zmiany tekstu błędu także bez reguł oraz braku testu regresji z regułami i bez nich na tym samym zbiorze. Bloker nie zachodzi.
