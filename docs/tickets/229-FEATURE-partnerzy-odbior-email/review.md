# 229-FEATURE-partnerzy-odbior-email — Code review

> Reviewed: 2026-10-10
> Branch: claude/peaceful-gates-a8yebr
> Diff: 13 plików (+1084), 1 commit (3b03dc0)

Sprawdzono: kod źródłowy, `node_modules/imapflow` (dist/esm), uruchomiono `npx vitest run test/partnerzy.odbior-email.test.ts` (12/12 zielone). Pełnych bramek nie uruchamiano (biegną u Mastera).

## BLOCKER

- [ ] `src/partnerzy/poczta-imap.ts:19` — klient `ImapFlow` nie ma nasłuchu zdarzenia `'error'`.
  - Reason: po udanym `connect()` imapflow zgłasza późniejsze błędy gniazda (zerwana sesja, `socketTimeout`, reset przez serwer) przez `this.emit('error', err)` (`dist/esm/imap-flow.js:304`). EventEmitter bez listenera rzuca wtedy wyjątek, a w `src` nie ma `uncaughtException`, więc **proces produkcyjnego backendu padnie** (to cały Bridge, nie tylko odbiór). Przy zerwaniu połączenia w trakcie odbioru (scenariusz wprost wymieniony w raporcie jako follow-up) to realne.
  - Suggestion: zaraz po `new ImapFlow(...)` dodać `klient.on("error", ...)` (zapamiętać błąd i zwracać go z następnej operacji / logować bez sekretu); to samo dla `close`, żeby wiedzieć, że sesja padła.
- [ ] `src/partnerzy/poczta-imap.ts:43-48` (+ `odbior-email.ts:68-72`) — jedna „zła" wiadomość blokuje wszystkie pozostałe, na stałe (poison pill).
  - Reason: `pobierzNieprzeczytane` parsuje wszystkie wiadomości w jednej pętli; wyjątek `simpleParser`/`fetchOne` dla jednej wiadomości przerywa całą metodę, więc `odbior-email.ts` łapie to jako „Odbiór przerwany", a wiadomość zostaje nieprzeczytana i **przy każdym kolejnym przebiegu psuje ten sam krok** — zamówienia z następnych wiadomości nigdy nie zostaną odebrane. Analogicznie w `odbior-email.ts`: wyjątek z `przetworz` albo z `w.oznaczPrzetworzona()` (np. błąd `messageFlagsAdd`) wychodzi z pętli `for` i porzuca resztę wiadomości. Wymaganie (2) z zadania — „czy jedna zła wiadomość blokuje pozostałe" — nie jest spełnione.
  - Suggestion: izolować błąd per wiadomość: w IMAP parsować leniwie (iterator / pobranie i parsowanie w momencie przetwarzania) i błąd parsowania jednej wiadomości zamieniać na wiadomość z flagą „nieczytelna" (log + oznaczenie `\Seen`); w pętli `odbior-email.ts` łapać wyjątek per wiadomość, logować do `partner_error_log`, kontynuować, a wiadomość zostawić nieprzeczytaną tylko przy awarii infrastruktury (i wtedy też nie przerywać reszty — lub przerwać świadomie, ale z limitem prób, żeby jedna wiadomość nie blokowała kanału w nieskończoność).

## SHOULD-FIX

- [ ] `src/partnerzy/poczta-imap.ts:23-45` — wszystkie wiadomości są ładowane do pamięci naraz: do 200 × `source` + sparsowane załączniki (`Buffer`) w tablicy `wynik`, zanim zacznie się przetwarzanie.
  - Reason: limit 10 MB jest „na wiadomość", ale sumarycznie to nawet ~GB w procesie produkcyjnym. Dodatkowo limit rozmiaru sprawdzany jest **po** `fetchOne(..., { source: true })`, czyli duża wiadomość i tak jest w całości pobrana (limit nie chroni pamięci).
  - Suggestion: najpierw `fetchOne` z samym `{ size: true }` (albo `envelope`), dopiero potem `source`; przetwarzać strumieniowo/leniwie wiadomość po wiadomości (zwalniać po `oznaczPrzetworzona`); obniżyć `MAKS_WIADOMOSCI_NA_ODBIOR`.
- [ ] `src/partnerzy/poczta-imap.ts:21-22` — przy błędzie po `connect()` (np. `getMailboxLock` rzuci) połączenie nie jest zamykane (brak `logout`/`close`), bo `zamknij()` nie powstało.
  - Reason: wyciek gniazda/sesji na każdym nieudanym przebiegu (co 5 min).
  - Suggestion: `try { lock } catch { await klient.logout().catch(()=>klient.close()); throw }`. W `zamknij()` przy zerwanej sesji `logout` bywa niepewny — rozważyć `klient.close()` jako fallback.
- [ ] `src/partnerzy/odbior-email.ts:46-49` — brak sekretu zapisuje ostrzeżenie do `partner_error_log` **w każdym przebiegu** (co 5 min ≈ 288 wpisów/dobę/partner), bez deduplikacji.
  - Reason: CLAUDE.md wymaga „pomijaj z wpisem w logu" — wpis jest, ale zaśmieca log; retencja (`wyczyscLogi`) jest wołana tylko z `zapiszWynikGenerowania`, więc dla partnera bez generowania wpisy nie są sprzątane przez 30 dni logiki (tabela rośnie bez końca). Ten sam efekt dla stałej awarii połączenia (`odbior-email.ts:57`).
  - Suggestion: zapisywać wpis o pominięciu raz (np. gdy ostatni wpis tego typu jest identyczny / starszy niż doba) i wołać `wyczyscLogi` także z odbioru.
- [ ] `src/partnerzy/odbior-email.ts:60-72` — semantyka „wyjątek infrastruktury zostawia nieprzeczytaną" działa, ale zapis po częściowym przetworzeniu: wiadomość z 2 załącznikami XML, gdzie pierwszy zapisał się, a drugi rzucił wyjątek DB, zostanie ponowiona — OK dzięki idempotencji 228 — jednak `wynik.nowe` i licznik w logu operacji **nie są zapisywane** (wyjątek omija `zapiszOperacje`), więc nowo zapisane zamówienia nie mają śladu w `partner_logi`.
  - Suggestion: zapisywać linię operacji w `finally` (lub po każdej wiadomości).
- [ ] `src/partnerzy/odbior-email.ts:97-99` — ewentualny wyjątek z `zapiszBlad` w gałęziach błędu (np. baza zablokowana) nie jest osłonięty przy `otworz`/„pominięty"; w `odbierzDlaWszystkich` wyjątek jednego partnera przerywa pętlę pozostałych, mimo komentarza „Błąd jednego nie zatrzymuje pozostałych".
  - Suggestion: `try/catch` wokół `odbierzZamowieniaEmail` w pętli `for` z logiem bez sekretów.
- [ ] Testy — niepełne względem ryzyk z punktów BLOCKER: brak testu (a) wyjątku z `pobierzNieprzeczytane`, (b) wyjątku z `oznaczPrzetworzona` w środku listy i kontynuacji następnych wiadomości, (c) kilku wiadomości w jednym przebiegu z jedną błędną, (d) dwóch załączników XML w jednej wiadomości, (e) wyjątku z `zamknij`. `poczta-imap.ts` (adapter, ~60 linii logiki: limity, `slice`, `size`) nie ma żadnego testu, nawet z ręcznie zamockowanym `ImapFlow` (`vi.mock("imapflow")`) — da się sprawdzić zwalnianie blokady i obsługę zdarzenia `error` bez sieci.
- [ ] `src/partnerzy/odbior-email.ts:55` / testy — `tick()` nie ma timeoutu całego przebiegu: zawieszona operacja IMAP (poza `socketTimeout` 5 min imapflow) blokuje flagę `trwa` na zawsze i odbiór staje bez śladu w logu.
  - Suggestion: `Promise.race` z limitem czasu na partnera lub jawne `connectionTimeout`/`socketTimeout` w opcjach `ImapFlow` (krótsze niż domyślne).

## NICE-TO-HAVE

- [ ] `src/partnerzy/odbior-email.ts:57,70` — komunikaty błędów z `e.message` biblioteki IMAP trafiają do `partner_error_log` widocznego w panelu. imapflow nie wkleja hasła do `message` (sprawdzono: `logger:false`, błędy auth niosą `responseText` serwera), więc dziś sekret nie wycieka, ale warto defensywnie wycinać `haslo` z komunikatu (`replaceAll`) i dodać test, że `haslo` nie występuje w `partner_error_log`.
- [ ] `src/server.ts:129` — hasła czytane przez `process.env["PARTNERZY_IMAP_HASLO_<id>"]` poza `env.ts`. Zgodne z opisaną decyzją i wzorcem (zmienna dynamiczna, nie da się jej zadeklarować w schemie), ale warto odnotować to jednym zdaniem w `docs/` (jest w komentarzu `env.ts`; OK). Zadbać, by `wczytajEnv` ładował `.env` do `process.env` (zweryfikować na środowisku testowym).
- [ ] `src/partnerzy/poczta-imap.ts:21` — `secure: konfig.port === 993`; dla innych portów imapflow zrobi oportunistyczny STARTTLS, a gdy serwer go nie ma, połączy się bez szyfrowania (hasło jawnie). Rozważyć `doSTARTTLS: true`/wymuszenie TLS albo jawną flagę.
- [ ] `src/partnerzy/odbior-email.ts:36` — `czyXml` łapie dowolny typ zawierający „xml" (np. `application/vnd.openxmlformats-…` czyli pliki `.xlsx`/`.docx`); wynik to błędny „XML" w error_log zamiast ignorowania. Zawęzić do `text/xml`/`application/xml` lub rozszerzenia.
- [ ] `src/partnerzy/odbior-email.ts:92` — `plik.tresc.toString("utf-8")` ignoruje deklarowane kodowanie (`encoding="ISO-8859-2"`) i BOM; sprawdzić zgodnie z parserem 228.
- [ ] `src/partnerzy/poczta-imap.ts:30` — wiadomość „za duża" dostaje temat „(pominięta: za duża)", a w `przetworz` kończy jako „brak załącznika XML" — mylący komunikat; lepiej osobny, jawny wpis „wiadomość pominięta: rozmiar X B".
- [ ] `docs/spec-backend/wpis-229.md` — dodać wzmiankę o ryzykach nieprzetestowanego adaptera IMAP (po poprawkach z BLOCKER) oraz o zachowaniu `\Seen` (imapflow używa `BODY.PEEK`, więc samo pobranie nie oznacza wiadomości — potwierdzone w `dist/esm/commands/fetch.js`).

## Plan compliance

### Done ✓
- Interfejs skrzynki (`poczta.ts`) i adapter IMAP za nim; atrapa w testach, żadnej prawdziwej poczty.
- `odbierzZamowieniaEmail` / `odbierzDlaWszystkich`: tylko aktywni partnerzy z `kanal_email` + `email_skrzynka`, zapis przez `zapiszZamowienie`, logi do `partner_logi`/`partner_error_log`.
- Pomijanie kanału bez hosta/hasła z wpisem w logu, bez wyjątku (zgodne z pkt 2 CLAUDE.md co do pomijania).
- Harmonogram za flagą domyślnie wyłączoną (`PARTNERZY_ODBIOR_EMAIL`), interwał, `.env.example`, zmienne w `env.ts` zgodne z konwencją (`flagaBoolDomyslnieWylaczona`, `z.coerce`).
- Brak tras REST, brak zmian kontraktu — GATE kontraktu N/D słusznie.
- Zależności przypięte; `@types/mailparser` jako dev.

### Missing or deviating ✗
- „Błąd jednego nie zatrzymuje pozostałych" (komentarz przy `odbierzDlaWszystkich`) i izolacja wiadomości — niedotrzymane, zob. BLOCKER 2 i SHOULD-FIX.
- „Wyjątek infrastruktury zostawia wiadomość nieprzeczytaną — zostanie ponowiona": działa, ale bez ochrony przed zapętleniem i blokadą pozostałych wiadomości.
- „Brak hosta/hasła → pomijany z wpisem w logu": spełnione, ale z lawiną wpisów (SHOULD-FIX).
- Przypięcie wersji „starszych niż 2 tygodnie" — nie weryfikowano dat publikacji (w diffie nie ma dowodu poza deklaracją).

### Definition of done
- [ ] Testy i bramki zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop` — testy tego ticketu zielone (12/12), pełne bramki i `mergeable` nie zweryfikowane w tym review; raport odsyła do PR. Adapter IMAP bez testów i bez próby na prawdziwym serwerze (raport to przyznaje).

## Parallel-test concerns

None — wszystkie testy używają `stworzSrodowiskoTestowe()` (baza w katalogu tymczasowym) i atrapy skrzynki, bez portów i stałych ścieżek.

## Overall assessment

Rdzeń (`odbior-email.ts`) jest czytelny, dobrze osadzony na modelu 228, z sensowną semantyką „oznacz po próbie" i dobrymi testami na atrapie. Najpoważniejsze problemy leżą w nieprzetestowanym adapterze IMAP: brak nasłuchu `'error'` klienta może wywrócić cały proces Node, a brak izolacji błędów per wiadomość pozwala jednej uszkodzonej wiadomości zablokować cały kanał na stałe. Po poprawce tych dwóch punktów i uzupełnieniu testów (mock `imapflow` + scenariusze wielu wiadomości) ticket nadaje się do merge'u z odbiorem domyślnie wyłączonym.
