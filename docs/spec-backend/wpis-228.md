# Wpis 228 — zamówienia partnerów: model i parser XML

Ticket `228-FEATURE-partnerzy-model-zamowien` (PRT-7.1). Nowa funkcjonalność, nie odtworzenie produkcji.

- Migracja `028_partner_zamowienia.sql`: `partner_zamowienia` (numer partnera i `numer_wlasny` osobno; `numer_wlasny` jest NULL do czasu wysyłki do sklepu) oraz
  `partner_zamowienia_pozycje`. `UNIQUE(partner_id, numer_partnera)` = idempotencja po `NUMBER`.
- `src/partnerzy/zamowienie-xml.ts`: parser `DOCUMENTORDER` bez zewnętrznej biblioteki; DOCTYPE/ENTITY odrzucane (XXE). `CODE` jest tekstem (zera wiodące znaczą).
  Parser zgłasza tylko błędy strukturalne; kody nieznane, brak stanu i cena poza tolerancją to walidacja biznesowa (PRT-7.4).
- `src/repos/partnerzy-zamowienia.ts`: `zapiszZamowienie` (ponowny plik z tym samym numerem nie tworzy duplikatu; zmienioną treść zgłasza flagą `zmieniony`,
  nie nadpisuje), `listaZamowien`, `szczegolyZamowienia`. Brak tras REST (panel zamówień to PRT-7.6) i brak wpisu w `openapi.yaml`.
