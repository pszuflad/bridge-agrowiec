# Wpis 209 — REST ustawień partnera B2B

Ticket `209-FEATURE-partnerzy-crud` (PRT-1.3). **Nowa funkcjonalność, trasy poza `openapi.yaml`** (jak `/api/ean-pary`).

`GET/POST /api/partnerzy`, `GET/PUT /api/partnerzy/:id`, `PUT /api/partnerzy/:id/aktywny` (`{aktywny}`), `PUT …/magazyny`
(`{magazyny[]}`), `PUT …/wykluczenia` (`{kody[]}`), `PUT/DELETE …/kraje/:kraj`. Nowy partner jest nieaktywny; nie ma usuwania.
Zestawy magazynów i wykluczeń są zastępowane w całości (transakcja). Kurs ręczny kraju wymaga `kursReczny > 0`. Błędy: `{error}`
(400 walidacja, 404 brak partnera/kraju, 409 zajęta nazwa). Akcje w `audit_log`: `partner_dodany|zmieniony|aktywowany|dezaktywowany|magazyny|wykluczenia|kraj|kraj_usuniety`.
