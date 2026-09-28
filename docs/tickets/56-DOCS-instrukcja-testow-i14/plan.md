# 56-DOCS-instrukcja-testow-i14 — instrukcja testów po fali 1 Iteracji 14

> Status: Draft
> Branch: `docs/56-instrukcja-testow-i14`
> Worktree: `.worktrees/56-DOCS-instrukcja-testow-i14`

## Opis ticketa

Karta **14d** Iteracji 14 — aktualizacja instrukcji testów dla Ani po zmergowaniu fal 14a, 14b
i 14c. Karta **dokumentacyjna, zero kodu produkcyjnego**. Źródłem prawdy dla stanu ekranów są
RAPORTY zamkniętych kart i kod na `origin/develop`, nie plany.

Zakres poleceń karty (pełna treść w promptcie użytkownika):
1. opisać STAN trzech ekranów zmienionych przez 14a/14b/14c,
2. „Dziwactwa ODTWORZONE CELOWO": wykreślić WULSTBAND i `nro`/`cho` (naprawione), przepisać
   „zapis naukowy" (zmiana zatwierdzona, niewdrożona), zostawić status dostawcy + nota o #18,
3. zweryfikować „Czego jeszcze NIE MA" wobec tablicy postępu §4,
4. ⚠ NIE wykreślać testu rozstrzygającego — ma zostać, oznaczony jako NIEWYKONANY,
5. ⚠ backlogu #9 i #10 NIE domykać — są już zamknięte; rozbieżność odnotować w raporcie.

## Kontekst

### Warunek wejścia — spełniony

Wszystkie trzy karty fali 1 są zmergowane do `origin/develop` (4cd5cd9):

| Fala | Ticket | Stan |
|---|---|---|
| 14a | `49-CHORE-i14a-wgrywanie-reczne` | ✅ w develop |
| 14b | `51-FEATURE-staging-filtr-pasek-kolumny` | ✅ w develop |
| 14c | `50-FEATURE-i14c-karta-dostawcy-upload` | ✅ w develop |

### Dwie wersje instrukcji I3 — sedno problemu

- **w repo:** `docs/instrukcja-testow-I3.md`, 2026-09-01, 494 linie, **8 rozdziałów**;
- **u Ani:** 2026-09-02, **17 rozdziałów** — ze ściągą dziesięciu dostawców, rozdziałem
  „Świadome ODSTĘPSTWA od starego Bridge" (10 poz.) i „Dziwactwa ODTWORZONE CELOWO" (13 poz.).
  **Tej wersji w gicie nigdy nie było.**

Numeracja w poleceniach karty pochodzi z wersji Ani. Zweryfikowane grepem po wersji w repo:

| Polecenie karty | Czy ma to odpowiednik w repo? |
|---|---|
| pkt 12 WULSTBAND | **NIE** — zero trafień na `wulst` |
| pkt 13 `nro`/`cho` | **NIE** — zero trafień |
| pkt 4 „zapis naukowy" | TAK — rozdz. 4 poz. **4** |
| pkt 10 status dostawcy | TAK — rozdz. 4 poz. **11** (nie 10) |
| test rozstrzygający | **NIE** — zero trafień |
| rozdz. „Czego jeszcze NIE MA" | TAK — rozdz. **5** |
| rozdz. „Świadome ODSTĘPSTWA" | **NIE** — brak rozdziału |
| ściąga dziesięciu dostawców | **NIE** — brak rozdziału |

Rozdział 4 w repo ma **11 pozycji, nie 13**.

### Stan trzech ekranów na `origin/develop` (zweryfikowany w kodzie)

Ustalenia researchera potwierdzone cytatami z kodu — szczegóły wchodzą wprost do instrukcji.

**Wgrywanie ręczne** (`pages/konfiguracja/Wgrywanie.tsx`, `DialogWgrywania.tsx`): dwie karty —
„Wgraj wiele plików — auto-detekcja" z przyciskiem **„Wgraj pliki"** (`button-multi-upload`,
**bez licznika**) otwierającym modal, oraz „Wgrywanie pojedyncze (z wymuszonym dostawcą)"
z siatką kafli `upload-tile-{kod}` (kod, nazwa, e-mail, przycisk „Wgraj plik"). W dialogu:
strefa dropu, „Wybierz pliki z dysku", „Dodaj kolejny plik", select dostawcy per pozycja,
„Wyczyść" i **„Importuj do staging"**. Toast sukcesu: tytuł `N pozycji czeka na akceptację`
albo „Import zakończony", opis = niezerowe człony sklejone `" • "`. Toast błędu pliku:
`Błąd pliku {nazwa}`; błąd importu: „Błąd importu" — **dialog zostaje otwarty**, pętla urywa się
na pierwszym błędzie. Sekcja „Ostatni import" pod kaflami pojawia się po pierwszym imporcie.

**Staging** (`pages/Staging.tsx`, `pages/staging/**`): domyślny filtr **„Nowe produkty"**
(`nowa`), nie „Wszystkie". Opcje: Wszystkie / Nowe produkty / Nowe produkty (stare) / Wycofane /
Zmiany kluczowe / Błędy importu. Placeholder szukajki: „Szukaj po kodzie, nazwie, dostawcy
lub EAN...". Nagłówek: „Akceptuj wszystkie (N)" / „Odrzuć wszystkie (N)" — **pytają o
potwierdzenie** (`DialogPotwierdzenia`). Pasek: „Akceptuj/Odrzuć zaznaczone (N)" tylko przy
zaznaczeniu, „Kolumny", „Akceptuj widoczne" / „Odrzuć widoczne". Konfigurator kolumn: skróty
„Wszystkie" / „Domyślne" / „Żadna", sekcje „W tabeli stagingu" (9) i „Dodatkowe (z katalogu)"
(49, nieaktywne). **Domyślnie UKRYTE: Stan, Cena zakupu, Cena sprzedaży.** Kolejność nagłówków:
☑ · Typ · Kod · Nazwa · Dostawca · Magazyn · Zmiana · Powód · Akcje.

**Karta dostawcy** (`pages/konfiguracja/Dostawcy.tsx`): przycisk **„Synchronizuj"** (nie
„Synchronizuj teraz"). Nowy przycisk **„Wgraj plik"** dla `sposobDostarczania ∈ {upload, mail}`,
`accept=".csv,.xml,.xlsx"`, toast „Plik wczytany" z `N produktów, N nowych, N zmienionych`.
Pole minut schowane za opcją **„Inna wartość (minuty)…"**; po przełączeniu z presetu pole jest
**puste** (zgodne z oryginałem, `freq-injection.js:141`).

### Stan backlogu (zweryfikowany)

- **#9** (`nro`/`cho` jako 0/1) — ✅ **ZAMKNIĘTY**: fix Ani 2026-09-01, sportowany i
  **potwierdzony pomiarem** w `42-CHORE-i13a-resync-parserow` (2026-09-08).
- **#10** (WULSTBAND) — ✅ **ZAMKNIĘTY**, ta sama karta i ten sam pomiar.
- **#11** (EAN w notacji naukowej, „null cyfr znaczących") — ✅ TAK, **rozstrzygnięte
  2026-09-18 przez Anię** (EAN ma trafiać jako PUSTE pole), status: „decyzja podjęta, karta
  niezałożona" → karta **14i**, jeszcze nie istnieje. **Niewdrożone.**
- **#18** (status „wstrzymany" niewidoczny na karcie) — ✅ port 1:1, odtworzone, opisane w I3
  §4 pkt 11. Prośba Ani o dwa pola czeka na decyzję, **poza zakresem I14**.

### Rozjazd wykryty w roadmapie

`docs/rebuild-roadmap.md` §4 wiersz 14 ma status **⬜**, podczas gdy blok §5/I14 mówi
„🔨 w toku, 14c ✅" i trzy karty są zmergowane. Wiersz jest własnością tej karty.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Brak — ticket nie dotyka kontraktu.** Karta jest czysto dokumentacyjna: nie powstaje ani nie
zmienia się żadna linia w `rebuild/`, `contract/` ani w schemacie bazy. Gate odbudowy z Kroku 9
**nie obowiązuje**; bramki kodu (`lint`/`typecheck`/`build`/`test`) nie są uruchamiane, bo nie
ma czego weryfikować — zmienione pliki to wyłącznie `docs/**`.

Jedyna „siatka bezpieczeństwa" tej karty to **wierność opisu wobec kodu**: każdy cytowany
w instrukcji string UI musi być dosłownie obecny w `rebuild/frontend/src/` na `origin/develop`.
Weryfikacja: `grep` po literałach przed oddaniem karty (patrz „Strategia weryfikacji").

## Decyzje

Podjęte w rozmowie z użytkownikiem (runda D1 + doprecyzowanie).

- **D1 — forma: delta `docs/instrukcja-testow-I14.md`, nie odtworzenie 17 rozdziałów.**
  Użytkownik wybrał najpierw wariant B (odtworzenie pełnej wersji Ani), a po wyjaśnieniu zakresu
  zmienił decyzję na **nową, krótką instrukcję w konwencji `instrukcja-testow-I13.md`** —
  opisującą wyłącznie to, co się zmieniło, co Ania zgłosiła w uwagach i co musi zweryfikować
  ponownie. *Za:* dokument jest krótki, Ania testuje deltę, a nie czyta 17 rozdziałów od nowa;
  projekt ma już ten wzorzec (I13). *Przeciw (świadomy koszt):* **rozjazd z 17-rozdziałowym
  dokumentem Ani NIE znika** — to było wprost powiedziane przy wyborze i zostaje jako follow-up.
- **D2 — treść rekonstruowana wyłącznie z weryfikowalnych źródeł repo** (kod `rebuild/` na
  `origin/develop`, `docs/rebuild-backlog.md`, raporty kart 49/50/51, `docs/rebuild-roadmap.md`).
  Niczego nie zmyślamy; czego nie da się pokryć źródłem — nie wchodzi do dokumentu.
- **D3 — stary `docs/instrukcja-testow-I3.md` ZOSTAJE, dostaje banner** „nieaktualne w punktach
  X, patrz I14" na górze. *Za:* linkuje do niego `instrukcja-testow-I4.md`, a historia I3 ma
  wartość jako zapis stanu z 01.09. *Przeciw:* dwa dokumenty zamiast jednego — akceptowane,
  bo banner kieruje ruch.
  ⚠ **Poza bannerem NIE edytujemy treści I3** — w szczególności NIE poprawiamy 9 wystąpień
  „Synchronizuj teraz" w miejscu, tylko wymieniamy je w rozdziale „Co jest nieaktualne".
  Uzasadnienie: konwencja I13 („starsze instrukcje ZOSTAJĄ bez zmian, wierz tej kartce").
- **D4 — test rozstrzygający wchodzi do I14 jako NOWY rozdział, oznaczony NIEWYKONANY.**
  W wersji repo go nie ma, więc „nie wykreślać" znaczy tu „dopisać". Tabela MO1–MO10 z jawnym
  statusem: MO1 — „na oko, bez liczb"; MO2–MO8, MO10 — nieporównane; MO9 — niewykonalne (API,
  brak pliku); MO6 — wyłączony z importu.
- **D5 — backlogu #9 i #10 NIE ruszamy.** Są zamknięte i potwierdzone pomiarem w 13a.
  Wcześniejszy plan I14 („14d ma je rozliczyć") był błędny — rozbieżność idzie do raportu
  i do poprawki opisu 14d w roadmapie.
- **D6 — wiersz 14 w §4 dostaje status 🔨, nie ✅.** Fala 1 (14a–14d) domknięta, ale fala 2
  (14e, 14f, 14h, 14i) jest otwarta, więc ✅ byłoby nieprawdą.
- **D7 — `docs/instrukcja-testow-I4.md` NIETKNIĘTA.** Decyzje Ani unieważniły jej rozdziały
  4 i 5, ale to zależy od kart 14f/14h/14i, których jeszcze nie ma. Idzie do follow-upu.

### Świadome odstępstwa od zachowania oryginału

Brak — karta nie zmienia zachowania. Odstępstwa opisywane w instrukcji (np. brak podglądu
przed importem, `DialogPotwierdzenia` zamiast `confirm()`) zostały zatwierdzone w kartach
14a/14b i tu są tylko **opisywane**, nie wprowadzane.

## Plan realizacji

1. **`docs/instrukcja-testow-I14.md`** (nowy) — trzynaście rozdziałów w konwencji I13:
   1. Co zmienia Iteracja 14 — w skrócie
   2. Co zobaczysz INACZEJ niż wcześniej (tabela gdzie/było/jest)
   3. Wgrywanie ręczne — nowy przepływ (dwie ścieżki: modal zbiorczy i kafel dostawcy)
   4. Staging — nowy domyślny filtr i przycisk „Kolumny"
   5. Karta dostawcy — „Synchronizuj", „Wgraj plik", pole częstotliwości
   6. Co PRZESTAŁO być dziwactwem (WULSTBAND, `nro`/`cho` — z liczbami z pomiaru 13a)
   7. Co ZOSTAJE dziwactwem (status dostawcy, #18 + prośba o dwa pola czeka na decyzję)
   8. Zmiana zatwierdzona, ale jeszcze NIE wdrożona (EAN naukowy, #11, karta 14i)
   9. ⭐ Test rozstrzygający — NIEWYKONANY (tabela MO1–MO10)
   10. Co jest NIEAKTUALNE w instrukcji Iteracji 3 (lista miejsc z numerami sekcji)
   11. Czego jeszcze NIE MA (zweryfikowane wobec §4)
   12. Szybka lista kontrolna
   13. Jak zgłaszać problemy
2. **`docs/instrukcja-testow-I3.md`** — wyłącznie banner na górze (po nagłówku „STAGING"),
   kierujący do I14 i wymieniający, co konkretnie zdezaktualizowało się po I14.
3. **`docs/rebuild-roadmap.md`** — podblok **14d** przepisany na STAN (✅ + data + ID ticketa,
   faktyczny zakres, sprostowanie założenia o backlogu #9/#10, zapis decyzji D1 o formie
   dokumentu) oraz **wiersz 14 w tablicy §4** (⬜ → 🔨, z rozliczeniem fali 1 i wskazaniem
   otwartej fali 2). Podbloków 14a/14b/14c ani kart fali 2 NIE ruszamy.
4. **`docs/rebuild-backlog.md`** — sprawdzić #9/#10/#11/#18; **domyślnie BEZ ZMIAN** (D5).
   Edycja tylko, gdyby weryfikacja wykazała realny brak.

Kolejność: 1 → 2 → 3 → 4, commit po każdym kroku.

## Strategia weryfikacji

Bramki kodu nie dotyczą (patrz „Kontrakt i fixtures"). Zamiast nich:

1. **Weryfikacja stringów** — każdy literał UI cytowany w instrukcji sprawdzony `grep`em
   w `rebuild/frontend/src/` na tej gałęzi. Lista do sprawdzenia: „Wgraj pliki", „Wgraj plik",
   „Importuj do staging", „Dodaj kolejny plik", „Wyczyść", „Ostatni import", „Nowe produkty",
   „Szukaj po kodzie, nazwie, dostawcy lub EAN...", „Kolumny", „Widoczne kolumny (staging)",
   „Akceptuj widoczne", „Synchronizuj", „Inna wartość (minuty)…", „Plik wczytany",
   „Wgrywanie pojedyncze (z wymuszonym dostawcą)".
2. **Weryfikacja liczb** — 9 przełączników w „W tabeli stagingu", 49 w „Dodatkowe",
   3 domyślnie ukryte kolumny, liczby z pomiaru 13a (MO1 199, MO3 44, MO9 12).
3. **Weryfikacja stanu iteracji** — każdy wiersz rozdziału „Czego jeszcze NIE MA" skonfrontowany
   z tablicą §4 i z listą tras w `rebuild/frontend/src/App.tsx`.
4. **Weryfikacja odsyłaczy** — wszystkie numery sekcji I3 przywołane w rozdziale 10 muszą
   istnieć w `docs/instrukcja-testow-I3.md` (nauka z 14b: roadmapa powoływała się na §9.1/§9.3,
   których nie ma — dokument kończy się na §8).
5. **Review** — podagent `reviewer` na diffie gałęzi.

Czego NIE robimy: nie uruchamiamy aplikacji ani testów — nie ma zmian w kodzie, a `npm test`
na niezmienionym `rebuild/` nic by nie dowiodło.

## Poza zakresem

- **Kod produkcyjny** — zero zmian w `rebuild/`.
- **`docs/instrukcja-testow-I4.md`** — D7, czeka na karty 14f/14h/14i.
- **Odtworzenie 17-rozdziałowej wersji Ani** — odrzucone w D1; rozjazd zostaje jako follow-up.
- **Poprawianie treści I3 poza bannerem** — D3.
- **Podbloki 14a/14b/14c i karty fali 2 w roadmapie** — cudza własność, równolegle mogą chodzić
  karty 14e/14h/14i.
- **Zakładanie karty 14i** (EAN naukowy) — instrukcja tylko OPISUJE, że decyzja czeka.
- **Domykanie backlogu #9/#10** — D5, są zamknięte.

## Definicja ukończenia

- [ ] `docs/instrukcja-testow-I14.md` istnieje i opisuje STAN trzech ekranów zgodny z kodem
      na `origin/develop` (wszystkie cytowane stringi zweryfikowane `grep`em)
- [ ] WULSTBAND i `nro`/`cho` opisane jako **naprawione**, z liczbami z pomiaru 13a
- [ ] „zapis naukowy" opisany jako **zmiana zatwierdzona, jeszcze niewdrożona** (#11, karta 14i)
- [ ] status dostawcy **zostaje** jako dziwactwo + nota o prośbie Ani i backlogu #18
- [ ] rozdział „Czego jeszcze NIE MA" zawiera wyłącznie pozycje potwierdzone wobec §4
- [ ] **test rozstrzygający obecny i oznaczony NIEWYKONANY**, z tabelą MO1–MO10
- [ ] `docs/instrukcja-testow-I3.md` ma banner kierujący do I14; poza bannerem nietknięta
- [ ] roadmapa: podblok 14d opisuje STAN, wiersz 14 w §4 ma status 🔨 z rozliczeniem fali 1
- [ ] backlog #9/#10 **nietknięte**, rozbieżność z planem I14 odnotowana w raporcie
- [ ] `docs/instrukcja-testow-I4.md` nietknięta, follow-up zapisany
- [ ] `git diff --name-only origin/develop` zwraca wyłącznie pliki z listy własności karty
