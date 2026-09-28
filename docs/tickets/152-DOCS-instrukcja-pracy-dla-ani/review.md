# 152-DOCS-instrukcja-pracy-dla-ani — Code review

> Reviewed: 2026-09-24
> Branch: `docs/152-instrukcja-pracy-dla-ani`
> Diff: 3 pliki (`docs/instrukcja-pracy-dla-ani.md`, `docs/tickets/152-.../plan.md`, `docs/tickets/152-.../raport.md`), 2 commity (`9f09c53`, `dc26987`)

## BLOCKER

- [ ] `docs/karty/TEST.3/karta.md` — karta nie jest domknięta, mimo że plan.md (Implementation plan, pkt 11) i Definition of done tego wymagają.
  - Reason: `git diff --name-only` pokazuje wyłącznie `docs/instrukcja-pracy-dla-ani.md` i pliki ticketu — `karta.md` nie był w ogóle dotknięty. Karta wciąż ma `Stan: ⬜ do zrobienia` i puste `Decyzje`/`Dowiezione`/`Do koordynatora`. To złamanie Definition of done z własnego planu ticketu („`docs/karty/TEST.3/karta.md` domknięta (Stan ✅ + data + ID ticketa, „Dowiezione", „Do koordynatora" z luką w `feature.md`)") — dokument produktowy jest gotowy, ale ticket jako całość nie jest kompletny.
  - Suggestion: dopisać do `karta.md`: `Stan: ✅ zrobione (152-DOCS-instrukcja-pracy-dla-ani, 2026-09-24)`, sekcję „Dowiezione” z realnym zakresem dokumentu i „Do koordynatora” z luką opisaną w raport.md (Follow-up #2) — inaczej ta luka zgubi się w katalogu ticketu i nigdy nie trafi do koordynatora, co jest dokładnie tym mechanizmem, który dokument obiecuje Ani.

- [ ] `docs/instrukcja-pracy-dla-ani.md:134,139-140,145-147` — dokument obiecuje Ani mechanizm zapisu „świadomej zmiany" na „naszej liście zmian z datą", którego `.claude/commands/feature.md` nie ma jako nazwanego kroku.
  - Reason: Sprawdzone w `.claude/commands/feature.md:29` — Faza nanosi do `docs/rebuild-backlog.md` **tylko** wpisy już oznaczone ✅ TAK; `:382` (Faza 5) aktualizuje **statusy istniejących** wpisów. Nie ma kroku „utwórz NOWY wpis backlogu z odpowiedzi Ani udzielonej w trakcie sesji". Sam raport.md (Follow-up #2) i plan.md (Decyzja 3, „Skutek uboczny researchu") to potwierdzają i przekazują dalej jako „Do koordynatora" — ale koordynator nigdy się o tym nie dowie, bo `karta.md` nie została zaktualizowana (patrz punkt wyżej). W efekcie dokument dla Ani mówi „zapisujemy jako Twoją decyzję na naszej liście zmian" jako fakt, choć w procedurze istnieje tylko przez improwizację sesji (np. wpis w `Decisions` własnego `plan.md` ticketu — co technicznie **jest** trwałym, datowanym zapisem, ale nie jest tym samym co scentralizowana „lista zmian", którą sugeruje sformułowanie, i nie jest to nigdzie nazwane jako gwarantowany krok).
  - Suggestion: albo złagodzić sformułowanie do czegoś, co faktycznie gwarantuje procedura („zostaje zapisane w planie tego zgłoszenia, z datą i uzasadnieniem" — to jest pewne, bo plan.md zawsze ma sekcję Decisions), albo — jeśli ma zostać „nasza lista zmian" — dopisać krok do `feature.md` (osobna decyzja użytkownika, poza zakresem tej karty) i dopiero potem obiecywać to Ani. Zgodnie z kartą TEST.3 ten ticket nie może zmieniać `feature.md`, więc do czasu jego uzupełnienia dokument nie powinien składać obietnicy silniejszej niż to, co dziś gwarantowane.

## SHOULD-FIX

- [ ] `docs/instrukcja-pracy-dla-ani.md:159-161` — zdanie „Mamy ostrzeżenie przy zapisie" zakłada, że hook `pre-push` jest włączony w sesji Ani, co nie jest pewne.
  - Reason: `docs/tickets/134-CHORE-praca-w-chmurze/plan.md:26-31` (punkt 1, nieodhaczony w Definition of done) wprost mówi, że hooki włączają się dziś TYLKO przez `npm install` (`prepare`) — „sesja pracująca tylko na dokumentacji zostaje bez hooka". Sesja Ani w przeglądarce, zwłaszcza przy zgłoszeniu czysto dokumentacyjnym albo na świeżym klonie/kontenerze, może nigdy nie odpalić `npm install`, więc ostrzeżenie przy `git push` może w jej wypadku fizycznie nie zadziałać — bez tego, że ktoś jej to powie.
  - Suggestion: albo dodać jedno zastrzegające zdanie („to ostrzeżenie jest ustawieniem naszego środowiska pracy, nie Twojej sesji z osobna — jeśli akurat nie zadziała, i tak decyduje PR, nie push"), albo nie precyzować mechanizmu i zostać przy ogólnym „umowa, nie zamek", które już tam jest.

- [ ] `docs/instrukcja-pracy-dla-ani.md:73-76` — sformułowanie „Sesja sama zakłada osobną kopię plików do pracy (zobaczysz słowo *worktree*)" opisuje mechanizm zaprojektowany dla równoległych sesji w JEDNYM klonie lokalnym; dla sesji w przeglądarce (do której to zdanie ma zastosowanie wg Decyzji 4 w planie) `docs/tickets/134-CHORE-praca-w-chmurze/plan.md:32-36` mówi, że każda sesja chmurowa ma już własny kontener/klon i worktree tam jest „zbędny" — wariant `feature.md` dla chmury nie istnieje (`134-.../plan.md` DoD, pkt 2, nieodhaczony), więc dziś sesja w chmurze i tak dosłownie wykona Krok 5 (`git worktree add`), ale to nie jest właściwy powód, dla którego jej praca jest bezpieczna — właściwy powód (w chmurze) to osobny kontener per sesja, nie sam worktree.
  - Reason: nie jest to twierdzenie nieprawdziwe DZISIAJ (worktree nadal powstaje, więc efekt — osobna kopia — jest realny), ale jest to wyjaśnienie mechanizmu, który ticket 134 planuje zastąpić czymś innym w chmurze („`git checkout -b`" bez worktree) — czyli dokument uczy Anię słowa, które może zniknąć z jej doświadczenia po domknięciu 134, a materiał ma być „kartką pod ręką" na dłużej.
  - Suggestion: nie krytyczne do zmiany teraz (opis jest zgodny ze stanem na dziś), ale warto dopisać do „Do koordynatora" w karcie TEST.3 (patrz BLOCKER wyżej) notatkę, że po domknięciu 134 ten fragment trzeba zweryfikować.

- [ ] `docs/instrukcja-pracy-dla-ani.md:169-174` — opisuje przełącznik „na próbę" w panelu Selly jako **opcję** przy synchronizacji, choć w UI to w rzeczywistości DWA ODDZIELNE przyciski: „Test dry-run (5 szt.)" (zawsze `dry_run: true`, limit sztywno 5) i „Wyślij do Selly" (zawsze `dry_run: false`) — `rebuild/frontend/src/pages/selly/SekcjaSync.tsx:112-129`. Nie ma pola/checkboxa, który przełącza tryb tego samego przycisku.
  - Reason: „opcja" sugeruje ustawienie, które można przełączyć przed wysłaniem — realnie trzeba kliknąć inny, osobny przycisk. Różnica jest subtelna, ale dla osoby nietechnicznej wygodniej mieć dokładny opis, żeby zamiast „przełącznika" nie szukała checkboxa.
  - Suggestion: zmienić na coś w rodzaju: „W panelu Selly są dwa przyciski: «Test dry-run (5 szt.)» (nic nie wychodzi na zewnątrz, możesz klikać) i «Wyślij do Selly» (to już jest prawdziwa wysyłka)." — precyzyjniej i bez ryzyka, że ktoś szuka nieistniejącego checkboxa.

- [ ] Definition of done ticketu 152 — pozycja „Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE`" nie jest spełniona: `origin/develop` poszedł o 2 commity dalej (`#164`, ticket 153) po założeniu tej gałęzi, a `HEAD` ich nie zawiera; PR jeszcze nie istnieje (`gh pr list` puste).
  - Reason: To normalny krok przed pushem (`tools/sync-z-develop.sh`), nie defekt treści dokumentu — ale odnotowuję, bo DoD z planu tego ticketu explicite to wymaga, a na dziś nie jest zrobione.
  - Suggestion: uruchomić `tools/sync-z-develop.sh` i dopiero potem `tools/push-i-pr.sh`, zgodnie z CLAUDE.md.

## NICE-TO-HAVE

- [ ] `docs/instrukcja-pracy-dla-ani.md:28-30` — „poprawka została napisana 1 września" — zgodne z `deminified/README.md:19` (`konstr` 2026-09-01), ale rok nie jest podany explicité w dokumencie; dla kogoś czytającego to za kilka lat data „1 września" będzie niejednoznaczna. Drobne, bo kontekst („do tej pory", „dziś") sugeruje bieżący rok.
- [ ] `docs/instrukcja-pracy-dla-ani.md:34-36` — „587 pozycji" bez „z 7395" (jest w `docs/rebuild-backlog.md:664` i `docs/tickets/47-.../plan.md:108`) — liczba absolutna bez mianownika brzmi bardziej dramatycznie niż jest (587/7395 ≈ 8%); nieistotne dla samej tezy dokumentu („nazwa nie odpowiadała treści"), ale warto rozważyć dodanie mianownika dla uczciwości proporcji.

## Plan compliance

### Done ✓
- Wszystkie 5 punktów zakresu z karty TEST.3 pokryte: jak wejść (§„Jak wejść") · jak zgłaszać (§„Jak napisać zgłoszenie") · trzy rodzaje zgłoszeń (§„Trzy rodzaje zgłoszeń") · czego nie wolno (§„Czego nie robimy" + „Gdy pali się") · czego się spodziewać (§„Czego się spodziewać po drodze").
- Wymóg twardy „każde zgłoszenie przez `/feature`, bez furtki 'popraw mi to szybko w czacie'" — spełniony, sekcja „Gdy pali się" ma ostrą granicę („zatrzymuje sprzedaż") i nie staje się furtką na drobne sprawy.
- Zero przepisanej treści `.claude/commands/feature.md` (brak nazw agentów, numerów kroków, żargonu orkiestracji) — potwierdzone grepem.
- Kontrola żargonu (gate/fixture/karta/kontrakt/snapshot/bramka/triaż/deminif) — zero wystąpień; `worktree` jedno wystąpienie, wyjaśnione w tym samym zdaniu.
- Fakty o Selly zweryfikowane w kodzie i zgodne z dokumentem: domyślka `SELLY_CSV_DIR` (`env.ts:138-141`), kolumna `Cena-zakupu` (`generator-csv.ts:54`), `dry_run` domyślnie `false` i realny wpływ na `agroopony.selly24.pl` (`routes/selly.ts:236` i dalej, `klient.ts:1-19`, `openapi.yaml:20431`).
- Trzy skutki dawnych łatek (konstrukcja → „—", `Lq`/„null cyfr znaczących", `.bak_szer_marka`) — zweryfikowane w `deminified/README.md` i `docs/rebuild-backlog.md` #11, treściowo zgodne, bez tonu wyrzutu wobec Ani.
- `test.agritires.eu` jako staging, zamrożenie produkcji od 22.09, godzina 12:00 poboru CSV przez Selly, nazwy zmiennych sekretów — wszystko potwierdzone w repo.
- Ton i forma zgodne ze wzorcem `docs/karty/I15.9/wejscie-104b.md` i `docs/instrukcja-testow-I10-v2.md` — bez ściany tekstu, gotowy szablon zgłoszenia do skopiowania, przykład dobry i źle napisany.

### Missing or deviating ✗
- Domknięcie karty `docs/karty/TEST.3/karta.md` (plan.md, Implementation plan pkt 11 i Definition of done) — **nie zrobione**, patrz BLOCKER.
- Synchronizacja z `origin/develop` przed PR — jeszcze nie wykonana (nie blokuje treści, ale jest w DoD ticketu).

### Definition of done
- [x] Pięć punktów zakresu z karty TEST.3 pokryte
- [x] Każde zgłoszenie prowadzi do `/feature`, jedyne wyjście awaryjne to telefon
- [x] Uzasadnienie oparte na korzyści, bez tonu wyrzutu wobec Ani
- [x] Gotowy szablon zgłoszenia + przykład dobry i zły
- [x] Każdy zakaz ma następstwo
- [x] Żargon wyjaśniony albo zastąpiony polskim
- [x] Zero przepisanej treści `feature.md`
- [x] Fakty o Selly zweryfikowane w kodzie
- [ ] `docs/karty/TEST.3/karta.md` domknięta — **nie spełnione**, karta nadal `⬜ do zrobienia` z pustymi sekcjami
- [x] `git diff --name-only origin/develop` zwraca wyłącznie ścieżki w `docs/` (dokładniej: wyłącznie te 3 pliki liczone od merge-base)
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE` — **nie spełnione jeszcze**, brak PR, gałąź nie zawiera 2 commitów z `develop`

## Parallel-test concerns

None — ticket dokumentacyjny, brak testów automatycznych i brak zmian w `rebuild/`.

## Overall assessment

Sama treść `docs/instrukcja-pracy-dla-ani.md` jest solidna: fakty o Selly, zamrożeniu produkcji i skutkach dawnych łatek zweryfikowane w kodzie i repo się zgadzają, ton jest właściwy dla nietechnicznego odbiorcy, żargon opanowany, a granica „kiedy dzwonić do Pawła" jest wystarczająco ostra, by nie stała się furtką. Główny problem leży poza samym dokumentem: ticket nie domknął karty TEST.3 (złamanie własnego Definition of done), przez co jedyny kanał, którym gap w `feature.md` (brak kroku tworzącego nowy wpis backlogu) miałby dotrzeć do koordynatora, jest pusty — a to jest dokładnie ten mechanizm, który dokument obiecuje Ani jako fakt. Do merge'a: domknąć kartę i rozważyć złagodzenie/uszczegółowienie obietnicy o „liście zmian".
