# Wpisy — jeden plik na ticket, zero wspólnych linii

Ten katalog istnieje po to, żeby **równoległe zadania nie konfliktowały we wspólnych dokumentach**
(roadmapa, specyfikacja, backlog). Wzorzec sprawdzony w projekcie Bridge: siedem konfliktów
merge'a w jednej roadmapie w ciągu czterech dni zniknęło po przejściu na „oś podziału = PLIK".

## Dlaczego

Każdy wspólny dokument ma **punkty zbiorowego dopisywania**: koniec listy, koniec sekcji, jedna
gigantyczna linia statusu, sąsiednie wiersze tabeli. Dwa zadania piszące w to samo miejsce = konflikt
(git traktuje zmiany w SĄSIEDNICH liniach jak konflikt). Do tego numeracja „następny numer po #N":
dwa zadania biorą ten sam.

## Reguła

- Ticket, który ma do zapisania nowe ustalenie, tworzy **NOWY plik**
  `docs/wpisy/<kategoria>/wpis-<N>.md` (`N` = numer ticketu z Kroku 4 skilla `/feature`,
  unikalny z atomowej rezerwacji). Dwa tickety nigdy nie tworzą tego samego pliku — konflikt jest
  **niemożliwy**, a nie tylko rzadszy.
- Identyfikator wpisu wewnątrz pliku: `#<ticket>.<kolejny>` (`#128.1`, `#128.2`) — numeracja lokalna.
- **Nie dopisujesz nowych akapitów na końcu wspólnych dokumentów.** Ich końce mają stały wskaźnik
  na ten katalog i on się nie zmienia.
- **Wolno poprawiać w miejscu** zdanie, które ticket obalił (fałsz ma zniknąć, nie stać obok sprostowania).
- Plik wpisu jest **własnością ticketu, który go stworzył**. Późniejszy ticket, który obala wpis,
  pisze własny `wpis-<M>.md` z odnośnikiem. Wyjątek: pojedyncza linia decyzji/statusu w tabeli wpisu.

## Kategorie (przykłady — dopasuj do projektu)

| Katalog | Co trafia |
|---|---|
| `docs/wpisy/spec/` | nowe ustalenia o zachowaniu systemu (zamiast dopisków w specyfikacji) |
| `docs/wpisy/backlog/` | nowe pozycje backlogu, listy „pominięte", podsumowania partii |
| `docs/wpisy/karty/<ID>/` | ustalenia dla PRZYSZŁEJ karty/zadania nadrzędnego (`wejscie-<N>.md`) |

## Tryb „koordynator + karty" (opcjonalny, dla dużych fal równoległej pracy)

- **Koordynator** = sesja, która planuje falę i pisze prompty do kart. Tylko on edytuje roadmapę.
  Przed wydaniem promptów zakłada `docs/karty/<ID>/karta.md` dla KAŻDEJ karty fali i merguje to do
  `{{BAZA}}` (ticket `DOCS`). Karty branchują z bazy, która już ma ich pliki.
- **Karta** pisze wyłącznie: własne `karta.md` (linia `> **Stan:** …`, sekcja „Dowiezione" =
  stan FAKTYCZNY, nie zamiar), nowe `wejscie-<N>.md` dla przyszłych kart, nowe `wpis-<N>.md`.
  Fałsz w roadmapie lub cudzej karcie → sekcja „Do koordynatora" we własnym `karta.md`.
- Stan kart nie jest przepisywany do tabeli — składa go skrypt czytający linie `> **Stan:**`.

Szablon `karta.md`:

```markdown
# <ID> — <tytuł>

> **Stan:** ⬜ gotowe do startu
> **Iteracja:** <n> · **Zależy od:** <ID…>
> **Ticket:** —

## Zakres
## Pliki (wyłączna własność)
## Decyzje
## Dowiezione
## Do koordynatora
```

Postaci `Stan`: `⬜ <gotowe | po X>` · `🔨 ticket <N>` · `✅ <data> · <ticket>` · `⏸ <powód>` · `❌ skasowana — <powód>`.

## Szablon `wpis-<N>.md`

```markdown
# Wpis (<kategoria>) od ticketu <N> · <RRRR-MM-DD>

**Sekcja:** <czego dotyczy>.

**Potwierdzone w <N>** (`<TICKET-ID>`, <data>): <fakt, dowód plik:linia / pomiar, co system robi
tak samo, a co świadomie inaczej>. Szczegóły: `docs/tickets/<TICKET-ID>/`.
```

## Czytanie

Pełna wiedza = dokument główny + wszystkie pliki z katalogu, najnowsze na końcu:

```bash
ls docs/wpisy/spec/wpis-*.md | sort -t- -k2 -n
```

Stare wpisy **nie są przenoszone** z dokumentów głównych — przeniesienie tekstu spod zadań w toku
dałoby im dokładnie ten konflikt, któremu reguła ma zapobiec.
