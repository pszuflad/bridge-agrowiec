# Karty — jeden katalog na kartę, zero wspólnych linii

Ten katalog istnieje po to, żeby **równoległe karty nie konfliktowały w `docs/rebuild-roadmap.md`**.
Wprowadzony ticketem `82-DOCS-roadmapa-bez-konfliktow` (2026-09-21).

## Dlaczego

Siedem merge'ów z konfliktem w roadmapie (2026-09-18…21, odtworzone `git show --remerge-diff`)
wpadało w jeden z trzech wzorców — wszystkie biorą się z tego, że **dwie karty piszą w tym samym
miejscu wspólnego pliku**:

1. **Sąsiednie wiersze tabeli** — każda karta przestawia „Stan” w swoim wierszu tabeli kart
   (`| P7.1 |`, `| P7.2 |`…). Git traktuje zmiany w SĄSIEDNICH liniach jak konflikt, nawet gdy
   dotyczą różnych kart (`6d34eea`, `354af5f`, `a2040ea`).
2. **Dopisek w tym samym punkcie** — dwie karty dopisują akapit na końcu tej samej sekcji
   („Dla P7.4…”, „Dla PR.5…”, „P7.1 dowieziona…”); oba wstawienia trafiają w to samo miejsce
   (`941f60d`, `6d34eea`, `10944e0`, `92fb310`).
3. **Jedna gigantyczna linia** — wiersz iteracji w §4 roadmapy, w którym każda karta dopisuje
   swój status (`81787c8`, `a2040ea`).

Reguła „oś podziału = PLIK” działała w kodzie, ale nie obejmowała dokumentacji. Ten katalog
rozciąga ją na dokumentację: **każda karta pisze tylko w plikach, których jest właścicielem.**

## Struktura

```
docs/karty/
  README.md                ← ten plik
  P7.4/
    karta.md               ← zakres, decyzje, pliki, Stan, Dowiezione — właściciel: karta P7.4
    wejscie-74.md          ← ustalenie DLA P7.4 zapisane przez ticket 74 (karta P7.1)
    wejscie-78.md          ← ustalenie DLA P7.4 zapisane przez ticket 78 (karta P7.2)
  PR.3/
    karta.md
    wejscie-76.md          ← „007 zajęte, bierz 008” — jeden plik zamiast dwóch akapitów w roadmapie
```

Katalog nazywa się **identyfikatorem karty** (`P7.4`, `PR.3`, `14f`…), nie numerem ticketa —
karta istnieje, zanim dostanie ticket. Plik wejścia nazywa się **numerem ticketa, który go pisze**
(`wejscie-<N>.md`), więc dwie karty nigdy nie tworzą tego samego pliku.

## Kto pisze gdzie — tabela własności

| Miejsce | Kto pisze | Kiedy |
|---|---|---|
| `docs/karty/<ID>/karta.md` | **koordynator** zakłada; potem **wyłącznie karta `<ID>`** | koordynator: przy planowaniu fali · karta: przy „sync docs” |
| `docs/karty/<ID>/wejscie-<N>.md` | **wyłącznie ticket `<N>`** — zawsze NOWY plik, nigdy edycja cudzego | gdy ticket `<N>` ustali coś dla przyszłej karty `<ID>` |
| `docs/rebuild-roadmap.md` §4 (tablica postępu) | **tylko koordynator** | przy planowaniu fali i po jej zamknięciu |
| `docs/rebuild-roadmap.md` §5 — tabela kart iteracji, podsumowanie iteracji, decyzje całej iteracji | **tylko koordynator** (albo karta zamykająca iterację, jeśli ostatnia i idzie SAMA) | j.w. |
| `docs/rebuild-roadmap.md` §0–§3 | koordynator | rzadko |
| `docs/rebuild-backlog.md` — wpis `#N` | karta, która realizuje `#N` | przy „sync docs” (każdy wpis to osobny blok, więc konfliktuje rzadko) |
| `docs/spec-backend/wpis-<N>.md` | **wyłącznie ticket `<N>`** — zawsze NOWY plik | przy „sync docs”, gdy ticket ustalił coś o backendzie (od ticketu 91; `docs/spec-backend/README.md`) |
| `docs/spec-backend.md` | nikt nie dopisuje nowych akapitów; poprawka w miejscu obalonego zdania — ticket, który je obalił | przy „sync docs” |

**Koordynator** = sesja, która planuje falę i pisze prompty do równoległych kart (nie jest
kartą, nie ma własnego ticketa-feature'a; jeśli zmienia pliki, robi to własnym ticketem `DOCS`).

**Karta w roadmapie nie pisze NIC.** Jeśli karta uważa, że w roadmapie jest fałsz albo trzeba coś
dopisać na poziomie iteracji — zapisuje to w sekcji „Do koordynatora” swojego `karta.md`
(albo w `raport.md` ticketa), a koordynator przenosi to do roadmapy przy najbliższym przeglądzie.

## Przepływ fali

1. **Koordynator planuje falę** — ticket `DOCS`: zakłada `docs/karty/<ID>/karta.md` dla KAŻDEJ
   karty fali (szablon niżej), dopisuje karty do tabeli iteracji w roadmapie (kolumny bez
   „Stan”) i ewentualnie wiersz §4. PR → merge do `develop`.
2. **Dopiero potem** koordynator wydaje prompty. Karty branchują z `develop`, który już ma ich
   `karta.md` — więc każda karta tylko EDYTUJE własny plik, nie tworzy wspólnego szkieletu.
3. **Karta przy „sync docs”** (`.claude/commands/feature.md` Krok 13):
   - w `docs/karty/<własne ID>/karta.md`: linia `> **Stan:**`, sekcja „Dowiezione”, usuwa z pliku
     to, co ticket obalił;
   - dla każdej PRZYSZŁEJ karty, której coś ustaliła: NOWY plik `docs/karty/<jej ID>/wejscie-<N>.md`;
   - dla przeczytanych wejść: nic nie kasuje (historia), ale w „Dowiezione” pisze, które rozliczyła;
   - wpisy `#N` w backlogu, które zrealizowała.
4. **Koordynator po fali** — przegląda `tools/stan-kart.sh`, odświeża §4 i podsumowanie iteracji
   w roadmapie, planuje następną falę.

Tak ułożone, dwie karty tej samej fali **nie mają ani jednej wspólnej linii** w `docs/` — konflikt
w roadmapie przestaje być możliwy, a nie tylko mniej prawdopodobny.

## Jak sesja czyta swoją kartę

```bash
cat docs/karty/P7.4/*.md          # karta + wszystkie wejścia od innych kart
tools/stan-kart.sh                 # stan wszystkich kart (generowany, nie pisany ręcznie)
tools/stan-kart.sh P7              # tylko karty Iteracji 7
```

Stan kart NIE jest przepisywany ręcznie do żadnej tabeli — jedynym źródłem jest linia
`> **Stan:**` w `karta.md`, a widok składa `tools/stan-kart.sh`.

## Szablon `karta.md`

```markdown
# P7.4 — delta instrukcji I7 dla Ani

> **Stan:** ⬜ gotowe do startu
> **Iteracja:** 7 — Atrybuty · **Wpisy backlogu:** — · **Zależy od:** P7.1, P7.2, P7.3, P7.5
> **Ticket:** —

## Zakres
<co karta robi; co Ania kliknie>

## Pliki (wyłączna własność)
<lista — gwarancja rozłączności z kartami tej samej fali>

## Decyzje
<podjęte przez użytkownika przed startem, z datą>

## Dowiezione
<wypełnia karta przy zamknięciu: faktyczny zakres, odstępstwa od planu, ticket, data>

## Do koordynatora
<ustalenia na poziomie iteracji/roadmapy — koordynator przeniesie je do roadmapy>
```

Linia `> **Stan:**` ma jedną z postaci: `⬜ <gotowe | po X>` · `🔨 ticket <N>` ·
`✅ <data> · <ticket>` · `⏸ <powód>` · `❌ skasowana — <powód>`. Skrypt czyta ją dosłownie.

## Szablon `wejscie-<N>.md`

```markdown
# Wejście dla P7.4 od ticketu 78 (P7.2) · 2026-09-21

<fakt, dowód (plik:linia / pomiar), co karta P7.4 ma z nim zrobić>
```

## Migracja — stan i etap 2

**Etap 1 (ticket 82, 2026-09-21) — zrobiony:** ten katalog, `tools/stan-kart.sh`, reguły w
`CLAUDE.md`, `.claude/commands/feature.md` (Krok 13), `.claude/agents/doc-checker.md` i §0
roadmapy. Treść istniejących kart NIE została przeniesiona, bo w chwili wprowadzenia w toku
były cztery karty planu P (tickety 77, 79, 80, 81), które swoje „sync docs” robią jeszcze
w roadmapie — przeniesienie tekstu spod nich dałoby każdej z nich dokładnie ten konflikt,
któremu ta zmiana ma zapobiec.

**Okres przejściowy (zakończony etapem 2):** karty, które wystartowały PRZED ticketem 82, kończą po staremu (piszą
w roadmapie). Karty startujące PO nim piszą już tylko w `docs/karty/`. Jeśli karta nie ma
jeszcze `karta.md`, zakłada go sama przy „sync docs” (nowy plik = zero konfliktu), przepisując
zakres z tabeli planu P; wiersza w tabeli roadmapy NIE rusza — stan widać w `tools/stan-kart.sh`.

**Etap 2 (ticket 86, 2026-09-21) — zrobiony:**
- karty otwarte planu P przeniesione z roadmapy do katalogów: **P10.1–P10.4, PR.1–PR.6**; noty „Dla X…”
  rozpisane na pliki wejść (`PR.3/wejscie-76.md`, `PR.3/wejscie-77.md`, `PR.5/wejscie-78.md`, oraz
  nowe `PR.6/wejscie-77.md` — nota z raportu ticketu 77, której w roadmapie nie było);
- w roadmapie tabele Iteracji 10 i przeglądu 12 widoków to już tylko spis (bez kolumny „Stan”,
  z linkiem do katalogu), a tablica §4 ma krótkie wiersze + wiersz „P” dla planu poprawek;
- **nie przeniesione, celowo:** **P6.3** — ticket 85 (PR #99) sam zakłada `P6.3/karta.md` według
  nowych reguł, więc założenie go tutaj dałoby konflikt dwóch nowych plików; **P7.4** — ticket 79
  (PR #100) wystartował przed ticketem 82 i zamyka kartę po staremu, w sekcji Iteracji 7 roadmapy,
  której ten ticket nie ruszał;
- tabele kart zamkniętych (Iteracje 5, 6, 7, 9) zostają w roadmapie jako historia; wiersze P6.3 i
  P7.4 odświeża koordynator po merge'u #99 i #100.

Od tego ticketu **każda nowa karta dostaje katalog od razu przy planowaniu** (koordynator, patrz
„Przepływ fali”) — okres przejściowy się skończył.
