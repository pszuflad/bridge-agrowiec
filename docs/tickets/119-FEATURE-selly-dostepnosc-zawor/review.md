# 119-FEATURE-selly-dostepnosc-zawor — Code review

> Reviewed: 2026-09-23
> Branch: feature/119-selly-dostepnosc-zawor
> Diff: 7 plików, 3 commity (`249bccd`, `4e92415`, `3dfc7c9`), wobec `origin/develop`

## BLOCKER

- [ ] `docs/karty/I15.10/karta.md`, `docs/karty/I15.4/` (brak `wejscie-119.md`), `docs/spec-backend/` (brak `wpis-119.md`), `docs/rebuild-backlog.md` (#104, #108) — dokumentacja karty i backlogu NIE została zaktualizowana, mimo że plan.md Krok 7 i ostatni punkt Definition of done tego wymagają.
  - Reason: To bezpośrednie naruszenie DoD z `plan.md` („Karta I15.10 opisuje STAN; `wejscie-119.md` dla I15.4; roadmapa nietknięta”) i wprost zasady projektu z `CLAUDE.md` (pkt 1–2: karta ma opisywać STAN po zamknięciu, a ustalenie dla przyszłej karty idzie do JEJ katalogu). `karta.md` w tym worktree nadal pokazuje `Stan: ⬜ po I15.4 i I15.3`, `Dowiezione: —`, `Do koordynatora: —` — czyli stan sprzed ticketu, mimo że opis w `raport.md` mówi o realnym domknięciu zakresu. Poważniejszy skutek: krytyczna wiedza bezpieczeństwa z „Follow-up 2” raportu (hook I15.4 NIE MOŻE wołać `zadajOdswiezenie()` bezwarunkowo z wnętrza `syncDelta` — potwierdzone eksperymentalnie OOM) jest dziś WYŁĄCZNIE w `raport.md` tego ticketu, którego sesja I15.4 zgodnie z konwencją projektu nie czyta — powinna trafić do `docs/karty/I15.4/wejscie-119.md`. Bez tego karta I15.4 może odtworzyć ten sam błąd.
  - Suggestion: Przed mergem dopisać `docs/karty/I15.10/karta.md` (Stan ✅, Dowiezione = zakres z raportu, Do koordynatora = uwaga o #104/#108 statusach), utworzyć `docs/karty/I15.4/wejscie-119.md` z treścią „Follow-up 2” z `raport.md`, oraz zaktualizować kolumnę „Status” wpisów #104 i #108 w `docs/rebuild-backlog.md`. `docs/spec-backend/wpis-119.md` — do oceny, czy ticket wprowadza coś, co tam należy (np. semantyka kolejki/zaworu), zgodnie z regułą pliku `docs/spec-backend/README.md`.

## SHOULD-FIX

- [ ] `rebuild/backend/test/selly.dostepnosc.test.ts:155-175` — komentarz w teście „błąd przerywający partię zostawia niedokończonych dostawców w kolejce” i „…ale zgłoszenie nie ginie: oryginał restartuje bieg z `finally`” jest mylący względem tego, co test faktycznie potwierdza.
  - Reason: Zweryfikowałem niezależnie: gdy błąd wystąpi w środku partii (`MO9` rzuca, `MO2` czeka w tej samej partii), `MO2` jest FAKTYCZNIE UTRACONE w tym obrocie — nie trafia z powrotem do `oczekujace`, więc `finally` nie robi restartu (`zostalo.length === 0`). Test to poprawnie asercjuje (`slad` kończy się na `["csv", "delta:MO9"]`, bez drugiej rundy), ale komentarz sugeruje coś przeciwnego. To wierny port zachowania oryginału (`availability_sync.cjs`: `suppliers` to lokalna kopia, `pending` już wyczyszczone) — nie jest to błąd w kodzie, tylko nieścisłość opisu, która może zmylić kartę I15.4 co do gwarancji „zgłoszenie nigdy nie ginie” z nagłówka modułu (`dostepnosc.ts:10-17`) i z `plan.md:51`.
  - Suggestion: Doprecyzować komentarz testu i nagłówek modułu — zaznaczyć, że gwarancja „nie ginie” dotyczy zgłoszeń jeszcze niepobranych do bieżącej partii; utracone przez błąd w środku partii wraca dopiero przez okresową synchronizację (jak w oryginale).
- [ ] `rebuild/backend/test/alerty-katalogu.gate.test.ts:267` (poza diffem tego ticketu) — test „paczka równa limitowi 20 000 id” timeoutuje (20 s) także w izolacji (~37-50 s), niezwiązane z tym ticketem.
  - Reason: To nie jest regresja wprowadzona przez ten diff (plik nietknięty), ale sygnalizuję zgodnie z zasadą „flag non-parallelizable/flaky tests”: test jest na granicy/ponad domyślnym `testTimeout` nawet bez współbieżności, więc pod obciążeniem (np. kilku agentów jednocześnie odpalających `npm test`) będzie fałszywie czerwony i może zmylić GATE tego i innych ticketów.
  - Suggestion: Osobny ticket — podnieść `testTimeout` dla tego testu albo zoptymalizować ścieżkę zapisu 20k ID.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/selly/rest/sync-delta.ts:130-148` — `grupyKolizyjne()` liczy dodatkowo `rozne_ceny_lub_stany` (porównanie `stan`+`cena_sprzedazy`), czego plan nie wymagał wprost — przydatne, ale warto krótko udokumentować w karcie/backlogu #108 jako rozszerzenie ponad plan (na wypadek gdyby ktoś użył tego pola do decyzji biznesowej).

## Plan compliance

### Done ✓
- Tor 1 (`sync-delta.ts`): WHERE, projekcja `p.id, p.status`, żywy odczyt `status`/`stan`/`cena_sprzedazy` w dokładnie tym miejscu co oryginał (przy komentarzu „2. Aktualizacja wariantu”, przed `if(dryRun)`) — zweryfikowane linia po linii wobec `git diff 7d6cfc9 abe5f14 -- mirror/backend/selly/sync_delta.cjs`, zgodność 1:1.
- Tor 2 (`sync-full.ts`): 3-liniowa poprawka żywego odczytu, zweryfikowana wobec `git diff 7d6cfc9 abe5f14 -- mirror/backend/selly/sync_full.cjs` — zgodność 1:1.
- Potwierdzone: `git diff abe5f14 88fa31c` na obu plikach oryginału jest pusty (jak twierdzi plan).
- Wykrywanie kolizji `kod_importu`: `grupyKolizyjne()` grupuje po PARZE `(dostawca, kod_importu)`, jednym zapytaniem (bez N+1), **nie pomija** kolizyjnych wierszy (zawór z `wejscie-116/117.md` faktycznie WYCOFANY z kodu, zgodnie z decyzją z 23.09) — test T6b potwierdza, że różni dostawcy z tym samym `kod_importu` NIE są raportowani jako kolizja.
- Moduł dostępności (`dostepnosc.ts`): semantyka `pending`/`running` odtworzona wiernie — drenaż `while`, jeden CSV na partię, `syncDelta` sekwencyjnie, błąd tylko logowany, restart z `finally` (zweryfikowane logicznie i testami T9–T11, w tym scenariusz błędu w środku partii).
- `app.ts` nietknięty, moduł celowo niewpięty, `zadajOdswiezenie()` jest no-opem bez zamontowanej instancji.
- Testy T1–T11 (nazewnictwo w kodzie inne niż w planie, ale zakres pokryty) — zielone; żaden nie woła sieci (klient Selly wstrzykiwany wszędzie, `db.$client` na SQLite w katalogu tymczasowym).
- `npm run lint`, `typecheck`, `build` — zielone. `npm test`: 1653 passed / 1 failed (niezwiązany, patrz SHOULD-FIX) / 3 skipped / 101 plików — zgodne z deklaracją raportu (+22 testy, brak regresji w zakresie ticketu).
- Niezależnie zweryfikowana teza raportu o `row.stan = live.stan` w Torze 2: **potwierdzona, prawdziwa**. `toSellyPayloadV2()` (`mapper-v2.ts:199-221`) nie ma pola stanu/ilości, a `markProductSynced()` (`sync-full.ts:180-188`) aktualizuje tylko `ostatnia_sync`, `ostatni_status`, `ostatni_blad`, `cena_zakupu_wyslana` — `stan_wyslany` nigdze nie jest zapisywany w Torze 2. Oryginał (`sync_full.cjs:291`) ma dokładnie ten sam martwy zapis. Jedyny realny efekt poprawki #104 w Torze 2 to `skip` dla produktu wstrzymanego/usuniętego w trakcie cyklu — potwierdzone testami.
- Kontrakt/fixtures: brak tras `/sync-delta`, `/sync-full` w `contract/openapi.yaml` (zweryfikowane), `szczegoly_json` w schemacie `GETSellyLogOdpowiedz200` jest typu `string` (zweryfikowane) — dopisanie klucza `kolizje` do zawartości tego stringa nie narusza kontraktu.

### Missing or deviating ✗
- Krok 7 planu („dokumentacja karty”) — nie wykonany: `docs/karty/I15.10/karta.md` bez aktualizacji, `docs/karty/I15.4/wejscie-119.md` nie istnieje, `docs/spec-backend/wpis-119.md` nie istnieje, statusy #104/#108 w `docs/rebuild-backlog.md` bez zmian. Patrz BLOCKER.
- `raport.md` jest niezacommitowany (`git status` pokazuje go jako `??`) — do uzupełnienia przy commitowaniu przez Mastera, nie wpływa na ocenę kodu.

### Definition of done
- [x] Tor 1 ma WHERE, projekcję i żywy odczyt zgodne z `abe5f14`
- [x] Tor 2 ma 3-liniową poprawkę żywego statusu z `abe5f14`
- [x] Wykrywanie kolizji działa w Torze 1: raportuje i nie pomija
- [x] Przypadek „różni dostawcy, ten sam `kod_importu`” NIE jest raportowany jako kolizja
- [x] Moduł dostępności odtwarza semantykę kolejki oryginału
- [x] `zadajOdswiezenie` wystawione, `app.ts` nietknięty
- [x] Testy T1–T11 zielone; żaden nie woła sieci
- [x] `lint`, `typecheck`, `build`, `test` zielone (1 niezwiązana usterka `alerty-katalogu.gate.test.ts`, poza zakresem diffu)
- [x] Pomiar #101 zapisany w karcie jako fakt (w `raport.md`; nie w `docs/karty/`, patrz uwaga niżej)
- [ ] Karta I15.10 opisuje STAN; `wejscie-119.md` dla I15.4; roadmapa nietknięta — **NIE spełnione**, dokumentacja karty/backlogu nie zaktualizowana (patrz BLOCKER)

## Parallel-test concerns

Testy tego ticketu (`selly.dostepnosc.test.ts`, `selly.sync-delta.test.ts`, `selly.sync-full.test.ts`) używają `stworzTestowaBaze()` (SQLite w katalogu tymczasowym) i atrapy Selly — brak twardych ścieżek/portów, w pełni równoległe.

Poza zakresem diffu: `test/alerty-katalogu.gate.test.ts` (test „paczka równa limitowi 20 000 id”) jest na granicy/ponad domyślnym timeoutem nawet w izolacji — pod większym obciążeniem (kilku agentów naraz) może dawać fałszywe czerwone GATE-y. Nie wprowadzone przez ten ticket, ale odnotowuję zgodnie z zasadą flagowania niestabilnych testów.

## Overall assessment

Sama zmiana kodu jest bardzo dobra: port Toru 1 i Toru 2 zweryfikowany linia po linii wobec `abe5f14` jest wierny 1:1, decyzja o wycofaniu zaworu na kolizje `kod_importu` została poprawnie wdrożona (grupowanie po parze `(dostawca, kod_importu)`, bez `continue`, z raportowaniem), a moduł dostępności odtwarza subtelną semantykę kolejki oryginału łącznie z mniej oczywistym przypadkiem utraty zgłoszenia w środku partii przy błędzie. Teza raportu o martwym `row.stan` w Torze 2 jest prawdziwa — potwierdzona niezależnie. Testy są rzeczywiste (nie obrysowują mechanizmu), atrap jest tyle, ile trzeba (klient Selly), nic nie woła sieci. Jedyny poważny problem to brak aktualizacji dokumentacji projektu (karta, wejście dla I15.4, backlog) wymaganej explicite przez plan i przez zasady `CLAUDE.md` — to blokuje merge, bo kluczowa wiedza bezpieczeństwa dla następnej karty (I15.4) nie jest tam, gdzie następna sesja jej poszuka.
