# 227 — model zamówień partnera i parser XML (PRT-7.1)

> Status: Approved (użytkownik 2026-10-10: „rób wszystko automatycznie, bez pytań") · Gałąź: `claude/peaceful-gates-a8yebr` (wskazana przez środowisko; bez osobnego worktree)

Karta: `docs/karty/PARTNERZY/` · poziom 7 · zależy od 208 (model partnera). Pierwszy ticket zamówień: nie wymaga żadnej zewnętrznej decyzji
(FTP/e-mail, walidacja, Selly to 7.2–7.5).

## Zakres
- Migracja `028_partner_zamowienia.sql`: `partner_zamowienia` (+ `partner_zamowienia_pozycje`). Numer partnera i nasz numer osobno
  (`numer_partnera` NOT NULL, `numer_wlasny` NULL — nadaje go dopiero wysyłka do Selly, 7.5). `UNIQUE(partner_id, numer_partnera)` = idempotencja po `NUMBER`.
- `src/partnerzy/zamowienie-xml.ts`: parser `DOCUMENTORDER` (przykład w `karta.md`). Bez zależności (strumieniowy, odrzuca DOCTYPE/ENTITY — brak XXE
  i „billion laughs”). `CODE` zostaje TEKSTEM (zachowuje zera wiodące, np. `011200284`).
- `src/repos/partnerzy-zamowienia.ts`: `zapiszZamowienie` (idempotentne po `NUMBER`; ponowny plik z tym samym numerem nie tworzy duplikatu, a zmieniona
  treść jest sygnalizowana flagą `zmieniony`, bez nadpisania), `listaZamowien`, `szczegolyZamowienia`.

## Decyzje (wzięte samodzielnie — użytkownik zlecił pracę bez pytań)
- Parser ZGŁASZA tylko błędy strukturalne (zły XML, brak `NUMBER`, brak pozycji, `CODE` pusty, ilość/cena nieliczbowa). Kody nieznane, brak stanu, cena poza
  tolerancją to walidacja BIZNESOWA (7.4) — zamówienie ma wtedy trafić do Selly ze statusem „błąd importu”, więc nie może zginąć w parserze.
- Status zamówienia: `nowe` (domyślny); pozostałe wartości doda 7.4/7.5. Kolumna tekstowa bez CHECK, żeby kolejne tickety nie wymagały przebudowy tabeli.
- `INVOICE` i `DELIVERY` zapisujemy jako płaską mapę JSON (`faktura_json`, `dostawa_json`) — pełny zestaw pól partnera nie jest znany (w karcie „…”);
  do zapytań wyciągamy tylko `kraj_dostawy`. Surowy XML trzymamy (`surowy_xml`) + `skrot_xml` (sha256) do wykrywania zmian.
- Trasy REST poza zakresem (panel zamówień to 7.6); brak wpisu w `openapi.yaml`.

## Kontrakt i fixtures
Brak (nie dotyka kontraktu): nowe tabele i moduł wewnętrzny, żadna istniejąca trasa nie zmienia się. Nazw produktów nie dotyka.

## Testy
`partnerzy.zamowienie-xml.test.ts` (parser: przykład z karty, zera wiodące, encje, CDATA, DOCTYPE odrzucony, błędy strukturalne),
`partnerzy.zamowienia.test.ts` (repo: idempotencja, zmiana treści, kaskada), `db.migracja-028.test.ts`, liczniki w `db.migracje*.test.ts`.

## Poza zakresem
Odbiór (FTP/e-mail), walidacja biznesowa, Selly, panel, numer własny zamówienia.

## Definition of done
- [ ] Parser i repo z testami zielonymi; bramki lint/typecheck/build/test
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR do `develop` `MERGEABLE`
