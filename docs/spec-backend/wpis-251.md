# Wpis 251 — licznik zamówień partnerów

`GET /api/partnerzy` (lista) dokłada do każdego partnera `zamowienia: {lacznie, nowe, doSelly, bledy, wBlokadzie, wyslane}` — zliczenie po `partner_zamowienia.status` jednym `GROUP BY partner_id, status` (`repos/partnerzy.ts` `listaPartnerow`). Statusy spoza listy (`nowe`, `przyjete`, `blad_importu`, `wysylanie`, `wyslane`) liczą się tylko do `lacznie`. Partner bez zamówień ma same zera.
