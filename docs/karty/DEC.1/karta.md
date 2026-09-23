# DEC.1 — runda decyzyjna: wpisy backlogu wiszące bez decyzji

> **Stan:** 🔨 ticket 141
> **Iteracja:** poza iteracjami (porządkowa) · **Wpisy backlogu:** #135.1 (zakładający), #5, #12, #43, #65, #88, #89, #94, #95, #98, #103, #108, #137.1, #137.2 · **Zależy od:** I15.4b (domknięta)
> **Ticket:** 141 (`141-DOCS-runda-decyzyjna-backlog`)

Karta założona przez ticket 141 — koordynator jej nie założył przed wydaniem promptu.
Typ: DOCS/decyzje. **ZERO zmian w `rebuild/` i w `contract/`.**

## Zakres
Przejść wpis po wpisie przez wszystko, co `tools/stan-backlogu.sh --do-decyzji` pokazuje jako
⬜ bez decyzji, ustalić **stan faktyczny w kodzie na `develop`** (nie z opisu wpisu), napisać
rekomendację z kosztem, zebrać decyzję użytkownika i zapisać ją w polach `Do nowej wersji?`
i `Status`. **Bez implementacji napraw** — z decyzji „naprawiamy" powstaje propozycja karty
w sekcji „Do koordynatora".

## Pliki (wyłączna własność)
- `docs/karty/DEC.1/karta.md`
- `docs/rebuild-backlog.md` — wyłącznie linie `Do nowej wersji?` / `Status` rozstrzyganych wpisów
- `docs/rebuild-backlog/wpis-135.md`, `docs/rebuild-backlog/wpis-137.md` — j.w.
- `docs/tickets/141-DOCS-runda-decyzyjna-backlog/**`

NIE: `rebuild/**`, `contract/**`, `docs/rebuild-roadmap.md`, karty innych kart.

## Lista rozstrzygana — korekta wobec promptu
Prompt mówił o **jedenastu** wpisach (za `#135.1`, stan na `ba4667d`). Na `develop` w chwili
startu karty (`ab30674`) narzędzie pokazuje **czternaście**: doszły `#137.1` i `#137.2`
(ticket 137, zmergowany po napisaniu promptu) oraz sam `#135.1`, który też ma ⬜ i domyka się
dopiero tą kartą. Lista wzięta z narzędzia, zgodnie z poleceniem.

## Stan faktyczny — ustalenia (dowody)
<wypełniane w trakcie>

## Decyzje
<decyzje użytkownika z datą — wypełniane po rundzie>

## Dowiezione
<wypełnia karta przy zamknięciu>

## Do koordynatora
<propozycje kart z decyzji „naprawiamy" + fakty do przeniesienia do roadmapy>
