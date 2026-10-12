# 239-FEATURE-partnerzy-odbior-zamowien-z-plikow — Code review

> Reviewed: 2026-10-12
> Branch: claude/peaceful-gates-a8yebr
> Diff: 7 plików (+273), 1 commit własny (bdcb3cd). Testów nie uruchamiano (zgodnie z poleceniem); raport.md nie podaje wyników testów ("Bramki w CI PR").

## BLOCKER

Brak. Kolejność jest poprawna: `zapiszZamowienie` (transakcja `immediate`, idempotentna po `(partner, numer)`) idzie PRZED `renameSync`, więc nie ma utraty zamówienia przy awarii procesu. Kanał jest domyślnie wyłączony, a odczyt idzie tylko z katalogu z mapowania, bez rekursji. `done/` nie jest skanowany ponownie. Nazwy pochodzą z `readdirSync` (bez separatorów), więc path traversal przez nazwę nie występuje.

## SHOULD-FIX

- [ ] `rebuild/backend/src/partnerzy/odbior-plikow.ts:55` — `statSync` idzie za symlinkami, a `isFile()` jest wtedy prawdziwe dla celu linku.
  - Reason: partner z SFTP/shellem może wgrać `x.xml` -> dowolny plik czytelny dla użytkownika Bridge. Proces działa jako ten sam użytkownik co produkcja i środowisko testowe, więc odczyt wykracza poza katalog partnera. Skutek jest ograniczony: `.xml`, parser najczęściej odrzuci treść, a `surowyXml` zapisałoby się tylko dla poprawnego zamówienia. Dalej `rename` przenosi sam link.
  - Suggestion: `lstatSync` + `isFile()` (symlink pomijany z wpisem w logu), ewentualnie `realpath` w obrębie katalogu. To samo dotyczy `done/` jako symlinku do `mkdirSync`.
- [ ] `odbior-plikow.ts:86-90` (blok `catch` infrastruktury) + `:93` — plik, którego nie da się przenieść (brak praw do `done/`, `done` jest plikiem, ENAMETOOLONG przy `BLAD_`+długa nazwa, ENOENT po wyścigu), zostaje, a CO 5 MIN każdy przebieg dopisuje wiersz do `partner_error_log` i `partner_logi` ("Odebrano N plików…", bo `plikow>0`). To zapętlenie logów (~288 wierszy na dobę na plik, retencja kilkudziesięciu dni). Dodatkowo po zapisie do bazy przy nieudanym przeniesieniu plik liczy się w kółko jako `duplikaty`.
  - Suggestion: nie logować, gdy zamówienie jest już zapisane, a problem dotyczy tylko przeniesienia (jeden wpis na plik, np. dedup po treści z ostatnich N godzin), albo po nieudanym przeniesieniu próbować przenieść do `BLAD_`. Przy `zwaliduj` rzucającym wyjątek (nie `BladZamowienia`) jest ta sama pętla.
- [ ] `odbior-plikow.ts:44-48` — brak/niedostępny katalog `orders` (odmontowany, zła ścieżka w `.env`) = nowy wiersz błędu co przebieg, bez deduplikacji. Ta sama przyczyna co wyżej (flood). Warto ograniczyć do jednego wpisu na zmianę stanu/godzinę.
- [ ] `tools/deploy-staging.sh` (nie zmieniony w tym ticketcie) — środowisko testowe działa na tym samym serwerze i użytkowniku, ale ma osobną bazę. Jedyną barierą jest "mapowanie tylko w `.env` produkcji" (wpis-239.md). Jeśli ktoś skopiuje `.env` z produkcji na środowisko testowe (skrypt już raz się tego obawiał przy `SELLY_*`, `deploy-staging.sh:42`), TEST zaimportuje zamówienia do SWOJEJ bazy i przeniesie pliki do `done/`, a produkcja ich nie zobaczy = realna utrata zamówień.
  - Suggestion: w `deploy-staging.sh` wymusić `PARTNERZY_ODBIOR_PLIKOW=false` i puste `PARTNERZY_KATALOGI_ZAMOWIEN` (wzorem guardu Selly), osobnym, jasno opisanym PR-em (to ścieżka wdrożenia). Włączenie flagi na produkcji ma iść krokiem wdrożenia przez `ustawWEnvPliku` (CLAUDE.md pkt 7), czego plan nie opisuje.
- [ ] `odbior-plikow.ts:35-36` — `existsSync` + `renameSync`: TOCTOU. `rename` w POSIX nadpisuje cel, więc przy równoczesnym drugim procesie (nakładanie starego i nowego procesu PM2 w trakcie wdrożenia, oba na tej samej bazie) lub równoległym zapisie do `done/` można zgubić wcześniej zarchiwizowany plik o tej samej nazwie. Zapis w bazie jest bezpieczny (transakcja `immediate` + idempotencja), ale drugi proces dostanie ENOENT i zaloguje fałszywy błąd. Suggestion: `linkSync`+`unlinkSync` lub `copyFileSync` z `COPYFILE_EXCL`, ENOENT traktować jako "już przetworzony".
- [ ] `odbior-plikow.ts:52-56` — okno 30 s opiera się wyłącznie na mtime. Wgrywanie przerwane/zawieszone na >30 s da obcięty XML, który zostanie przeniesiony jako `BLAD_…` i nie wróci, a partner nie dostanie żadnej informacji (to zgodne z "bez powiadomień", ale warto to zaznaczyć w dokumentacji operacyjnej). Rozważyć: błąd parsowania pliku młodszego niż np. 5 min = pominąć i ponowić, a nie archiwizować jako błąd.
- [ ] `odbior-plikow.ts:65-76` — przypadek "to samo zamówienie, inna treść" tylko ostrzega i przenosi plik do `done/` (poprawka partnera po stronie Bridge znika bez śladu poza logiem). Zgodne z idempotencją z e-maila, ale to świadoma decyzja, którą plan powinien potwierdzić.
- [ ] Raport (`raport.md`) nie zawiera wyników testów/bramek, a PR-y wymagają ich zielonych. Uzupełnić po uruchomieniu CI.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/server.ts:144` — komunikat błędu parsowania mówi o `PARTNERZY_KATALOGI_PUBLIKACJI`, a parsuje się `PARTNERZY_KATALOGI_ZAMOWIEN` (wspólny parser). Dodać parametr z nazwą zmiennej.
- [ ] `server.ts:~214` — flaga włączona przy pustym mapowaniu = ciche nic; wypisać ostrzeżenie przy starcie.
- [ ] `odbior-plikow.ts:38` — synchroniczne I/O w pętli zdarzeń; przy zawieszonym montowaniu zablokuje cały backend. Plik z mtime w przyszłości (zły zegar FTP) jest pomijany bez końca i bez wpisu.
- [ ] `odbior-plikow.ts:60` — limit sprawdzany w bajtach, a `parsujZamowienie` w znakach (`xml.length`); drobna rozbieżność, bez skutku bezpieczeństwa.
- [ ] `odbior-plikow.ts:107` — `and(eq(...))` z jednym warunkiem; uproszczenie kosmetyczne.

## Plan compliance

### Done ✓
- `partnerzy/odbior-plikow.ts`: ta sama ścieżka co e-mail (`zapiszZamowienie` + `zwaliduj` informacyjnie), `done/`, `BLAD_`, 30 s, limit rozmiaru przed odczytem, wyjątek infrastruktury zostawia plik.
- Harmonogram za flagą domyślnie wyłączoną, interwał 5 min, zatrzymanie w `zamknij()`, błędne mapowanie nie przewraca backendu.
- Flagi w `env.ts`; wpis `docs/spec-backend/wpis-239.md` (plik-per-ticket); test `test/partnerzy.odbior-plikow.test.ts` (katalogi tymczasowe, bez portów — równoległość OK).

### Missing or deviating ✗
- Plan nie opisuje sposobu włączenia flagi na produkcji (krok wdrożenia) ani zabezpieczenia środowiska testowego po stronie `deploy-staging.sh`.
- Brak wyników testów w raporcie.

### Definition of done
- [x] Odbiór XML z katalogu, `done/`, błędy w `partner_error_log` — zaimplementowane.
- [x] Nieaktywny bez flagi.
- [ ] Odporność na utratę zamówień na styku prod/środowisko testowe — tylko konwencją w `.env` (patrz SHOULD-FIX).
- [ ] Wyniki testów w raporcie — brak.

## Parallel-test concerns

None — test używa `mkdtempSync` i własnej bazy w katalogu tymczasowym.

## Overall assessment

Rdzeń jest poprawny: zapis do bazy jest przed przeniesieniem pliku, idempotencja chroni przed duplikatami, a nazwy z katalogu nie dają path traversal. Główne ryzyka to symlinki (`statSync`), zapętlenie logów przy trwale nieprzenoszalnym pliku lub niedostępnym katalogu, oraz izolacja środowiska testowego opierająca się tylko na konwencji w `.env`. Żaden z nich nie blokuje merge'a (kanał jest domyślnie wyłączony), ale symlinki i guard w `deploy-staging.sh` warto załatwić przed włączeniem flagi na produkcji.
