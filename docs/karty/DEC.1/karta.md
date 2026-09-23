# DEC.1 — runda decyzyjna: jedenaście wiszących wpisów backlogu

> **Stan:** ⬜ gotowe (niezależna od kart kodu — można puścić równolegle)
> **Iteracja:** poza iteracjami (porządki przed cutoverem) · **Wpisy backlogu:** #135.1 (lista), #5, #12, #43, #65, #88, #89, #94, #95, #98, #103, #108 · **Zależy od:** —
> **Ticket:** —

Założona przez koordynatora ticketem `138-DOCS-status-i15`, 2026-09-23, na podstawie wpisu **#135.1**
(ticket 135). Lista i uzasadnienie: `docs/rebuild-backlog/wpis-135.md`; aktualny stan zawsze z
`tools/stan-backlogu.sh --do-decyzji`.

## Zakres
Karta **decyzyjna, nie implementacyjna**. Dla każdego z jedenastu wpisów: ustal stan faktyczny w kodzie na
`develop` (nie z pamięci i nie z opisu wpisu), podaj **rekomendację z uzasadnieniem i kosztem**, a decyzję
zbierz od użytkownika. Wynik zapisz w polu „Do nowej wersji?" i „Status" każdego wpisu.
Wpisy, które okażą się już rozstrzygnięte w kodzie (kandydat: **#5**), zamknij od razu z dowodem.

⚠ **Nie implementujesz napraw.** Jeśli decyzja brzmi „naprawiamy", zaproponuj koordynatorowi kartę
i zapisz to w „Do koordynatora" — implementacja idzie osobnym ticketem.

Dwa wpisy prawdopodobnie tanie (z #135.1): **#5** (wygląda na rozstrzygnięty) i **#43** (kontrakt nie zna
kodów 403/404/409, a od ticketu 129 doszły cztery trasy celowo oddające 409 — luka w GATE się pogłębiła).
Dwa wpisy czekają na Anię, nie na nas: **#108** (przegląda listę sklejonych opon) i **#89** (pole „priorytet").

## Pliki (wyłączna własność)
`docs/rebuild-backlog.md` i `docs/rebuild-backlog/**` (pola decyzji i statusu), `docs/karty/DEC.1/karta.md`,
`docs/tickets/<ID>/**`. Zero zmian w `rebuild/` i w `contract/`.

## Decyzje
—

## Dowiezione
—

## Do koordynatora
—
