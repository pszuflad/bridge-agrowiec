# 62-DOCS — naniesienie trzech decyzji użytkownika po karcie 14j

> Status: **Approved** (decyzje wydane wprost w rozmowie 2026-09-18) → Implemented → Shipped
> Branch: `docs/62-decyzje-po-i14j` (gałąź NAD `chore/59-i14j-oracle-diff-historii`)
> Worktree: `.worktrees/62-DOCS-decyzje-po-i14j`

## Opis ticketa

Karta `59-CHORE-i14j` zamknęła się raportem, który postawił trzy pytania. Użytkownik
odpowiedział na wszystkie trzy w rozmowie 2026-09-18:

1. **Eksport ZIP (defekt produkcji, HTTP 500):** *„oczywiście zostajemy przy działającej wersji"*.
2. **Instrukcja I5 z martwej gałęzi:** *„przenieśmy treść do aktualnej instrukcji"*.
3. **Limit `LIMIT_AUDYTU = 5000`:** *„zróbmy na razie tak jak jest, że jest 5 tysięcy i tyle"*.

Ta karta nanosi te trzy decyzje na dokumentację. **Zero kodu** — żadna z decyzji zmiany kodu
nie wymaga (to kluczowe ustalenie: odbudowa już zachowuje się tak, jak użytkownik zdecydował).

## Dlaczego gałąź nad 59, a nie od `develop`

Wpis backlogu **#87** i podblok roadmapy **14j** powstały w PR #74 i **nie są jeszcze
zmergowane**. Gałąź od `develop` nie widziałaby ich, a obie te rzeczy trzeba tu zmodyfikować —
skończyłoby się trzecim z rzędu konfliktem na `docs/rebuild-backlog.md` i `docs/rebuild-roadmap.md`.
Stacked PR (baza = `chore/59-i14j-oracle-diff-historii`) usuwa problem; po merge'u #74 GitHub
przestawi bazę na `develop` sam.

## Decisions

- **D1 — eksport ZIP: ✅ NIE odtwarzamy defektu.** Wpis backlogu **#88**, decyzja użytkownika.
  Kodu nie ruszamy: odbudowa działa, bo deklaruje `archiver: ^8.0.0`, a produkcja ma w lockfile
  `archiver@5.3.2` bez `ZipArchive`. **Osobna karta implementacyjna jest zbędna** — to był jedyny
  powód, dla którego raport 14j ją proponował.
- **D2 — instrukcja I5: odzyskujemy i poprawiamy.** Treść wnosimy do `docs/`, z poprawkami §3.3,
  §8.2, §9, §11 pkt 9, §12 i §13.
- **D3 — limit 5000: ❌ zostaje.** Wpis #87 zmienia się z ⬜ na ❌ wraz z uzasadnieniem i warunkiem
  powrotu do tematu (próg albo rozstrzygnięcie #21).

## ⚠ Ustalenie z trakcie realizacji: gałąź instrukcji ZNIKNĘŁA Z `origin`

Raport 14j podawał, że instrukcja leży na `origin/docs/instrukcja-testow-i5`. **W momencie
realizacji tej karty tej gałęzi na `origin` już nie było** (`git ls-remote --heads origin` — zero
trafień). Treść odzyskano z **wiszącego lokalnie** commita `322a176`; kontrola: `4ea3b92` ma
identyczną sumę MD5 (`f7e37f91…`), więc obie wersje niosły ten sam plik. Dokument był o jeden
`git gc` od bezpowrotnego zniknięcia i **nikt by tego nie zauważył**.

## Implementation plan

1. `docs/instrukcja-testow-I5.md` — wniesienie treści (325 linii) + sześć poprawek merytorycznych.
2. `docs/rebuild-backlog.md` — #87 na ❌ z uzasadnieniem; nowy wpis #88.
3. `docs/rebuild-roadmap.md` — trzy noty w podbloku 14j przestają być otwarte.
4. `docs/pytania-do-ani-2026-09-18.md` — pytanie 5.3 przestaje być pytaniem (wynik pomiaru).

## Out of scope

- Jakakolwiek zmiana kodu — żadna z trzech decyzji jej nie wymaga.
- Zgłoszenie defektu eksportu ZIP do produkcji Ani — świadomie odłożone, nie blokuje cutoveru.
- Pytanie **#21** (czy Historia ma pokazywać importy z URL) — **nadal otwarte**, czeka na Anię
  w `docs/pytania-do-ani-2026-09-18.md` §5.1. Tej karty nie dotyczy.
- Artefakty karty 59 (`docs/tickets/59-*/`) — zostają jako zapis historyczny tamtego pomiaru.

## Definition of done

- [ ] `docs/instrukcja-testow-I5.md` istnieje w repo i nie zawiera nieprawdziwych obietnic
- [ ] Backlog #87 = ❌, #88 = ✅, numeracja bez duplikatów
- [ ] Roadmapa nie zostawia następnej sesji pytań, na które padła już odpowiedź
- [ ] Bramki backendu zielone (karta docs-only, ale gałąź niesie kod z 59 i 58)
