# 65-DOCS-instrukcja-testow-i4-v2 — Code review

> Reviewed: 2026-09-19
> Branch: docs/65-instrukcja-testow-i4-v2
> Diff: 3 pliki (`docs/instrukcja-testow-I4-v2.md` nowy 564 linie, `docs/instrukcja-testow-I4.md` +14/-0, `docs/tickets/65-.../plan.md` nowy), 1 commit (`4802aac`)

## BLOCKER

- [ ] `docs/instrukcja-testow-I4-v2.md:418-426` (§5.2) — twierdzenie jest ODWROTNE do stanu faktycznego.
  - Reason: Dokument mówi Ani wprost: „Komunikat po edycji reguły **dalej brzmi «Reguła dodana»**" i każe jej zapamiętać to jako świadomie zaakceptowany, niezmieniony defekt. Tymczasem kod (`rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:270-282`, gałąź `dodawanie ? "Reguła dodana" : "Reguła zaktualizowana"`) pokazuje po edycji **„Reguła zaktualizowana"**, i to jest pokryte testem `rebuild/frontend/test/narzuty.edycja-toast.test.tsx:193-205` (`expect(toast).toHaveTextContent("Reguła zaktualizowana"); expect(toast).not.toHaveTextContent("Reguła dodana")`). Co więcej, **sam cytowany przez ticket materiał źródłowy temu przeczy**: `docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md:166` mówi wprost „Toast po edycji narzutu: «Reguła zaktualizowana»", a linia 20 podsumowania tego samego raportu stwierdza „Pomiar i tak wykazał, że defektu nie ma". Dokument więc każe Ani oczekiwać złego komunikatu, a zobaczy dobry — wygeneruje to fałszywe zgłoszenie „naprawa nie zadziałała" albo zdezorientuje ją co do tego, w co ma wierzyć.
  - Suggestion: Przepisać §5.2 zgodnie z raportem 53: nie było defektu w treści komunikatu (obawa się nie potwierdziła), Ania i tak zdecydowała, że to bez znaczenia — ale nie pisać, że „dalej brzmi Reguła dodana".

- [ ] `docs/instrukcja-testow-I4-v2.md:181-198` (§3.1, kroki 1-5) i `:233-248` (§3.2, kroki 1-4) i `:365-372` (§4.1, kroki 1-6) — scenariusze zakładają NOWĄ promocję na ten sam warunek („Marka → BKT") w każdej sekcji, bez usunięcia poprzedniej z 2.1, a to psuje właśnie zadeklarowany rezultat.
  - Reason: W 2.1 Ania zakłada promocję „Wyprzedaż BKT" (rabat 10%, daty domyślne „dziś → +30 dni") i **zostawia ją aktywną** — nic w dokumencie nie każe jej usunąć przed dalszymi krokami. W 3.1 krok 1 i w 3.2 krok 1 zakłada się KOLEJNĄ, osobną promocję na ten sam warunek. `wybierzPromocje` (`rebuild/backend/src/repos/ceny.ts:161-165`, identyczny mechanizm w `rebuild/frontend/src/pages/narzuty/ceny.ts:113-119`) przy remisie priorytetu (każda nowa promocja dostaje domyślnie `priorytet: 50` — `DialogReguly.tsx:141-142`, formularz nie ma pola priorytetu) wybiera **pierwszą pasującą w kolejności zwracanej z bazy** (stabilny `sort`, brak `ORDER BY` w `listaPromocji`, więc kolejność = kolejność wstawienia = rosnące `id`). Skutek: promocja „Wyprzedaż BKT" z 2.1, dopóki jest aktywna, **zawsze wygrywa** z późniejszymi promocjami o tym samym priorytecie i tym samym warunku.
    - W 3.1 kroku 5 dokument obiecuje „cena wróciła do poziomu bez rabatu" po ustawieniu dat promocji z 3.1 na 2020 — ale „Wyprzedaż BKT" z 2.1 wciąż jest aktywna (dziś mieści się w jej oknie), więc cena **nadal będzie obniżona o 10%**, a kolumna „Promocja" nie pokaże „—".
    - W 3.2 kroku 2 dokument obiecuje „cena bez rabatu" (bo nowa promocja ma dopiero zacząć się jutro) — ale „Wyprzedaż BKT" z 2.1 wciąż jest aktywna niezależnie od tego, więc cena **będzie obniżona od razu**, mimo że test ma pokazywać stan „przed startem".
    - W 4.1 kroku 6, po usunięciu WYŁĄCZNIE „Wyprzedaż BKT" z 2.1, promocja założona w 3.2 (data startu „wczoraj", nadal w oknie aktywności) może wciąż obniżać cenę, więc „cena bez rabatu" znów może się nie potwierdzić.
    To dotyczy dwóch scenariuszy oznaczonych ⭐ jako najważniejsze w całym dokumencie (3.1 i 3.2) — dokładnie tych, które instrukcja poleca zrobić w pierwszej kolejności przy braku czasu (linia 42).
  - Suggestion: Przed 3.1 (albo na końcu 2.1) dopisać krok „usuń/wyłącz promocję Wyprzedaż BKT z 2.1, zanim pójdziesz dalej" — albo kazać każdej sekcji kasować swoją promocję na końcu, zanim zacznie się następna. Bez tego kroku instrukcja testuje nie to, co deklaruje.

## SHOULD-FIX

- [ ] `docs/instrukcja-testow-I4-v2.md:88-91` (§2.1, „Zgłosiłaś:") — cytat „Rabaty nie działają mimo wprowadzenia promocji, nie zaczytała się ona ani w katalogu w kolumnie promocje ani nie zmieniło na tej podstawie ceny" nie ma w repo weryfikowalnego pierwotnego źródła.
  - Reason: Jedyne miejsca, gdzie ten cytat istnieje dosłownie, to `docs/tickets/53-CHORE-i14e-diagnoza-promocji/plan.md:16-18` i plan.md tego samego ticketu 65 — oba to dokumenty planistyczne PISANE PRZEZ SESJĘ, nie zapis oryginalnej wiadomości Ani. `docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md:132` (jedyne miejsce bliższe „źródła") przytacza tylko SKRÓCONĄ wersję („nie zaczytała się w katalogu w kolumnie promocje"), bez pierwszej połowy zdania. Dla porównania: karta 65 sama zastosowała zasadę D2 (parafraza jawnie oznaczona) dokładnie w takiej sytuacji przy cytacie do §4.1 — tu, przy pozornie mocniejszym (dosłownym) cytacie w §2.1, tej samej ostrożności zabrakło.
  - Suggestion: Albo znaleźć faktyczne pierwotne źródło (np. zrzut wiadomości/ticketu), albo oznaczyć ten cytat tak jak w D2 („streszczenie z naszych notatek").

## NICE-TO-HAVE

- [ ] `docs/instrukcja-testow-I4-v2.md:310-311` — cytat noty z `DialogReguly.tsx:559-561` używa cudzysłowu francuskiego «zaplanowana» wewnątrz cytatu, podczas gdy kod ma polski cudzysłów „zaplanowana". Treść się zgadza, tylko znak inny — kosmetyka, ale przy dosłownych cytatach lepiej trzymać znak w znak.
- [ ] `docs/instrukcja-testow-I4-v2.md:127` — w Ramce A pojawia się „cały backend produkcji" — pojedynczy techniczny termin w dokumencie pisanym dla nietechnicznej odbiorczyni; reszta dokumentu bardzo dobrze tego unika.

## Plan compliance

### Done ✓
- `docs/instrukcja-testow-I4-v2.md` powstał, 564 linie, struktura 1:1 z `I3-v2` (nagłówek, „Zgłosiłaś:"/„Tego nie zgłaszałaś:", „Jak to naprawiliśmy.", „Sprawdź:", „Ma się stać:", ramki ⚠, „Twoja ocena").
- Sześć zmian opisanych: kolumna „Promocja" (2.1), data końca wyłącza promocję (3.1), promocja zaplanowana się włącza (3.2), rada „zmień status" unieważniona (3.3), zniknięcie znacznika + nowa nota (3.4), usuwanie z potwierdzeniem i liczbą produktów (4.1) — wszystkie zweryfikowane w kodzie, treści i liczby (2050/7405, 954, 1/7405, 7405/0) zgadzają się ze źródłami.
- Kolumna „Promocja" opisana wprost jako nowa funkcja, nie powrót do stanu sprzed backupu (Ramka A, 2.1), z konkretnymi dowodami.
- Promocja „zaplanowana" ma osobną sekcję (3.2) z „co było zepsute / od kiedy (2026-09-02) / co teraz działa" i testem dwustronnym.
- Rada „zmień status" jawnie unieważniona (3.3) z tabelą zamienników (data końca / usunięcie).
- Rozdział „czego świadomie nie zmieniliśmy" (§5) z trzema decyzjami Ani, dwie z trzech cytatów zweryfikowane co do znaku (backlog:1759, roadmap:2453); trzeci cytat („dodana czy zaktualizowana...") zgodny ze źródłem, ale samo `§5.2` obudowane błędną tezą (patrz BLOCKER).
- Rozdział „co przestało być prawdą" (§6.1) z tabelą 7 punktów i numerami starej instrukcji, plus §6.2 uczciwie przyznające, że §4 pkt 6 był nieprawdziwy jeszcze przed zmianami, plus §6.3 rozliczające wszystkie 4 pozycje starego §5.
- Banner w `docs/instrukcja-testow-I4.md` to WYŁĄCZNIE wstawka (`git diff` = same `+`, zero `-`), treść starej instrukcji nietknięta, lista „przestało być prawdą"/„dalej obowiązuje" zgodna ze stanem faktycznym.
- Własność plików zachowana — diff dotyka wyłącznie dozwolonych plików `docs/**`, `rebuild/**` i `contract/**` nietknięte.
- „Ani jednego pola bez pytania albo kratki" — przelot po całym pliku potwierdza: każda sekcja kończy się polem z ☐, zero pól typu „miejsce na uwagi" bez pytania.

### Missing or deviating ✗
- Krok 3 (aktualizacja `docs/rebuild-roadmap.md`) i Krok 4 (`docs/rebuild-backlog.md`) z planu **nie zostały wykonane na tej gałęzi** — zgodnie z notatką w zleceniu przeglądu to nie jest brak tej karty (robią to doc-checkery w kolejnej fazie), więc nie flaguję tego jako problem.
- Plan i raport nie przewidziały ryzyka nakładania się kilku promocji testowych na ten sam warunek między sekcjami — stąd BLOCKER wyżej; ani plan.md, ani raport.md nie wspominają o tym scenariuszu ani o potrzebie porządkowania promocji między krokami.

### Definition of done
- [x] `docs/instrukcja-testow-I4-v2.md` istnieje, trzyma konwencję I3-v2, ma w nagłówku wprost „WERSJA 2 ... TYLKO DELTĘ"
- [x] Sześć zmian opisanych z CO/DLACZEGO/JAK
- [x] Kolumna „Promocja" opisana jako nowa funkcja
- [x] Promocja „zaplanowana" ma osobną sekcję co-było/od-kiedy/co-teraz
- [x] Rada „zmień status" unieważniona z zamiennikiem
- [ ] Rozdział „czego świadomie nie zmieniliśmy" z trzema decyzjami cytowanymi dosłownie — 5.1 i 5.3 tak, ale **5.2 opiera się na twierdzeniu sprzecznym z kodem i z własnym cytowanym raportem** (BLOCKER)
- [x] Rozdział „co przestało być prawdą" z numerami i tabelą rozliczenia
- [x] §4 pkt 6 opisany uczciwie jako nieprawdziwy przed zmianami
- [x] Każda sekcja kończy się polem „Twoja ocena" z kratkami
- [x] Banner w I4.md — tylko wstawka, nic więcej zmienione
- [ ] Roadmapa/backlog aktualizowane — świadomie odłożone do kolejnej fazy (nie wina tej karty, patrz wyżej)
- [ ] „Kroki Sprawdź są wykonalne i dają zadeklarowany rezultat" (kryterium przeglądu, nie literalny punkt DoD, ale funkcjonalnie kluczowy) — **nie spełnione dla 3.1/3.2/4.1** z powodu nakładających się promocji testowych (BLOCKER)

## Parallel-test concerns

Nie dotyczy — karta nie dodaje ani nie zmienia żadnych testów automatycznych (zero zmian w `rebuild/**`).

## Overall assessment

Warstwa redakcyjna i zgodność ze wzorcem `I3-v2` są bardzo solidne: liczby, cytaty (poza jednym) i większość brzmień UI zweryfikowano w kodzie, a nie w raportach, dokładnie tak, jak wymagała karta — to widać w jakości pracy. Niestety dokument ma dwa realne błędy merytoryczne, które podważają jego główny cel: §5.2 mówi Ani coś odwrotnego niż pokazuje kod i własny cytowany raport, a scenariusze 3.1/3.2 (obie ⭐, rekomendowane jako „zrób to jeśli masz mało czasu") mogą dać wynik niezgodny z opisanym „Ma się stać" z powodu nieusuwanej promocji testowej z 2.1. Oba są do naprawienia bez przepisywania całości — pierwszy to zmiana kilku zdań w §5.2, drugi to dopisanie jednego kroku porządkującego przed/między scenariuszami.

---

# Przegląd nr 2

> Reviewed: 2026-09-19
> Branch: docs/65-instrukcja-testow-i4-v2
> Diff od przeglądu nr 1: commit `1e45f7a` (84 zmienione linie w `docs/instrukcja-testow-I4-v2.md`, nowe `raport.md` i `review.md`)

## Weryfikacja BLOCKER 1 (§5.2, teraz linie ~435-453)

**Naprawione poprawnie.** Sprawdzone niezależnie w trzech miejscach:

- `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:270-282` — gałąź `dodawanie = !edycja`
  daje przy edycji narzutu **„Reguła zaktualizowana"**, przy edycji promocji **„Promocja
  zaktualizowana"**. Dokument teraz cytuje oba brzmienia poprawnie (linia 445-446 tekst,
  domyślnie narzut; promocja wspomniana wprost).
- `rebuild/frontend/test/narzuty.edycja-toast.test.tsx` — policzone `it(` bloki: **11**,
  dokładnie tyle, ile deklaruje dokument („zmierzyliśmy jedenaście przypadków"). Same testy
  faktycznie sprawdzają brzmienie toastu (`:204-205`, `:223-224`) i brak drugiej reguły
  (`:154-190`, `PATCH` bez `POST`) — obie treści z §5.2 mają pokrycie.
- `docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md:160-173` — dosłownie „11 przypadków,
  wszystkie przechodzą", tabela z wierszami „Toast po edycji narzutu: Reguła zaktualizowana" /
  „Toast po edycji promocji: Promocja zaktualizowana", i zdanie „nie, edycja nie tworzy drugiej
  reguły" — zgodne z nowym tekstem dokumentu słowo w słowo pod względem faktów.

Nowa ramka ⚠ („gdybyś zobaczyła «Reguła dodana» — to błąd") jest logicznie poprawna: odwraca
polaryzację zgodnie z odwróconym stanem faktycznym.

**Grep po śladach starego, fałszywego twierdzenia — czysto:**
- „Reguła dodana" występuje wyłącznie w kontekście DODAWANIA reguły (§5.2 nowa ramka ⚠ — jako
  przykład błędu do zgłoszenia — oraz `docs/instrukcja-testow-I4.md:83`, gdzie dotyczy scenariusza
  3.1 pierwszej wersji, czyli faktycznego dodania reguły, nie edycji). Brak fałszywego twierdzenia
  „po edycji dalej Reguła dodana".
- „dalej brzmi" — brak w całym pliku.
- „§3.11" — trzy wystąpienia w I4-v2.md (wszystkie w kontekście naprawionym) i jedno w bannerze
  I4.md (`:26`, na liście „Dalej obowiązują" — poprawnie, bo §3.11 rzeczywiście mówi prawdę).
- Rozdziały 6, 7, 8 (linie 468-591) — bez śladu starej tezy; wiersz „5" w tabeli podsumowania
  (rozdz. 7) mówi „Trzy Twoje decyzje zapamiętane poprawnie" — to zdanie jest o zapamiętaniu
  DECYZJI Ani (którą podjęła niezależnie od tego, czy defekt istniał), więc zostaje prawdziwe
  także po przepisaniu §5.2; nie wymagało zmiany.

## Weryfikacja BLOCKER 2 (rozdział 3 + 4.1, jedna promocja)

Przejście łańcucha 2.1 → 3.1 → 3.2 → 3.4 → 4.1 krok po kroku (stan promocji *Wyprzedaż BKT*
po każdym punkcie):

| Po punkcie | Daty | Status wynikowy |
|---|---|---|
| 2.1 | dziś → +30 dni | aktywna |
| 3.1 krok 3 | 2020-01-01 → 2020-03-31 | zakończona |
| 3.2 krok 1 | jutro → za miesiąc | zaplanowana |
| 3.2 krok 3 | wczoraj → za miesiąc (bez zmian) | aktywna |
| 3.4 krok 1 (powtórka kroku 3 z 3.1) | 2020-01-01 → 2020-03-31 | zakończona |
| 4.1 krok 2 | dziś → +30 dni | aktywna |

Każdy krok zastaje promocję w stanie, którego oczekuje poprzedni punkt, i zostawia ją w stanie,
którego oczekuje następny. Ramka ⚠ na wejściu do rozdziału 3 (linie 158-162) poprawnie tłumaczy
DLACZEGO nie wolno zakładać drugiej promocji (remis priorytetu 50, brak pola priorytetu w
formularzu — zgodne z `DialogReguly.tsx:141-152`), bez nadmiernego twierdzenia o determinizmie
kolejności (poprzednia wersja nie miała tego problytmu akurat tu, ale ramka jest ostrożniej
sformułowana: „nie masz wpływu na to, która" zamiast zakładać z góry, że zawsze wygra pierwsza).

**Sekwencja 4.1 (dwa brzmienia komunikatu) jest wykonalna i prawdziwa:**
- krok 1 zastaje promocję *zakończoną* (po 3.4) → komunikat „nie obejmuje żadnego produktu" —
  zgodne z tabelą brzmień wyżej w tym samym punkcie (linia 372) i z logiką „dziś nie obejmuje".
- krok 2 „przywróć daty na domyślne (start dziś, koniec za 30 dni)" — **nie jest to nawiązanie
  do automatycznego resetu formularza** (który rzeczywiście działa tylko przy DODAWANIU nowej
  reguły, `DialogReguly.tsx:129-133`, `naDate(edytowanaPromocja?.start ?? "") || dzisiaj()`),
  tylko instrukcja RĘCZNEGO wpisania tych samych wartości w pola dat przy edycji — pola dat to
  zwykłe `<input type="date">`, więc dowolna wartość jest wpisywalna niezależnie od tego, co
  pokazuje się przy otwarciu dialogu. Wykonalne.
- krok 3 zastaje promocję aktywną → komunikat z liczbą 954, zgodnie z pomiarem z 2.1 (niezmienionym
  tą naprawą, już zweryfikowanym w przeglądzie nr 1).

**Wniosek: oba BLOCKERy naprawione poprawnie, bez wprowadzenia nowych błędów w rozumowanym łańcuchu stanów.**

## Sprawdzenie skutków ubocznych naprawy

- Numeracja punktów (2.1, 3.1–3.4, 4.1, 5.1–5.3, 6.1–6.3, 7, 8) — spójna, bez dziur i duplikatów.
- Tabela w rozdziale 7 — 11 wierszy, zgadza się z „Sprawdzonych ____ / 11" pod tabelą i z liczbą
  punktów w dokumencie. Wiersz „5" nadal opisuje prawdę (patrz wyżej).
- Lista fałszywych alarmów (rozdział 8) — 6 pozycji, wszystkie zweryfikowane w przeglądzie nr 1
  i nietknięte przez `1e45f7a`; nowa treść §5.2/rozdziału 3 nie dodała nowego kandydata na tę
  listę, choć mogłaby (np. „krok 1 w 4.1 pokazuje „0 produktów", to nie błąd" — dokument tłumaczy
  to w miejscu, nie zbiorczo w rozdziale 8; brak tego w rozdziale 8 to niedopatrzenie, patrz
  NICE-TO-HAVE niżej, bo scenariusz jest nowy w tej naprawie i akurat pasowałby do wzorca innych
  sześciu pozycji).
- Pola „Twoja ocena" / pytania z kratkami — przelot po całym pliku (`grep` powyżej) potwierdza:
  zero pól bez pytania lub bez ☐.
- Własność plików — diff `1e45f7a` dotyka wyłącznie `docs/instrukcja-testow-I4-v2.md` i
  `docs/tickets/65-.../{raport.md,review.md}` — w granicach dozwolonych.

## SHOULD-FIX z przeglądu nr 1 — ocena uzasadnienia „bez zmian"

Reviewer (ja, poprzednio) zgłosił, że cytat Ani w §2.1 nie ma weryfikowalnego pierwotnego źródła
(żyje tylko w `plan.md`/`raport.md` kart 53/61, nie w zapisie oryginalnej wiadomości), i zasugerował
oznaczenie go jako parafrazy (D2), tak jak zrobiono to dla cytatu w §4.1.

Autor karty **świadomie nie zmienił** tego, z uzasadnieniem: karty 53/61 zapisują te zdania
**jako cytaty** ze zwrotem „Ania zgłosiła: «…»" — sprawdzone: `docs/tickets/53-.../plan.md:16-18`
faktycznie ma „Ania zgłosiła: «Rabaty nie działają…»" w tej samej konwencji, w jakiej backlog
i roadmapa zapisują cytaty (a)/(b)/(c) z rozdziału 5, których przegląd nr 1 NIE kwestionował.
Rozróżnienie, które przegląd nr 1 próbował przeprowadzić („to dokument planistyczny pisany przez
sesję, nie zapis oryginału"), dotyczy w równym stopniu backlogu i roadmapy — a te źródła traktuje
się w całym dokumencie jako wiarygodne.

**Uzasadnienie się broni.** To defensywny, spójny wybór: albo oznacza się jako parafrazę WSZYSTKIE
cytaty w dokumencie (co rozmywa siłę adnotacji D2 tam, gdzie jest naprawdę potrzebna — przy §4.1,
gdzie samo źródło jawnie mówi „doprecyzowuje"), albo nie oznacza się żadnego z tej kategorii.
Ryzyko zostało uczciwie odnotowane w raporcie („repo nie przechowuje oryginalnych wiadomości Ani,
tylko ich zapis w kartach") zamiast przemilczane. Nie eskaluję tego z powrotem do SHOULD-FIX.

## NICE-TO-HAVE z przeglądu nr 1 — nadal aktualne

- `docs/instrukcja-testow-I4-v2.md:320` (przesunięte z :310-311) — cudzysłów francuski «zaplanowana»
  w cytacie noty, kod ma polski cudzysłów „zaplanowana" (`DialogReguly.tsx:559`). Nadal aktualne,
  nietknięte przez `1e45f7a`.
- `docs/instrukcja-testow-I4-v2.md:127` (przesunięte z :127, treść ta sama) — „cały backend
  produkcji" jako pojedynczy techniczny termin w dokumencie dla nietechnicznej odbiorczyni.
  Nadal aktualne, nietknięte.

## Nowe NICE-TO-HAVE (z tej naprawy)

- [ ] `docs/instrukcja-testow-I4-v2.md:377` (§4.1 krok 1) — słowo „jeśli" („jeśli po punkcie 3.4
  promocja ma daty z 2020") sugeruje niepewność, choć przy wykonaniu kroków po kolei stan jest
  deterministyczny (zawsze będzie miała daty z 2020). Nieszkodliwe (działa jako zabezpieczenie
  na wypadek pominięcia kroku), ale „ponieważ" byłoby precyzyjniejsze.
- [ ] `docs/tickets/65-DOCS-instrukcja-testow-i4-v2/raport.md:6` — raport podaje „561 linii" dla
  `docs/instrukcja-testow-I4-v2.md`, ale po naprawie plik ma **592 linie** (`wc -l`). Metryka w
  Summary nie została odświeżona po dopisaniu naprawy w tym samym commicie, który dodał raport.

## Ocena końcowa (przegląd nr 2)

**0 BLOCKER / 0 SHOULD-FIX (nowych) / 2 NICE-TO-HAVE przeniesione + 2 nowe NICE-TO-HAVE.**
Oba BLOCKERy z przeglądu nr 1 są naprawione rzetelnie — nie tylko zmieniono treść, ale nowa treść
jest zweryfikowana w kodzie i testach, a łańcuch scenariuszy 2.1→3.1→3.2→3.4→4.1 faktycznie
działa na jednej promocji bez kolizji stanu. SHOULD-FIX pozostawiony bez zmian ma solidne
uzasadnienie. Dokument jest gotowy do merge'a z punktu widzenia code review; pozostałe uwagi są
kosmetyczne.
