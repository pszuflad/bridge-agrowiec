# 65-DOCS-instrukcja-testow-i4-v2 — raport z implementacji

## Summary

Powstał `docs/instrukcja-testow-I4-v2.md` (598 linii) — delta dla Ani po kartach 14f (`64-…`)
i 14h (`61-…`), w konwencji `docs/instrukcja-testow-I3-v2.md`. Opisuje sześć zmian, trzy
świadomie niezmienione rzeczy (jej decyzje z 2026-09-18) i rozlicza wszystkie punkty starej
instrukcji, które przestały być prawdą — w tym §4 pkt 6, który **nieprawdziwy był już przed
zmianami**. Stara instrukcja dostała wyłącznie banner (`git diff`: 14 wstawek, 0 usunięć).
Karta domyka falę 2 Iteracji 14 i całą Iterację 4.

## Changes

- **Nowy:** `docs/instrukcja-testow-I4-v2.md` — 8 rozdziałów, 11 punktów z polem oceny.
- `docs/instrukcja-testow-I4.md` — **wyłącznie banner** wstawiony po ramce o przeliczaniu
  katalogu. Treści nie przepisano ani nie skasowano: `git diff --stat` = `14 ++++`, 0 usunięć.
- **Nowy:** `docs/tickets/65-DOCS-instrukcja-testow-i4-v2/plan.md`, `raport.md`, `review.md`.
- `docs/rebuild-roadmap.md`, `docs/rebuild-backlog.md` — patrz „Docs updates" niżej.

## Struktura dokumentu i decyzje redakcyjne

| Rozdział | Treść | Źródło |
|---|---|---|
| 1 | ⚠ dwa skutki uboczne PRZED scenariuszami (2050/7405 cen; zamiecenie statusów przy starcie) | D3; nota cutoverowa z roadmapy 14m, pomiar 14e |
| 2.1 ⭐ | kolumna „Promocja" ożyła + **wprost: to NOWA FUNKCJA, nie powrót sprzed backupu** | 14h / `61-…/raport.md:11-39` |
| 3.1 ⭐ | data końca naprawdę wyłącza promocję (wygaszacz, obie strony, 3 momenty odpalenia) | 14f |
| 3.2 ⭐ | promocja „zaplanowana" wreszcie się włącza — co, od kiedy (4a, 2026-09-02), co teraz | 14f + 14e |
| 3.3 | rada „zmień status" unieważniona, z tabelką zamienników (data / usunięcie) | 14f |
| 3.4 | zniknął pomarańczowy znacznik + nowa nota w dialogu (cytat dosłowny) | 14f |
| 4.1 ⭐ | potwierdzenie usuwania z liczbą produktów, oba dialogi, trzy brzmienia zdania | 14f |
| 5 | trzy decyzje Ani z 2026-09-18, cytowane dosłownie | backlog #25, 14e raport, roadmapa |
| 6.1 | tabela 7 unieważnionych punktów starej instrukcji | I4 + 14f/14h |
| 6.2 | §4 pkt 6 — uczciwe sprostowanie: instrukcja podała błąd, oto prawda | 14f, roadmapa 14m |
| 6.3 | rozliczenie wszystkich 4 pozycji §5 wobec tablicy postępu roadmapy | roadmapa §4/§5 |
| 7–8 | podsumowanie z licznikiem 11 pozycji + skrócone zasady zgłaszania | wzorzec I3-v2 |

Cztery decyzje redakcyjne z Q&A (wszystkie zgodnie z rekomendacją, użytkownik 2026-09-19):

- **D1** — trzy zmiany bez zgłoszenia Ani (3.2, 3.3, 3.4) dostały cytat blokowy zaczynający się
  od **„Tego nie zgłaszałaś"** + zdanie, skąd zmiana i z jakiej daty. Alternatywa „zmyślić
  parafrazę jej słów" odrzucona: dokument prostuje nieprawdziwy §4 pkt 6, więc sam nie może
  podawać fikcyjnych cytatów.
- **D2** — zgłoszenie do §3.6 (punkt 4.1) cytowane jako **jawnie oznaczona parafraza**:
  „Zgłosiłaś *(streszczenie z naszych notatek — dosłownego zapisu Twoich słów nie mamy)*".
- **D3** — oba skutki uboczne w rozdziale 1, **przed** scenariuszami.
- **D4** — §5 poz. 4 (priorytet reguły) opisana jako nadal otwarta, z pytaniem-kratką.

## Deviations from plan

Trzy dołożenia wobec planu, wszystkie rozszerzające, żadne nie zmienia zakresu:

1. **Pole oceny pod §6.1** (tabelą unieważnionych punktów) — plan nie przewidywał, a jest to
   realnie sprawdzalne twierdzenie („czy któryś z tych siedmiu punktów zachowuje się nadal po
   staremu?"). Bez niego rozdział był jedynym blokiem tekstu bez kratki.
2. **⚠ „wiersz promocji NIE znika z tabeli"** w punkcie 3.1. Ania, opisując oczekiwane
   zachowanie, użyła sformułowania *„reguła znika po końcu obowiązywania"*
   (`docs/rebuild-backlog.md:1368`). Wiersz **zostaje** z odznaką „zakończona" — bez tego
   uprzedzenia zgłosiłaby to jako błąd i z własnego punktu widzenia miałaby rację.
3. **§6 checklisty starej instrukcji** dopisane do listy unieważnień (w banerze i w tabeli 6.1).
   Pozycja „Wygasła promocja dalej obniża ceny, a znacznik mówi o tym wprost ⭐" jest dziś
   nieprawdą; plan wymieniał §3.6/§3.9/§4/§5, ale nie checklistę.

## Test results

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Zmieniono wyłącznie pliki
  `docs/**`; `rebuild/backend/**`, `rebuild/frontend/**` i `contract/**` nietknięte
  (`git diff --name-only origin/develop` → same `docs/`). Kontrakt i kod były tu **źródłem
  czytanym**, nie zmienianym.
- **Bramki kodu:** nie uruchamiane — brak zmian w kodzie. Zgodne z treścią karty.
- **Weryfikacja dokumentacyjna (5 sprawdzeń z planu):**

| Sprawdzenie | Wynik |
|---|---|
| Brzmienia UI cytowane z **kodu**, nie z raportów | ✓ `ceny.ts:171-182` (3 warianty `opisLiczbyProduktow`), `TabelaNarzutow.tsx:113-127`, `TabelaPromocji.tsx:127-141`, `DialogReguly.tsx:558-562`, `formatowanie.tsx:152-165`, `kolumny.ts:26` |
| Każdy cytat Ani ma źródło z numerem linii | ✓ 6 cytatów: backlog `:1759`, `:1367-1368`, roadmapa `:2453`, `53-…/raport.md:15,20`, `61-…/raport.md:13,29` |
| Ani jednego pola bez pytania albo kratki | ✓ 23 kratki `☐`, 11 pól oceny, 0 pól typu „miejsce na uwagi"; każda sekcja `##` pokryta (rozdz. 1 i 5 mają jedno pole na rozdział — świadomie) |
| Wszystkie 4 pozycje §5 rozliczone wobec tablicy postępu | ✓ tabela 6.3: 2 × ✅ dowiezione, 1 × ❌ decyzją Ani, 1 × ⬜ otwarte |
| Banner nie tknął treści I4 | ✓ `git diff --stat` = `14 ++++`, zero usunięć |

**Domiar własny poza raportami** (bo raport bywa zamiarem, a nie stanem): `sortuj()`
w `rebuild/frontend/src/pages/katalog/filtrowanie.ts:107-123` czyta `produkt["promocja"]`, a
wartość siedzi w `_reguly.promocja` — obie strony porównania to `""`, więc **kliknięcie nagłówka
„Promocja" nic nie sortuje**. Identycznie w oryginale (`frontend-index.js:23307-23311`). Trafiło
do dokumentu jako ramka ⚠ (punkt 2.1) i na listę fałszywych alarmów w rozdziale 8. Researcher
zostawił to jako pytanie otwarte — domierzone, nie zgadnięte.

## Korekty faktów wobec treści karty

Zapisane jako **fakty**, nie zmiany zakresu (CLAUDE.md: fakt ≠ decyzja o zakresie):

1. **`docs/pytania-do-ani-2026-09-18.md` nie zawiera trzech cytatów decyzji Ani** — nie ma
   w nim w ogóle sekcji o Iteracji 4 (sekcje: 0, 3, 5, 6, 7, 9, 10, 12). Źródła rzeczywiste:
   (a) `docs/rebuild-backlog.md:1759`, (b) `docs/tickets/53-…/raport.md:20`,
   (c) `docs/rebuild-roadmap.md:2453`. Stamtąd cytowano.
2. **Cytat (c) brzmi w repo pełniej** niż w karcie: *„zostawiamy tak jak obecnie działa,
   promocje po prostu się usuwa"* — użyto pełnego brzmienia.

## Breaking changes

Brak — ticket nie dotyka kodu ani kontraktu.

## Follow-up

Rzeczy zauważone, świadomie NIE realizowane w tej karcie:

- **§5 poz. 4 — edycja priorytetu reguły z formularza.** Wisi od 2026-09-02 bez czyjejkolwiek
  decyzji, jedyna pozycja §5 bez rozstrzygnięcia. Dokument zadaje Ani pytanie (punkt 6.3);
  **jej odpowiedź wymaga wpisu w backlogu i ewentualnie karty.** Dziś nie ma wpisu w backlogu.
- **Sortowanie kolumny „Promocja"** — nie działa (patrz „Domiar własny"), tak samo w oryginale.
  Dokument o tym uprzedza i pyta, czy byłoby przydatne. Gdyby Ania odpowiedziała „tak" — osobna
  karta (wirtualne pole trzeba by albo materializować, albo obsłużyć w `sortuj()` wyjątkiem).
- **Ukrywanie wygasłych promocji z tabeli** — Ania spodziewała się, że „reguła znika po końcu
  obowiązywania". Wiersz zostaje (zachowanie oryginału). Dokument pyta; ewentualna zmiana to
  świadome odstępstwo i osobna decyzja.
- **Backlog #88** (`promocjaPasuje` łapie każdą promocję dla produktu z pustą marką I kategorią)
  — ⬜ do decyzji, zmierzona skala: 0 produktów na 7405. Świadomie nie opisane Ani: dziś nie ma
  jak tego zobaczyć.
- **`docs/instrukcja-testow-I5.md`** — pliku nie ma na `develop` (leży na niezmergowanej gałęzi
  `origin/docs/instrukcja-testow-i5`), a roadmapa notuje, że jest w dwóch miejscach nieaktualny.
  Poza zakresem tej karty, osobny temat.

---

## Review fixes applied

Przegląd (`review.md`) zgłosił 2 BLOCKER, 1 SHOULD-FIX, 2 NICE-TO-HAVE. Oba BLOCKERy
**potwierdzone niezależnie w kodzie** przed naprawą (reviewer miał rację co do obu).

### BLOCKER 1 — §5.2 twierdziło odwrotność stanu faktycznego ✅ naprawione

**Co było źle.** Dokument pisał Ani, że komunikat po edycji reguły „dalej brzmi «Reguła
dodana»". **Kod mówi co innego:** `DialogReguly.tsx:270-282` wybiera treść przez
`dodawanie = !edycja` i przy edycji daje **„Reguła zaktualizowana"** (przy promocji — „Promocja
zaktualizowana"). Potwierdza to pomiar 14e: `rebuild/frontend/test/narzuty.edycja-toast.test.tsx`,
11 przypadków, wszystkie przechodzą (`docs/tickets/53-…/raport.md:160-173`).

**Skąd błąd.** Przepisany wprost z treści karty, która podała to jako fakt. To dokładnie ta
pułapka, przed którą ostrzega `CLAUDE.md` („roadmapa/prompt opisuje zamiar, nie stan") — tylko
tym razem źródłem nieprawdy była sama karta, a nie roadmapa.

**Jak naprawione.** §5.2 przepisane na stan faktyczny: zgłoszenie Ani odnotowane, jej decyzja
zacytowana bez zmian, ale wynik podany uczciwie — *„sprawdziliśmy i wyszło coś innego, niż oboje
myśleliśmy: komunikat brzmi «Reguła zaktualizowana»"*, czyli §3.11 pierwszej wersji mówi prawdę
i nie ma czego naprawiać. Dołożona ramka ⚠ z odwróconą polaryzacją: **gdyby zobaczyła „Reguła
dodana" po edycji — TO jest błąd do zgłoszenia.**

**Gdyby to zostało:** Ania szukałaby komunikatu, którego nie ma, i zgłosiła „ŹLE" na poprawnie
działającej funkcji.

### BLOCKER 2 — kolizja promocji w scenariuszach 3.1 / 3.2 / 4.1 ✅ naprawione

**Co było źle.** Punkty 2.1, 3.1 i 3.2 kazały **każdy z osobna zakładać nową promocję** na
warunek „Marka → BKT". Przy dwóch pasujących promocjach obniżkę robi tylko jedna:
`wybierzPromocje` (`rebuild/backend/src/repos/ceny.ts:161-165`) sortuje malejąco po `priorytet`
i bierze pierwszą, a priorytetu **nie da się ustawić z formularza** (`DialogReguly.tsx:141-143`
trzyma go w stanie tylko po to, by odesłać istniejącą wartość; domyślnie 50). Przy remisie
wygrywa więc pierwsza z listy — promocja z 2.1 — i **maskowałaby** efekt zmian dat testowanych
w 3.1 i 3.2. Obietnice „cena wraca do poziomu bez rabatu" i „cena bez rabatu przed startem"
mogłyby się nie potwierdzić.

**Jak naprawione.** Cały rozdział 3 pracuje teraz na **jednej** promocji — tej z punktu 2.1:
- nagłówek rozdziału 3 dostał ramkę ⚠ „przez cały ten rozdział pracujesz na JEDNEJ promocji",
  z wyjaśnieniem, dlaczego druga promocja na tę samą markę psuje test;
- 3.1 krok 1 zmieniony z „załóż promocję" na „upewnij się, że *Wyprzedaż BKT* jest jedyną
  pasującą do BKT; jeśli wisi druga — usuń ją";
- 3.2 kontynuuje tę samą promocję zamiast zakładać kolejną.

**Znaleziona przy okazji, poza raportem reviewera:** po punkcie 3.4 promocja zostaje na datach
z 2020 (*zakończona*), więc okienko usuwania w 4.1 pokazałoby *„Dziś ta reguła nie obejmuje
żadnego produktu"*, a nie obiecane **954**. 4.1 przerobione na sekwencję, która **celowo pokazuje
oba brzmienia**: najpierw wariant zerowy na promocji zakończonej, potem przywrócenie dat
domyślnych i wariant z liczbą. Zamiast pułapki wyszedł lepszy test.

### SHOULD-FIX — źródło cytatu w §2.1 · świadomie bez zmian

Reviewer zauważył, że cytaty Ani w §2.1 (*„Rabaty nie działają mimo wprowadzenia promocji…"*,
*„tylko się nie wyświetlało, cena się oblicza prawidłowo"*, *„w starym Bridge działała…"*) żyją
w repo w `plan.md`/`raport.md` kart 53 i 61, a nie w zapisie jej oryginalnej wiadomości —
i sugeruje oznaczyć je jako parafrazę, tak jak zrobiono w §4.1 (D2).

**Nie zmieniono, świadomie.** Rozróżnienie jest realne, ale przebiega gdzie indziej, niż
wskazuje reviewer: karty 53 i 61 zapisują te trzy zdania **jako cytaty**, w cudzysłowie, ze
zwrotem „napisała" — tak samo jak backlog i roadmapa zapisują cytaty (a)/(b)/(c) z rozdziału 5.
W §4.1 sytuacja jest inna i dlatego dostała adnotację: tam **samo źródło** (`roadmapa:2448-2450`)
mówi o sobie „jej pierwotny wpis precyzuje", czyli jawnie streszcza. Oznaczanie jako parafrazy
wszystkiego, czego nie mamy w oryginalnym mailu, oznaczałoby oznaczenie **wszystkich** cytatów
w dokumencie — w tym trzech decyzji z rozdziału 5 — co odebrałoby adnotacji siłę dokładnie tam,
gdzie jest potrzebna.

**Odnotowane jako ryzyko:** repo nie przechowuje oryginalnych wiadomości Ani, tylko ich zapis
w kartach. Gdyby kiedyś zaczęło, cytaty warto przewiązać do tamtego źródła.

## Test results — po naprawach

| Sprawdzenie | Wynik |
|---|---|
| §5.2 zgodne z `DialogReguly.tsx:270-282` i testem `narzuty.edycja-toast.test.tsx` | ✓ |
| Łańcuch scenariuszy 2.1 → 3.1 → 3.2 → 3.4 → 4.1 przechodzi na jednej promocji, bez kolizji | ✓ przejrzany krok po kroku |
| 4.1 obiecuje liczbę tylko w stanie, w którym promocja jest aktywna | ✓ |
| Brzmienia UI nadal zgodne z kodem (pozostałe punkty) | ✓ bez zmian |
| Pola oceny, struktura, banner, własność plików | ✓ bez zmian |

### Przegląd nr 2 — 0 BLOCKER, 0 SHOULD-FIX; cztery NICE-TO-HAVE naprawione

Reviewer zweryfikował obie naprawy niezależnie (łańcuch stanów promocji 2.1→3.1→3.2→3.4→4.1
przejrzany krok po kroku: aktywna → zakończona → zaplanowana → aktywna → zakończona → aktywna),
potwierdził, że uzasadnienie odrzucenia SHOULD-FIX się broni, i zostawił cztery drobiazgi.
Wszystkie naprawione, bo były tanie:

- **cudzysłowy w cytacie noty o datach** — było `«zaplanowana»` (zagnieżdżenie), jest `„zaplanowana"`,
  czyli znak w znak jak na ekranie; zewnętrzne cudzysłowy zdjęte, bo cytat i tak stoi w bloku kursywą;
- **`«nazwa»` w treści dialogu usuwania** — zamienione na czytelny przykład z dopiskiem, co wchodzi
  w to miejsce;
- **„cały backend produkcji wraz ze wszystkimi kilkunastu łatkami"** — żargon i błąd odmiany;
  jest „cała część Bridge'a działająca na serwerze, razem z kilkunastoma późniejszymi poprawkami";
- **„jeśli po punkcie 3.4…"** w kroku 1 punktu 4.1 — stan jest deterministyczny, więc zdanie
  twierdzące zamiast warunkowego;
- **metryka w Summary** — 561 → 592 linie (nieodświeżona po naprawach BLOCKERów).

---

## Docs updates

Dwa doc-checkery, równolegle, w tym samym worktree.

### `docs/rebuild-roadmap.md` (65 wstawek, 27 usunięć)

- **Podblok `##### 14m` (:2641)** → `✅ ZROBIONE 2026-09-19 (65-DOCS-instrukcja-testow-i4-v2,
  domyka FALĘ 2 I14 i całą Iterację 4)`. Opis przerobiony z „co do zrobienia" na **stan**:
  co zgadzało się z pierwotnym blokiem (§4 pkt 6, §3.9, rada „zmień status" — wszystkie trzy)
  i **co dołożono ponad blok** (§3.6, §4 pkt 1, §4 pkt 5, §4 pkt 8, pozycja checklisty §6).
  Dopisane rozliczenie wszystkich 4 pozycji §5. Nota cutoverowa przeformułowana z „uprzedzić
  Anię" na „przekazana Ani" — fakt dokonany.
- **Sprostowanie nieprawdy o komunikacie po edycji** — dwa miejsca: `:2456` (wpis decyzji Ani
  o §3.11 w „Druga fala I14") i `:2775` (opis zadania B w 14e). Oba mówiły albo sugerowały, że
  komunikat brzmi „Reguła dodana". Teraz mówią stan faktyczny z dowodem
  (`DialogReguly.tsx:270-282`, `narzuty.edycja-toast.test.tsx` 11/11,
  `docs/tickets/53-…/raport.md:160-173`) i odnotowują, że ustaliła to dopiero ta karta.
- **Tablica postępu §4** — wiersz **Iteracja 14**: `🔨` → `✅`, „FALA 2 DOWIEZIONA POZA 14m" →
  „FALA 2 ZAMKNIĘTA W CAŁOŚCI", dopisane `14m: ✅ 65-… · 2026-09-19`, **usunięte** zdanie
  „otwarte 14m … stąd 🔨, nie ✅". Wiersz **Iteracja 4**: dopisane, że domykają ją karty z I14
  (14e, 14f, 14h, 14m); status ✅ bez zmian.
- **Pięć rozrzuconych wzmianek** opisujących 14m jako otwarte (`:2162`, `:2512`, `:2534`,
  `:2819`, `:2903`) — zaktualizowane, nie dopisane obok.
- **Ustalenia dla PRZYSZŁYCH bloków** zapisane w sekcji „Poza zakresem I14, wymaga osobnych
  decyzji i kart", **nie** w zamkniętym bloku 14m (`CLAUDE.md`, obowiązek 2): edycja priorytetu
  reguły, sortowanie kolumny „Promocja", ukrywanie wygasłych promocji — wszystkie trzy jako
  oczekujące na odpowiedź Ani z datą pytania 2026-09-19.

### `docs/rebuild-backlog.md` (8 edycji + 1 nowy wpis)

- **#19** — sprostowanie przekazane Ani (I4-v2 §3.1, §3.2), unieważnia §3.9 i §4 pkt 5–6 starej
  instrukcji; osobno odnotowane pytanie otwarte o ukrywanie wygasłych promocji.
- **#22** — opisane Ani w §2.1 wraz z jawnym sprostowaniem jej założenia o backupie (cztery
  niezależne dowody); dopisany domiar 14m o niedziałającym sortowaniu kolumny + pytanie otwarte.
- **#24** — odnotowane, że I4-v2 §4.1 uprzedza o rozbieżności między liczbą w okienku usuwania
  a liczbą z czerwonego paska „poniżej kosztu" (#23 nietknięte — dotyczy symulatora).
- **#25** — opisane Ani w rozdziale 5.1 ze zmierzonym zasięgiem 1/7405; pułapka zostaje.
- **#88** — odnotowane, że **świadomie NIE opisano tego Ani** (skala 0/7405, nie ma jak dziś
  zobaczyć) — żeby następna sesja nie uznała tego za przeoczenie.
- **Nowy wpis #89** — „edycja priorytetu reguły z formularza", ⬜ do decyzji, czeka na odpowiedź
  Ani (pytanie zadane 2026-09-19). Kontekst zweryfikowany w kodzie: `DialogReguly.tsx:141-143`,
  `rebuild/backend/src/repos/ceny.ts:161-165`.

**Sprostowanie o „Reguła dodana" nie dotyczyło backlogu** — sprawdzone `grep`em, plik nigdy nie
zawierał tego twierdzenia. Nieprawda żyła w roadmapie (2 miejsca, poprawione) i w treści karty.

### Pre-existing issues

Oba doc-checkery zgłosiły **brak** — nie znalazły w swoich plikach nieprawd spoza zakresu tej
karty.
