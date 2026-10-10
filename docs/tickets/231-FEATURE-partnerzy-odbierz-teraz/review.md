# 231-FEATURE-partnerzy-odbierz-teraz — Code review

> Reviewed: 2026-10-10
> Branch: claude/peaceful-gates-a8yebr
> Diff: 15 plików (+419/-28) względem origin/develop, 1 commit ticketu (7395f71) + merge'e main/develop. Uruchomione: `partnerzy.odbierz-teraz.test.ts` + `partnerzy.odbior-email.test.ts` — 29/29 zielone.

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/src/partnerzy/odbior-email.ts:126-129` — gdy `pobierzNieprzeczytane()` (albo cała pętla) rzuci, wynik ma `polaczono:true`, `powod:null`, `bledy:0`, a panel pokazuje zielony toast „Odebrano pocztę … 0/0/0/0”.
  - Reason: dokładnie ten scenariusz (połączenie OK, ale np. SEARCH/SELECT INBOX się wywala) jest najbardziej prawdopodobny przy pierwszym teście na prawdziwej skrzynce, a przycisk służy do diagnozy. Ręczny odbiór kłamie, że się udało; błąd jest tylko w logach. Niespójne też z deklaracją „`powod` ≠ null, gdy nic nie odebrano”.
  - Suggestion: w `catch` ustawić `wynik.powod = "Odbiór przerwany: …"` (ten sam tekst co w logu, po `bezHasla`) i zwiększyć `bledy`; frontend powinien traktować `powod !== null` jako ostrzeżenie, nie tylko `!polaczono`. Dodać test (atrapa rzucająca w `pobierzNieprzeczytane`).
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:38-39` — `odswiez()` (refetch listy + dwie invalidacje) i zaraz po nim `invalidateQueries([KLUCZ_PARTNERZY, id])` (prefiks całego partnera).
  - Reason: lista zamówień jest pobierana 2-3 razy, a prefiks odświeża też szczegóły partnera, podgląd pliku, logi, błędy i każde otwarte szczegóły zamówienia. Formularze używają `useState(partner.…)` (inicjalizacja z propsów), więc niezapisane pola nie są nadpisywane — ale `partner` prop się zmienia, co daje zbędny ruch i ryzyko przy późniejszym dodaniu synchronizacji stanu. Podgląd pliku bywa kosztowny.
  - Suggestion: unieważnić wąsko: `kluczLogow(id)` i `kluczBledow(id, …)` (prefiks `[KLUCZ_PARTNERZY, id, "logi"]`/`"bledy"`) oraz listę zamówień raz; zostawić szczegóły partnera.
- [ ] `rebuild/backend/src/routes/partnerzy.ts:113-132` — brak testu 500 (nieoczekiwany wyjątek) i brak audytu przy 409/500/`polaczono:false`-z-wyjątkiem. Dodatkowo `console.error(... e.message)` w gałęzi 500 loguje surowy komunikat bez `bezHasla` (wyjątki spoza try/catch w `odbierz`, np. z bazy, raczej nie zawierają hasła, ale `otworz` rzucone synchronicznie jest już łapane wcześniej — więc ryzyko niskie).
  - Reason: obsługa 500 jest zadeklarowana w planie jako „bez wycieku szczegółów” — odpowiedź jest OK (komunikat generyczny), ale nietestowana.
  - Suggestion: test z atrapą `ustawienia.haslo` rzucającą wyjątek → 500 z generycznym komunikatem i zwolnionym zamkiem.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/partnerzy/odbior-email.ts:56-80` — identyfikacja własnego zamka przez `Date.now()` (`moj`): dwa przejęcia w tej samej milisekundzie (fake timers, mockowany czas) pozwolą pierwszemu zdjąć cudzy zamek. Użyć unikalnego tokenu (`Symbol`/licznik) zamiast znacznika czasu.
- [ ] `odbior-email.ts:57` — zamek wygasa po 15 min, a harmonogram zwalnia swój po 10 min (`limitPrzebieguMs`); po wygaśnięciu zawieszony odbiór nadal działa w tle i może pracować równolegle z nowym na tej samej skrzynce. Duplikaty chroni idempotentny zapis po numerze, więc to nie bug, ale warto zapisać w komentarzu (jest częściowo) i rozważyć test na wygasanie z `vi.useFakeTimers` (czy istnieje w `partnerzy.odbior-email.test.ts` — niezweryfikowane poza przejściem testów).
- [ ] `routes/partnerzy.ts:118-122` — `szczegolyPartnera` jest wołane dwa razy (raz w `idZParametru`, raz w trasie). Kolejność walidacji 404 → 503 → 409 jest poprawna i zgodna z planem; drobny koszt, można zwrócić partnera z jednego odczytu.
- [ ] `odbior-email.ts:111-113` — `powod` zawiera adres skrzynki i surowy komunikat serwera IMAP po zamaskowaniu tylko dokładnego hasła. Dostęp mają wyłącznie zalogowani użytkownicy wewnętrzni, więc akceptowalne; warto jednak nie rozszerzać `powod` o dane połączenia (host/port) w przyszłości.
- [ ] `ZamowieniaPartnera.tsx:52` — podpowiedź dla wyłączonego przycisku jest akapitem pod nagłówkiem, nie `title`/aria na przycisku; plan mówił „z podpowiedzią” — działa, ale dostępność (czytnik ekranu) słabsza. Dodać `title` na przycisku.
- [ ] `docs/instrukcja-testow-PARTNERZY.md:72` — nagłówek „1.7 Zamówienia z e-maila (tylko podgląd)” a opis opisuje akcję odbioru; zmienić na „Odbiór i podgląd zamówień z e-maila”.

## Plan compliance

### Done ✓
- Trasa `POST /api/partnerzy/:id/zamowienia/odbierz` za `requireAuth`: 404 (nieistniejący) → 503 (brak wstrzyknięcia) → 409 (brak kanału/adresu lub odbiór trwa) → 200 z wynikiem; audyt `partner_odbior_reczny`; poprawne statusy HTTP.
- Zamek per partner wspólny z harmonogramem (`odbierzZamowieniaEmail` jest jedynym wejściem; `odbierzDlaWszystkich` pomija partnera z `OdbiorTrwaError` bez logu błędu); wygasanie 15 min; nie zdejmuje cudzego zamka; `_zresetujZamkiOdbioru` używany tylko w testach.
- `WynikOdbioru.powod` (brak hosta/hasła z nazwą zmiennej bez wartości, awaria połączenia z maskowaniem hasła); spójny z tekstami w logach partnera (ten sam `tekst`).
- Wstrzykiwanie: `app.ts`/`aplikacja.ts` (testowe środowisko) — bez `odbiorEmail` trasa daje 503. `server.ts`: `odbiorEmail` (fabryka + ustawienia) jest tylko obiektem; połączenie z pocztą powstaje wyłącznie w ręcznej akcji, a timer rusza nadal tylko przy `PARTNERZY_ODBIOR_EMAIL`. Zamykanie (`zamknij`) zaktualizowane na `harmonogramOdbioru`.
- Panel: przycisk wyłączony bez kanału/adresu oraz w trakcie odbioru, toasty sukcesu i błędu, zmiana układu nagłówka na wrap (mobile).
- Instrukcja: rozdział 1.7 zgodny z kodem (przycisk aktywny tylko z kanałem i adresem, działa dla nieaktywnego, nazwa brakującej zmiennej w komunikacie, etykieta „Błędy i ostrzeżenia” istnieje w `GenerowanieILogi.tsx`, wzór XML jest w karcie PARTNERZY „Przykład zamówienia partnera”); tabela „Czeka na decyzję” zaktualizowana.
- Kontrakt: trasa poza `openapi.yaml` jak reszta `/api/partnerzy*`, wzmianka w planie — OK. Eksport do Selly/parsowanie cenników nietknięte.

### Missing or deviating ✗
- Plan: „`powod` — gdy nic nie odebrano”: nie obejmuje przerwania odbioru po udanym połączeniu (patrz SHOULD-FIX 1).
- Plan: „wyłączony z podpowiedzią” — podpowiedź jako tekst pod nagłówkiem, nie na przycisku (NICE-TO-HAVE).

### Definition of done
- [ ] Bramki backendu i frontendu zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop` — nie zweryfikowano w tym review (pełne bramki biegną osobno); dwa pliki testów backendu przechodzą (29/29). Raport odsyła do PR bez wyników.

## Parallel-test concerns

None — testy trasy używają bazy tymczasowej i atrapy skrzynki (brak portów/plików stałych). Uwaga: zamki są stanem modułu (globalnym dla procesu vitest), ale pliki testowe biegną w osobnych workerach, a testy wołają `_zresetujZamkiOdbioru()` w `start`; w `partnerzy.odbior-email.test.ts` należy to samo zapewnić w `beforeEach` (nie zweryfikowano).

## Overall assessment

Zmiana jest czysta, mała i dobrze przetestowana; zamek (Map z czasem, wygasanie, ochrona przed zdjęciem cudzego) i kolejność walidacji trasy są poprawne, a domyślnie przy starcie nic nie łączy się z pocztą. Główna uwaga: ręczny odbiór raportuje sukces, gdy odbiór został przerwany po połączeniu (brak `powod`/`bledy`), co obniża wartość diagnostyczną przycisku właśnie w pierwszym teście na prawdziwej skrzynce; do tego zbyt szeroka invalidacja cache. Brak blockerów.
