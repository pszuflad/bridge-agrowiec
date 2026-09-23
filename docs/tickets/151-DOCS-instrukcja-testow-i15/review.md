# 151-DOCS-instrukcja-testow-i15 — Code review

> Reviewed: 2026-09-24
> Branch: `docs/151-instrukcja-testow-i15`
> Diff: 3 pliki (`docs/instrukcja-testow-I15.md` nowy, `docs/tickets/151-.../plan.md` nowy, `docs/triage-state.txt` zmieniony), 1 commit

## BLOCKER

- [ ] `docs/instrukcja-testow-I15.md:71` — przykład treści kolumny „Blokowane formy płatności" jest zmyślony.
  - Reason: dokument mówi „kolumna pokazuje listę zablokowanych form, np. «Płatność odroczona, Kredyt
    kupiecki»". W kodzie (`rebuild/frontend/src/pages/katalog/formatowanie.tsx:47-70,257-260`, 1:1 z
    oryginałem `rebuild/backend/src/import/legacy/payment_blocks.cjs:7-16`) kolumna wypisuje **surową listę
    numerycznych ID form płatności Selly**, np. dla MO1 dosłownie `"203, 204, 205, 206, 207, 208, 209, 210,
    211, 212, 213, 214, 215, 216, 217, 218, 219"` — nigdzie w repo (backend, frontend, `contract/`, karty
    ticketu 122) nie ma mapowania tych ID na nazwy typu „Płatność odroczona" czy „Kredyt kupiecki". Fraza
    pochodzi wyłącznie z `docs/karty/I15.9/wejscie-122.md` i została przepisana bez weryfikacji w kodzie
    (dokładnie ten typ błędu, przed którym ostrzega `plan.md`: „każdy fakt w dokumencie ma oparcie w pliku,
    nie w pamięci"). Ania, klikając krok 2, zobaczy ciąg liczb, a nie nazwy form płatności — może to zgłosić
    jako błąd (bo dokument obiecał czytelny tekst), albo zwątpić w resztę dokumentu.
  - Suggestion: zamienić przykład na rzeczywistą wartość (np. `"203, 204, 205, ..., 219"` dla MO1) albo
    opisać ogólnie „ciąg numerów identyfikatorów form płatności, oddzielonych przecinkami — to jest to samo,
    co dziś pokazuje produkcja".

## SHOULD-FIX

- [ ] `docs/instrukcja-testow-I15.md:409-421` — licznik w podsumowaniu nie zgadza się z liczbą wierszy tabeli.
  - Reason: tabela ma 11 wierszy (1.1–1.8, 2.1, 2.2, 3), a stopka mówi „Sprawdzonych ____ / 10". Wiersz „3"
    (sprostowania) nie jest wliczony do dziesiątki, ale wygląda identycznie jak pozostałe wiersze z checkboxami
    OK/ŹLE, więc Ania może dodać go do licznika i się nie zgodzi z „/10".
  - Suggestion: dopisać przy wierszu „3" adnotację „nie liczy się do dziesiątki" albo zmienić licznik na „/11".
- [ ] `docs/instrukcja-testow-I15.md:283,418` — punkt 1.8 ma inny format oceny niż reszta.
  - Reason: sama sekcja 1.8 kończy się „Twoja ocena: ☐ przeczytane" (bo na stagingu nic nie da się kliknąć),
    ale wiersz 1.8 w tabeli podsumowania (rozdz. 5) ma zwykłe kolumny OK/ŹLE — niespójność formy, która może
    zdezorientować przy wypełnianiu zbiorczej tabelki.
  - Suggestion: ujednolicić — albo tabela dostaje trzecią kolumnę „przeczytane" dla 1.8, albo się to jasno
    opisze w nagłówku tabeli.
- [ ] Odsyłacze do `instrukcja-testu-sciezki-krytycznej.md`, `instrukcja-pelnego-testu.md`,
  `instrukcja-pracy-dla-ani.md` (linie 20-21, 84, 137, 192, 270, 429) wskazują na pliki, które **jeszcze nie
  istnieją** w repo (powstają równolegle w tickecie 150/149/153). To świadoma decyzja D2 z `plan.md`, więc nie
  jest to błąd tego ticketu — ale warto, żeby koordynator upewnił się, że te trzy dokumenty trafią do `develop`
  zanim ktokolwiek wyśle tę kartkę Ani, inaczej linki będą martwe.

## NICE-TO-HAVE

- [ ] `docs/instrukcja-testow-I15.md:126` — „Wiersz MO9 (Agrorami)" używa pisowni „Agrorami" (bez łącznika),
  podczas gdy `docs/cutover.md` i część kart konsekwentnie piszą „Agro-Rami". Nazwa faktycznie widoczna w
  panelu pochodzi z kolumny `suppliers.nazwa` w bazie i nie jest zaszyta w kodzie frontu, więc nie da się tego
  100% zweryfikować statycznie — ale warto ujednolicić pisownię w dokumentacji.
- [ ] Dokument jest dość długi (442 linie) jak na „krótko, bez ściany tekstu" z polecenia Ani
  (`wejscie-104b.md`). Struktura per punkt jest zwarta, ale liczne ramki ⚠ z wyjaśnieniami mechanizmu (np.
  1.6, 1.8, 2.1) miejscami zbliżają się do uzasadnień technicznych, których polecenie Ani prosiło unikać.
  Prawdopodobnie uzasadnione (zapobiega fałszywym zgłoszeniom „błędu"), ale warto to mieć na uwadze przy
  kolejnych deltach.

## Plan compliance

### Done ✓
- Nowy `docs/instrukcja-testow-I15.md` w układzie „co zmieniliśmy → polecenie → rezultat" (D6).
- Wszystkie tematy z karty I15.9 (11 wejść) i kart I15.10/I15.10b/I15.11 pokryte: blokowane formy płatności
  (1.1), zastosowania/kategorie (1.2), MO9 (1.3), szerokość bez zer — sprostowanie (1.4), Staging v2/EAN —
  sprostowanie (1.5), „Braki w cenniku" (1.6), import zatrzymujący się na błędach odczytu (1.7), Selly REST
  (1.8), pełne pliki CSV z Analityki — sprostowanie (2.1), kolejka atrybutów -526 (2.2).
- Trzy sprostowania (D4/D7) poprawnie zaadresowane i zweryfikowane niezależnie: cytat „I3 §11 pkt 10" faktycznie
  nie istnieje (I3 i I3-v2 mają sekcje 1–8), prawdziwe miejsce to `instrukcja-testow-I3.md` §4 pkt 3, wiersze
  355-358 — treść zgadza się słowo w słowo z dokumentem. EAN naukowy (I3-v2 pkt 4.3) i pliki CSV Analityki
  (I10-v2 pkt 1.3) też poprawnie zacytowane.
- D8 (przycisk „Synchronizuj", nie „Synchronizuj teraz") potwierdzony w `Dostawcy.tsx:309-314` i w
  `instrukcja-testow-I3-v2.md:374-389`.
- D9 (brak filtra „Zastosowanie", filtruje się przez „Kategoria") potwierdzony w `filtrowanie.ts` — kryteria
  mają tylko `kategorie`, `zastosowanie` nie ma w `POLA_SZUKAJKI`.
- Ścieżka krytyczna nie jest powielona (D5) — przy MO9, Staging v2 i CSV zostaje „jest teraz tak" + odesłanie,
  bez pełnych scenariuszy.
- Karta `docs/karty/I15.9/karta.md` i `docs/triage-state.txt` zaktualizowane zgodnie z planem.
- Zweryfikowałem wyrywkowo prawie każdą etykietę z tabeli „Weryfikacja etykiet interfejsu" w raporcie
  (nawigacja, zakładki Konfiguracji, filtr „Typ sprawy" + odznaki, kolumny domyślne, filtr „Kategoria",
  kolejka „Do akceptacji", przyciski Selly, komunikat blokady EAN, reguły zastosowań, generator CSV, migracje)
  — wszystkie się zgadzają z kodem, łącznie z numerami linii.
- Liczby (265 rekordów Ładowarka→Ciągnik, 172 zmiany szerokości, 1114/991/123 dla MO9, 5109/5184/1716/1644/1100
  dla CSV Analityki) mają pokrycie w `docs/rebuild-backlog.md` i kartach — nic zmyślonego poza pozycją z
  BLOCKER.

### Missing or deviating ✗
- Brak — zakres z karty I15.9 (11 wejść) pokryty w całości, nic nie wypadło.

### Definition of done
- [x] `docs/instrukcja-testow-I15.md` pokrywa cały zakres z karty I15.9 i decyzji D1
- [x] Każdy punkt w układzie „co zmieniliśmy → polecenie → rezultat", bez ściany tekstu (poza drobną uwagą
      NICE-TO-HAVE o długości)
- [x] Trzy sprostowania wyraźnie oznaczone i zebrane w tabeli
- [x] Rozbieżności z logiką biznesową w osobnej sekcji „Do Twojej decyzji"
- [x] Tematy wspólne ze ścieżką krytyczną odesłane, nie przepisane
- [x] Karta I15.9 opisuje STAN, nie zamiar; `triage-state.txt` zaktualizowany
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE` — nie sprawdzałem (poza zakresem code review;
      do weryfikacji przy pushu)

## Parallel-test concerns

Brak testów automatycznych — ticket jest czysto dokumentacyjny, nie dotyczy suite'ów Vitest ani zasobów
współdzielonych.

## Overall assessment

Rzemiosło weryfikacyjne w tym tickecie jest bardzo solidne — niemal każdy fakt (nazwy ekranów, zakładek,
filtrów, kolumn, komunikatów, godzin harmonogramu, liczby z charakteryzacji) ma dokładne pokrycie w kodzie i
kartach, łącznie z numerami linii. Jeden istotny wyjątek psuje ten obraz: przykład treści kolumny „Blokowane
formy płatności" w punkcie 1.1 jest zmyślony i wprowadzi Anię w błąd przy pierwszym, najważniejszym (⭐) punkcie
dokumentu — to trzeba poprawić przed wysłaniem. Reszta uwag to drobne niespójności formy (licznik w
podsumowaniu, format oceny 1.8) i informacja o zależności od równoległych ticketów z linkami do jeszcze
nieistniejących dokumentów — żadna z nich nie blokuje merge'a samego dokumentu, ale BLOCKER musi być
naprawiony.

---

## Obieg 2

> Reviewed: 2026-09-24
> Branch: `docs/151-instrukcja-testow-i15`
> Diff: 5 plików (`docs/instrukcja-testow-I15.md`, `plan.md`, `raport.md`, `review.md`, `docs/triage-state.txt`), 3 commity
> Kontekst: weryfikacja poprawek po obiegu 1 (commit `1d3e21c`) + świeże spojrzenie na resztę dokumentu.

### Weryfikacja BLOCKER-a z obiegu 1

**Zniknął.** Punkt 1.1 (`docs/instrukcja-testow-I15.md:59-94`) teraz poprawnie mówi, że kolumna
pokazuje listę numerów, z przykładem dla MO1 `203, 204, 205, … 219`. Sprawdzone znak w znak:

- `rebuild/backend/src/import/legacy/payment_blocks.cjs:8` — `MO1: '203, 204, 205, 206, 207, 208,
  209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219'` — identyczne z przykładem w dokumencie.
- `rebuild/frontend/src/pages/katalog/formatowanie.tsx:47-70` — czwarta kopia tej samej mapy,
  identyczna co do znaku (potwierdzone też komentarzem w kodzie: „zweryfikowane 2026-09-23, że
  dziś są identyczne co do znaku").
- `formatowanie.tsx:257-260` — `<span title={lista}>{lista}</span>` dla niepustej listy, `<Kreska/>`
  („—") gdy `blokowaneFormyPlatnosci()` zwraca pusty string — potwierdza zarówno dymek (`title`)
  z dokumentu, jak i zachowanie dla MO6 (mapa nie ma klucza `MO6`, więc `?? ""` daje pustkę →
  kreska). Komentarz w kodzie (`formatowanie.tsx:32-34`) potwierdza też fakt „MO6 celowo bez wpisu"
  cytowany w dokumencie.
- Nowy punkt **4.6** (`:412-418`) jest prawdziwy i nie obiecuje niczego ponad stan faktyczny —
  `grep` po „odroczon"/„kupieck" w repo rzeczywiście daje zero trafień (sam sprawdziłem), więc
  zdanie „nigdzie nie mamy listy numer→nazwa" się broni.

### Weryfikacja obu SHOULD-FIX z obiegu 1

- **Licznik rozdz. 5** (`:438`): „Sprawdzonych ____ / 11”. Tabela ma dokładnie 11 wierszy
  (1.1–1.8, 2.1, 2.2, 3) — zgadza się. Decyzje: rozdział 4 ma punkty 4.1–4.6, licznik „/ 6” —
  zgadza się.
- **Punkt 1.8** (`:290`): teraz kończy się „☐ OK ☐ ŹLE — uwagi: _______________”, tak samo jak
  reszta punktów — niespójność formy zniknęła.

Oba SHOULD-FIX z obiegu 1 potwierdzone jako naprawione.

### Regresja po poprawkach

- Numeracja punktów i odsyłaczy wewnętrznych spójna: „patrz punkty 4.1 i 4.2” (1.8), „punkt 4.6”
  (1.1), „punkt 4.3” (1.8), tabela w rozdz. 3 odsyła do punktów 1.4/1.5/2.1 — wszystkie istnieją
  i treściowo się zgadzają.
- Rozdział 6 „Siedem rzeczy... wygląda na błąd”: policzone — lista ma dokładnie 7 pozycji, zgadza
  się z zapowiedzią „Siedem rzeczy”. Punkt 1 listy („numery zamiast nazw... i „—” przy MO6”)
  poprawnie odzwierciedla nową treść 1.1 (przed poprawką ten punkt siłą rzeczy nie mógł być
  spójny, bo mówił o czymś innym — sprawdzone, teraz jest spójny).
- Tabela sprostowań w rozdziale 3 (trzy wiersze) nie została naruszona poprawką BLOCKER-a — nie
  dotyczy kolumny blokowanych form płatności, więc nie było ryzyka kolizji; sprawdzone, że nadal
  ma 3 wiersze zgodne z zapowiedzią „Trzy zdania”.
- Nic nie wskazuje, żeby poprawka BLOCKER-a naruszyła sąsiadujące akapity (dymek z tooltipem, opis
  MO6, sekcja „Dwie rzeczy, które wyglądają na brak”) — wszystkie nadal prawdziwe i spójne z resztą
  dokumentu.

### Świeże spojrzenie — szukanie tego samego wzorca błędu (fakt z karty bez weryfikacji w kodzie)

Przeszedłem punkt po punkcie liczby, godziny i treści komunikatów, sprawdzając każdą wartość
bezpośrednio w kodzie (nie tylko w kartach `docs/karty/I15.9/wejscie-*.md`):

- **1.2** — lista 7 wartości zastosowań Rolniczych (`Ciągnik · Kombajn · Opryskiwacz · Przyczepa
  · Kosiarka/ogród · Wózek widłowy · Uniwersalne/pozostałe`) zgadza się słowo w słowo z
  `CATEGORY_VALUES.Rolnicze` w `rebuild/backend/src/import/legacy/application_rules.cjs:9-17`;
  „Ładowarka” zostaje w `Przemysłowe` (`:19-26`) — potwierdzone. Liczba **265 rekordów** potwierdzona
  niezależnie w `docs/rebuild-backlog.md:3843` („265 rekordów Rolniczych, po korekcie zostało 0
  Rolniczych z zastosowaniem «Ładowarka»”).
- **1.3** — liczby **1114/991/123** dla MO9 z 17.09 potwierdzone w `docs/rebuild-backlog.md:3690`
  („1114 pozycji, 991 dopuszczonych, 123 odrzucone, 0 błędów”).
- **1.4** — **172 pozycje u 9 z 10 dostawców (wszyscy poza MO6)** — nie zweryfikowałem tej
  konkretnej liczby bezpośrednio (wymagałoby uruchomienia pomiaru na `db/snapshot.db`), ale
  mechanizm obcinania zer (`formatowanie.tsx` — sekcja „Zera końcowe PRZEŻYŁY usunięcie gałęzi”)
  jest w kodzie i opisany zgodnie z dokumentem. Brak w repo alternatywnego źródła liczby „172” do
  krzyżowej weryfikacji — nie mogę ani potwierdzić, ani obalić; nie flaguję jako błąd (dokument
  jasno przypisuje to do „wzorca dziesięciu dostawców”, czyli konkretnego pomiaru autora), ale
  odnotowuję jako pozycję nie w 100% zweryfikowaną z mojej strony.
- **1.8 / harmonogram** — `MINUTY_TORU_1 = [55, 10, 25, 40]`, `TOR2_HOUR=4`, `TOR2_MINUTE=30`,
  `FULL_ROTATION` (`rebuild/backend/src/selly/rest/scheduler.ts:36-64`) zgadzają się dosłownie z
  tabelą w dokumencie, łącznie z „śr MO5+MO6” (a nie samo MO5) i „pierwsza sobota/niedziela”.
- **Komunikaty** — wszystkie trzy dosłowne cytaty sprawdzone bajt w bajt w kodzie:
  `„Błędy odczytu cennika (N). Import zatrzymany bez przełączania na stary format."`
  (`rebuild/backend/src/import/legacy/feed_safety.cjs:13`), `„Błędny EAN: popraw numer w edycji
  zgłoszenia przed akceptacją."` (`rebuild/backend/src/import/polityka/blokady.ts:70`), `„Brak
  trzech wiarygodnych potwierdzeń nieobecności. Wczytaj aktualny cennik."` (`blokady.ts:53`).
- **CSV / Analityka (2.1)** — liczby 5109 / po 5184 / 1716 / 1644 / 1100 potwierdzone niezależnie
  w `docs/karty/P10.5/karta.md:48-53` i `docs/rebuild-backlog.md:4410-4411` (nie tylko w karcie
  I15.9) — dwa niezależne źródła się zgadzają. „EAN wspólne (769)” i „Marża (335)” też potwierdzone
  w tych samych źródłach.
- **2.2** — **526 pozycji** potwierdzone w `docs/karty/I15.9/wejscie-113.md:6,10` („usunięto z
  kolejki 526 pozycji obecnych w słowniku” / „znika 526 pozycji”) — jedyne źródło jest kartą, nie
  ma niezależnego drugiego potwierdzenia w `rebuild-backlog.md`, ale treść jest spójna i
  konkretna (nie ogólnikowa), więc nie flaguję.
- **Warunki (8329 produktów, 23.09)** — potwierdzone w `docs/karty/I15.9/wejscie-113.md:3`
  („Staging dostał 23.09 świeżą kopię bazy produkcji (8329 produktów)”) i niezależnie w
  `rebuild/backend/src/selly/generator-csv.ts:170-172` (pomiar z ticketu 113: „0 wierszy z pustym
  polem na 8329 produktów”) — dwa niezależne miejsca, ta sama liczba.
- **60. kolumna CSV / nazwy kategorii** — policzyłem ręcznie wpisy w `KOLUMNY` w
  `generator-csv.ts:49-108` = dokładnie 60, `Blokowane-formy-platnosci` jest ostatnia (60.).
  Nazwy kategorii („Opony rolnicze”, „Opony leśne”, „Opony przemysłowe”, „Opony ciężarowe”)
  zgadzają się dosłownie z `NAZWY_KATEGORII_SKLEPU` (`generator-csv.ts:172-178`).
- **Godziny CSV (6:00 generacja / 12:00 pobranie przez Selly)** — potwierdzone w komentarzach
  `csv-cli.ts:5-10`, `generator-csv.ts:5,202` i niezależnie w `docs/karty/I15.9/wejscie-104.md:6`.
- **Przycisk „Rozstrzygnij” / „Sprawdź kartę”** — potwierdzony w `OknoRozstrzygniecia.tsx`,
  `TabelaStagingu.tsx:221`, `Staging.tsx:65,381`.
- **Etykiety Stagingu** („Braki w cenniku”, „Brak w cenniku”, podsumowanie importu) — potwierdzone
  w `pages/staging/dane.ts:78,103-104` i `pages/konfiguracja/DialogWgrywania.tsx:217-220`.

Nie znalazłem żadnego drugiego przypadku wzorca „fakt z karty bez weryfikacji w kodzie” — dokument
po poprawkach jest wyjątkowo starannie podparty kodem, w tym liczbami i cytatami dosłownymi.

### Wynik

**0 BLOCKER / 0 SHOULD-FIX / 1 NICE-TO-HAVE**

- [ ] `docs/instrukcja-testow-I15.md:163` — liczba „172 pozycje u dziewięciu z dziesięciu
  dostawców (wszyscy poza MO6)” nie ma w repo niezależnego źródła do krzyżowej weryfikacji (jest
  tylko w tym dokumencie); mechanizm, który ją produkuje, jest w kodzie i zgodny z opisem, ale
  samej liczby nie da się potwierdzić bez odpalenia pomiaru na `db/snapshot.db`. Nie blokuje —
  odnotowuję dla porządku, gdyby ktoś chciał to później zweryfikować.

### Ogólna ocena

BLOCKER z obiegu 1 został naprawiony poprawnie i dokładnie — nowa treść punktu 1.1 zgadza się co
do znaku z trzema niezależnymi miejscami w kodzie (backend, front, render komórki), a nowy punkt
4.6 nie obiecuje niczego, czego nie ma. Oba SHOULD-FIX naprawione bez regresji — sprawdziłem
liczniki, odsyłacze wewnętrzne, tabelę rozdz. 3 i listę w rozdz. 6, wszystko spójne. Świeży
przegląd całego dokumentu pod kątem tego samego wzorca błędu (liczby, godziny, cytaty) nie znalazł
żadnego kolejnego przypadku — każda sprawdzalna wartość ma pokrycie w kodzie lub w co najmniej
jednym niezależnym źródle. Dokument jest gotowy do wysłania Ani.
